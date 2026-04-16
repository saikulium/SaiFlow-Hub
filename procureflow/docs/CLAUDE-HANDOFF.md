# ProcureFlow — Handoff per Claude

Copia-incolla questo intero file nella prima prompt di una nuova conversazione Claude per dargli contesto completo. Poi puoi fare brainstorming.

---

## Identità del Progetto

**Nome**: ProcureFlow (brand interno: SaiFlow Hub Centralizzato)
**Cos'è**: Hub di procurement centralizzato per **PMI italiane**, in particolare per il settore difesa/aerospazio/elettronica.
**Cliente principale di riferimento**: Faleni SRL (componentistica MIL-SPEC).
**Utente target**: una sola persona in azienda gestisce gli acquisti + un manager che approva.
**Posizionamento competitivo**: vuole differenziarsi da IUNGO, DigitalPA, Zucchetti con funzionalità AI-first su misura per PMI.
**Status**: in sviluppo attivo, pre-produzione. Circa 30 clienti pilota previsti.

---

## Tech Stack

- **Frontend**: Next.js 14 App Router + TypeScript strict + Tailwind CSS + shadcn/ui + TanStack Query
- **Backend**: Next.js API Routes + Prisma ORM + PostgreSQL (hostato su Supabase)
- **Auth**: NextAuth v5 (JWT strategy) + MFA TOTP opzionale
- **AI**: `@anthropic-ai/sdk ^0.78` (Claude Sonnet 4.6, Opus 4.6 per task complessi)
- **Validazione**: Zod v4
- **Testing**: Vitest (~510 test unitari + integration)
- **CI**: GitHub Actions (lint, type-check, test, docker build smoke)
- **Deploy**: Vercel (target) o Docker self-hosted
- **Integrazioni future (non ancora wired)**: n8n per orchestrazione email/cron, Supabase Storage, SES/Postmark per email in uscita

---

## Moduli Prodotto

Il sistema è modulare — ogni modulo può essere abilitato/disabilitato per cliente:

| Modulo | Funzione |
|---|---|
| `core` | PR, approvazioni, fornitori, utenti — sempre attivo |
| `invoicing` | Fatture passive (FatturaPA XML + OCR PDF) + three-way matching |
| `budgets` | Budget per centro di costo con snapshot |
| `analytics` | Dashboard ROI, spend by vendor, trend |
| `tenders` | Gare d'appalto (MEPA/CONSIP style) con go/no-go |
| `inventory` | Magazzino materiali + movimenti + forecast WMA |
| `chatbot` | Assistente AI conversazionale |
| `smartfill` | Auto-compilazione campi PR via AI |
| `commesse` | Commesse cliente (ordini da evadere) + margine |
| `articles` | Anagrafica articoli + alias fornitore/cliente |

---

## Schema Database — Entità Chiave

```
User ─┬─ PurchaseRequest (PR-YYYY-NNNNN) ─┬─ RequestItem (link opzionale ad Article)
      │                                   ├─ Approval
      │                                   ├─ TimelineEvent
      │                                   └─ Attachment
      │
      └─ Notification

Vendor ─┬─ PurchaseRequest
        └─ ArticlePrice (storico prezzi)

Commessa (COM-YYYY-NNNNN) ─┬─ PurchaseRequest (link via commessa_id)
                           ├─ Client
                           └─ CommessaTimeline

Article (ART-YYYY-NNNNN) ─┬─ ArticleAlias (VENDOR | CLIENT | STANDARD)
                          ├─ ArticlePrice
                          ├─ Material (opzionale, se gestito a magazzino)
                          └─ RequestItem

Invoice (FatturaPA) ─┬─ InvoiceLineItem
                     └─ matched_request (PR)

Material ─┬─ StockLot ─ StockMovement
          └─ MaterialAlert (sotto scorta)

Budget ─ BudgetSnapshot (spent/committed/available)

Tender ─ TenderEvaluation (go/no-go)
```

---

## Feature Implementate (status)

### ✅ Complete e funzionanti
- CRUD richieste d'acquisto con stati (DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED → ORDERED → SHIPPED → DELIVERED → INVOICED → RECONCILED → CLOSED)
- Workflow approvazioni multi-step per ruolo
- CRUD fornitori con rating e categorie
- Budget per centro di costo + snapshot
- Fatture FatturaPA XML parser (deterministico) + OCR PDF via Claude Vision
- Three-way matching Ordinato/Ricevuto/Fatturato
- Dashboard con KPI, ROI, spend charts
- Gare d'appalto (CRUD + go/no-go manuale)
- Magazzino: materiali, movimenti, lotti, forecast WMA + AI
- Commesse cliente con calcolo margine
- Anagrafica articoli con alias
- Import articoli da CSV con cross-reference vendor/client codes
- Onboarding wizard per nuovi clienti
- Auth NextAuth v5 + MFA TOTP + sessioni + rate limiting
- Middleware di protezione + per-route `requireAuth` + module guards
- **7 Claude Managed Agents** integrati (vedi sezione dedicata)

### 🟡 Parziali / da migliorare
- **Email import manuale via dialog** — funziona ma: copre solo flusso ORDINE_CLIENTE in modo completo, gli altri intent (conferma ordine, ritardo, variazione prezzo) sono solo classificati, non azionati in modo ricco
- **Sistema verifica articoli auto-creati** — campo `verified` + UI review c'è, ma non c'è ancora il merge suggestion (deduplicazione AI)
- **RDA auto-generate dall'agente** — vengono create ma l'operatore deve modificare le quantità manualmente (le quantità sono quelle richieste dal cliente, non quelle necessarie da ordinare dopo aver scalato il magazzino)
- **Compliance monitor agent** — esiste, endpoint `/api/agents/compliance` funziona, ma non c'è cron scheduler né UI che lo invoca
- **Smart reorder agent** — esiste, endpoint `/api/agents/reorder` funziona, ma nessun cron né bottone nell'UI inventario

### 🔴 Non implementate
- **Sostituzione completa n8n** — mancano: IMAP client polling, nodemailer per invio email, cron scheduling interno
- **PEC ingestion automatica** — oggi l'utente deve incollare l'email nel dialog
- **Reconciliation UI panel** — l'agente di riconciliazione esiste ma non c'è un bottone nella pagina fattura per invocarlo
- **Tender analysis UI panel** — agente Opus esiste, endpoint esiste, ma nessuna UI per caricare il PDF della gara
- **Vendor Sync Agent** — non creato (il workflow n8n 4 — polling portali fornitori)
- **Weekly report automatico** — non implementato
- **Dead letter queue per email failed** — non c'è
- **Deduplicazione articoli assistita da AI** — il campo `verified` c'è ma la logica di merge suggestion no

---

## 7 Claude Managed Agents

Tutti usano `client.beta.messages.toolRunner()` dal SDK Anthropic (tranne procurement-assistant che usa manual loop per intercettare WRITE tools) e `betaZodTool` per tools tipizzati con Zod.

| Agent | File | Modello | Endpoint | Status |
|---|---|---|---|---|
| **Procurement Assistant** | `src/server/agents/procurement-assistant.agent.ts` | Sonnet 4.6 | `/api/chat` (SSE) | Funzionante, in uso |
| **Email Intelligence** | `src/server/agents/email-intelligence.agent.ts` | Sonnet 4.6 | `/api/email-import` + webhook classify | Funzionante per ORDINE_CLIENTE, da estendere agli altri intent |
| **Invoice Reconciliation** | `src/server/agents/invoice-reconciliation.agent.ts` | Sonnet 4.6 | `/api/agents/reconcile` | Backend pronto, UI da wire |
| **Smart Reorder** | `src/server/agents/smart-reorder.agent.ts` | Sonnet 4.6 | `/api/agents/reorder` | Backend pronto, trigger da wire (cron/UI) |
| **Tender Analysis** | `src/server/agents/tender-analysis.agent.ts` | **Opus 4.6 + adaptive thinking + Files API** | `/api/agents/tender-analysis` | Backend pronto, UI da wire |
| **Compliance Monitor** | `src/server/agents/compliance-monitor.agent.ts` | Sonnet 4.6 | `/api/agents/compliance` | Backend pronto, cron da wire |
| **Onboarding** | `src/server/agents/onboarding.agent.ts` | Sonnet 4.6 + Files API | `/api/agents/onboarding` | Backend pronto, UI da wire |

### Shared Tools Layer (betaZodTool)

Cartella `src/server/agents/tools/`:
- `procurement.tools.ts` — 10 tools: search_requests, get_request_detail, search_vendors, get_budget_overview, get_invoice_stats, search_invoices, get_inventory_stats, get_tender_stats, create_request, approve_request
- `notification.tools.ts` — create_notification, create_timeline_event
- `commessa.tools.ts` — search_commesse, create_commessa
- `invoice.tools.ts` — get_invoice_detail, get_order_for_invoice, get_vendor_price_history, update_reconciliation_status
- `inventory.tools.ts` — get_active_alerts, get_material_forecast, get_material_price_history
- `article.tools.ts` — find_or_create_article (con normalizzazione codici per fuzzy matching)

### Pattern WRITE tools

Il procurement-assistant usa un **manual loop** perché deve intercettare i WRITE tools e chiedere conferma all'utente via UI dialog prima dell'esecuzione. Gli altri agenti eseguono i WRITE tools direttamente (smart-reorder crea PR DRAFT senza chiedere, email-intelligence crea commesse e RDA senza chiedere).

Per l'intercezione si usa uno store in-memory in `src/lib/ai/pending-actions.ts` attaccato a `globalThis` (così sopravvive ai hot-reload di Next.js in dev).

---

## Problemi Noti / Debito Tecnico

1. **Dialog di conferma write tools** — L'UX non è ottimale: l'agente mostra uno spinner "Creo richiesta...", poi il dialog di conferma compare in fondo alla chat panel e serve scroll per vederlo. Funziona ma può essere migliorato.

2. **n8n è ancora richiesto** — L'infrastruttura è predisposta per ricevere webhook da n8n (IMAP polling), ma senza n8n non c'è modo automatico di ricevere PEC. L'import manuale via dialog è l'unica via funzionante oggi.

3. **Articoli auto-creati accumulano duplicati** — Il `find_or_create_article` fa fuzzy matching su alias e manufacturer_code, ma se un articolo arriva con un nome leggermente diverso ogni volta, ne crea uno nuovo. Servirebbe un job di deduplicazione post-hoc con suggestions AI.

4. **Le RDA auto-create hanno quantità = quantità cliente** — Se il cliente ordina 500pz e ne hai 200 in magazzino, l'agente crea una RDA da 500, non da 300. L'operatore deve modificare manualmente. Il prompt ora glielo dice nella description, ma la logica giusta sarebbe che l'agente interroghi il magazzino (ha `get_inventory_stats` ma non un "get stock for article X").

5. **Chat state non persistente** — Se l'operatore chiude il chat panel e lo riapre, perde i messaggi. Sarebbe utile persistere l'ultima conversazione in localStorage o DB.

6. **Cost tracking AI** — Non c'è un sistema per tracciare i costi Anthropic per tenant/utente. Con 30 clienti e agenti multi-step, serve monitoring.

7. **Nessun rate limit per tenant sugli agenti** — Un tenant potrebbe invocare `/api/email-import` 1000 volte e consumare tutta la quota Anthropic. Il rate limit c'è solo sul chat (10/min per utente).

8. **Dev environment fragile** — In dev, il Supabase è condiviso e a volte va in pausa (auto-pause dopo 7gg di inattività). Il dev server ha avuto casi di disco pieno (Next.js `.next` cache cresce molto).

9. **Test coverage bassa su componenti UI** — 510 test totali ma quasi tutti unit/integration su servizi backend. Zero test E2E (Playwright è menzionato in CLAUDE.md ma non configurato).

10. **Middleware + RBAC non uniformi** — Alcune API route usano `requireAuth()`, altre `requireRole('ADMIN', 'MANAGER')`, alcune non hanno guard e si affidano al middleware. C'è stato un audit di sicurezza (`fix: seal auth gaps on 5 API routes`) ma non è stato esaustivo.

---

## Design System

**Filosofia**: "Industrial Luxe" — eleganza enterprise (ispirazione Linear, Vercel Dashboard, Raycast) con calore italiano.

**Palette principale** (tema dark):
- Background: `#0A0A0B` → `#141416` → `#1C1C1F`
- Accent: `#6366F1` (indigo)
- Semantic: `#22C55E` success, `#F59E0B` warning, `#EF4444` danger

**Typography**:
- Display: Satoshi / SF Pro Display
- Body: Inter / SF Pro Text
- Mono: JetBrains Mono

**Layout**:
- Sidebar 260px (collapsible 64px)
- Content max-width 1280px
- Card radius 12px, button 8px, badge 6px
- Transizioni 150ms cubic-bezier
- Staggered animations su card list

Tutti i componenti sono in `src/components/`:
- `ui/` primitive (shadcn-based)
- `layout/` shell, sidebar, header
- Un folder per feature: `requests/`, `vendors/`, `invoices/`, `budgets/`, `tenders/`, `inventory/`, `commesse/`, `articles/`, `chat/`, `onboarding/`, `analytics/`, `admin/`

---

## Workflow di Sviluppo Corrente

- Branch strategy: `main` + branch di feature mergiati rapidamente
- Nightly review automatizzata (commit con prefix `fix: ... (nightly review)`)
- Commit semantici (feat, fix, refactor, chore, test, docs)
- Test runner: `npx vitest run`
- Type check: `npx tsc --noEmit`
- DB migrations: `npx prisma db push` in dev, `npx prisma migrate dev` per commit schema

---

## Cronologia Recente (ultimi 20 commit)

```
9ab7f43 fix: improve API route consistency (nightly review)
2a53934 fix: timing-safe bearer auth, type safety, and auth rate limiting (nightly review)
d819ebb fix: improve API route consistency (nightly review)
d95aea7 fix: resolve TypeScript errors (nightly auto-fix)
98cdd74 test: integration tests for email ingestion service and classify webhook
c3d9c8e fix: seal auth gaps on 5 API routes + bcrypt DoS guard
701c8ee fix: email agent RDAs now include verify-quantity note in description
b9e675d fix: widen article status column to show Verifica button
bf395f9 feat: article verification system — verified field + smart dedup + review UI
b249b9a feat: email agent creates articles + links RDAs to commessa
d1128c7 feat: email agent now creates RDAs for each item in client orders
a0acf0f feat: connect email import to Email Intelligence Agent
4fee0a8 chore: project cleanup — remove stale worktree, dead code, temp files
8210106 fix: use globalThis for pending actions store to survive Next.js hot-reload
41e627c fix: remove debug logs from chat route
9fefb94 fix: force agent to call write tools immediately without text confirmation
5946c0a fix: chat 400 error from empty assistant messages in payload
c990498 fix: rewrite use-chat hook to prevent isStreaming stuck state
c6aad4d fix: remove double-confirmation in chat agent
c08d28e feat: integrate Claude managed agents for PMI procurement automation  ← il commit grande degli agenti
```

---

## Domande Aperte per il Brainstorming

Queste sono le aree dove più serve una visione d'insieme:

1. **Come rendere l'email ingestion davvero automatico** senza n8n? Mettere un IMAP client nel backend Next.js? Delegare a un worker esterno? Usare SES inbound routing?

2. **Deduplicazione articoli intelligente** — quando l'agente dovrebbe suggerire un merge? Real-time durante la creazione, o batch ogni notte? Con quale modello (regole fisse, AI embedding, AI reasoning)?

3. **Cross-reference automatico da fatture** — quando una fattura matcha un ordine, creare automaticamente alias VENDOR tra il codice fornitore sulla fattura e l'articolo ordinato. Questo si autoalimenterebbe nel tempo. Farlo subito o dopo validazione operatore?

4. **Smart Reorder Agent attivazione** — cron giornaliero? bottone manuale nella dashboard? trigger quando arriva una MaterialAlert nuova? Tutte e tre le opzioni?

5. **Multi-tenant** — oggi c'è un `tenant_id: 'default'` hardcoded in molti posti. Come scalare a 30 clienti senza rompere tutto? Row-level security Postgres o filtering applicativo?

6. **Monetizzazione e pricing AI** — Claude Sonnet 4.6 costa $3/$15 per 1M token. Con prompt caching e agenti multi-step, qual è il costo realistico per tenant/mese? Va addebitato al cliente in fattura separata o incluso nel canone?

7. **Audit trail AI** — Ogni azione fatta da un agente (crea PR, crea commessa, notifica) deve essere tracciabile: chi (umano) ha scatenato l'azione, quale agente l'ha eseguita, con quale prompt, quale output. Non esiste ancora.

8. **Disaster recovery / rollback agenti** — Se l'agente crea 50 RDA sbagliate per un bug nel prompt, come si rollbackano? Soft delete? Stato "pending_review" globale prima di commit?

9. **Gestione timezone/i18n** — Oggi tutto è in italiano hardcoded e timezone Europe/Rome. Strategia per internazionalizzazione futura?

10. **Testing degli agenti** — Come testare un agente che chiama Claude API? Mock completo? Recording/replay? Valutazione con golden set di email?

---

## Working Directory & Git

- Repo root: `/Users/kiraah/Downloads/SaiFlow Hub Centralizzato/`
- App directory: `/Users/kiraah/Downloads/SaiFlow Hub Centralizzato/procureflow/`
- Branch: `main`
- Clean tree: generalmente sì, con commit frequenti
- Last commit: vedi sezione cronologia sopra

---

## Come Usare Questo Handoff

Quando apri una nuova conversazione con Claude per brainstorming:

1. Incolla questo intero documento come primo messaggio
2. Aggiungi in fondo: *"Questo è il contesto del progetto. Voglio fare brainstorming su [TEMA SPECIFICO]. Non serve che tu tocchi codice — rispondi come un senior engineer/product manager che conosce il dominio procurement italiano."*
3. Se l'obiettivo è implementazione, aggiungi: *"Questa è la sessione di planning. Alla fine voglio un piano d'azione concreto con task ordinati."*

Per la massima qualità, usa **Claude Opus 4.6** con adaptive thinking per brainstorming su decisioni architetturali complesse (domande 1, 4, 5, 7, 8 della lista sopra).
