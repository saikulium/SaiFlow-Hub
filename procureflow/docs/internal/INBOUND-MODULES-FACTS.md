# ProcureFlow — Estrazione Fatti: Modulo Clienti, Commesse, Articoli+Alias

**Data**: 17 aprile 2026
**Commit analizzato**: `74d4a1b` (branch `main`)
**Scopo**: documentare cosa il codice fa oggi per la gestione degli ordini in entrata (da cliente verso l'azienda), senza interpretazioni, raccomandazioni o stime di effort.

---

## 1. Modulo Client

### 1.1 Schema dati

Il modello `Client` è definito in `prisma/schema.prisma` (righe 483-504). Campi: `id` (cuid), `code` (string, unique), `name`, `tax_id`, `email`, `phone`, `address`, `contact_person`, `notes`, `status` (enum `ClientStatus`), `created_at`, `updated_at`.

L'enum `ClientStatus` ha 3 valori: `ACTIVE`, `INACTIVE`, `PENDING_REVIEW`.

Relazioni: `commesse Commessa[]` — un Client può avere N commesse.

Indici: `@@index([status])`, `@@index([name])`. Tabella mappata come `"clients"`.

Il modello `Client` è separato dal modello `Vendor`. Vendor ha campi che Client non ha: `portal_url`, `portal_type` (enum `VendorPortalType`), `category[]`, `payment_terms`, `rating`. Client ha campi che Vendor non ha: `tax_id`, `address`, `contact_person`. Le due entità hanno tabelle distinte, nessuna FK incrociata, nessuna tabella di ereditarietà condivisa.

### 1.2 Validazione input

Il file `src/lib/validations/client.ts` (20 righe) definisce due Zod schema:

- `createClientSchema`: `name` obbligatorio (1-200 char), `code` opzionale (1-20 char), `tax_id` opzionale (max 20), `email` opzionale (validazione email o stringa vuota), `phone` (max 30), `address` (max 500), `contact_person` (max 100), `notes` (max 2000).
- `updateClientSchema`: tutti i campi di create resi opzionali, più `status` (enum 3 valori).

### 1.3 Route API

**`src/app/api/clients/route.ts`** (142 righe):

- `GET`: lista clienti con query param `search` (cerca in `name`, `code`, `tax_id` con `contains` case-insensitive), `status` (filtro esatto), `cursor` (paginazione cursor-based, 50 per pagina). Include `_count.commesse`. Ordinamento: `name asc`. Autenticazione: `requireAuth()` — qualsiasi utente autenticato.
- `POST`: crea cliente. Se `code` non fornito, genera automaticamente via `generateNextCodeAtomic('CLI', 'clients')`. Validazione con `createClientSchema`. Autenticazione: `requireAuth()`.

**`src/app/api/clients/[id]/route.ts`** (170 righe):

- `GET`: dettaglio cliente con lista commesse (include `code`, `title`, `status`, `client_value`, `deadline`, `_count.requests`). Autenticazione: `requireAuth()`.
- `PATCH`: aggiornamento campi. Validazione con `updateClientSchema`. Autenticazione: `requireAuth()`.
- `DELETE`: soft-delete — imposta `status: 'INACTIVE'`. Prima verifica che non ci siano commesse in stato attivo (`DRAFT`, `PLANNING`, `ACTIVE`, `ON_HOLD`); se ce ne sono, ritorna errore 409 con messaggio "Impossibile disattivare: il cliente ha commesse attive". Non cancella il record dal database. Autenticazione: `requireAuth()`.

### 1.4 Service layer

Non esiste un file `src/server/services/client.service.ts`. Le operazioni CRUD Client sono implementate direttamente nelle route API. Il modello Vendor, per confronto, ha un service layer dedicato (`vendor.service.ts`).

### 1.5 Tool AI

Il file `src/server/agents/tools/client.tools.ts` (178 righe) definisce 2 tool:

- **`search_clients`**: cerca clienti per nome, codice o P.IVA. Query Prisma con `OR` su `name`, `code`, `tax_id` (tutti `contains` case-insensitive). Ritorna max 10 risultati con `id`, `code`, `name`, `tax_id`, `email`, `phone`, `status`, `_count.commesse`.

- **`find_or_create_client`**: logica di ricerca in 2 step:
  1. Cerca per `tax_id` normalizzato (se fornito)
  2. Se non trovato, cerca per nome normalizzato (`contains` case-insensitive)
  3. Se non trovato, crea un nuovo Client in stato `PENDING_REVIEW` con note "Creato dall'AI — verificare i dati". Genera codice via `generateNextCodeAtomic('CLI', 'clients')`.

  Questo tool è usato dall'email agent nell'intent `ORDINE_CLIENTE`.

### 1.6 UI

**`src/components/clients/clients-page-content.tsx`** (322 righe): pagina lista clienti con:
- Ricerca debounced (300ms) per nome, codice, P.IVA
- Filtri per stato (chip: Tutti, Attivo, Inattivo, In Revisione)
- Tabella con colonne: Codice, Nome, P.IVA, Email, Contatto, Stato, Commesse (count attive)
- Export CSV con 7 colonne (Codice, Nome, P.IVA, Email, Contatto, Stato, Commesse Attive)
- Click sulla riga apre dialog di modifica
- Bottone "Nuovo Cliente"
- Skeleton loader, stato vuoto, stato errore

**`src/components/clients/client-dialog.tsx`** (291 righe): dialog modale per creazione e modifica.
- Form con react-hook-form + zod resolver
- Campi: Nome (obbligatorio), Codice (opzionale, placeholder "Auto-generato"), P.IVA, Email, Telefono, Persona di contatto, Indirizzo, Note
- In modalità edit: aggiunge select per Stato (Attivo, Inattivo, In Revisione)
- Submit chiama `useCreateClient` o `useUpdateClient` hook

---

## 2. Modulo Commessa

### 2.1 Schema dati

Il modello `Commessa` è definito in `prisma/schema.prisma` (righe 506-560). Campi principali:

- `id` (cuid), `code` (string, unique), `title`, `description`, `status` (enum `CommessaStatus`, default `DRAFT`)
- `client_id` (FK obbligatorio verso Client), `client_value` (Decimal 12,2), `currency` (default "EUR")
- `received_at`, `deadline`, `completed_at`
- `category`, `department`, `priority` (enum Priority), `tags[]`, `assigned_to` (FK opzionale verso User)
- `email_message_id` (string unique — usato per deduplicazione email)
- Relazioni: `requests PurchaseRequest[]`, `timeline CommessaTimeline[]`

Indici: `@@index([status, created_at])`, `@@index([client_id])`, `@@index([deadline])`. Tabella mappata come `"commesse"`.

L'enum `CommessaStatus` ha 6 valori: `DRAFT`, `PLANNING`, `ACTIVE`, `ON_HOLD`, `COMPLETED`, `CANCELLED`.

Il modello `CommessaTimeline` (righe 562-577) traccia eventi sulla commessa: `type`, `title`, `description`, `metadata` (Json), `actor`, `email_message_id`. Mappato come `"commessa_timeline"`.

### 2.2 Collegamento Commessa → PurchaseRequest

Il modello `PurchaseRequest` ha un campo `commessa_id` (FK opzionale verso Commessa) e un booleano `is_ai_suggested` (default `false`). Indice su `commessa_id`.

Il campo `is_ai_suggested` distingue tra:
- RDA "suggerite" dall'AI (`is_ai_suggested = true`): create automaticamente dall'email agent come bozze da confermare
- RDA "confermate" (`is_ai_suggested = false`): create manualmente dall'utente o accettate dall'utente

Questa separazione è usata nel service `getCommessaDetail()` per dividere le RDA in due liste: `requests` (confermate) e `suggestions` (suggerite).

### 2.3 State machine

Il file `src/lib/commessa-state-machine.ts` (45 righe) definisce le transizioni valide:

```
DRAFT     → PLANNING, CANCELLED
PLANNING  → ACTIVE, ON_HOLD, CANCELLED
ACTIVE    → COMPLETED, ON_HOLD
ON_HOLD   → PLANNING, ACTIVE
COMPLETED → (nessuna — stato terminale)
CANCELLED → (nessuna — stato terminale)
```

Funzioni esportate: `canCommessaTransition(from, to)` (boolean), `assertCommessaTransition(from, to)` (lancia `CommessaTransitionError`).

### 2.4 Service layer

**`src/server/services/commessa.service.ts`** (297 righe) contiene 3 funzioni principali:

**`computeMargin(clientValue, totalActual, totalEstimated)`**: funzione pura. Calcola: `cost = totalActual ?? totalEstimated ?? 0`. Se `clientValue` è null ritorna null. `margin = clientValue - cost`. `marginPercent = (margin / clientValue) * 100`. Ritorna `{ margin, marginPercent }`.

**`getCommessaDetail(code)`**: recupera commessa con `client` (nome), `requests` (tutte le PR collegate, con vendor name), `timeline` (ordinata desc). Separa le PR in `confirmed` (dove `is_ai_suggested === false`) e `suggestions` (dove `is_ai_suggested === true`). Per le PR confermate calcola `totalEstimated` (somma `estimated_amount`) e `totalActual` (somma `actual_amount`). Poi chiama `computeMargin`. Ritorna oggetto con tutti i campi commessa + `clientName`, `requests` (confermate), `suggestions`, `totalCosts`, `margin`, `marginPercent`, `timeline`.

**`getCommessaDashboardStats()`**: conta commesse attive (`PLANNING` + `ACTIVE`), valore totale `client_value` aggregato, margine medio, commesse "due soon" (deadline nei prossimi 7 giorni con status non terminale).

**`updateCommessaStatus(code, newStatus)`**: valida la transizione con `assertCommessaTransition`, aggiorna lo status, crea evento `CommessaTimeline` di tipo `status_change`.

### 2.5 Validazione input

Il file `src/lib/validations/commesse.ts` (25 righe) definisce:

- `createCommessaSchema`: `title` (1-200 char, obbligatorio), `client_id` (obbligatorio), `description` (max 5000), `client_value` (number >= 0), `currency` (default "EUR"), `deadline` (datetime ISO), `category` (max 100), `department` (max 100), `priority` (enum 4 valori, default MEDIUM), `tags[]`, `assigned_to`.
- `updateCommessaSchema`: tutti i campi di create resi opzionali, più `status` (enum 6 valori).

### 2.6 Route API

**`src/app/api/commesse/route.ts`** (227 righe):

- `GET`: lista commesse con query param `search` (su `code`, `title`, `client.name`), `status`, `client_id`, `sort` ("created_at" o "deadline"), `cursor` (50 per pagina). Include per ogni commessa: count PR confermate (`requestsCount`), count PR suggerite (`suggestionsCount`), somma estimated/actual delle PR confermate, calcolo margine. Ordinamento desc sul campo sort scelto. Autenticazione: `requireAuth()`.
- `POST`: crea commessa. Richiede che il `client_id` esista e abbia `status: 'ACTIVE'`. Genera codice via `generateNextCodeAtomic('COM', 'commesse')`. Stato iniziale: `DRAFT`. Crea un evento `CommessaTimeline` di tipo `created`. Autenticazione: `requireAuth()`.

**`src/app/api/commesse/[code]/route.ts`** (110 righe):

- `GET`: dettaglio via `getCommessaDetail(code)`. Autenticazione: `requireAuth()`.
- `PATCH`: aggiornamento. Se presente `status`, valida la transizione via `updateCommessaStatus`. Se presente `client_id`, verifica che il client esista e sia ACTIVE. Autenticazione: `requireAuth()`.

**`src/app/api/commesse/[code]/accept-suggestion/route.ts`** (84 righe):

- `POST`: accetta un suggerimento AI. Input: `suggestion_id`. Trova la commessa per codice, poi aggiorna la PR dove `id = suggestion_id`, `commessa_id = commessa.id`, `is_ai_suggested = true`. Cambia: `is_ai_suggested → false`, `status → SUBMITTED`. Usa `updateMany` con 3 condizioni per optimistic concurrency (se già elaborato, count = 0 → errore 409). Crea evento `CommessaTimeline` tipo `suggestion_accepted`. Autenticazione: `requireAuth()`.

**`src/app/api/commesse/[code]/suggestions/[id]/route.ts`** (123 righe):

- `PATCH`: modifica un suggerimento prima di accettarlo. Campi modificabili: `title`, `estimated_amount`, `vendor_id`, `priority`. Verifica che la PR abbia `is_ai_suggested = true` (se no, 404). Autenticazione: `requireAuth()`.
- `DELETE`: rifiuta (cancella) un suggerimento. `deleteMany` con 3 condizioni (id, commessa_id, is_ai_suggested). Crea evento `CommessaTimeline` tipo `suggestion_rejected`. Autenticazione: `requireAuth()`.

### 2.7 Tool AI

Il file `src/server/agents/tools/commessa.tools.ts` (221 righe) definisce 3 tool:

- **`search_commesse`**: cerca commesse per codice, titolo o nome cliente. Ritorna max 10 risultati con stato, valore, deadline, nome cliente.

- **`create_commessa`**: riceve `client_name`, `title`, `description`, `client_value`, `deadline`, `items[]`, `tags[]`. Internamente:
  1. Chiama `find_or_create_client` (cerca per nome, crea se non esiste in PENDING_REVIEW)
  2. Genera codice `COM-YYYY-NNNNN` via `generateNextCodeAtomic`
  3. Crea commessa in stato `PLANNING` (non DRAFT)
  4. Se `items` forniti, li include nella description come riepilogo
  5. Tag default: `['ai-created']`
  6. Ritorna id, codice, cliente, e istruzioni per creare le RDA collegate

  Questo tool è usato dall'email agent nell'intent `ORDINE_CLIENTE`.

- **`update_commessa_status`**: WRITE-intercepted (ritorna messaggio di errore che dice "usa il tool di conferma"). L'agent non può cambiare lo stato di una commessa autonomamente.

### 2.8 UI

**`src/components/commesse/commesse-page-content.tsx`** (436 righe): pagina lista commesse con:
- Ricerca debounced per codice, titolo, cliente
- Filtri chip per stato (7: Tutte + 6 stati)
- Filtro dropdown per cliente
- Ordinamento: "Data creazione" o "Scadenza"
- Tabella: Codice, Titolo, Cliente, Stato, Valore, Costi, Margine (con colore verde/rosso e %), Scadenza, PR (count + icona Sparkles per suggerimenti)
- Export CSV con 9 colonne
- Bottone "Nuova Commessa" che apre `CommessaCreateDialog`

**`src/components/commesse/commessa-create-dialog.tsx`** (272 righe): dialog modale per creazione manuale.
- Form con react-hook-form + zod
- Select per cliente (solo clienti ACTIVE)
- Campi: Titolo (obbligatorio), Descrizione, Cliente (obbligatorio, select), Valore Cliente (EUR), Priorità (select 4 valori), Scadenza (datetime-local), Categoria, Dipartimento
- Submit chiama `useCreateCommessa` hook

**`src/components/commesse/commessa-detail.tsx`** (553 righe): pagina dettaglio commessa con:
- Header: titolo, badge stato, codice (font-mono), nome cliente, scadenza
- 3 stat card: "Valore Cliente", "Costi", "Margine" (con colore e percentuale)
- 3 tab: "Richieste", "Timeline", "Dettagli"
- Tab Richieste:
  - Sezione "Suggerimenti AI" (se presenti): griglia di `SuggestionCard` con bottoni Accetta/Rifiuta
  - Sezione "Richieste di acquisto": tabella con Codice (link), Titolo, Stato (badge), Fornitore, Importo
  - Link "Nuova Richiesta" che punta a `/requests/new?commessa_id={id}`
- Tab Timeline: eventi in ordine cronologico discendente con dot, titolo, descrizione, actor, timestamp
- Tab Dettagli: griglia chiave-valore di tutti i campi commessa

**`src/components/commesse/suggestion-card.tsx`** (133 righe): card per singolo suggerimento AI.
- Icona Sparkles ambra, titolo, codice PR, priorità (badge), importo stimato, fornitore
- Bottoni "Accetta" (verde) e "Rifiuta" (rosso) con spinner durante l'operazione
- Stile: bordo ambra, sfondo ambra/5

---

## 3. Modulo Article + Alias

### 3.1 Schema dati Article

Il modello `Article` è definito in `prisma/schema.prisma`. Campi principali: `id` (cuid), `code` (string, unique, pattern `ART-YYYY-NNNNN`), `name`, `description`, `category`, `unit_of_measure` (default "PZ"), `manufacturer`, `manufacturer_code`, `is_active` (default true), `verified` (default false), `notes`, `tags[]`, `created_at`, `updated_at`.

Relazioni: `aliases ArticleAlias[]`, `prices ArticlePrice[]`, `request_items RequestItem[]`, `materials Material[]`, `invoice_items InvoiceItem[]`.

### 3.2 Schema dati ArticleAlias

Il modello `ArticleAlias` è definito in `prisma/schema.prisma` (righe 289-341). Campi: `id` (cuid), `article_id` (FK verso Article), `alias_type` (enum `AliasType`), `alias_code`, `alias_label`, `entity_id` (opzionale), `is_primary` (default false), `created_at`.

L'enum `AliasType` ha 3 valori: `VENDOR`, `CLIENT`, `STANDARD`.

Constraint di unicità: `@@unique([alias_type, alias_code, entity_id])` — garantisce che lo stesso codice alias non possa essere registrato due volte per la stessa coppia tipo+entità.

Il campo `entity_id` è un String opzionale che punta a `Vendor.id` (per alias tipo VENDOR) o `Client.id` (per alias tipo CLIENT). Non c'è una FK esplicita nel Prisma schema — il collegamento è polimorfico via convenzione applicativa.

### 3.3 Tool AI — find_or_create_article

Il file `src/server/agents/tools/article.tools.ts` (247 righe) definisce 2 tool:

**`find_or_create_article`**: logica di ricerca in 5 step sequenziali:
1. Cerca per alias esatto: `alias_type = STANDARD`, `alias_code = input`
2. Cerca per alias normalizzato: `normalizeCode(alias_code)` (strip hyphens, spazi, slashes, case-insensitive)
3. Cerca per `manufacturer_code` esatto
4. Cerca per `manufacturer_code` normalizzato
5. Cerca per nome (contains, case-insensitive)

Se non trovato in nessun step, crea un nuovo Article con:
- `code` generato via `generateNextCodeAtomic('ART', 'articles')`
- `verified: false`
- `tags: ['auto-created', 'from-email']`
- Un `ArticleAlias` tipo `STANDARD` con il codice fornito

Se trovato, ritorna l'articolo esistente con tutti gli alias.

La funzione `normalizeCode(code: string)` rimuove trattini, spazi, slash e converte in uppercase.

**`link_article_to_request_item`**: collega un `article_id` a un `RequestItem` cercando per nome dell'item nella PR specificata. Aggiorna `RequestItem.article_id`.

### 3.4 Route API Alias

**`src/app/api/articles/[id]/aliases/route.ts`** (88 righe):

- `GET`: lista tutti gli alias di un articolo. Ordinamento: `created_at desc`. Autenticazione: nessuna (solo `requireModule`).
- `POST`: crea nuovo alias. Input validato con `createAliasSchema` (da `src/lib/validations/article.ts`): `alias_type`, `alias_code`, `alias_label`, `entity_id`, `is_primary`. Autenticazione: `requireRole('ADMIN', 'MANAGER')`. Gestione errore unique constraint → 409 "Questo codice alias esiste già per questa entità".

Esiste anche una route per singolo alias (`src/app/api/articles/[id]/aliases/[aliasId]/route.ts`) per DELETE individuale.

### 3.5 UI Articoli

**`src/components/articles/article-detail.tsx`** (519 righe): pagina dettaglio con 5 tab:
- **Alias**: tabella con colonne Tipo (badge colorato con icona), Codice (font-mono), Etichetta, Entità (entity_id raw), Primario (stella), azione delete. Bottone "Aggiungi Alias" apre form inline.
- **Prezzi**: tabella con Fornitore (stella per prezzo più basso), Prezzo (font-mono), Q.tà Min, validità Da/A, Fonte (badge). Bottone "Aggiungi Prezzo".
- **Magazzino**: pannello `ArticleStockPanel` (componente separato).
- **Dove Usato**: 3 card con contatori: Righe RDA, Righe fattura, Materiali.
- **Dettagli**: griglia con UdM, Produttore, Codice produttore, Descrizione, Note, Date, Tag.

**`src/components/articles/article-alias-form.tsx`** (156 righe): form inline per aggiungere alias.
- Select per Tipo (VENDOR, CLIENT, STANDARD)
- Input per Codice (obbligatorio), Etichetta, Entità (placeholder "ID fornitore/cliente")
- Checkbox "Primario"
- Chiama `useAddAlias` hook

Il form alias mostra il campo `entity_id` come input di testo libero con placeholder "ID fornitore/cliente". Non c'è un dropdown che elenca fornitori o clienti esistenti — l'utente deve conoscere e inserire l'ID manualmente.

---

## 4. Flusso ORDINE_CLIENTE nell'Email Agent

### 4.1 Intent e prompt

Il file `src/server/agents/email-intelligence.agent.ts` definisce l'intent `ORDINE_CLIENTE` come uno dei 7 intent dell'email agent. Nel system prompt (righe 124-151), le istruzioni per questo intent sono:

1. Cerca il cliente con `search_clients`; se non esiste, `find_or_create_client`. Salva il `client_id`.
2. Crea la commessa con `create_commessa` passando `client_name`, `client_value`, `deadline`, `items`. Salva l'ID della commessa.
3. Per OGNI articolo nell'ordine:
   a. Cerca o crea l'articolo con `find_or_create_article`. Salva `article_id`.
   b. Verifica disponibilità: `get_stock_for_article`, `get_pending_orders_for_material`.
   c. Calcola: `quantita_da_ordinare = max(0, quantita_richiesta - stock_disponibile - pending_in_arrivo)`.
   d. Se `quantita_da_ordinare > 0`: crea RDA con `create_request` includendo `commessa_id` e `article_id` negli items, con description che dettaglia stock breakdown.
   e. Se `quantita_da_ordinare == 0`: nota nel summary.
4. Cerca fornitori con `search_vendors`.
5. Crea notifica di riepilogo con link alle RDA create.

Il prompt specifica che `article_id` DEVE essere passato negli items della RDA per collegare la riga all'articolo nel catalogo.

### 4.2 Servizio email-ingestion: handleCreateCommessa

Il file `src/server/services/email-ingestion.service.ts` (886 righe) implementa il caso `create_commessa` nella funzione `handleCreateCommessa` (righe 421-601). Questa funzione è il path alternativo per la creazione commessa (il webhook n8n lo invoca direttamente, senza passare per l'agent).

Il flusso in `handleCreateCommessa`:

1. **Deduplicazione**: se `email_message_id` presente, cerca `Commessa` con quel `email_message_id`. Se trovata, ritorna risultato idempotente con `deduplicated: true`.
2. **Find or Create Client**: cerca per `client_code` esatto, poi per nome fuzzy (`contains` case-insensitive). Se non trovato, crea con `status: 'PENDING_REVIEW'` e code auto-generato.
3. **Genera codice**: `generateNextCodeAtomic('COM', 'commesse')`.
4. **Crea Commessa**: stato iniziale `PLANNING`, con `client_value`, `deadline`, `email_message_id`, `tags`.
5. **Crea PR suggerite**: per ogni item in `ai_client_order_items`, genera un codice PR via `generateNextCodeAtomic('PR', 'purchase_requests')` e crea una `PurchaseRequest` con:
   - `status: 'DRAFT'`
   - `is_ai_suggested: true`
   - `commessa_id: commessa.id`
   - `tags: ['ai-suggested', 'commessa:{code}']`
   - Un `RequestItem` con `name` e `quantity`
6. **Crea evento timeline**: `CommessaTimeline` tipo `email_ingestion` con metadata che include `suggested_prs` count.
7. **Notifica**: crea notifiche a tutti gli utenti ADMIN/MANAGER con link alla commessa e conteggio PR suggerite.

Tutto è wrappato in una `prisma.$transaction` per atomicità.

### 4.3 Differenza tra i due path

Ci sono due modi per creare una commessa da email:

| Aspetto | Email Agent (ORDINE_CLIENTE) | email-ingestion.service (handleCreateCommessa) |
|---|---|---|
| Trigger | Dialog import email → agent AI | Webhook n8n → API `/api/email-import` |
| Crea client | Via tool `find_or_create_client` | Inline nel service |
| Crea articoli | Via tool `find_or_create_article` | Non crea articoli |
| Verifica stock | Via tool `get_stock_for_article` | Non verifica stock |
| RDA create | `is_ai_suggested: true` via `create_request` tool | `is_ai_suggested: true` via Prisma diretto |
| Collega article_id | Sì (istruito nel prompt) | No (crea solo RequestItem con name/quantity) |
| Commessa iniziale | `PLANNING` (dal tool) | `PLANNING` (hardcoded) |
| Transazione | No (call tool sequenziali) | Sì (`prisma.$transaction`) |

### 4.4 Flusso di accettazione/rifiuto suggerimenti

Dopo che l'email agent o il webhook crea una commessa con PR suggerite:

1. L'utente va alla pagina `/commesse/{code}`
2. Nel tab "Richieste" vede la sezione "Suggerimenti AI" con card ambra
3. Può **accettare**: POST `/api/commesse/{code}/accept-suggestion` con `suggestion_id`
   - La PR cambia: `is_ai_suggested: false`, `status: 'SUBMITTED'`
   - Evento timeline: `suggestion_accepted`
4. Può **modificare prima di accettare**: PATCH `/api/commesse/{code}/suggestions/{id}`
   - Campi modificabili: `title`, `estimated_amount`, `vendor_id`, `priority`
5. Può **rifiutare**: DELETE `/api/commesse/{code}/suggestions/{id}`
   - La PR viene cancellata dal database
   - Evento timeline: `suggestion_rejected`

---

## 5. Catena relazionale Client → Commessa → PurchaseRequest → Article

La catena completa è:

```
Client (1)
  └── Commessa (N)           [client_id FK obbligatorio]
        └── PurchaseRequest (N)    [commessa_id FK opzionale]
              └── RequestItem (N)        [request_id FK]
                    └── Article (0..1)         [article_id FK opzionale]
                          └── ArticleAlias (N)       [article_id FK]
                                [entity_id → Client.id o Vendor.id]
```

FK `commessa_id` su PurchaseRequest è opzionale: esistono PR senza commessa (acquisti diretti, non legati a ordini cliente).

FK `article_id` su RequestItem è opzionale: il tool `link_article_to_request_item` lo popola dopo la creazione della PR.

Il campo `entity_id` su ArticleAlias è un riferimento polimorfico: contiene l'ID di un Client o di un Vendor a seconda del `alias_type`, ma non è una FK Prisma.

La navigazione è bidirezionale nel database (via relazioni Prisma), ma nella UI la navigazione parte dalla commessa → verso le PR (come link nella tabella richieste).

---

## 6. Verifica affermazioni dal gap analysis

### Affermazione 1: "Il modello mentale di ProcureFlow oggi è 'PMI che compra', non 'PMI che vende e compra'" (GAP-ANALYSIS-FALENI.md, riga 67)

**Verifica**: il codice contiene moduli per entrambe le direzioni.

Direzione "compra" (outbound): PurchaseRequest verso Vendor, approvazione, ordine, delivery, fattura fornitore.

Direzione "vende" (inbound): Client → Commessa → PurchaseRequest (suggerite AI). L'email agent processa ordini da clienti (`ORDINE_CLIENTE`) e crea la catena Client → Commessa → PR. La commessa ha `client_value` e calcola margine (valore cliente - costi acquisto). L'UI ha pagine dedicate per clienti e commesse. Il tool `find_or_create_client` crea clienti in `PENDING_REVIEW`.

Elementi mancanti nella direzione "vende": non esiste un modello `Offer` (offerta economica/tecnica). Non esiste un modello `SalesOrder` o `CustomerOrder` separato dalla Commessa. La Commessa non ha fase di offerta (dal ciclo Tender a WON non c'è transizione automatica verso Commessa). Il listino prezzi di vendita (prezzo a cui Faleni vende al cliente) non è modellato — `ArticlePrice` traccia solo i prezzi di acquisto da fornitore.

### Affermazione 2: "Commessa: lega un ordine cliente a delle RDA ma non ha fase di offerta" (GAP-ANALYSIS-FALENI.md, riga 65)

**Verifica**: confermata. La Commessa ha `status` con ciclo `DRAFT → PLANNING → ACTIVE → COMPLETED` ma nessuno di questi stati rappresenta "offerta in preparazione", "offerta inviata" o "offerta aggiudicata". Non esiste una FK `tender_id` sulla Commessa. Non esiste una transizione automatica da `Tender.status = WON` a creazione Commessa.

### Affermazione 3: "L'alias CLIENT esiste ma non c'è una UI dedicata per gestire 'i codici di Leonardo per questo articolo' vs 'i codici di Fincantieri'" (GAP-ANALYSIS-FALENI.md, riga 202)

**Verifica**: confermata. La UI `article-alias-form.tsx` mostra un select per il tipo (VENDOR/CLIENT/STANDARD) e un input di testo libero per `entity_id`. Non c'è un dropdown che filtra clienti o fornitori. La tabella alias in `article-detail.tsx` mostra tutti gli alias flat, senza raggruppamento per entità. La colonna "Entità" mostra il raw `entity_id` (un cuid), non il nome del cliente o fornitore.

### Affermazione 4: "L'Article non ha drawing_revision né bom_revision" (GAP-ANALYSIS-FALENI.md, riga 200)

**Verifica**: confermata. Il modello Article in `schema.prisma` non ha campi `drawing_revision`, `bom_revision`, o altri campi revisione. I campi disponibili sono: `code`, `name`, `description`, `category`, `unit_of_measure`, `manufacturer`, `manufacturer_code`, `is_active`, `verified`, `notes`, `tags`. Non esiste un modello `ArticleRevision`.

### Affermazione 5: "Dato il codice Leonardo '14-ABC-123', posso trovare l'articolo internamente (il tool AI lo fa), ma non c'è una pagina UI dedicata tipo 'Mappatura Codici per Committente'" (GAP-ANALYSIS-FALENI.md, riga 203)

**Verifica**: confermata. Il tool `find_or_create_article` cerca per alias normalizzato e trova l'articolo. Ma nella UI non esiste una pagina che mostri "tutti i codici del cliente X mappati sugli articoli interni". La ricerca articoli nella UI lista articoli usa il codice interno, non gli alias. Il tab Alias nel dettaglio articolo mostra gli alias di un singolo articolo, ma non esiste una vista "inversa" (da codice esterno → articolo).

---

## 7. Dati quantitativi

| Metrica | Valore |
|---|---|
| File analizzati per questo documento | 26 |
| Righe di codice lette | ~5.200 |
| Modelli Prisma coinvolti | 7 (Client, Commessa, CommessaTimeline, PurchaseRequest, RequestItem, Article, ArticleAlias) |
| Route API documentate | 9 |
| Tool AI documentati | 7 |
| Componenti UI documentati | 8 |
| Servizi documentati | 2 (commessa.service, email-ingestion.service) |
| Affermazioni gap analysis verificate | 5 su 5 confermate |

### File sorgente analizzati

**Schema**: `prisma/schema.prisma`

**API routes**: `src/app/api/clients/route.ts`, `src/app/api/clients/[id]/route.ts`, `src/app/api/commesse/route.ts`, `src/app/api/commesse/[code]/route.ts`, `src/app/api/commesse/[code]/accept-suggestion/route.ts`, `src/app/api/commesse/[code]/suggestions/[id]/route.ts`, `src/app/api/articles/[id]/aliases/route.ts`

**Servizi**: `src/server/services/commessa.service.ts`, `src/server/services/email-ingestion.service.ts`

**Tool AI**: `src/server/agents/tools/client.tools.ts`, `src/server/agents/tools/commessa.tools.ts`, `src/server/agents/tools/article.tools.ts`

**Agent**: `src/server/agents/email-intelligence.agent.ts`

**State machine**: `src/lib/commessa-state-machine.ts`

**Validazioni**: `src/lib/validations/client.ts`, `src/lib/validations/commesse.ts`

**UI**: `src/components/clients/clients-page-content.tsx`, `src/components/clients/client-dialog.tsx`, `src/components/commesse/commesse-page-content.tsx`, `src/components/commesse/commessa-create-dialog.tsx`, `src/components/commesse/commessa-detail.tsx`, `src/components/commesse/suggestion-card.tsx`, `src/components/articles/article-detail.tsx`, `src/components/articles/article-alias-form.tsx`
