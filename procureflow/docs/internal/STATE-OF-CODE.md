# ProcureFlow — Stato del Codice

Generato il: 2026-04-17
Commit di riferimento: 689013a (branch: sprint/security-hardening-w1)

---

## 1. Inventario Quantitativo

| Metrica | Valore |
|---|---|
| File `.ts` + `.tsx` (esclusi node_modules, .next) | 555 |
| Linee di codice in `src/` | 65.055 |
| API routes (`route.ts` in `src/app/api/`) | 104 |
| Modelli Prisma | 42 |
| Migrazioni Prisma | 4 |
| File di test | 57 |
| Test totali (individuali) | 589 |
| Linee di codice test (`tests/`) | 8.296 |
| Rapporto test/codice | ~1:7.8 (8.296 / 65.055) |
| Dependencies | 37 |
| DevDependencies | 17 |
| Commit totali | 182 |
| Commit ultimi 30 giorni | 167 |
| Servizi (`src/server/services/`) | 31 |
| Agenti AI (`src/server/agents/`) | 7 |
| File tool per agenti | 16 |
| Custom hooks (`src/hooks/`) | 36 |

### Linee per cartella top-level di `src/`

| Cartella | Linee |
|---|---|
| `src/app/` | 12.625 |
| `src/components/` | 28.277 |
| `src/hooks/` | 3.874 |
| `src/lib/` | 3.751 |
| `src/server/` | 15.377 |
| `src/types/` | 1.087 |

Il frontend (`components/` + `hooks/`) pesa 32.151 righe, il backend (`server/` + `app/api/` + `lib/`) circa 31.753. Rapporto quasi 1:1.

---

## 2. Mappa dei Moduli (livello cartella)

### Pagine dashboard (`src/app/(dashboard)/`)

| Cartella | File | Ultimo commit | Stato |
|---|---|---|---|
| `analytics/` | 3 | 2026-04-05 | viva |
| `approvals/` | 3 | 2026-03-11 | ferma (37 giorni) |
| `articles/` | 6 | 2026-04-03 | viva |
| `budgets/` | 6 | 2026-04-05 | viva |
| `clients/` | 3 | 2026-04-02 | viva |
| `commesse/` | 6 | 2026-04-02 | viva |
| `inventory/` | 18 | 2026-04-05 | viva |
| `invoices/` | 6 | 2026-04-05 | viva |
| `requests/` | 9 | 2026-04-05 | viva |
| `settings/` | 6 | 2026-04-05 | viva |
| `tenders/` | 6 | 2026-04-05 | viva |
| `users/` | 3 | 2026-04-05 | viva |
| `vendors/` | 6 | 2026-04-05 | viva |

### Componenti (`src/components/`)

| Cartella | File | Ultimo commit | Stato |
|---|---|---|---|
| `admin/` | 7 | 2026-04-05 | viva |
| `analytics/` | 4 | 2026-04-05 | viva |
| `articles/` | 8 | 2026-04-10 | viva |
| `auth/` | 4 | 2026-04-14 | viva |
| `budgets/` | 3 | 2026-03-13 | ferma (35 giorni) |
| `chat/` | 3 | 2026-04-10 | viva |
| `clients/` | 2 | 2026-04-02 | viva |
| `commesse/` | 4 | 2026-04-03 | viva |
| `dashboard/` | 24 | 2026-04-16 | viva |
| `forms/` | 0 | — | vuota |
| `inventory/` | 12 | 2026-04-10 | viva |
| `invoices/` | 12 | 2026-04-05 | viva |
| `layout/` | 11 | 2026-04-10 | viva |
| `onboarding/` | 11 | 2026-04-05 | viva |
| `providers/` | 3 | 2026-04-05 | viva |
| `requests/` | 21 | 2026-04-17 | viva |
| `shared/` | 9 | 2026-04-05 | viva |
| `tables/` | 0 | — | vuota |
| `tenders/` | 6 | 2026-04-05 | viva |
| `users/` | 2 | 2026-03-13 | ferma (35 giorni) |
| `vendors/` | 5 | 2026-04-05 | viva |

### Server (`src/server/`)

| Cartella | Ultimo commit | Stato |
|---|---|---|
| `agents/` (7 agenti + 16 file tools) | 2026-04-17 | viva |
| `services/` (31 servizi) | 2026-04-17 | viva |

### Nota

`src/components/forms/` e `src/components/tables/` sono cartelle vuote dichiarate nell'architettura CLAUDE.md ma mai popolate. Non esistono componenti UI primitivi (`src/components/ui/` non esiste): i componenti sono scritti direttamente con Tailwind, senza una libreria shadcn/ui o simile, nonostante le dipendenze Radix siano in `package.json`.

---

## 3. Tabella Completa API Routes

104 route totali. Sotto, raggruppate per modulo. La colonna "Auth" indica il numero di riferimenti a `requireAuth`/`requireRole`/`getServerSession`/`withAuth`; 0 significa nessun guard visibile nel file.

### Admin (8 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/admin/config` | GET, PATCH | 3 | 102 | Configurazione deploy (feature flags) |
| `/api/admin/export/[entity]` | GET | 2 | 50 | Export CSV per entita generica |
| `/api/admin/export/backup` | GET | 2 | 68 | Backup JSON completo |
| `/api/admin/import/materials` | POST | 2 | 46 | Import materiali da CSV |
| `/api/admin/import/vendors` | POST | 2 | 46 | Import fornitori da CSV |
| `/api/admin/integrations` | GET | 2 | 66 | Lista integrazioni configurate |
| `/api/admin/integrations/[type]` | PUT, DELETE | 3 | 102 | CRUD singola integrazione |
| `/api/admin/integrations/[type]/test` | POST | 2 | 196 | Test connettivita integrazione |

### Agents (5 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/agents/compliance` | POST | 2 | 30 | Avvia compliance monitor agent |
| `/api/agents/onboarding` | POST | 2 | 93 | Avvia onboarding agent |
| `/api/agents/reconcile` | POST | 2 | 55 | Avvia invoice reconciliation agent |
| `/api/agents/reorder` | POST | 2 | 30 | Avvia smart reorder agent |
| `/api/agents/tender-analysis` | POST | 2 | 136 | Avvia tender analysis agent |

### AI (5 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/ai/forecast/[materialId]` | GET, POST | 3 | 66 | Forecast domanda materiale |
| `/api/ai/forecast/alerts` | GET | 2 | 30 | Lista alert forecast |
| `/api/ai/forecast/alerts/[id]` | PATCH | 2 | 42 | Aggiorna stato alert |
| `/api/ai/forecast/check` | POST | 2 | 30 | Check manuale forecast |
| `/api/ai/insights` | GET, POST | 2 | 43 | Insight AI generati |
| `/api/ai/insights/[id]` | PATCH | 2 | 21 | Aggiorna stato insight |

### Analytics (1 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/analytics/roi` | GET | 2 | 35 | Metriche ROI |

### Approvals (2 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/approvals` | GET | **0** | 60 | Lista approvazioni pendenti |
| `/api/approvals/[id]/decide` | POST | 2 | 63 | Approva/rifiuta |

### Articles (8 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/articles` | GET, POST | 3 | 160 | Lista e creazione articoli |
| `/api/articles/[id]` | GET, PATCH, DELETE | 3 | 178 | CRUD singolo articolo |
| `/api/articles/[id]/aliases` | GET, POST | 2 | 87 | Gestione alias articolo |
| `/api/articles/[id]/aliases/[aliasId]` | DELETE | 2 | 33 | Elimina alias |
| `/api/articles/[id]/prices` | GET, POST | 2 | 89 | Storico prezzi articolo |
| `/api/articles/[id]/stock` | GET, POST | **0** | 217 | Stock per articolo |
| `/api/articles/import` | POST | 2 | 80 | Import articoli da CSV |
| `/api/articles/search` | GET | 2 | 87 | Ricerca articoli |
| `/api/articles/unverified/count` | GET | 2 | 24 | Conteggio articoli non verificati |

### Auth (5 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/auth/[...nextauth]` | (handler) | 0 | 3 | NextAuth catch-all |
| `/api/auth/mfa/disable` | POST | 2 | 57 | Disattiva MFA |
| `/api/auth/mfa/setup` | POST | 2 | 26 | Avvia setup MFA |
| `/api/auth/mfa/verify-setup` | POST | 2 | 47 | Verifica setup MFA |
| `/api/auth/preflight` | POST | 0 | 97 | Pre-check login (rate limit) |

### Budgets (3 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/budgets` | GET, POST | **0** | 89 | Lista e creazione budget |
| `/api/budgets/[id]` | GET, PATCH, DELETE | 4 | 180 | CRUD singolo budget |
| `/api/budgets/check` | POST | 2 | 33 | Verifica disponibilita budget |

### Chat (2 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/chat` | POST | 2 | 150 | Chat AI procurement assistant |
| `/api/chat/confirm` | POST | 2 | 55 | Conferma azione pendente |

### Clients (2 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/clients` | GET, POST | 3 | 141 | Lista e creazione clienti |
| `/api/clients/[id]` | GET, PATCH, DELETE | 4 | 169 | CRUD singolo cliente |

### Commesse (5 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/commesse` | GET, POST | 3 | 226 | Lista e creazione commesse |
| `/api/commesse/[code]` | GET, PATCH | 3 | 109 | Dettaglio e modifica commessa |
| `/api/commesse/[code]/accept-suggestion` | POST | 2 | 83 | Accetta suggerimento AI |
| `/api/commesse/[code]/suggestions/[id]` | PATCH, DELETE | 3 | 122 | Gestione suggerimenti |
| `/api/commesse/stats` | GET | 2 | 26 | Statistiche commesse |

### Email (2 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/email-import` | POST | 2 | 168 | Import email manuale con PDF |
| `/api/email-logs` | GET | 2 | 33 | Consultazione log email |

### Files (1 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/files/[id]` | GET | 2 | 86 | Serve file autenticato (PF-005) |

### Health (1 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/health` | GET | 0 | 22 | Health check |

### Inventory (12 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/inventory/inventories` | GET, POST | 3 | 123 | Lista e creazione inventari |
| `/api/inventory/inventories/[id]` | GET, PATCH | 4 | 240 | Dettaglio inventario |
| `/api/inventory/lots` | GET | 2 | 63 | Lista lotti |
| `/api/inventory/lots/[id]` | GET | 2 | 78 | Dettaglio lotto |
| `/api/inventory/materials` | GET, POST | 3 | 167 | Lista e creazione materiali |
| `/api/inventory/materials/[id]` | GET, PATCH, DELETE | 4 | 247 | CRUD materiale |
| `/api/inventory/movements` | GET, POST | 3 | 223 | Lista e registra movimenti |
| `/api/inventory/reservations` | POST | 2 | 62 | Crea prenotazione stock |
| `/api/inventory/reservations/[id]` | PATCH | 2 | 60 | Aggiorna prenotazione |
| `/api/inventory/stats` | GET | 2 | 28 | Statistiche inventario |
| `/api/inventory/suggested-inbounds` | GET | 2 | 28 | Suggerimenti riordino |
| `/api/inventory/warehouses` | GET, POST | 3 | 90 | CRUD magazzini |
| `/api/inventory/warehouses/[id]` | GET, PATCH | 3 | 120 | Dettaglio magazzino |

### Invoices (6 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/invoices` | GET | 2 | 109 | Lista fatture |
| `/api/invoices/[id]` | GET, PATCH, DELETE | 4 | 157 | CRUD fattura |
| `/api/invoices/[id]/match` | POST | 2 | 135 | Match fattura a ordine |
| `/api/invoices/[id]/reconcile` | POST | **0** | 164 | Riconciliazione fattura |
| `/api/invoices/[id]/unmatch` | POST | 2 | 115 | Rimuovi match |
| `/api/invoices/stats` | GET | 2 | 60 | Statistiche fatture |
| `/api/invoices/upload` | POST | 2 | 320 | Upload fattura XML/PDF |

### Notifications (2 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/notifications` | GET, PATCH | **0** | 63 | Lista e segna lette |
| `/api/notifications/[id]` | PATCH | **0** | 26 | Segna singola come letta |

### Onboarding (3 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/onboarding` | PATCH, GET | 3 | 81 | Stato onboarding utente |
| `/api/onboarding/company` | PATCH, GET | 3 | 75 | Setup azienda |
| `/api/onboarding/team` | POST | 2 | 72 | Invita team member |

### Price Variance (2 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/price-variance` | GET | 2 | 52 | Lista variazioni prezzo |
| `/api/price-variance/[id]` | PATCH | 2 | 111 | Decidi su variazione |

### Reports (1 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/reports/weekly` | GET | 2 | 185 | Report settimanale |

### Requests (6 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/requests` | GET, POST | 3 | 158 | Lista e creazione RDA |
| `/api/requests/[id]` | GET, PATCH, DELETE | 4 | 261 | CRUD singola richiesta |
| `/api/requests/[id]/approvals` | GET, POST | 3 | 92 | Approvazioni per richiesta |
| `/api/requests/[id]/attachments` | GET, POST | 3 | 128 | Allegati richiesta |
| `/api/requests/[id]/comments` | GET, POST | **0** | 87 | Commenti richiesta |
| `/api/requests/[id]/submit` | POST | 2 | 129 | Sottometti richiesta |
| `/api/requests/suggest` | POST | 2 | 34 | Suggerimenti AI |

### Tenders (5 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/tenders` | GET, POST | 3 | 179 | Lista e creazione gare |
| `/api/tenders/[id]` | GET, PATCH, DELETE | **0** | 186 | CRUD singola gara |
| `/api/tenders/[id]/go-no-go` | POST | 2 | 83 | Decisione Go/No-Go |
| `/api/tenders/[id]/status` | PATCH | 2 | 64 | Cambio stato gara |
| `/api/tenders/stats` | GET | 2 | 25 | Statistiche gare |

### Users (4 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/users` | GET, POST | 3 | 79 | Lista e creazione utenti |
| `/api/users/[id]` | PATCH | 2 | 51 | Modifica utente |
| `/api/users/[id]/sessions` | DELETE | 2 | 27 | Termina sessioni utente |
| `/api/users/search` | GET | 2 | 39 | Ricerca utenti |

### Vendors (3 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/vendors` | GET, POST | **0** | 60 | Lista e creazione fornitori |
| `/api/vendors/[id]` | GET, PATCH, DELETE | 4 | 123 | CRUD singolo fornitore |
| `/api/vendors/quick` | POST | **0** | 42 | Creazione rapida fornitore |

### Webhooks (5 route)

| Path | Metodi | Auth | Righe | Descrizione |
|---|---|---|---|---|
| `/api/webhooks/approval-response` | POST | 0 | 173 | Callback approvazione da n8n |
| `/api/webhooks/email-ingestion` | POST | 0 | 125 | Ingestion email da n8n |
| `/api/webhooks/email-ingestion/classify` | POST | 0 | 266 | Classificazione email AI |
| `/api/webhooks/sdi-invoice` | POST | 0 | 431 | Ricezione fatture SDI |
| `/api/webhooks/vendor-update` | POST | 0 | 146 | Aggiornamento stato da fornitore |

### Route senza auth guard visibile (auth=0, escludendo webhook/health/nextauth)

Queste route non hanno nessun `requireAuth` nel file. Possono essere protette dal middleware Next.js, ma il guard non e nel file route stesso:

- `/api/approvals` (GET)
- `/api/articles/[id]/stock` (GET, POST)
- `/api/budgets` (GET, POST)
- `/api/invoices/[id]/reconcile` (POST)
- `/api/notifications` (GET, PATCH)
- `/api/notifications/[id]` (PATCH)
- `/api/requests/[id]/comments` (GET, POST)
- `/api/tenders/[id]` (GET, PATCH, DELETE)
- `/api/vendors` (GET, POST)
- `/api/vendors/quick` (POST)

---

## 4. Stato Reale dei Moduli Prodotto

### Core (Requests + Approvals + Vendors + Users)

**Stato: 🟡 PARZIALE**

- Pagine: `requests/`, `approvals/`, `vendors/`, `users/` — tutte presenti con page, loading, error
- Componenti: 21 file requests, 5 vendors, 2 users
- API: 6 route requests, 2 approvals, 3 vendors, 4 users — coprono CRUD + submit + approvazioni
- Servizi: `approval.service.ts`, `code-generator.service.ts`, `attachment.service.ts`, `comment.service.ts`, `notification.service.ts`, `suggest.service.ts`
- Test: `requests-api.test.ts` (7), `requests-idor.test.ts` (3), `code-generator.test.ts` (6), `webhook-approval.test.ts` (5), `request-access.test.ts` (7), `state-machine.test.ts` (10)
- Gap: `users/` fermo dal 13 marzo. Form creazione utente esiste (`create-user-dialog.tsx`) ma nessun test UI. Approvals page ferma dal 11 marzo.
- ~LOC: requests ~3.500, vendors ~1.200, approvals ~800, users ~400

### Invoicing (Fatture + SDI + Three-way matching)

**Stato: 🟡 PARZIALE**

- Pagine: `invoices/` con lista, dettaglio, 6 file
- Componenti: 12 file in `components/invoices/`
- API: 7 route (CRUD + match/unmatch/reconcile/upload/stats)
- Servizi: `fatturapa-parser.service.ts` (10.833B), `invoice-ai-parser.service.ts` (11.323B), `invoice-matching.service.ts`, `three-way-matching.service.ts`, `vendor-order.service.ts`
- Test: `fatturapa-parser.test.ts` (32), `invoice-ai-parser.test.ts` (15), `three-way-matching-logic.test.ts` (10), `invoices-upload-api.test.ts` (5), `reconciliation-thresholds.test.ts` (17)
- Gap: `/api/invoices/[id]/reconcile` non ha auth guard. Nessun test E2E del flusso upload-parse-match.
- ~LOC: ~4.000

### Budgets

**Stato: 🟡 PARZIALE**

- Pagine: `budgets/` con 6 file
- Componenti: 3 file in `components/budgets/` — fermi dal 13 marzo
- API: 3 route (`/budgets`, `/budgets/[id]`, `/budgets/check`). `/budgets` (GET, POST) non ha auth guard.
- Servizi: `budget.service.ts` (12.674B)
- Test: `budget-service.test.ts` (26)
- Gap: componenti UI fermi da 35 giorni. Budget check esiste ma l'integrazione con il flusso di approvazione non e visibile.
- ~LOC: ~1.500

### Analytics

**Stato: 🟡 PARZIALE**

- Pagine: `analytics/` con 3 file
- Componenti: 4 file — `roi-charts.tsx` (533 righe), `roi-dashboard.tsx`, `roi-export-button.tsx`, `roi-summary-cards.tsx`
- API: 1 route (`/api/analytics/roi`) + `/api/reports/weekly` (185 righe)
- Servizi: `roi-metrics.service.ts` (617 righe), `dashboard.service.ts` (445 righe)
- Test: nessuno per analytics/ROI specificatamente
- Gap: nessun test. `roi-metrics.service.ts` e il quinto file piu grande del progetto e non ha copertura.
- ~LOC: ~1.800

### Tenders (Gare)

**Stato: 🟡 PARZIALE**

- Pagine: `tenders/` con 6 file
- Componenti: 6 file — `tender-detail-content.tsx` (481 righe), `tender-form-dialog.tsx` (456 righe)
- API: 5 route. `/api/tenders/[id]` (GET, PATCH, DELETE) non ha auth guard.
- Servizi: `tenders.service.ts` (7.789B)
- Agente: `tender-analysis.agent.ts` (9.965B)
- Test: `tender-service.test.ts` (17), `tender-analysis.agent.test.ts` (14), `tender-analysis-idor.test.ts` (3), `tender.tools.test.ts` (2)
- Gap: route CRUD tenders senza auth guard.
- ~LOC: ~2.500

### Inventory (Magazzino)

**Stato: 🟡 PARZIALE**

- Pagine: `inventory/` con 18 file (piu pagine di qualsiasi altro modulo)
- Componenti: 12 file — `material-detail-content.tsx` (666 righe), `material-form-dialog.tsx` (514 righe)
- API: 13 route che coprono materials, warehouses, lots, movements, reservations, inventories, stats, suggested-inbounds
- Servizi: `inventory.service.ts`, `inventory-db.service.ts` (535 righe)
- Test: `inventory-service.test.ts` (37)
- Gap: `/api/articles/[id]/stock` non ha auth guard. Nessun test per le API route direttamente.
- ~LOC: ~4.200

### Chatbot (AI Assistant)

**Stato: 🟡 PARZIALE**

- Componenti: 3 file — `chat-panel.tsx`, `chat-message.tsx`, `action-confirmation.tsx`
- API: 2 route (`/api/chat`, `/api/chat/confirm`)
- Agente: `procurement-assistant.agent.ts` (6.158B) — il piu piccolo degli agenti, funge da orchestratore
- Tool: `procurement.tools.ts` (1.804 righe — il file piu grande del progetto)
- Hook: `use-chat.ts`
- Test: `procurement-assistant.agent.test.ts` (16), `pending-actions.test.ts` (4)
- Gap: `procurement.tools.ts` a 1.804 righe e un god-file. Contiene definizioni di 34+ tool con schema Zod + logica write-intercept. Nessun test diretto per la maggior parte dei tool individuali.
- ~LOC: ~2.500

### SmartFill / AI Email Intelligence

**Stato: 🟡 PARZIALE**

- Agente: `email-intelligence.agent.ts` (818 righe) — il cuore dell'automazione
- Servizi: `email-ingestion.service.ts` (885 righe), `email-ai-classifier.service.ts` (12.326B), `email-log.service.ts`
- API: `/api/email-import` (168 righe), `/api/email-logs` (33 righe)
- Componenti: `email-import-dialog.tsx` (485 righe) in `dashboard/`
- Webhook: `/api/webhooks/email-ingestion/` (2 route, 391 righe totali)
- Test: `email-intelligence.agent.test.ts` (1 test — solo verifica export), `email-agent-security.test.ts` (5), `email-ai-classifier.test.ts` (14), `email-classify-webhook.test.ts` (14), `email-ingestion-service.test.ts` (19)
- Gap: `email-ingestion.service.ts` a 885 righe sembra un vecchio approccio pre-agente (parsing manuale). Convive con l'email agent ma non e chiaro quale sia il path attivo. L'agent test ha solo 1 test ("exports processEmail function"). Nessun golden-set test con email reali.
- ~LOC: ~3.500

### Commesse (Ordini Cliente)

**Stato: 🟡 PARZIALE**

- Pagine: `commesse/` con 6 file
- Componenti: 4 file — `commessa-detail.tsx` (552 righe)
- API: 5 route
- Servizi: `commessa.service.ts` (8.488B)
- Test: `commessa-state-machine.test.ts` (1 test — solo import), `commessa-margin.test.ts` (5)
- Gap: il test della state machine ha solo 1 test (verifica import). I 14 stati e le transizioni non sono testati.
- ~LOC: ~1.800

### Articles (Catalogo Articoli)

**Stato: 🟡 PARZIALE**

- Pagine: `articles/` con 6 file
- Componenti: 8 file
- API: 9 route (CRUD + aliases + prices + stock + import + search + unverified)
- Servizi: `article-import.service.ts` (6.068B)
- Test: `article-validations.test.ts` (10), `article-import.test.ts` (2), `article-module.test.ts` (1), `article-code-generator.test.ts` (2)
- Gap: nessun test per le API route. `/api/articles/[id]/stock` senza auth.
- ~LOC: ~2.000

### Riepilogo

| Modulo | Stato | Pagine | API | Servizi | Test | Note |
|---|---|---|---|---|---|---|
| Core (Requests) | 🟡 | 9 | 8 | 6 | 38 | Manca test UI, approvals fermo |
| Invoicing | 🟡 | 6 | 7 | 5 | 79 | Reconcile senza auth |
| Budgets | 🟡 | 6 | 3 | 1 | 26 | UI ferma, `/budgets` senza auth |
| Analytics | 🟡 | 3 | 2 | 2 | 0 | Zero test |
| Tenders | 🟡 | 6 | 5 | 2 | 36 | CRUD senza auth |
| Inventory | 🟡 | 18 | 13 | 2 | 37 | Stock senza auth |
| Chatbot | 🟡 | — | 2 | 1 | 20 | God-file 1.804 righe |
| Email Agent | 🟡 | — | 4 | 3 | 53 | Agent test quasi vuoto |
| Commesse | 🟡 | 6 | 5 | 1 | 6 | State machine non testata |
| Articles | 🟡 | 6 | 9 | 1 | 15 | Stock senza auth |

Nessun modulo e ✅ COMPLETO e nessuno e 🔴 STUB o ⚫ ASSENTE. Tutto e 🟡 PARZIALE: il codice esiste e funziona (build passa), ma nessun modulo ha copertura test sufficiente e alcuni hanno gap di sicurezza (auth mancante).

---

## 5. Codice Morto e Orfano

### Cartelle vuote

| Path | Ipotesi |
|---|---|
| `src/components/forms/` | Prevista nell'architettura CLAUDE.md, mai popolata |
| `src/components/tables/` | Prevista nell'architettura CLAUDE.md, mai popolata |

### Servizio legacy convivente

| Path | Righe | Ipotesi |
|---|---|---|
| `src/server/services/email-ingestion.service.ts` | 885 | Parsing email pre-agente (manuale). Convive con `email-intelligence.agent.ts` che fa lo stesso lavoro via tool-calling. 24 `console.log` dentro. Probabilmente il vecchio approccio, tenuto per fallback. |

### Dipendenze mai importate in `src/`

| Pacchetto | Ipotesi |
|---|---|
| `@auth/prisma-adapter` | Installato per NextAuth Prisma adapter ma mai usato — auth implementata manualmente |
| `@radix-ui/react-avatar` | Installato per shadcn/ui ma `src/components/ui/` non esiste |
| `@radix-ui/react-dialog` | Idem |
| `@radix-ui/react-dropdown-menu` | Idem |
| `@radix-ui/react-popover` | Idem |
| `@radix-ui/react-scroll-area` | Idem |
| `@radix-ui/react-separator` | Idem |
| `@radix-ui/react-slot` | Idem |
| `@radix-ui/react-toggle` | Idem |
| `@radix-ui/react-tooltip` | Idem |
| `class-variance-authority` | Utility per shadcn/ui, mai usata |

11 dipendenze installate e mai importate. Tutte legate a un setup shadcn/ui che non e mai stato completato. I componenti usano Tailwind diretto.

### API route mai chiamate dal frontend

Queste route non hanno nessuna chiamata `fetch` da `src/hooks/` o `src/components/`:

| Route | Ipotesi |
|---|---|
| `/api/agents/compliance` | Esposta per n8n/cron, non per UI |
| `/api/agents/onboarding` | Esposta per n8n/cron, non per UI |
| `/api/agents/reconcile` | Esposta per n8n/cron, non per UI |
| `/api/agents/reorder` | Esposta per n8n/cron, non per UI |
| `/api/agents/tender-analysis` | Chiamata internamente dall'agent tender, non dal frontend |
| `/api/ai/forecast/check` | Esposta per n8n/cron |
| `/api/email-logs` | Creata nella security sprint, UI non ancora costruita |
| `/api/health` | Health check per infra/monitoring |
| `/api/inventory/stats` | Creata ma non ancora usata in UI |
| `/api/tenders/stats` | Creata ma non ancora usata in UI |
| `/api/users/[id]/sessions` | Creata per invalidazione sessioni, non ancora in UI |
| `/api/users/search` | Usata probabilmente dall'agent, non dal frontend direttamente |

Le 5 route `/api/agents/*` e `/api/ai/forecast/check` sono ragionevolmente B2B (n8n, cron). Le route `stats`, `email-logs`, `sessions` sono backend-ready senza UI.

---

## 6. Debito Tecnico Marker

### TODO / FIXME / HACK / XXX / @ts-ignore

Nessun `TODO`, `FIXME`, `HACK`, `@ts-ignore`, `@ts-expect-error`, o `eslint-disable` trovato in `src/`. I due match trovati (`XXX`) sono placeholder di formato in stringhe utente (es. `"formato +39 XXX XXXXXXX"`, `"MAG-XXX"`), non marker di debito.

### console.log in codice production

24 occorrenze totali in `src/`:

| File | Occorrenze | Severita |
|---|---|---|
| `src/server/services/email-ingestion.service.ts` | 8 | media — servizio con 885 righe, tutti log operativi |
| `src/app/api/webhooks/email-ingestion/classify/route.ts` | 4 | bassa — webhook logging |
| `src/app/api/webhooks/email-ingestion/route.ts` | 4 | bassa — webhook logging |
| `src/app/api/webhooks/sdi-invoice/route.ts` | 4 | bassa — webhook logging |
| `src/app/api/webhooks/approval-response/route.ts` | 1 | bassa — webhook logging |
| `src/app/api/webhooks/vendor-update/route.ts` | 1 | bassa — webhook logging |
| `src/server/services/vendor-order.service.ts` | 1 | bassa |
| `src/lib/ai/claude-client.ts` | 1 | bassa — log configurazione |

Non esiste un logger strutturato. Tutti i log sono `console.log` diretto. I webhook sono i maggiori produttori.

### Hardcoded values sospetti

| File | Valore | Severita |
|---|---|---|
| `src/lib/constants/sdi.ts:8` | `https://sdi.openapi.it` come fallback URL SDI | bassa — ha env var override |

Nessun indirizzo email hardcoded in logica (solo in placeholder UI). Nessun numero magico sospetto trovato.

### File over-size

| File | Righe | Severita |
|---|---|---|
| `src/server/agents/tools/procurement.tools.ts` | 1.804 | alta — god-file con 34+ tool definitions |
| `src/components/requests/request-form.tsx` | 1.024 | media — form complesso ma monolitico |
| `src/server/services/email-ingestion.service.ts` | 885 | media — probabilmente legacy |
| `src/server/agents/email-intelligence.agent.ts` | 818 | media — cresciuto con la security sprint |
| `src/types/index.ts` | 757 | bassa — barrel file di tipi |
| `src/components/inventory/material-detail-content.tsx` | 666 | media |
| `src/server/services/roi-metrics.service.ts` | 617 | media — nessun test |
| `src/components/commesse/commessa-detail.tsx` | 552 | media |

---

## 7. Stato dei Test

### Numeri

| Metrica | Valore |
|---|---|
| File di test | 57 |
| Test individuali | 589 |
| Linee test | 8.296 |
| Ratio test/src | 1:7.8 |

### Top test file per conteggio

| File | Test |
|---|---|
| `inventory-service.test.ts` | 37 |
| `fatturapa-parser.test.ts` | 32 |
| `budget-service.test.ts` | 26 |
| `webhook-security.test.ts` | 24 |
| `module-helpers.test.ts` | 21 |
| `email-ingestion-service.test.ts` | 19 |
| `tender-service.test.ts` | 17 |
| `reconciliation-thresholds.test.ts` | 17 |
| `onboarding.agent.test.ts` | 17 |
| `procurement-assistant.agent.test.ts` | 16 |

### Copertura qualitativa per area

| Area | Copertura | Note |
|---|---|---|
| Servizi backend | buona | budget (26), inventory (37), fatturapa (32), tender (17) |
| Agenti AI | parziale | onboarding (17), procurement (16), tender-analysis (14), ma email-intelligence ha solo 1 test |
| Tool agenti | minima | 7 file con 1-2 test ciascuno — verificano solo che il tool si importi |
| Webhook/sicurezza | buona | webhook-security (24), email-classify-webhook (14), auth-lockout (11) |
| API route integration | scarsa | solo 5 file: requests (7), invoices-upload (5), auth-mfa (5), requests-idor (3), tender-idor (3) |
| Componenti UI | assente | zero test per componenti React |
| Analytics/ROI | assente | zero test |
| Commesse state machine | assente | 1 test (solo verifica import) |

### E2E

Non esiste setup E2E. Nessun Playwright o Cypress in `package.json` o nei file di configurazione. CLAUDE.md menziona Playwright come target ma non e mai stato configurato.

---

## 8. Momentum di Sviluppo

### Classificazione ultimi 50 commit

| Tipo | Conteggio | % |
|---|---|---|
| `fix:` | 28 | 56% |
| `feat:` | 13 | 26% |
| `chore:` / `test:` / `docs:` | 9 | 18% |
| `refactor:` | 0 | 0% |

### Commit con "(nightly review)" o automation

8 su 50 (16%) hanno la dicitura "nightly review" o "nightly auto-fix". Sono fix automatici generati da un processo di revisione notturno (probabilmente Claude Code schedulato). Pattern: route consistency, TypeScript errors, security issues.

### Pattern di lavoro

I 167 commit negli ultimi 30 giorni (su 182 totali) dicono che il progetto ha ~5 settimane di vita. La densita e altissima: ~5.5 commit/giorno.

Le ultime 2 settimane mostrano due filoni:

1. **Email intelligence agent** (10-16 aprile): wiring tool, PDF attachments, inventory-aware quantities, price variance workflow. Questo e il focus principale.
2. **Security hardening sprint** (17 aprile): 10 fix in un giorno, branch dedicato. Sprint reattivo post-audit.

Non ci sono commit di refactoring. Zero. Il progetto cresce per addizione: nuove feature, nuovi fix, nuovi file. `procurement.tools.ts` e arrivato a 1.804 righe senza mai essere spezzato.

### Contributor

Un singolo contributor (`saikulium`) su tutti i 182 commit.

---

## 9. Health Check Build/Test/Audit

### `npm run build`

Build completata con successo. Output produce tutte le pagine attese. Nessun errore bloccante.

Warning in build: 9 route GET che usano `headers()` vengono segnalate come "couldn't be rendered statically". Questo e normale per route API autenticate in Next.js App Router — non sono errori.

### `npx tsc --noEmit`

Zero errori TypeScript. Pulito.

### `npx vitest run`

57 file, 589 test, tutti passati. Tempo: 4.96s. Nessun test fallito, nessun test skipped.

### `npm audit`

8 vulnerabilita totali (3 low, 5 high). Tutte nel pacchetto `vite` (versione 7.0.0-7.3.1). Sono vulnerabilita del dev server Vite (path traversal, WebSocket file read) — impattano solo lo sviluppo locale, non la produzione. Risolvibili con `npm audit fix`.

### `.env.example`

Esiste. 19 variabili documentate. Copre DATABASE_URL, NEXTAUTH, N8N, S3, ANTHROPIC, SMTP, SDI, ENCRYPTION_KEY. Non documenta `SEED_ON_STARTUP` usato in `docker-compose.yml`.

### `README.md`

36 righe. E il boilerplate di `create-next-app` non modificato. Non documenta il progetto, non spiega come fare setup, non menziona ProcureFlow. Ultimo commit: 10 marzo (primo giorno).

### `CLAUDE.md`

Esiste, dettagliato (~600 righe), copre architettura, design system, schema DB, workflow n8n, deployment. E il vero documento di riferimento del progetto. Parzialmente disallineato dalla realta (menziona `src/components/ui/` che non esiste, `tRPC` che non e usato, S3 per file storage che non e implementato).

---

## 10. Sintesi: 5 cose da sapere

1. **Il progetto ha 5 settimane di vita, 65.000 righe di codice, e un singolo contributor.** 167 commit su 182 sono negli ultimi 30 giorni. La velocita di sviluppo e estrema. Il 56% dei commit recenti sono fix, 0% refactoring.

2. **Tutto e 🟡 PARZIALE: nessun modulo e completo per standard production.** Backend e frontend esistono per tutti i 10 moduli dichiarati, la build passa, i tipi compilano. Ma 10 API route non hanno auth guard nel file, zero test UI/E2E, analytics ha zero test, e il file piu grande del progetto (1.804 righe) non e mai stato spezzato.

3. **11 dipendenze npm sono installate e mai importate** (tutto il layer Radix/shadcn). Il README e ancora il boilerplate create-next-app. `email-ingestion.service.ts` (885 righe, 8 console.log) sembra un approccio legacy che convive con il nuovo email agent senza che sia chiaro quale sia il path attivo.

4. **Il layer AI agent e il punto di massimo investimento e massimo rischio.** 7 agenti, 16 file tool, 34+ tool definitions in un singolo file da 1.804 righe. L'email intelligence agent (818 righe) e il pezzo piu critico: processa email commerciali e crea RDA, commesse, notifiche in autonomia. Il suo test file ha 1 singolo test ("exports processEmail function"). Il blast radius limit (PF-002) e stato aggiunto oggi.

5. **La security sprint odierna ha chiuso 10 gap reali** (encryption TOTP, hash refresh token, 4 IDOR, security headers, file serving autenticato, agent hardening). Ma rimangono route senza auth guard nel file (`/approvals`, `/budgets`, `/vendors`, `/tenders/[id]`, `/notifications`, `/articles/[id]/stock`, `/invoices/[id]/reconcile`, `/requests/[id]/comments`) e non esiste rate limiting applicativo.
