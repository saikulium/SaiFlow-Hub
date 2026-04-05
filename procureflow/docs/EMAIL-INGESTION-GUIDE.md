# Email Ingestion & n8n — Guida Completa

> Architettura tecnica, setup e guida di implementazione per nuovi clienti.

---

## Indice

1. [Panoramica del Sistema](#1-panoramica-del-sistema)
2. [Architettura Tecnica](#2-architettura-tecnica)
3. [Flussi di Elaborazione](#3-flussi-di-elaborazione)
4. [State Machine — Transizioni di Stato](#4-state-machine--transizioni-di-stato)
5. [Sicurezza Webhook](#5-sicurezza-webhook)
6. [Guida Implementazione Cliente](#6-guida-implementazione-cliente)
   - [6.1 Cosa chiedere al cliente](#61-cosa-chiedere-al-cliente)
   - [6.2 Setup lato ProcureFlow](#62-setup-lato-procureflow)
   - [6.3 Setup lato n8n](#63-setup-lato-n8n)
   - [6.4 Test e validazione](#64-test-e-validazione)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Panoramica del Sistema

ProcureFlow automatizza la creazione e l'aggiornamento delle richieste d'acquisto a partire dalle email dei fornitori. Il sistema supporta **due percorsi**:

| Percorso | AI usata | Pre-processing | Endpoint |
|----------|----------|----------------|----------|
| **Path A — n8n pre-parsed** | GPT-4o-mini (in n8n) | n8n parsa l'email e la arricchisce con AI | `POST /api/webhooks/email-ingestion` |
| **Path B — Raw classify** | Claude Sonnet (in ProcureFlow) | ProcureFlow riceve l'email grezza e classifica internamente | `POST /api/webhooks/email-ingestion/classify` |

**Path A** e il default: n8n fa il polling Gmail, l'AI analizza l'email, e invia un payload strutturato a ProcureFlow. E il percorso piu efficiente e quello usato nel workflow n8n fornito.

**Path B** e un'alternativa per scenari senza AI in n8n: l'email arriva grezza e Claude classifica internamente. Utile se il cliente non ha API key OpenAI o preferisce non usare AI in n8n.

---

## 2. Architettura Tecnica

```
┌──────────────┐     ┌──────────────────────────────────────────┐
│   Gmail      │     │                  n8n                      │
│   IMAP/API   │────▶│  Gmail Trigger (polling ogni minuto)      │
│              │     │  ↓                                        │
└──────────────┘     │  Parsa Email (Code node: from/to/subj/body)│
                     │  ↓                                        │
                     │  AI Parsing (GPT-4o-mini, JSON output)    │
                     │  ↓                                        │
                     │  Combina Email + AI (merge data)          │
                     │  ↓                                        │
                     │  HTTP POST → ProcureFlow webhook          │
                     │  ↓                                        │
                     │  Verifica Risposta → Log Successo/Errore  │
                     └──────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ProcureFlow (Next.js)                     │
│                                                                 │
│  POST /api/webhooks/email-ingestion                             │
│  ├── Auth: HMAC-SHA256 o Bearer token                           │
│  ├── Idempotency: x-webhook-id header                           │
│  ├── Validazione: Zod schema (emailIngestionSchema)             │
│  └── Processing: email-ingestion.service.ts                     │
│      ├── action: "new_request"                                  │
│      │   ├── Dedup via email_message_id                         │
│      │   ├── Resolve requester (email → User)                   │
│      │   ├── Resolve/auto-create vendor                         │
│      │   ├── Generate PR code (atomico)                         │
│      │   ├── Create PurchaseRequest + items + attachments       │
│      │   ├── Auto-approve se requester e MANAGER/ADMIN          │
│      │   └── Notifica admin/manager                             │
│      ├── action: "update_existing"                              │
│      │   ├── Find request (PR code / external_ref / subject)    │
│      │   ├── Status transition (state machine validation)       │
│      │   ├── Update tracking, delivery date, amount             │
│      │   ├── Add new items                                      │
│      │   ├── Create timeline event                              │
│      │   └── Notifica requester                                 │
│      └── action: "info_only"                                    │
│          ├── Find request (fallback: crea come DRAFT)           │
│          └── Create timeline event (email_info)                 │
└─────────────────────────────────────────────────────────────────┘
```

### File principali

| File | Ruolo |
|------|-------|
| `n8n/email-ingestion.json` | Workflow n8n importabile |
| `src/app/api/webhooks/email-ingestion/route.ts` | Endpoint webhook (path A) |
| `src/app/api/webhooks/email-ingestion/classify/route.ts` | Endpoint classificazione (path B) |
| `src/server/services/email-ingestion.service.ts` | Logica di business principale |
| `src/server/services/email-ai-classifier.service.ts` | Classificazione AI con Claude |
| `src/lib/validations/email-ingestion.ts` | Schema Zod del payload |
| `src/lib/webhook-auth.ts` | Autenticazione HMAC + Bearer |
| `src/lib/state-machine.ts` | Validazione transizioni di stato |

---

## 3. Flussi di Elaborazione

### 3.1 Nuova Richiesta (`new_request`)

1. **Deduplicazione**: Se `email_message_id` gia processato, ritorna risultato precedente (idempotente)
2. **Resolve requester**: Cerca l'utente per email. Se sconosciuto, assegna all'ADMIN come "quarantena" (ruolo VIEWER, niente auto-approve)
3. **Resolve vendor**: Cerca per `ai_vendor_code` (esatto) o `ai_vendor_name` (fuzzy). Se non trovato, **crea automaticamente** il vendor in stato `PENDING_REVIEW`
4. **Genera codice**: Codice atomico progressivo `PR-YYYY-NNNNN`
5. **Crea richiesta**: PurchaseRequest + RequestItem[] + Attachment[] + TimelineEvent
6. **Auto-approvazione**: Se il requester e MANAGER o ADMIN, avvia il workflow di approvazione automatica
7. **Notifica**: Admin/Manager ricevono notifica in-app

### 3.2 Aggiornamento Esistente (`update_existing`)

1. **Match richiesta**: Cerca per codice PR nell'AI output → nel subject email (`[PR-2026-00042]`) → per `external_ref`
2. **Fallback**: Se nessun match, crea come nuova richiesta con tag `match-non-trovato`
3. **Dedup timeline**: Se `email_message_id` gia processato per questa request, skip
4. **Aggiorna campi**: Status (con validazione state machine), tracking, delivery date, importo
5. **Date automatiche**: `ORDERED` → setta `ordered_at`; `DELIVERED` → setta `delivered_at`
6. **Nuovi items**: Aggiunge eventuali articoli estratti dall'AI
7. **Timeline + notifica**: Crea evento timeline e notifica il requester

### 3.3 Solo Informazione (`info_only`)

1. **Match richiesta**: Come sopra
2. **Fallback**: Se nessun match, crea come bozza con tag `info-only` + `auto-creata`
3. **Timeline**: Crea evento `email_info` con riepilogo AI

### 3.4 Path B — Classificazione Raw (Claude)

1. Riceve email grezza (from, subject, body)
2. Claude classifica l'intent tra 6 categorie:
   - `CONFERMA_ORDINE` → action `update_existing`, status `ORDERED`
   - `RITARDO_CONSEGNA` → action `update_existing`
   - `VARIAZIONE_PREZZO` → action `update_existing`
   - `RICHIESTA_INFO` → action `info_only`
   - `FATTURA_ALLEGATA` → action `info_only`
   - `ALTRO` → action `info_only`
3. **Soglia confidence**: Se `>= 0.8` → azione automatica. Se `< 0.8` → solo notifica per review manuale

---

## 4. State Machine — Transizioni di Stato

```
DRAFT ──────────────▶ SUBMITTED ──────────▶ PENDING_APPROVAL
  │                       │                       │
  ├──▶ PENDING_APPROVAL   ├──▶ APPROVED           ├──▶ APPROVED
  ├──▶ APPROVED           └──▶ CANCELLED          ├──▶ REJECTED
  └──▶ CANCELLED                                  └──▶ ON_HOLD
                                                       │
APPROVED ──▶ ORDERED ──▶ SHIPPED ──▶ DELIVERED         │
  │           │           │           │                │
  └──CANCELLED └──CANCELLED └──ON_HOLD └──▶ INVOICED   │
               └──ON_HOLD               └──▶ CLOSED    │
                                                       │
INVOICED ──▶ RECONCILED ──▶ CLOSED                     │
  │                                                    │
  └──▶ ON_HOLD                                         │
                                                       │
ON_HOLD ──▶ PENDING_APPROVAL / ORDERED / SHIPPED / INVOICED
CANCELLED ──▶ DRAFT (riapertura)
REJECTED ──▶ DRAFT (riapertura)
```

Le transizioni non valide vengono rifiutate silenziosamente con un warning in console (l'aggiornamento email prosegue ma senza cambiare lo stato).

---

## 5. Sicurezza Webhook

### Autenticazione (due metodi, almeno uno deve essere valido)

| Metodo | Header | Logica |
|--------|--------|--------|
| **HMAC-SHA256** | `x-webhook-signature` | `HMAC(timestamp.body, WEBHOOK_SECRET)` confrontato con `timingSafeEqual` |
| **Bearer Token** | `Authorization: Bearer <token>` | Token confrontato direttamente con `WEBHOOK_SECRET` |

### Protezione Replay Attack

| Header | Scopo |
|--------|-------|
| `x-webhook-timestamp` | Unix timestamp (secondi). Rifiutato se differenza > 5 minuti |

### Idempotency

| Header | Scopo |
|--------|-------|
| `x-webhook-id` | ID univoco del webhook. Se gia processato, ritorna la risposta cached |

**In produzione**: usare HMAC-SHA256 + timestamp. Il Bearer token e solo per sviluppo.

---

## 6. Guida Implementazione Cliente

### 6.1 Cosa chiedere al cliente

#### Informazioni obbligatorie

| # | Informazione | Perche serve | Esempio |
|---|-------------|--------------|---------|
| 1 | **Casella email da monitorare** | Gmail account per il polling n8n | `acquisti@azienda.it` |
| 2 | **Credenziali Google** | OAuth2 per Gmail API | Service account o app password |
| 3 | **Domini email fornitori** | Per filtrare email rilevanti (opzionale ma consigliato) | `@fornitore1.it, @fornitore2.com` |
| 4 | **URL ProcureFlow** | Endpoint per i webhook n8n | `https://app.azienda.it` |
| 5 | **Lista utenti con email e ruolo** | Mappatura email → utente per resolve requester | Mario Rossi, mario@azienda.it, MANAGER |
| 6 | **Lista fornitori attivi** | Per il matching AI vendor | Nome, codice, email |

#### Informazioni consigliate

| # | Informazione | Perche serve | Default |
|---|-------------|--------------|---------|
| 7 | **Soglie di auto-approvazione** | Regole approvazione per importo | < 500 EUR auto, < 5000 EUR manager |
| 8 | **Categorie merceologiche** | L'AI usa queste per categorizzare | Nessuna (campo libero) |
| 9 | **Dipartimenti** | Associazione richieste → dipartimento | Nessuno |
| 10 | **Centri di costo** | Per tracking budget | Nessuno |
| 11 | **API key OpenAI** (per Path A) | AI parsing in n8n | Se non disponibile, usare Path B con Claude |
| 12 | **Etichetta/label Gmail** | Per filtrare solo email specifiche | Nessuna (tutte le non lette) |
| 13 | **Fuso orario** | Per timestamp corretti | Europe/Rome |

#### Domande operative

- "Le email dei fornitori arrivano da indirizzi fissi o cambiano?"
  → Se cambiano, non filtrare per sender ma per label/folder
- "Ci sono email automatiche (newsletter, notifiche) sulla stessa casella?"
  → Se si, configurare filtri Gmail o label dedicata
- "Che lingua usano i fornitori nelle email?"
  → Il prompt AI e in italiano ma gestisce anche inglese
- "Serve notifica Slack/Teams per errori?"
  → Se si, aggiungere nodo notifica nel workflow n8n

---

### 6.2 Setup lato ProcureFlow

#### Step 1: Variabili d'ambiente

Aggiungere al `.env` del deploy:

```bash
# Webhook (OBBLIGATORIO)
# Generare con: openssl rand -hex 32
WEBHOOK_SECRET=<secret-condiviso-con-n8n>

# Path B — classificazione AI con Claude (OPZIONALE)
ANTHROPIC_API_KEY=sk-ant-...

# Modello AI per email classification (OPZIONALE)
# Default: claude-sonnet-4-5-20250929
AI_EMAIL_MODEL=claude-sonnet-4-5-20250929
```

#### Step 2: Verificare utenti nel database

Tutti gli utenti che inviano email devono esistere nel database ProcureFlow con la stessa email. Controllare:

```sql
SELECT email, name, role FROM "User";
```

Se manca un utente che inviera email, il sistema lo assegnera all'ADMIN come "quarantena". Non e un errore ma va gestito.

#### Step 3: Verificare fornitori nel database

I fornitori principali dovrebbero gia essere nel sistema. Se l'AI non trova match, **crea automaticamente** un vendor in stato `PENDING_REVIEW`:
- Codice: `AUTO-<nome>-<hash>`
- Status: `PENDING_REVIEW`
- Note: "Fornitore creato automaticamente da email ingestion. Verificare i dati."

Consiglio: importare i fornitori prima di attivare l'email ingestion.

#### Step 4: Verificare endpoints

Testare che gli endpoint rispondano:

```bash
# Deve ritornare 401 (non autenticato)
curl -X POST https://app.azienda.it/api/webhooks/email-ingestion

# Con auth (deve ritornare 400 per body vuoto)
curl -X POST https://app.azienda.it/api/webhooks/email-ingestion \
  -H "Authorization: Bearer <WEBHOOK_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### 6.3 Setup lato n8n

#### Step 1: Importare il workflow

1. Aprire n8n (self-hosted o cloud)
2. Andare su **Workflows → Import from File**
3. Importare `n8n/email-ingestion.json`
4. Il workflow contiene 7 nodi: Gmail Trigger → Parsa Email → AI Parsing → Combina → Invia → Verifica → Log

#### Step 2: Configurare le credenziali

**Gmail OAuth2:**
1. In n8n, andare su **Credentials → Add Credential → Gmail OAuth2**
2. Seguire la guida Google Cloud Console:
   - Creare progetto o selezionare esistente
   - Abilitare Gmail API
   - Creare credenziali OAuth2 (tipo "Desktop App" o "Web App")
   - Redirect URI: `https://<n8n-url>/rest/oauth2-credential/callback`
   - Scaricare client_id e client_secret
3. In n8n inserire client_id, client_secret e autorizzare
4. Associare la credential al nodo "Gmail Trigger"

**OpenAI API (per Path A):**
1. In n8n, andare su **Credentials → Add Credential → OpenAI API**
2. Inserire la API key del cliente (o dell'organizzazione)
3. Associare la credential al nodo "AI Parsing (OpenAI)"

#### Step 3: Configurare i nodi

**Nodo "Gmail Trigger":**
- Polling: ogni minuto (default). Aumentare a 5 min per ridurre costi API
- Filtro: `readStatus: "unread"`, `receivedAfter: inizio giornata`
- (Opzionale) Aggiungere filtro per label: impostare una label Gmail dedicata (es. "procurement") e filtrare per label

**Nodo "AI Parsing (OpenAI)":**
- Modello: `gpt-4o-mini` (default, economico). Cambiare a `gpt-4o` per risultati migliori
- Temperature: `0.1` (bassa, per output deterministico)
- Response format: `json_object` (forza output JSON valido)

**Nodo "Invia a ProcureFlow":**
- **URL**: Cambiare da `http://host.docker.internal:3000` a `https://<url-procureflow-cliente>`
- **Authorization**: Cambiare il Bearer token con il `WEBHOOK_SECRET` del cliente
- In produzione, sostituire Bearer con HMAC:
  - Aggiungere un Code node prima dell'invio che calcoli `HMAC-SHA256(timestamp.body, secret)`
  - Aggiungere headers: `x-webhook-signature`, `x-webhook-timestamp`, `x-webhook-id`

#### Step 4: HMAC Signature (Produzione)

Per ambienti di produzione, aggiungere un Code node tra "Combina Email + AI" e "Invia a ProcureFlow":

```javascript
const crypto = require('crypto');
const secret = '<WEBHOOK_SECRET>';
const body = JSON.stringify($json);
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${body}`)
  .digest('hex');
const webhookId = `email-${$json.email_message_id || Date.now()}`;

return [{
  json: $json,
  // Usare questi come headers nel nodo HTTP:
  _headers: {
    'x-webhook-signature': signature,
    'x-webhook-timestamp': timestamp,
    'x-webhook-id': webhookId,
  }
}];
```

E nel nodo "Invia a ProcureFlow", aggiungere gli headers dal campo `_headers`.

#### Step 5: Attivare il workflow

1. Verificare che tutte le credenziali siano configurate (check verde)
2. **Testare manualmente**: cliccare "Execute Workflow" dopo aver inviato un'email di test alla casella
3. Verificare i log di ogni nodo
4. Se tutto funziona, attivare il workflow (toggle in alto a destra)

---

### 6.4 Test e validazione

#### Checklist di test

- [ ] **Email nuova richiesta**: Inviare un'email che chiede di comprare qualcosa. Verificare che in ProcureFlow appaia una nuova PR in stato DRAFT
- [ ] **Email conferma ordine**: Inviare un'email che conferma un ordine esistente (includere il codice PR nel subject, es. `[PR-2026-00001] Conferma ordine`). Verificare che lo stato cambi a ORDERED
- [ ] **Email tracking**: Inviare un'email con numero di tracking. Verificare che appaia nella richiesta
- [ ] **Email sconosciuta**: Inviare da un indirizzo non in ProcureFlow. Verificare che la richiesta venga assegnata all'admin come quarantena
- [ ] **Vendor sconosciuto**: Inviare un'email che menziona un fornitore non presente. Verificare che venga creato automaticamente in PENDING_REVIEW
- [ ] **Deduplicazione**: Inviare la stessa email due volte. Verificare che non crei duplicati
- [ ] **Timeline**: Verificare che ogni email processata crei un evento nella timeline della richiesta
- [ ] **Notifiche**: Verificare che admin/manager ricevano le notifiche in-app

#### Payload di test manuale

Per testare l'endpoint direttamente senza n8n:

```bash
curl -X POST https://app.azienda.it/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <WEBHOOK_SECRET>" \
  -H "x-webhook-id: test-$(date +%s)" \
  -d '{
    "email_from": "fornitore@example.com",
    "email_subject": "Conferma ordine materiale ufficio",
    "email_body": "Confermiamo la ricezione del vostro ordine per 10 risme di carta A4 al prezzo di 5.50 EUR/risma. Consegna prevista entro il 2026-04-10.",
    "action": "new_request",
    "ai_title": "Carta A4 per ufficio",
    "ai_description": "Ordine di 10 risme di carta A4 formato standard",
    "ai_priority": "MEDIUM",
    "ai_vendor_name": "Cartoleria Rossi",
    "ai_category": "Cancelleria",
    "ai_estimated_amount": 55.00,
    "ai_currency": "EUR",
    "ai_expected_delivery": "2026-04-10",
    "ai_items": [
      {
        "name": "Carta A4 80g",
        "quantity": 10,
        "unit": "risma",
        "unit_price": 5.50,
        "total_price": 55.00
      }
    ],
    "ai_summary": "Ordine confermato per 10 risme di carta A4 a 55 EUR, consegna prevista il 10 aprile.",
    "ai_confidence": 0.92,
    "ai_tags": ["cancelleria", "ufficio"],
    "attachments": []
  }'
```

---

## 7. Troubleshooting

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| 401 Unauthorized | Secret non corrispondente | Verificare che `WEBHOOK_SECRET` in `.env` e in n8n siano identici |
| 400 Validation Error | Payload non conforme allo schema | Controllare i log n8n del nodo "Combina Email + AI" per campi mancanti |
| Email non lette nel trigger | Credenziali Gmail scadute | Riautorizzare OAuth2 in n8n |
| AI restituisce JSON non valido | Prompt non rispettato | Verificare che `response_format: json_object` sia attivo nel nodo OpenAI |
| Vendor creato come PENDING_REVIEW | Fornitore non nel DB | Importare il fornitore o aggiornare quello auto-creato nel pannello admin |
| Richiesta assegnata all'admin | Sender email non corrisponde a nessun utente | Aggiungere l'utente al sistema con la stessa email |
| Stato non aggiornato | Transizione non valida | Controllare i log: la state machine rifiuta transizioni non consentite |
| Duplicati | `email_message_id` mancante | Assicurarsi che il nodo "Parsa Email" estragga correttamente il message-id |
| Path B: 503 AI_NOT_CONFIGURED | `ANTHROPIC_API_KEY` mancante | Aggiungere la chiave API al `.env` |
| Path B: notifica senza azione | Confidence < 0.8 | Normale. L'admin deve verificare manualmente |
| Timeout webhook | ProcureFlow lento a rispondere | Aumentare timeout nel nodo HTTP di n8n (default 15s) |

---

## Appendice: Schema Payload Completo

Riferimento: `src/lib/validations/email-ingestion.ts`

```typescript
{
  // --- Dati email grezzi ---
  email_from: string           // "Mario Rossi <mario@fornitore.it>"
  email_to?: string
  email_subject: string        // "Conferma ordine PR-2026-00042"
  email_body: string           // Corpo dell'email (max 8000 char da n8n)
  email_date?: string          // ISO 8601
  email_message_id?: string    // Per deduplicazione

  // --- Decisione AI ---
  action: "new_request" | "update_existing" | "info_only"

  // --- Matching ---
  ai_matched_request_code?: string  // "PR-2026-00042"
  ai_matched_external_ref?: string  // Rif. ordine fornitore
  ai_vendor_code?: string           // Codice fornitore interno
  ai_vendor_name?: string           // Nome fornitore (fuzzy match)

  // --- Dettagli richiesta ---
  ai_title?: string
  ai_description?: string
  ai_priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  ai_category?: string
  ai_department?: string
  ai_needed_by?: string          // "YYYY-MM-DD"

  // --- Importi ---
  ai_estimated_amount?: number
  ai_actual_amount?: number
  ai_currency: string            // Default "EUR"

  // --- Tracking ---
  ai_status_update?: "ORDERED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | ...
  ai_tracking_number?: string
  ai_external_ref?: string
  ai_external_url?: string
  ai_expected_delivery?: string  // "YYYY-MM-DD"

  // --- Articoli ---
  ai_items: Array<{
    name: string
    description?: string
    quantity: number
    unit?: string
    unit_price?: number
    total_price?: number
    sku?: string
  }>

  // --- Meta ---
  ai_summary?: string           // Riepilogo leggibile
  ai_confidence?: number        // 0.0–1.0
  ai_tags: string[]

  // --- Allegati ---
  attachments: Array<{
    filename: string
    url: string                  // URL accessibile
    mime_type?: string
    file_size?: number
  }>
}
```
