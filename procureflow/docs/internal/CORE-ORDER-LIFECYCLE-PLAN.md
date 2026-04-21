# Core Order Lifecycle Hardening — Piano Architetturale

> **Branch**: `feat/core-order-lifecycle`
> **Data piano base**: 2026-04-20
> **Data estensione**: 2026-04-21
> **Stato piano base (Fasi 0-5)**: completo — merged in [PR #1](https://github.com/saikulium/SaiFlow-Hub/pull/1).
> **Stato estensioni line-level (Fasi 6-10)**: piano definito, in attesa di OK per l'inizio.

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

| Fase | Contenuto | Uscita | Stato |
|------|-----------|--------|-------|
| 0 | Plan doc + branch setup | Questo documento + branch `feat/core-order-lifecycle` su main pulito | ✅ fatto |
| 1 | Schema migration (DB-only, nessuna logica) | Migration reversibile + `npx prisma generate` + tsc/vitest verdi | ✅ fatto |
| 2 | Service layer + test (no API/UI) | `order-confirmation.service.ts` con create/compute/apply/reject, ≥6 unit test, 1 integration test end-to-end, 1 idempotency test | ✅ fatto |
| 3 | API routes + componente UI | 4 route sotto `withApiHandler`, `OrderConfirmationReview` integrato in PR detail page, manual-test script | ✅ fatto |
| 4 | Email intelligence + webhook attachment | Tool `create_order_confirmation`, aggiornamento system prompt, `fetchAttachmentBytes` wired, doc n8n | ✅ fatto |
| 5 | README, CHANGELOG, final report | Modulo documentato, changelog Unreleased aggiornato, report finale a chat — NO merge | ✅ fatto |
| **6 (ext)** | Schema extensions: `LineDeliveryStatus`, `RequestItemShipment`, `PARTIALLY_APPLIED` | Migration `core_order_lifecycle_extensions` + tsc/vitest verdi | ⏳ attesa OK |
| **7 (ext)** | Service: `rejectLines`, shipment service, recompute, logica `PARTIALLY_APPLIED` | 6+ nuovi test, tutti verdi | ⏳ attesa OK |
| **8 (ext)** | API + UI: 4 nuove route + tracker shipment + review a 3 azioni | UI integrata in PR detail | ⏳ attesa OK |
| **9 (ext)** | Email intelligence: `delivery_status` nel tool + (opz.) `AVVISO_SPEDIZIONE` | System prompt aggiornato | ⏳ attesa OK |
| **10 (ext)** | README + CHANGELOG + manual test | Docs aggiornati, final report, NO merge | ⏳ attesa OK |

**Ogni fase termina con un checkpoint hard e STOP per OK utente** — stessa
regola per le estensioni (6-ext → 10-ext).

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

---

> **Aggiornamento 2026-04-21** — Dopo l'analisi post-implementazione sullo
> scenario "fornitore conferma con stati diversi per riga" sono emersi 4 gap
> operativi rimasti aperti dal piano base. Per evitare di generare workaround
> manuali per i clienti, le 4 estensioni seguenti vengono integrate nella
> **stessa sprint** (non rimandate) come Fasi 6-10 sul medesimo branch
> `feat/core-order-lifecycle` / PR #1. Il piano base (Sezioni 1-9) resta
> valido e invariato; quanto segue si aggiunge senza sostituire nulla.

---

## 10. Estensioni decise per scope completo (post-analisi gap)

### Estensione 1 — `LineDeliveryStatus` enum

**Cosa**: nuovo enum applicato a `OrderConfirmationLine.delivery_status` e a
`RequestItem.delivery_status`.

**Valori**: `CONFIRMED | PARTIAL | BACKORDERED | UNAVAILABLE | SHIPPED | DELIVERED | CANCELLED`.

**Default**: `CONFIRMED` (retrocompatibile — equivale allo stato implicito
pre-estensione).

**Dove popolato**:

- dall'agent AI durante `create_order_confirmation` (nuovo campo nel payload del tool)
- dall'utente via UI (`OrderConfirmationReview` esteso con 3 azioni per riga)
- automaticamente dal service quando viene registrata una `RequestItemShipment`
  (es. `SHIPPED` → `DELIVERED` al completamento delle shipments)

### Estensione 2 — `RequestItemShipment`

**Cosa**: nuova tabella per modellare **consegne multiple della stessa riga**
(split shipment). N:1 con `RequestItem`.

**Campi principali**: `shipped_quantity`, date previste/effettive di
spedizione e consegna, `tracking_number`, `carrier`, `tracking_url`, `status`
(`PENDING | SHIPPED | DELIVERED | RETURNED | LOST | CANCELLED`), `source`
(`MANUAL | EMAIL | DDT_PARSING | API`), FK opzionale a `EmailLog`.

**Quando creata**:

- manualmente dall'utente via UI `RequestItemShipmentTracker`
- (futuro, fuori scope) automaticamente da parsing email "avviso spedizione"
  o importazione DDT

### Estensione 3 — Reject granulare per riga

**Cosa**: nuova funzione service `rejectLines` + nuova API route
`POST /api/confirmations/[id]/reject-lines` + estensione UI con 3 azioni per
riga ("Accetta" / "Rifiuta" / "Lascia in sospeso").

**Comportamento**:

- La riga rifiutata setta `rejected=true` + `rejected_reason` + `rejected_by`
  su `OrderConfirmationLine`.
- Propaga `delivery_status=UNAVAILABLE` (il fornitore non può fornire) o
  `CANCELLED` (annullamento su decisione utente) al `RequestItem` corrispondente.
- **Non** modifica `unit_price` / `quantity` del `RequestItem` (sono
  "ordinati ma non arriveranno").
- Ogni reject → `TimelineEvent` + `writeAuditLog`.
- Aggiorna lo stato della confirmation (vedi Estensione 4).

### Estensione 4 — Stato `PARTIALLY_APPLIED` su `OrderConfirmation`

**Cosa**: nuovo valore `PARTIALLY_APPLIED` aggiunto a `OrderConfirmationStatus`.

**Transizioni**:

- Dopo `applyConfirmation({acceptedLineIds})` con **subset parziale**
  → `PARTIALLY_APPLIED` (almeno una riga non è né accepted né rejected).
- Dopo `rejectLines` sulle righe residue tale che **tutte le righe hanno
  stato terminale** (applied o rejected) → `APPLIED`.
- Se restano righe in limbo → resta `PARTIALLY_APPLIED`.

Helper interno `isConfirmationComplete(confirmationId)` decide la transizione.

---

## 11. Fasi estese (6-10) — dettaglio per fase

Le fasi seguenti iniziano dopo OK utente, operano sullo stesso branch e
chiudono sulla stessa PR #1 (oppure una PR dedicata se preferito — decisione
da prendere al Checkpoint 0-ext).

### Fase 6 — Schema (estensione)

Aggiunge al `prisma/schema.prisma`:

**6.A — Enum `LineDeliveryStatus`**

```prisma
enum LineDeliveryStatus {
  CONFIRMED       // default — fornitore conferma come da richiesta
  PARTIAL         // conferma parziale (quantità ridotta o split)
  BACKORDERED     // in attesa disponibilità, data ignota
  UNAVAILABLE     // fornitore non può fornire
  SHIPPED         // almeno una shipment in transito
  DELIVERED       // somma shipment DELIVERED = quantity
  CANCELLED       // annullata (fornitore o utente)
}
```

**6.B — Estensione `OrderConfirmationLine`**

Nuovi campi (tutti additive, retrocompatibili):

```prisma
delivery_status   LineDeliveryStatus @default(CONFIRMED)
rejected_by       String?
rejected_reason   String?
applied_by        String?
@@index([delivery_status])
```

I campi `applied`, `applied_at`, `rejected`, `rejected_at` già pianificati
restano invariati.

**6.C — Estensione `RequestItem`**

```prisma
delivery_status  LineDeliveryStatus @default(CONFIRMED)
```

È uno **stato derivato** mantenuto coerente dal service
`recomputeRequestItemDeliveryStatus` (vedi Fase 7).

**6.D — Nuova tabella `RequestItemShipment`**

```prisma
model RequestItemShipment {
  id                     String    @id @default(cuid())
  request_item_id        String
  request_item           RequestItem @relation(fields: [request_item_id], references: [id], onDelete: Cascade)

  shipped_quantity       Decimal   @db.Decimal(12, 4)

  expected_ship_date     DateTime?
  actual_ship_date       DateTime?
  expected_delivery_date DateTime?
  actual_delivery_date   DateTime?

  tracking_number        String?
  carrier                String?
  tracking_url           String?

  status                 ShipmentStatus @default(PENDING)

  notes                  String?
  source                 ShipmentSource @default(MANUAL)
  source_email_log_id    String?
  source_email_log       EmailLog? @relation(fields: [source_email_log_id], references: [id])

  created_at             DateTime  @default(now())
  updated_at             DateTime  @updatedAt

  @@index([request_item_id])
  @@index([status])
  @@index([tracking_number])
  @@map("request_item_shipments")
}

enum ShipmentStatus {
  PENDING
  SHIPPED
  DELIVERED
  RETURNED
  LOST
  CANCELLED
}

enum ShipmentSource {
  MANUAL
  EMAIL
  DDT_PARSING
  API
}
```

**6.E — `OrderConfirmationStatus` — nuovo valore**

```prisma
enum OrderConfirmationStatus {
  RECEIVED
  PARSED
  ACKNOWLEDGED
  APPLIED
  PARTIALLY_APPLIED  // NUOVO
  REJECTED
}
```

**6.F — Migration e backfill**

- `npx prisma migrate dev --name core_order_lifecycle_extensions`.
- Tutte modifiche additive: nuovi campi con default (`CONFIRMED` / `PENDING`
  / `MANUAL`), nuova tabella, nuovo valore enum.
- **Nessun backfill**: i record esistenti ottengono `delivery_status=CONFIRMED`
  che è il default corretto; nessuno shipment legacy da creare.

**Verifiche Fase 6**:

- `npx tsc --noEmit` verde
- `npx vitest run` — tutti i 657 test pre-esistenti ancora verdi
- `npx prisma migrate status` → migration applicata
- Prisma Studio: nuova tabella visibile, enum esteso

### Fase 7 — Service layer (estensione)

**7.A — `rejectLines` in `order-confirmation.service.ts`**

```typescript
export async function rejectLines(input: {
  confirmationId: string
  rejectedLineIds: string[]
  userId: string
  reason: string
  newRequestItemStatus: 'UNAVAILABLE' | 'CANCELLED'
}): Promise<{ confirmation: OrderConfirmation; rejectedCount: number }>
```

Comportamento descritto in §10 Estensione 3. Transazione singola; errore se
una riga è già `applied=true`.

**7.B — Estensione di `applyConfirmation`**

Per ogni riga accettata: se
`OrderConfirmationLine.delivery_status !== CONFIRMED`, propaga lo stato al
`RequestItem` (PARTIAL, BACKORDERED, ecc.).

**7.C — `recomputeRequestItemDeliveryStatus(requestItemId)`**

Helper interno che ricalcola `RequestItem.delivery_status` derivato:

1. Se le shipment di questa riga coprono tutta la `quantity` e sono tutte
   `DELIVERED` → `DELIVERED`.
2. Se alcune shipment `DELIVERED` ma non coprono tutto → `PARTIAL`.
3. Se esistono shipment `SHIPPED` e nessuna `DELIVERED` → `SHIPPED`.
4. Altrimenti prende lo stato dall'ultima `OrderConfirmationLine` applicata
   (`CONFIRMED`, `PARTIAL`, `BACKORDERED`, `UNAVAILABLE`, `CANCELLED`).

Chiamato ogni volta che una shipment viene creata/aggiornata o una
confirmation applicata/rifiutata.

**7.D — `isConfirmationComplete(confirmationId)` + transizione
`PARTIALLY_APPLIED`**

Helper che verifica se tutte le righe hanno stato terminale
(`applied || rejected`). Usato da `applyConfirmation` e `rejectLines` per
decidere fra `PARTIALLY_APPLIED` e `APPLIED`.

**7.E — Nuovo service `request-item-shipment.service.ts`**

Funzioni esportate:

- `createShipment(input)` — crea shipment + invoca `recomputeRequestItemDeliveryStatus`
- `updateShipmentStatus({shipmentId, status, actualShipDate?, actualDeliveryDate?, userId})`
- `listShipmentsForRequestItem(requestItemId)`
- `listShipmentsForPurchaseRequest(requestId)`
- `getTotalShippedQuantity(requestItemId)`
- `getTotalDeliveredQuantity(requestItemId)`

**Vincoli**:

- `sum(shipped_quantity)` ≤ `RequestItem.quantity` × (1 + tolleranza)
  (tolleranza default 5%, configurabile).
- Ogni operazione → `TimelineEvent` su `PurchaseRequest` + `writeAuditLog`.

**7.F — Test (aggiunti ai test suite esistenti)**

Almeno:

- `rejectLines` rifiuta righe specifiche + propaga `delivery_status`.
- `applyConfirmation` con subset parziale → `PARTIALLY_APPLIED`.
- `applyConfirmation` + `rejectLines` sulle restanti → `APPLIED`.
- `createShipment` aggiorna `delivery_status` del `RequestItem`.
- `recomputeRequestItemDeliveryStatus` per 4+ scenari (no shipment, parziali,
  completi, mix).
- Validazione: errore se somma `shipped_quantity` supera soglia.

**Target coverage estensione**: mantenere ≥80% sui file nuovi/toccati.

### Fase 8 — API + UI (estensione)

**8.A — Nuove route**

Tutte sotto `withApiHandler`:

| Route | Metodo | Auth | Scopo |
|---|---|---|---|
| `/api/confirmations/[id]/reject-lines` | POST | MANAGER/ADMIN | `rejectLines` |
| `/api/request-items/[id]/shipments` | GET, POST | tutti / MANAGER+ | list/create shipment |
| `/api/shipments/[id]` | GET, PATCH | tutti / MANAGER+ | detail/update shipment |
| `/api/requests/[id]/shipments` | GET | tutti | aggregato shipment per PR |

**8.B — Estensione `OrderConfirmationReview`**

- Colonna "Stato" per riga con badge `delivery_status` proposto.
- 3 azioni per riga: "Accetta" / "Rifiuta" / "Lascia in sospeso".
- "Rifiuta" → dialog con motivo obbligatorio e scelta fra
  `UNAVAILABLE` e `CANCELLED`.
- Riepilogo in basso: "X accettate · Y rifiutate · Z in sospeso".
- Warning visibile se restano righe in sospeso: "La confirmation resterà in
  stato PARTIALLY_APPLIED finché tutte le righe non hanno decisione".

**8.C — Nuovo componente `RequestItemShipmentTracker`**

File: `src/modules/core/requests/components/request-item-shipment-tracker.tsx`.

- Timeline delle shipment per una singola riga.
- Per shipment: quantità, status badge, date, tracking link.
- Counter aggregato: "Spedito X/Y · Consegnato W/Y".
- CTA "+ Aggiungi shipment" (dialog form).
- CTA "Aggiorna stato" sulla shipment.

**8.D — Integrazione PR detail page**

- Badge `delivery_status` accanto a ogni riga in "Righe ordine".
- Click riga → espande shipment tracker per quella riga.
- Nuova sezione "Stato consegne" con counter aggregato:
  totale ordinato / spedito / consegnato / mancante (con %).

**8.E — Hooks React Query**

Nuovi hook in `src/modules/core/requests/hooks/`:

- `use-request-item-shipments.ts` (list, create, update)
- `useRejectLines` (mutation)

**8.F — Test E2E (se framework Playwright disponibile)**

- Confirmation con righe in stati misti → review → accetta/rifiuta/sospeso
  → confirmation in `PARTIALLY_APPLIED`.
- Aggiunta shipment manuale → `RequestItem.delivery_status` cambia a `SHIPPED`.
- Seconda shipment a copertura → passa a `DELIVERED`.

### Fase 9 — Email intelligence (estensione)

**9.A — Estensione tool AI `create_order_confirmation`**

Aggiunta al payload per ogni linea:

```typescript
delivery_status: z.enum([
  'CONFIRMED',
  'PARTIAL',
  'BACKORDERED',
  'UNAVAILABLE',
]).optional()
```

System prompt aggiornato con esempi mapping:

- "Disponibile, spedisco subito" → `CONFIRMED`
- "Posso fornire 50 su 100 richiesti" → `PARTIAL`
- "In attesa stock, vi aggiorneremo" → `BACKORDERED`
- "Articolo fuori produzione" → `UNAVAILABLE`

**9.B — Intent `AVVISO_SPEDIZIONE` (decisione bloccante al Checkpoint 4-ext)**

Opzionale: nuovo intent per email "abbiamo spedito, tracking XYZ", che
creerebbe automaticamente `RequestItemShipment` con `source=EMAIL`.

**Se aggiunto**: +1 giornata di effort (prompt nuovo + handler + tool
`create_shipment_from_email`).

**Se rimandato**: shipment resta creation manuale via UI (è sufficiente per
sprint corrente).

**Decisione da prendere durante Fase 9, non adesso.**

### Fase 10 — Docs + CHANGELOG (estensione)

**10.A — Aggiornamento `src/modules/core/requests/README.md`**

Nuove sezioni:

- "Order Confirmation — Stati delle linee" (tabella dei 7 stati + semantica)
- "Request Item Shipments" (modello + creazione manuale/automatica + API)
- "Reject granulare" (semantica + transizioni `PARTIALLY_APPLIED`/`APPLIED`)

**10.B — CHANGELOG**

Sezione Added:

- `LineDeliveryStatus` enum (7 valori)
- `RequestItemShipment` per split shipment
- `rejectLines` service per reject granulare
- `PARTIALLY_APPLIED` stato
- `RequestItemShipmentTracker` UI
- API: `POST /api/confirmations/[id]/reject-lines`,
  `GET/POST /api/request-items/[id]/shipments`,
  `GET/PATCH /api/shipments/[id]`,
  `GET /api/requests/[id]/shipments`

**10.C — Manual test script**

Aggiunta a `docs/internal/manual-tests-order-confirmation.md`:

- Scenario multi-stato (fornitore conferma A ok, B PARTIAL, C UNAVAILABLE)
- Scenario split shipment (2 shipment sulla stessa riga, una PARTIAL poi DELIVERED)
- Verifica transizione `APPLIED ↔ PARTIALLY_APPLIED`

---

## 12. Tempi rivisti con estensioni

| Fase | Effort originale | Effort esteso | Note |
|------|------------------|---------------|------|
| 0 | 0.5 gg | 0.5 gg | invariato |
| 1 | 0.5 gg | 0.5 gg | **fatto** |
| 2 | 2.0 gg | 2.0 gg | **fatto** |
| 3 | 1.5 gg | 1.5 gg | **fatto** |
| 4 | 1.5 gg | 1.5 gg | **fatto** |
| 5 | 0.5 gg | 0.5 gg | **fatto** |
| 6 (ext schema) | — | 0.5 gg | migration + enum + tabella |
| 7 (ext service) | — | 1.5 gg | rejectLines + shipment service + recompute + test |
| 8 (ext API/UI) | — | 1.5 gg | 4 route + 3-azioni + tracker + aggregato |
| 9 (ext email) | — | 0.5–1.5 gg | dipende decisione `AVVISO_SPEDIZIONE` |
| 10 (ext docs) | — | 0.5 gg | README + CHANGELOG + manual test |
| **Totale** | **~6 gg** | **~10-11 gg** | sprint estesa a 2.5-3 settimane calendario |

---

## 13. Fuori scope anche con le estensioni

Anche con Fasi 6-10 applicate, questa sprint **NON** include:

- **Goods receipt automatizzato** (registrazione ricezione fisica via barcode)
- **Parsing automatico DDT** (documento di trasporto)
- **Sync con `StockMovement`** (magazzino) quando arriva una shipment
- **Notifica automatica al fornitore** quando una riga viene rejected (resta manuale)
- **Workflow "sourcing alternativo"** quando una riga è `UNAVAILABLE`
- **Intent `AVVISO_SPEDIZIONE`** se la decisione al Checkpoint 4-ext è "rimanda"

Questi restano per sprint successive, tipicamente sotto il titolo
"Goods Receipt & Warehouse Integration".
