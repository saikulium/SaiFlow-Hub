# ProcureFlow — Descrizione Completa dei Processi

> Documento generato per il Procurement Hub di SaiFlow.
> Versione: 1.0 | Data: 2026-03-11

---

## Indice

1. [Panoramica Sistema](#1-panoramica-sistema)
2. [Processo 1 — Creazione Richiesta di Acquisto](#2-processo-1--creazione-richiesta-di-acquisto)
3. [Processo 2 — Workflow di Approvazione](#3-processo-2--workflow-di-approvazione)
4. [Processo 3 — Invio Ordine al Fornitore](#4-processo-3--invio-ordine-al-fornitore)
5. [Processo 4 — Ingestion Email (n8n → App)](#5-processo-4--ingestion-email-n8n--app)
6. [Processo 5 — Tracking Consegne](#6-processo-5--tracking-consegne)
7. [Processo 6 — Gestione Fornitori](#7-processo-6--gestione-fornitori)
8. [Processo 7 — Notifiche e Timeline](#8-processo-7--notifiche-e-timeline)
9. [Processo 8 — Analytics e Reporting](#9-processo-8--analytics-e-reporting)
10. [Processo 9 — Commenti e Collaborazione](#10-processo-9--commenti-e-collaborazione)
11. [Processo 10 — Allegati e Documentazione](#11-processo-10--allegati-e-documentazione)
12. [Macchina a Stati — Ciclo di Vita Richiesta](#12-macchina-a-stati--ciclo-di-vita-richiesta)
13. [Sicurezza e Autenticazione](#13-sicurezza-e-autenticazione)
14. [Flusso End-to-End Completo](#14-flusso-end-to-end-completo)

---

## 1. Panoramica Sistema

**ProcureFlow** e un hub centralizzato di procurement progettato per PMI italiane. Orchestra richieste di acquisto multi-vendor, automatizza il tracking e fornisce visibilita totale sul ciclo di procurement.

### Stack Tecnologico

| Componente | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| ORM | Prisma |
| Database | PostgreSQL (Supabase) |
| Automazione | n8n (webhook + IMAP polling) |
| AI | Parsing email con LLM (via n8n) |

### Architettura

```
┌─────────────────────────────────────────────────────┐
│               FRONTEND (Next.js 14)                 │
│  Dashboard ← Requests ← Vendors ← Analytics        │
├─────────────────────────────────────────────────────┤
│               API LAYER (REST Routes)               │
├─────────────────────────────────────────────────────┤
│  Services Layer (Business Logic)                    │
│  ├── approval.service                               │
│  ├── email-ingestion.service                        │
│  ├── vendor-order.service                           │
│  ├── notification.service                           │
│  ├── dashboard.service                              │
│  └── code-generator.service                         │
├─────────────────────────────────────────────────────┤
│  Prisma ORM  ↔  PostgreSQL (Supabase)              │
├─────────────────────────────────────────────────────┤
│  n8n Workflows                                      │
│  ├── Email Ingestion (IMAP polling)                 │
│  ├── AI Parsing (LLM extraction)                    │
│  ├── Order Email Sending                            │
│  └── Vendor Portal Sync                             │
└─────────────────────────────────────────────────────┘
```

### Ruoli Utente

| Ruolo | Permessi |
|---|---|
| **ADMIN** | Accesso completo, approvazione tutte le soglie, gestione sistema |
| **MANAGER** | Gestione richieste, approvazione fino a 5.000€, gestione fornitori |
| **REQUESTER** | Creazione e modifica proprie richieste |
| **VIEWER** | Solo lettura (usato anche per quarantena email sconosciute) |

---

## 2. Processo 1 — Creazione Richiesta di Acquisto

### Obiettivo
Permettere a qualsiasi utente autorizzato di creare una richiesta di acquisto strutturata, con codice univoco, articoli dettagliati e categorizzazione per centro di costo.

### Trigger
- Utente compila il form nella UI (`/requests/new`)
- Oppure: email in ingresso che genera automaticamente una richiesta (vedi Processo 4)

### Flusso

```
Utente compila form
  │
  ▼
POST /api/requests
  │
  ├─ Validazione Zod (titolo, importo, vendor, items...)
  │
  ├─ Generazione codice atomico (PR-2026-NNNNN)
  │   └─ SELECT ... FOR UPDATE in transazione PostgreSQL
  │   └─ Previene duplicati sotto concorrenza
  │
  ├─ Creazione PurchaseRequest (stato: DRAFT)
  │   ├─ Dati: titolo, descrizione, priorita, vendor, importo stimato
  │   ├─ Categorizzazione: categoria, dipartimento, centro di costo, budget
  │   └─ Date: data necessita, consegna attesa
  │
  ├─ Creazione RequestItems (articoli riga)
  │   └─ Per ogni item: nome, quantita, unita, prezzo unitario, prezzo totale, SKU
  │
  └─ Creazione TimelineEvent (tipo: "created")
      └─ Attore: nome utente corrente
```

### Output
- Richiesta in stato **DRAFT** con codice univoco
- Pronta per essere inviata all'approvazione

### File Coinvolti
- `src/app/api/requests/route.ts` — API route
- `src/server/services/code-generator.service.ts` — Generazione codice atomico
- `src/lib/validations/` — Schema Zod

---

## 3. Processo 2 — Workflow di Approvazione

### Obiettivo
Garantire che ogni acquisto sia autorizzato dalla figura appropriata in base all'importo, con fast-path automatico per importi bassi e ruoli senior.

### Soglie di Approvazione

| Importo | Azione | Approvatore Richiesto |
|---|---|---|
| < 500€ | Auto-approvazione | Nessuno (qualsiasi ruolo) |
| 500€ – 4.999€ | Approvazione MANAGER | MANAGER (o auto se richiedente e MANAGER/ADMIN) |
| >= 5.000€ | Approvazione ADMIN (direzione) | ADMIN (o auto se richiedente e ADMIN) |

### Flusso

```
Utente clicca "Invia per Approvazione"
  │
  ▼
POST /api/requests/[id]/submit
  │
  ├─ Verifica: stato attuale deve essere DRAFT
  │
  ├─ Calcolo fascia: getApprovalTier(importo_stimato)
  │
  ├─ CASO A: Auto-approvazione (importo < 500€ OPPURE ruolo senior)
  │   ├─ Stato: DRAFT → APPROVED
  │   ├─ Crea record Approval (approvatore = richiedente)
  │   ├─ Notifica richiedente
  │   └─ Trigger asincrono: sendOrderToVendor() (Processo 3)
  │
  └─ CASO B: Approvazione manuale
      ├─ Stato: DRAFT → PENDING_APPROVAL
      ├─ Cerca approvatore con ruolo richiesto (MANAGER o ADMIN)
      ├─ Crea record Approval (stato: PENDING)
      └─ Notifica approvatore (tipo: approval_required)
          │
          ▼
      Approvatore riceve notifica → apre coda approvazioni
          │
          ▼
      POST /api/approvals/[id]/decide
          │
          ├─ action: APPROVED
          │   ├─ Aggiorna Approval
          │   ├─ Se tutte le approvazioni OK → APPROVED
          │   ├─ Trigger: sendOrderToVendor()
          │   └─ Notifica richiedente
          │
          └─ action: REJECTED
              ├─ Aggiorna Approval
              ├─ Stato richiesta → REJECTED
              └─ Notifica richiedente
```

### Approvazione Esterna (via n8n)
Possibile anche tramite webhook:
- `POST /api/webhooks/approval-response`
- Payload: `{ approval_id, action, comment }`
- Autenticazione HMAC

### File Coinvolti
- `src/server/services/approval.service.ts` — Logica routing e decisione
- `src/lib/constants/approval-thresholds.ts` — Soglie e ruoli
- `src/app/api/requests/[id]/submit/route.ts` — Endpoint submit
- `src/app/api/approvals/[id]/decide/route.ts` — Endpoint decisione

---

## 4. Processo 3 — Invio Ordine al Fornitore

### Obiettivo
Dopo l'approvazione, inviare automaticamente un ordine formattato al fornitore via email, con codice richiesta nel subject per permettere il matching automatico delle risposte.

### Trigger
- Approvazione completata (auto o manuale)
- Chiamata asincrona e non-bloccante

### Flusso

```
Approvazione completata → APPROVED
  │
  ▼
sendOrderToVendor(requestId)
  │
  ├─ Carica richiesta con vendor, richiedente, items
  │
  ├─ Verifica: vendor esiste e ha email configurata
  │
  ├─ Costruisce email formattata:
  │   ├─ Subject: "[PR-2026-00042] Ordine: Materiale ufficio"
  │   ├─ Body: tabella articoli, importi, date, richiesta conferma
  │   └─ Il [PR-CODE] nel subject permette matching automatico
  │
  ├─ POST verso n8n: /send-order-email
  │   └─ n8n invia via Gmail/SMTP
  │
  ├─ Se successo:
  │   ├─ Stato: APPROVED → ORDERED
  │   ├─ Imposta ordered_at = now
  │   └─ TimelineEvent (tipo: order_sent)
  │
  └─ Se fallimento:
      ├─ Log errore
      ├─ TimelineEvent (tipo: order_warning)
      └─ Non blocca il flusso principale
```

### File Coinvolti
- `src/server/services/vendor-order.service.ts` — Costruzione e invio ordine
- Dipende da: `N8N_WEBHOOK_BASE_URL` in .env

---

## 5. Processo 4 — Ingestion Email (n8n → App)

### Obiettivo
Automatizzare la creazione e aggiornamento di richieste di acquisto a partire da email in ingresso, parsate dall'AI tramite n8n. Supporta 3 azioni: creazione, aggiornamento, solo informazione.

### Trigger
- n8n polling IMAP (ogni 5 minuti)
- n8n parsa email con LLM → estrae dati strutturati
- n8n invia payload arricchito al webhook

### Flusso Generale

```
Email ricevuta (IMAP)
  │
  ▼
n8n: AI parsing (LLM)
  │ Estrae: mittente, fornitore, articoli, importi, tracking, stato
  │ Determina action: new_request | update_existing | info_only
  │
  ▼
POST /api/webhooks/email-ingestion
  │
  ├─ Autenticazione: HMAC signature O Bearer token
  ├─ Validazione Zod del payload
  │
  └─ processEmailIngestion(payload)
      │
      ├─ ACTION: new_request (nuova richiesta)
      │   ├─ Deduplicazione: verifica email_message_id univoco
      │   ├─ Risoluzione richiedente (email → User)
      │   │   └─ Se sconosciuto: assegna ad ADMIN con ruolo VIEWER (quarantena)
      │   ├─ Risoluzione fornitore (codice o nome)
      │   │   └─ Se non trovato: crea automaticamente con status PENDING_REVIEW
      │   ├─ Generazione codice atomico
      │   ├─ Crea PurchaseRequest (DRAFT) + Items + Allegati
      │   ├─ Se richiedente MANAGER/ADMIN → auto-approvazione
      │   └─ Notifica tutti ADMIN/MANAGER
      │
      ├─ ACTION: update_existing (aggiornamento)
      │   ├─ Cerca richiesta esistente:
      │   │   ├─ Per codice PR nel payload
      │   │   ├─ Per codice PR nel subject email (regex)
      │   │   ├─ Per riferimento esterno
      │   │   └─ Fallback: crea come nuova
      │   ├─ Deduplicazione timeline (email_message_id)
      │   ├─ Aggiorna campi: stato, tracking, data consegna, importo effettivo
      │   ├─ Validazione transizione stato (soft: log warning se invalida)
      │   ├─ Aggiunge nuovi articoli
      │   └─ Notifica richiedente
      │
      └─ ACTION: info_only (solo informazione)
          ├─ Cerca richiesta esistente
          └─ Crea TimelineEvent informativo
```

### Campi AI Estratti dal Payload

| Campo | Descrizione |
|---|---|
| `ai_title` | Titolo richiesta |
| `ai_description` | Descrizione dettagliata |
| `ai_vendor_code` / `ai_vendor_name` | Identificazione fornitore |
| `ai_items[]` | Articoli con nome, quantita, prezzo |
| `ai_estimated_amount` | Importo stimato totale |
| `ai_actual_amount` | Importo effettivo (per aggiornamenti) |
| `ai_status_update` | Nuovo stato (ORDERED, SHIPPED, DELIVERED...) |
| `ai_tracking_number` | Numero tracking spedizione |
| `ai_external_ref` | Riferimento ordine fornitore |
| `ai_needed_by` | Data necessita |
| `ai_expected_delivery` | Data consegna prevista |
| `ai_confidence` | Confidenza AI (0-1) |
| `ai_priority` | Priorita stimata |

### Misure di Sicurezza
- **Deduplicazione**: `email_message_id` univoco su PurchaseRequest e indicizzato su TimelineEvent
- **Quarantena**: mittenti sconosciuti assegnati con ruolo VIEWER (niente auto-approvazione)
- **Auto-creazione fornitore**: status PENDING_REVIEW richiede validazione manuale

### File Coinvolti
- `src/app/api/webhooks/email-ingestion/route.ts` — Endpoint webhook
- `src/server/services/email-ingestion.service.ts` — Logica di processing
- `src/lib/validations/email-ingestion.ts` — Schema Zod

---

## 6. Processo 5 — Tracking Consegne

### Obiettivo
Monitorare le consegne attese, evidenziare ritardi e aggiornare automaticamente lo stato tramite email dal fornitore.

### Fonti di Aggiornamento

1. **Manuale (UI)**: utente aggiorna stato da ORDERED → SHIPPED → DELIVERED
2. **Automatico (Email)**: fornitore risponde con conferma spedizione/consegna → n8n → email ingestion → aggiorna stato e tracking
3. **Futuro (API Vendor)**: polling portali fornitore con API

### Dashboard Consegne

La dashboard mostra le consegne imminenti:

```
getDashboardStats() → overdue_deliveries
getUpcomingDeliveries(5) → lista ordinata per data consegna

Priorita visualizzazione:
  - 🔴 SCADUTA: expected_delivery < oggi
  - 🟡 A RISCHIO: expected_delivery entro 3 giorni
  - 🟢 IN TEMPO: expected_delivery > 3 giorni
```

### Transizioni di Stato

```
ORDERED → SHIPPED (tracking number aggiunto)
SHIPPED → DELIVERED (delivered_at impostato)
```

### File Coinvolti
- `src/server/services/dashboard.service.ts` — Query consegne
- `src/app/(dashboard)/page.tsx` — Widget consegne
- `src/lib/state-machine.ts` — Validazione transizioni

---

## 7. Processo 6 — Gestione Fornitori

### Obiettivo
Mantenere un anagrafica fornitori centralizzata con contatti, rating, categorie e stato, integrabile con il flusso di acquisto.

### Operazioni CRUD

| Operazione | Endpoint | Descrizione |
|---|---|---|
| Lista | `GET /api/vendors` | Ricerca per nome, filtro per stato |
| Creazione | `POST /api/vendors` | Codice univoco, validazione |
| Dettaglio | `GET /api/vendors/[id]` | Info completa + contatti |
| Modifica | `PATCH /api/vendors/[id]` | Aggiornamento campi |
| Eliminazione | `DELETE /api/vendors/[id]` | Rimozione (se senza richieste) |

### Auto-Creazione (da Email Ingestion)

Quando l'AI identifica un fornitore non presente nel sistema:
- Crea automaticamente con codice `AUTO-{NOME}-{TIMESTAMP}`
- Status: **PENDING_REVIEW** (richiede validazione manuale)
- Utente puo poi completare i dati e cambiare stato ad ACTIVE

### Attributi Fornitore

| Campo | Descrizione |
|---|---|
| `code` | Codice interno univoco (es. FORN-001) |
| `name` | Ragione sociale |
| `email` | Email per invio ordini |
| `portal_type` | Tipo portale: WEBSITE, EMAIL_ONLY, API, MARKETPLACE, PHONE |
| `category[]` | Categorie merceologiche |
| `payment_terms` | Termini pagamento (es. "30gg DFFM") |
| `rating` | Rating interno 1-5 |
| `status` | ACTIVE, INACTIVE, BLACKLISTED, PENDING_REVIEW |
| `contacts[]` | Contatti associati (nome, ruolo, email, telefono) |

### Webhook Aggiornamento (da n8n)

`POST /api/webhooks/vendor-update` — Sync dati da portali esterni:
- Payload: `{ vendor_code, updates: { name?, email?, rating?, status? } }`
- Autenticazione HMAC

### File Coinvolti
- `src/app/api/vendors/route.ts` — API routes
- `src/app/(dashboard)/vendors/page.tsx` — Pagina UI

---

## 8. Processo 7 — Notifiche e Timeline

### Obiettivo
Garantire che ogni attore coinvolto sia informato in tempo reale degli eventi rilevanti, e che ogni azione sia tracciata in un audit trail immutabile.

### Sistema Notifiche

**Tipi di Notifica:**

| Tipo | Trigger | Destinatario |
|---|---|---|
| `approval_required` | Nuova richiesta da approvare | Approvatore assegnato |
| `approval_decided` | Approvazione/rifiuto completato | Richiedente |
| `status_changed` | Cambio stato richiesta | Richiedente |
| `email_ingestion` | Nuova richiesta da email | Tutti ADMIN/MANAGER |
| `email_update` | Aggiornamento da email | Richiedente |
| `new_comment` | Commento aggiunto | Richiedente + menzionati |

**API:**
- `GET /api/notifications` — Lista paginata con filtro read/unread
- `PATCH /api/notifications` — Segna come lette (batch)
- Badge con contatore notifiche non lette nella sidebar

### Sistema Timeline

Ogni richiesta ha una timeline cronologica con **tutti** gli eventi:

| Tipo Evento | Descrizione |
|---|---|
| `created` | Richiesta creata |
| `status_change` | Cambio stato (con from → to) |
| `approval` | Azione approvazione |
| `comment` | Commento aggiunto |
| `attachment` | Allegato caricato |
| `email_ingestion` | Richiesta creata da email |
| `email_update` | Aggiornamento da email |
| `email_info` | Informazione da email |
| `order_sent` | Ordine inviato al fornitore |
| `order_warning` | Problema invio ordine |

Ogni evento include: **attore**, **timestamp**, **descrizione**, **metadata** (JSON).

### File Coinvolti
- `src/server/services/notification.service.ts` — Creazione notifiche
- TimelineEvent creati in ogni service

---

## 9. Processo 8 — Analytics e Reporting

### Obiettivo
Fornire visibilita in tempo reale sullo stato del procurement: spesa, trend, distribuzione stati, performance fornitori.

### KPI Dashboard

| Metrica | Descrizione | Calcolo |
|---|---|---|
| Richieste attive | Non in stato terminale | Count(status NOT IN DELIVERED, CANCELLED, REJECTED) |
| Approvazioni in attesa | Da approvare | Count(approvals WHERE status=PENDING) |
| Spesa mensile | Importo mese corrente | Sum(actual_amount OR estimated_amount) mese corrente |
| Consegne in ritardo | Scadute | Count(status IN ORDERED,SHIPPED AND expected_delivery < oggi) |

Ogni KPI mostra anche il **confronto col mese precedente** (trend %).

### Grafici

| Grafico | Dati | Periodo |
|---|---|---|
| Trend Spesa Mensile | Importo per mese | Ultimi 6 mesi |
| Distribuzione Stati | Conteggio per stato | Attuale |
| Spesa per Fornitore | Top 5 fornitori per importo | Totale |
| Trend Richieste | Numero richieste per mese | Ultimi 6 mesi |

### File Coinvolti
- `src/server/services/dashboard.service.ts` — Query analytics
- `src/app/(dashboard)/page.tsx` — Componenti grafici

---

## 10. Processo 9 — Commenti e Collaborazione

### Obiettivo
Permettere discussioni contestuali sulle richieste con menzioni, notifiche e distinzione tra commenti interni ed esterni.

### Flusso

```
Utente scrive commento su richiesta
  │
  ▼
POST /api/requests/[id]/comments
  │
  ├─ Contenuto validato
  ├─ Flag: is_internal (true = solo team, false = visibile al vendor)
  │
  ├─ Analisi @menzioni (regex: @nome_utente)
  │   └─ Per ogni @menzione: notifica utente menzionato
  │
  ├─ Notifica proprietario richiesta (se diverso dall'autore)
  │
  └─ TimelineEvent (tipo: comment)
```

### File Coinvolti
- `src/server/services/comment.service.ts` — Logica commenti
- `src/app/api/requests/[id]/comments/route.ts` — API

---

## 11. Processo 10 — Allegati e Documentazione

### Obiettivo
Associare documenti (preventivi, ordini, DDT, fatture) alle richieste con validazione di tipo e dimensione.

### Vincoli Upload

| Vincolo | Valore |
|---|---|
| Dimensione massima | 10 MB |
| Tipi ammessi | PDF, DOCX, XLSX, PNG, JPG, JPEG |
| Storage | `/public/uploads/{requestId}/{uuid}-{filename}` |

### Flusso

```
Utente carica file
  │
  ▼
POST /api/requests/[id]/attachments (multipart/form-data)
  │
  ├─ Validazione tipo e dimensione
  ├─ Salvataggio su filesystem con nome UUID
  ├─ Record Attachment nel database
  └─ TimelineEvent (tipo: attachment)
```

### File Coinvolti
- `src/server/services/attachment.service.ts` — Gestione allegati
- `src/app/api/requests/[id]/attachments/route.ts` — API upload

---

## 12. Macchina a Stati — Ciclo di Vita Richiesta

### Obiettivo
Garantire che le richieste seguano un percorso logico e prevenire transizioni di stato invalide.

### Diagramma Transizioni

```
                    ┌─────────────┐
            ┌───────│   DRAFT     │◄──────────────┐
            │       └──────┬──────┘               │
            │              │                      │
            │    ┌─────────┼──────────┐           │
            │    ▼         ▼          ▼           │
            │ SUBMITTED  PENDING    APPROVED      │
            │    │       APPROVAL     │           │
            │    │         │          │           │
            │    │    ┌────┼────┐     │           │
            │    │    ▼    ▼    ▼     │           │
            │    │ APPROVED REJECTED ON_HOLD      │
            │    │    │      │                    │
            │    │    ▼      └────────────────────┘
            │    │ ORDERED
            │    │    │
            │    │    ├───────┐
            │    │    ▼       ▼
            │    │ SHIPPED  ON_HOLD
            │    │    │
            │    │    ▼
            │    │ DELIVERED (terminale)
            │    │
            ▼    ▼
         CANCELLED ──────────────────────────────┘
              (puo tornare a DRAFT)
```

### Tabella Transizioni Valide

| Stato Corrente | Transizioni Ammesse |
|---|---|
| DRAFT | SUBMITTED, PENDING_APPROVAL, APPROVED, CANCELLED |
| SUBMITTED | PENDING_APPROVAL, APPROVED, CANCELLED |
| PENDING_APPROVAL | APPROVED, REJECTED, ON_HOLD |
| APPROVED | ORDERED, CANCELLED |
| REJECTED | DRAFT (per riprovare) |
| ORDERED | SHIPPED, CANCELLED, ON_HOLD |
| SHIPPED | DELIVERED, ON_HOLD |
| DELIVERED | — (stato terminale) |
| CANCELLED | DRAFT (per riaprire) |
| ON_HOLD | PENDING_APPROVAL, ORDERED, SHIPPED |

### Enforcement

- **Hard** (throw error): API routes, approval service → ritorna 400 se transizione invalida
- **Soft** (log warning): Email ingestion, vendor-order → salta l'operazione senza bloccare il flusso

### File Coinvolti
- `src/lib/state-machine.ts` — Definizione transizioni + `canTransition()` + `assertTransition()`

---

## 13. Sicurezza e Autenticazione

### Autenticazione Webhook

| Metodo | Header | Verifica |
|---|---|---|
| HMAC-SHA256 | `x-webhook-signature` | `timingSafeEqual()` (previene timing attack) |
| Bearer Token | `Authorization: Bearer <token>` | Confronto diretto con `WEBHOOK_SECRET` |

### RBAC (Role-Based Access Control)

- Ogni API route verifica il ruolo utente
- Approvazioni instradate in base al ruolo
- Email da mittenti sconosciuti → quarantena con ruolo VIEWER

### Protezioni Implementate

- Validazione input con Zod su ogni endpoint
- Query parametrizzate (Prisma) contro SQL injection
- File upload con whitelist estensioni e limite dimensione
- UUID nei nomi file (previene path traversal)
- Nessun segreto hardcoded nel codice
- Generazione codice atomica (previene duplicati)
- Deduplicazione email (previene riprocessamento)

---

## 14. Flusso End-to-End Completo

### Scenario: Acquisto Completo (dalla richiesta alla consegna)

```
1. CREAZIONE
   Utente compila form → PurchaseRequest (DRAFT, PR-2026-00042)

2. APPROVAZIONE
   Utente clicca "Invia" → Sistema valuta importo + ruolo
   ├─ <500€ o MANAGER/ADMIN: auto-approvato → APPROVED
   └─ Altrimenti: PENDING_APPROVAL → notifica approvatore
       └─ Approvatore decide → APPROVED o REJECTED

3. INVIO ORDINE
   APPROVED → sendOrderToVendor()
   → Email al fornitore con [PR-2026-00042] nel subject
   → Stato: ORDERED

4. RISPOSTA FORNITORE
   Fornitore risponde "Confermato, tracking: ABC123"
   → n8n cattura email (IMAP polling)
   → AI estrae: tracking, data consegna, importo
   → POST /api/webhooks/email-ingestion (action: update_existing)
   → Matching automatico tramite [PR-2026-00042] nel subject
   → Stato: ORDERED → SHIPPED, tracking impostato

5. CONSEGNA
   Fornitore conferma consegna
   → Email → n8n → webhook → status: SHIPPED → DELIVERED
   → delivered_at impostato
   → Richiedente notificato

6. REPORTING
   Dashboard aggiornata: spesa mensile, trend, consegne completate
```

### Scenario: Email da Mittente Sconosciuto

```
1. Email ricevuta da indirizzo non registrato
2. n8n parsa e invia al webhook
3. Sistema: mittente non trovato → assegna ad ADMIN con ruolo VIEWER
4. Richiesta creata in DRAFT (niente auto-approvazione)
5. Notifica a tutti ADMIN/MANAGER
6. Admin verifica e decide se procedere
```

### Scenario: Email Duplicata

```
1. Stessa email processata due volte (retry n8n, errore rete)
2. Secondo tentativo: email_message_id gia presente in DB
3. Sistema ritorna risultato con deduplicated: true
4. Nessun duplicato creato — endpoint idempotente
```

---

## Riepilogo Processi

| # | Processo | Obiettivo Primario |
|---|---|---|
| 1 | Creazione Richiesta | Strutturare acquisti con codice univoco e categorizzazione |
| 2 | Workflow Approvazione | Autorizzare acquisti in base a importo e ruolo |
| 3 | Invio Ordine | Comunicare automaticamente l'ordine al fornitore |
| 4 | Ingestion Email | Automatizzare creazione/aggiornamento richieste da email |
| 5 | Tracking Consegne | Monitorare consegne e evidenziare ritardi |
| 6 | Gestione Fornitori | Centralizzare anagrafica e stato fornitori |
| 7 | Notifiche e Timeline | Informare attori e tracciare ogni azione |
| 8 | Analytics e Reporting | Visibilita su spesa, trend e performance |
| 9 | Commenti | Collaborazione contestuale con menzioni |
| 10 | Allegati | Documentazione associata alle richieste |

---

*Documento generato automaticamente. Riferimento codebase: `/procureflow/src/`*
