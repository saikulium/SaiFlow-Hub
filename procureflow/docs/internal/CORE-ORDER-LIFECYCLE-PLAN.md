# Core Order Lifecycle Hardening — Piano Architetturale

> **Branch**: `feat/core-order-lifecycle`
> **Data**: 2026-04-20
> **Stato**: Piano approvato — Fase 0 in chiusura, attesa OK per Fase 1.

---

## 1. Stato attuale

L'analisi del Core ha rilevato **cinque lacune strutturali** sul ciclo di vita
degli ordini fornitore, emerse durante la validazione Faleni SRL ma tutte
imputabili al Core, non a personalizzazioni cliente.

### 1.1 Discrepanze per riga non strutturate

Le variazioni di prezzo/data vengono salvate come JSON freeform nel campo
`PriceVarianceReview.items` ([prisma/schema.prisma](../../prisma/schema.prisma)
modello `PriceVarianceReview`). Conseguenze:

- Non interrogabili via SQL / Prisma sui singoli line-item.
- Nessuna FK verso `RequestItem`: se un articolo cambia nome o viene rimosso,
  la discrepanza non aggiorna il suo riferimento.
- Impossibile costruire report aggregati (es. "media delta prezzo per vendor").

### 1.2 Data di consegna scalare a livello richiesta

`PurchaseRequest.expected_delivery`
([prisma/schema.prisma:198](../../prisma/schema.prisma)) è un singolo
`DateTime` per l'intera richiesta. In pratica i fornitori confermano date
diverse per ciascuna riga (split shipments, lead time eterogenei).

Tutti i reader attuali (analytics, compliance monitor, inventory tools,
weekly report) leggono il campo scalare: almeno **8 call-site** da ri-puntare.

### 1.3 Accettazione variance non propaga i prezzi

[src/app/api/price-variance/[id]/route.ts:60-90](../../src/app/api/price-variance/[id]/route.ts)
ribalta solo lo status della review e scrive un `TimelineEvent`. **`RequestItem.unit_price` non viene mai aggiornato**: il DB resta con il prezzo originale,
l'importo totale della richiesta non rispecchia l'accettazione, gli analytics
continuano a ragionare su valori obsoleti.

### 1.4 Conferme d'ordine indistinguibili da altri allegati

Non esiste un'entità dedicata. Gli ack dei fornitori confluiscono come righe
`Attachment` generiche, senza stato, senza parsing strutturato, senza
collegamento alle variance. Unica traccia "semi-strutturata" è
`PriceVarianceReview`, ma solo se l'AI ha rilevato un delta prezzo.

### 1.5 PDF persi nel path webhook/n8n

L'AI agent supporta già upload PDF via Anthropic Files API
([src/modules/core/email-intelligence/server/email-intelligence.agent.ts:630](../../src/modules/core/email-intelligence/server/email-intelligence.agent.ts)),
ma funziona **solo** tramite `/api/email-import` (upload manuale).

Il path n8n → `/api/webhooks/email-ingestion` hardcoda
`attachments: []` al nodo merge
([n8n/email-ingestion.json](../../n8n/email-ingestion.json)); lo schema Zod
`emailAttachmentSchema`
([src/modules/core/email-intelligence/validations/email-ingestion.ts:33-44](../../src/modules/core/email-intelligence/validations/email-ingestion.ts))
accetta già metadata + URL, ma nessuno li scarica e li inoltra al modello.

---

## 2. Proposta architetturale

### A — Discrepanze per riga strutturate

Nuova entità **`OrderConfirmationLine`** con:

- `request_item_id` FK (nullable, `onDelete: SetNull` — preserva storia se
  la riga viene eliminata dal requester).
- Snapshot dei valori originali (`original_unit_price`,
  `original_quantity`, `original_expected_delivery`) + dei valori confermati
  (`confirmed_unit_price`, `confirmed_quantity`, `confirmed_delivery`).
- Campi derivati `price_delta_pct`, `delivery_delay_days` calcolati in
  `create()`.

Zero JSON per dati strutturali: ogni variazione è una riga interrogabile.

### B — Date di consegna per riga

Tre nuovi campi **nullable** su `RequestItem`:

- `expected_delivery` (data attesa dal requester).
- `confirmed_delivery` (data confermata dal fornitore).
- `actual_delivery` (data reale — aggiunta ora per evitare una seconda
  migrazione quando shipperà il modulo goods-receipt).

`PurchaseRequest.expected_delivery` resta come fallback a livello richiesta.
Un helper `getEffectiveDeliveryDate(item, request)` centralizza la logica
"item-level → PR-level" e sostituirà progressivamente gli 8 read-site.

Nessun backfill dei dati esistenti: i campi sono nullable, l'helper legge il
PR-level se l'item non ha data propria. Scenari di consegna parziale
(multi-shipment per singola riga) restano fuori scope.

### C — Aggiornamento prezzi in transazione

Nuovo servizio `applyConfirmation({confirmationId, userId, acceptedLineIds, notes})`
che esegue in un solo `prisma.$transaction`:

1. Legge confirmation + righe selezionate con nested `request_item`.
2. Per ogni riga accettata: update `RequestItem.unit_price`, ricalcola
   `total_price = quantity × unit_price`, scrive `confirmed_delivery`.
3. Aggiorna status confirmation → `APPLIED`, stamp `applied_at`/`applied_by`.
4. Crea `TimelineEvent` con diff nelle metadata.
5. Chiama `writeAuditLog` (entityType `OrderConfirmation`, action `UPDATE`).
6. **Idempotency**: rifiuta con errore esplicito se status ∉ {`RECEIVED`,
   `PARSED`, `ACKNOWLEDGED`}.

Nessuna esecuzione parziale: un errore su una riga rollbacka l'intera
transazione (test di iniezione failure previsto in Fase 2).

### D — `OrderConfirmation` come entità di primo livello

Nuovo modello 1:N con `PurchaseRequest` (una PR può ricevere più conferme —
revisioni, ack parziali). Macchina a stati:

```
RECEIVED → PARSED → ACKNOWLEDGED → APPLIED  (terminale)
                                 ↘ REJECTED (terminale)
```

- `source` enum: `EMAIL | WEBHOOK | MANUAL | IMPORT` — permette analytics
  sul canale d'ingresso.
- FK opzionale a `EmailLog` per traceability end-to-end.
- Riuso `Attachment` con nuova FK nullable `order_confirmation_id` (niente
  sotto-tabella dedicata questa sprint).

**`PriceVarianceReview`** non viene rimosso. Aggiunta una annotation
`/// @deprecated` nello schema e rimozione del tool AI
`create_price_variance_review` dal system prompt del branch CONFERMA_ORDINE/
VARIAZIONE_PREZZO. Il componente `PriceVarianceBanner` resta per i record
storici; una sprint follow-up (1–2 iterazioni dopo) rimuoverà l'intero path
legacy.

### E — PDF ingestion via webhook

Lo schema Zod `emailAttachmentSchema` già accetta
`[{filename, url, mime_type, file_size}]`. La gap è il **download lato server
prima della chiamata al modello**.

Nuovo helper `fetchAttachmentBytes(url, opts)` in
`email-intelligence/server/`:

- Timeout 5s.
- Size cap 10MB (abort se `Content-Length` > soglia).
- MIME allowlist: solo `application/pdf`.
- Fail-soft: se il download fallisce, warning in log + proseguimento senza
  attachment (l'agent lavora sul testo email).

I byte scaricati passano all'Anthropic Files API usando la stessa path già
attiva in [email-intelligence.agent.ts:630](../../src/modules/core/email-intelligence/server/email-intelligence.agent.ts).

L'update del workflow n8n stesso resta **documentato, non applicato** in
`docs/internal/n8n-workflow-update-required.md` (il workflow è gestito da
ops, non dal repo).

---

## 3. Ordine di esecuzione

| Fase | Contenuto | Uscita |
|------|-----------|--------|
| 0 | Plan doc + branch setup | Questo documento + branch `feat/core-order-lifecycle` su main pulito |
| 1 | Schema migration (DB-only, nessuna logica) | Migration reversibile + `npx prisma generate` + tsc/vitest verdi |
| 2 | Service layer + test (no API/UI) | `order-confirmation.service.ts` con create/compute/apply/reject, ≥6 unit test, 1 integration test end-to-end, 1 idempotency test |
| 3 | API routes + componente UI | 4 route sotto `withApiHandler`, `OrderConfirmationReview` integrato in PR detail page, manual-test script |
| 4 | Email intelligence + webhook attachment | Tool `create_order_confirmation`, aggiornamento system prompt, `fetchAttachmentBytes` wired, doc n8n |
| 5 | README, CHANGELOG, final report | Modulo documentato, changelog Unreleased aggiornato, report finale a chat — NO merge |

**Ogni fase termina con un checkpoint hard e STOP per OK utente.**

---

## 4. Rischi identificati

| Rischio | Impatto | Mitigazione |
|---------|---------|-------------|
| `applyConfirmation` fallisce a metà e corrompe i prezzi articolo | Dati inconsistenti su PR reali | `prisma.$transaction` stretta; test di rollback con failure iniettato |
| Reader esistenti di `PurchaseRequest.expected_delivery` si rompono se spostati per riga | Regressioni silenziose in analytics/compliance | PR-level NON viene rimosso; helper `getEffectiveDeliveryDate` fa fallback |
| Backfill dei date scalari verso le righe è distruttivo | Perdita date storiche | **Nessun backfill**: campi nuovi nullable, helper legge PR come fallback |
| Download attachment da webhook va in timeout o OOM | Webhook lento, memory spike su PDF grandi | Timeout 5s, size cap 10MB, MIME-filter PDF, fail-soft |
| L'agent AI chiama sia `create_price_variance_review` che `create_order_confirmation` sulla stessa email | Record duplicati su PR | System prompt aggiornato: "preferire `create_order_confirmation` per CONFERMA_ORDINE e VARIAZIONE_PREZZO; l'altro è deprecato" |
| Double-render `PriceVarianceBanner` + `OrderConfirmationReview` sullo stesso record | Confusione utente | PR detail page: banner legacy mostrato solo se `PriceVarianceReview PENDING` **AND** nessuna `OrderConfirmation` per stesso `email_log_id` |
| Migrazione lenta su tabella grande in prod | Lock su `request_items` | Colonne nullable senza default → Postgres esegue come metadata-only (istantaneo) |
| La deprecation annotation nello schema viene ignorata dai dev | Continuo uso del tool legacy | Runtime `console.warn` one-shot nel builder del tool `create_price_variance_review` |

---

## 5. Cosa NON è in scope

- **Defense Pack**: modulo Offer, codici multi-livello Leonardo.
- **Customizzazioni Faleni**: connettori SAP Ariba / SupplyOn.
- **Modifiche n8n applicate**: solo documentazione della change richiesta.
- **Rimozione `PriceVarianceReview`**: solo deprecation; delete in sprint futura.
- **Refactor degli intent del classificatore email**.
- **Logica goods-receipt**: campo `actual_delivery` aggiunto preventivamente
  ma non scritto dal sistema.
- **Nuovi provider email**: no Resend inbound, no IMAP nativo.
- **Scenari partial-shipment per singola riga**: una riga = una data, niente
  schedule multi-data.
- **Backfill dei dati storici** di `PurchaseRequest.expected_delivery` verso
  le righe.

---

## 6. Stima effort per fase

| Fase | Effort | Note |
|------|--------|------|
| 0 | 0.5 gg | Plan doc + branch setup; deliverable è questo documento |
| 1 | 0.5 gg | Schema + migrazione + regenerate client |
| 2 | 2.0 gg | Service + test; la transazionalità richiede cura |
| 3 | 1.5 gg | 4 API route + componente React + wiring PR detail |
| 4 | 1.5 gg | Tool AI + tuning prompt + pipeline attachment |
| 5 | 0.5 gg | Docs, changelog, cleanup |
| **Totale** | **~6 gg** | Allineato con la stima originale "6-8 giornate" |

---

## 7. File critici

### Da creare

- [prisma/migrations/`<ts>`_core_order_lifecycle/migration.sql](../../prisma/migrations/)
- [src/modules/core/requests/server/order-confirmation.service.ts](../../src/modules/core/requests/server/)
- [src/modules/core/requests/__tests__/order-confirmation.service.test.ts](../../src/modules/core/requests/__tests__/)
- [src/modules/core/requests/__tests__/order-confirmation.apply.test.ts](../../src/modules/core/requests/__tests__/)
- [src/modules/core/requests/validations/order-confirmation.ts](../../src/modules/core/requests/validations/)
- [src/modules/core/requests/components/order-confirmation-review.tsx](../../src/modules/core/requests/components/)
- [src/modules/core/requests/hooks/use-order-confirmations.ts](../../src/modules/core/requests/hooks/)
- [src/app/api/requests/[id]/confirmations/route.ts](../../src/app/api/requests/)
- [src/app/api/confirmations/[id]/route.ts](../../src/app/api/confirmations/)
- [src/app/api/confirmations/[id]/apply/route.ts](../../src/app/api/confirmations/)
- [src/app/api/confirmations/[id]/reject/route.ts](../../src/app/api/confirmations/)
- [src/modules/core/email-intelligence/server/tools/order-confirmation.tools.ts](../../src/modules/core/email-intelligence/server/tools/)
- [docs/internal/n8n-workflow-update-required.md](.)
- [docs/internal/manual-tests-order-confirmation.md](.)

### Da modificare

- [prisma/schema.prisma](../../prisma/schema.prisma) — nuovi modelli + enum,
  estende `RequestItem` / `Attachment`, annotazione `@deprecated` su
  `PriceVarianceReview`.
- [src/modules/core/requests/index.ts](../../src/modules/core/requests/index.ts) — barrel export.
- [src/modules/core/requests/README.md](../../src/modules/core/requests/README.md) — sezione Order Confirmations.
- [src/modules/core/email-intelligence/server/email-intelligence.agent.ts](../../src/modules/core/email-intelligence/server/email-intelligence.agent.ts) — registrazione tool + aggiornamento system prompt.
- [src/modules/core/email-intelligence/server/email-ingestion.service.ts](../../src/modules/core/email-intelligence/server/email-ingestion.service.ts) — download attachment prima della chiamata agent.
- [src/app/(dashboard)/requests/[id]/page.tsx](../../src/app/) (o detail component) — render `OrderConfirmationReview` quando esistono conferme.
- [CHANGELOG.md](../../CHANGELOG.md) — voce Unreleased.

### Utility esistenti da riusare

- `writeAuditLog` ([audit-log module](../../src/modules/core/audit-log/)) — ogni `apply`/`reject`.
- `withApiHandler` ([src/lib/api-handler.ts](../../src/lib/api-handler.ts)) — tutte le nuove route.
- `createNotification` ([notifications module](../../src/modules/core/notifications/)) — notifica requester on apply/reject.
- `requireRole('ADMIN', 'MANAGER')` — per le route di apply/reject (match pattern [price-variance/[id]/route.ts:23](../../src/app/api/price-variance/)).
- Files API PDF upload ([email-intelligence.agent.ts:630](../../src/modules/core/email-intelligence/server/email-intelligence.agent.ts)) — riuso per PDF scaricati da webhook.

---

## 8. Verifica

### Unit/integration
```bash
cd procureflow
npx tsc --noEmit
npx vitest run src/modules/core/requests
npx vitest run src/modules/core/email-intelligence
```

### Schema
```bash
npx prisma migrate status
npx prisma studio   # conferma visiva: OrderConfirmation + OrderConfirmationLine, 3 nuove colonne su RequestItem
```

### End-to-end manuale

1. `npm run dev`
2. Creare PR di test con 3 line item via `/requests/new`.
3. `POST /api/requests/{id}/confirmations` con lines prezzi/date variati → 201, conferma in stato `PARSED`.
4. Aprire `/requests/{id}` → nuovo componente di review visibile con diff per riga.
5. Selezionare 2 righe su 3 → "Applica selezionate" → verificare:
   - solo le 2 righe selezionate hanno `unit_price` / `confirmed_delivery` aggiornati
   - status conferma → `APPLIED`
   - TimelineEvent registrato
   - audit-log: `SELECT * FROM audit_log WHERE entity_type = 'OrderConfirmation'`
   - double-apply → 409 con messaggio esplicito
6. Creare seconda conferma sulla stessa PR → reject con reason → verifica nessun cambio item, status `REJECTED`.
7. Import manuale email `/analytics` con PDF Faleni reale → conferma auto-creata con righe discrepanza.
8. `POST /api/webhooks/email-ingestion` con `attachments` contenente URL PDF pubblico → conferma creata, PDF processato dall'agent.

### Regression

- PR detail page identica quando non ci sono conferme.
- `PriceVarianceReview` storici → banner legacy ancora visibile.
- `npx vitest run` — tutti i 640+ test esistenti ancora verdi.
- `/api/price-variance/[id]` PATCH funziona ancora sui record legacy.

---

## 9. Rollback

### Dev DB
```bash
git checkout main
git branch -D feat/core-order-lifecycle
npx prisma migrate reset   # SOLO DEV — cancella dati
```

### DB condiviso / prod

**STOP**, annotare l'incidente in `docs/internal/INCIDENT-NOTES.md`, consultare prima di agire. Tutte le colonne nuove sono nullable; worst case = `ALTER TABLE DROP COLUMN` + `DROP TABLE order_confirmation_lines, order_confirmations` + cleanup history migrazioni.
