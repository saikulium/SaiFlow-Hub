# Email Intelligence Agent

Agente multi-step che processa email commerciali (conferme ordine, ritardi, variazioni prezzo, ordini clienti, fatture) e orchestra tutte le azioni necessarie nel sistema.

**File**: `src/server/agents/email-intelligence.agent.ts`
**Endpoint**: `POST /api/email-import` (dialog "Importa da Email" dalla dashboard)
**Modello**: `claude-sonnet-4-6`

---

## Capabilities

- Classificazione intent (7 categorie)
- Lettura allegati PDF via Anthropic Files API
- Creazione automatica di articoli, fornitori, clienti, commesse, RDA
- Timeline events + notifiche contestuali
- Separazione chiara tra "confidence dell'analisi" e "serve decisione umana"

---

## Input

### JSON (solo testo)
```json
POST /api/email-import
Content-Type: application/json

{
  "email_from": "monica.tondo@it.ttiinc.com",
  "email_subject": "Conferma ordine 14177",
  "email_body": "Testo dell'email..."
}
```

### Multipart (testo + PDF allegati)
```
POST /api/email-import
Content-Type: multipart/form-data

email_from: ...
email_subject: ...
email_body: ...
attachments: <File>  // application/pdf, max 10MB per file, max 5 file
attachments: <File>
...
```

---

## Output

```json
{
  "success": true,
  "data": {
    "intent": "CONFERMA_ORDINE",
    "confidence": 0.95,
    "requires_human_decision": true,
    "decision_reason": "Variazione prezzo +38% su Riga 2 — richiede approvazione buyer",
    "summary": "Conferma ordine TTI SO-3759187...",
    "action_taken": true,
    "actions": [
      "search_requests",
      "find_or_create_vendor",
      "create_request",
      "create_timeline_event",
      "create_notification"
    ],
    "attachments_processed": 3
  }
}
```

### Campi chiave

| Campo | Tipo | Significato |
|---|---|---|
| `intent` | enum | Classificazione: CONFERMA_ORDINE, RITARDO_CONSEGNA, VARIAZIONE_PREZZO, ORDINE_CLIENTE, FATTURA_ALLEGATA, RICHIESTA_INFO, ALTRO |
| `confidence` | number 0-1 | Quanto l'agente è sicuro della classificazione e dell'estrazione dati |
| `requires_human_decision` | boolean | True quando serve decisione umana (indipendente da confidence) |
| `decision_reason` | string \| null | Spiegazione breve (solo se requires_human_decision=true) |
| `action_taken` | boolean | True se almeno un tool di scrittura è stato eseguito |
| `actions` | string[] | Lista dei tool invocati |
| `attachments_processed` | number | Numero di PDF caricati via Files API |

---

## Modello Confidence vs Decisione Umana

**Sono due dimensioni indipendenti**:

| | `requires_human_decision: false` | `requires_human_decision: true` |
|---|---|---|
| **confidence alto** (>0.8) | Tutto ok, nessun intervento | Agent ha capito ma serve approvazione (price variance, dispute, censimento fornitore) |
| **confidence basso** (<0.6) | Email poco chiara ma irrilevante | Ambiguità + serve verifica — caso critico |

### Quando `requires_human_decision = true`

1. **Variazione prezzo > 2%** in una conferma ordine
2. **Ritardo consegna** che impatta una commessa cliente con deadline stretta
3. **Fatture con discrepanze** oltre la tolleranza
4. **Ordini clienti** con articoli non in catalogo
5. **Fornitori/clienti auto-creati** in PENDING_REVIEW (segnalato come info)
6. **Classificazione ambigua** (confidence < 0.5)

### UI rendering

Il dialog `email-import-dialog.tsx` mostra:
- **Banner verde** (CheckCircle) "Email processata con successo" se `action_taken`
- **Banner ambra** (AlertTriangle) "Decisione manuale richiesta" con `decision_reason` se `requires_human_decision`
- **Toast variant**:
  - `warning` → se `requires_human_decision` (anche se `action_taken`)
  - `success` → se solo `action_taken`
  - `info` → se nessuno dei due

---

## Tools disponibili

L'agente ha accesso a 16 tool in toolRunner, organizzati per dominio:

### Procurement (READ + WRITE)
- `search_requests` — cerca PR per codice, titolo, stato, external_ref
- `get_request_detail` — dettaglio completo di una PR
- `search_vendors` — cerca fornitori esistenti
- `get_budget_overview` — budget per centro di costo
- `create_request` — crea nuova RDA DRAFT collegata a commessa (WRITE)

### Articoli
- `find_or_create_article` — cerca per alias/manufacturer_code/nome normalizzato, altrimenti crea con `verified: false`

### Fornitori (nuovo)
- `find_or_create_vendor` — cerca per P.IVA o nome normalizzato, altrimenti crea in `PENDING_REVIEW`

### Clienti (nuovo)
- `search_clients` — cerca per nome/codice/tax_id
- `find_or_create_client` — cerca per tax_id o nome normalizzato, altrimenti crea in `PENDING_REVIEW`

### Commesse
- `search_commesse` — cerca commesse esistenti
- `create_commessa` — crea nuova commessa da ordine cliente

### Notifiche
- `create_notification` — notifica in-app all'utente responsabile
- `create_timeline_event` — aggiunge evento alla timeline di una PR

---

## Normalizzazione dedup

Tutti i tool `find_or_create_*` usano normalizzazione per evitare duplicati:

### Articoli
```
"MS3106A-18-1S" → "MS3106A181S"  (strip -, _, /, ., spazi)
"D38999/26WB98SN" → "D3899926WB98SN"
```
Ricerca in: `ArticleAlias.alias_code` normalizzato + `Article.manufacturer_code` normalizzato + `Article.name` fuzzy.

### Fornitori
```
"TTI Italy S.r.l." → "tti italy"  (lowercase, strip SRL/SPA/SAS/SNC/SL, strip .,)
"TTI ITALY SRL" → "tti italy"
```
Ricerca primaria su `vat_id` (P.IVA normalizzata, senza "IT"), fallback su nome normalizzato.

### Clienti
Stessa logica dei fornitori ma su `Client.tax_id` + `Client.name`.

---

## Auto-create in PENDING_REVIEW

Quando l'agente crea automaticamente un fornitore o cliente:
- **Stato iniziale**: `PENDING_REVIEW` (non `ACTIVE`)
- **Note**: `"Auto-creato da email agent — verificare e censire completamente."`
- **Immediatamente usabile** in RDA/commesse (non blocca il flusso)
- **Visibile nella lista** con indicatore da aggiungere nell'UI (TODO)

Gli articoli auto-creati hanno invece il campo dedicato `verified: false` (già implementato) con filter tab "Da Verificare" e bottone "Verifica" nella pagina anagrafica.

---

## Esempio: Email Faleni TTI

**Input**: email con 3 PDF allegati (ordine Faleni firmato, conferma TTI, condizioni generali).

**Azioni eseguite dall'agente**:

1. **Lettura PDF** via Files API:
   - `ordine14177-TTI_signed.pdf` → prezzi originali, quantità, codici
   - `Order-3759187_Confirmation_edc.pdf` → prezzi nuovi, nuove date consegna
   - `Condizioni generali di fornitura 01.pdf` → clausole contrattuali
2. **Classificazione**: `intent: "CONFERMA_ORDINE"` con sotto-eventi (variazione prezzo + ritardo)
3. **Search vendor**: TTI Italy SRL non in anagrafica → `find_or_create_vendor` → crea `VND-2026-XXXXX` in PENDING_REVIEW
4. **Search PR**: nessuna PR con `external_ref=14177` → crea PR tracking `PR-2026-XXXXX`
5. **Timeline events**:
   - `"Conferma Ordine TTI SO 3759187"` con dettaglio tutte le righe
   - `"Variazione prezzo Riga 2 e Riga 3"` con delta +€296
   - `"Ritardo consegna Riga 3"` con date originali vs nuove
6. **Notifiche**: riepilogo completo + alert urgente per il ritardo
7. **Output**:
   - `confidence: 0.95` (letti tutti i PDF, dati estratti con precisione)
   - `requires_human_decision: true`
   - `decision_reason: "Variazione prezzo +38% su Riga 2 e +6% su Riga 3 — richiede approvazione buyer"`

---

## Commit correlati

| Commit | Descrizione |
|---|---|
| `a0acf0f` | feat: connect email import to Email Intelligence Agent |
| `d1128c7` | feat: email agent now creates RDAs for each item in client orders |
| `b249b9a` | feat: email agent creates articles + links RDAs to commessa |
| `701c8ee` | fix: email agent RDAs now include verify-quantity note in description |
| `c0bdcae` | feat: email import supports PDF attachments via Files API |
| `b4275bd` | fix: remove invalid tenant_id filter from search_requests, add external_ref search |
| `bd095df` | feat: email agent gets vendor/client tools + split confidence from human-decision flag |

---

## Prossimi passi noti

- **Badge "PENDING_REVIEW"** nella lista fornitori e clienti (analogo a quello articoli)
- **Dashboard review** che raggruppa tutte le entità auto-create in attesa di verifica
- **Soglia price variance** configurabile per tenant (oggi hardcoded al 2%)
- **Integrazione n8n/IMAP** per ricezione automatica email (oggi solo upload manuale)
