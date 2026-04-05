# ProcureFlow — Guida Completa di Installazione e Test

> Questa guida spiega passo-passo come installare ProcureFlow sul tuo computer,
> caricare i dati demo, e testare tutte le funzionalita del sistema.
> Non serve esperienza tecnica — basta seguire i passaggi nell'ordine.

---

## Indice

1. [Cosa ti serve](#1-cosa-ti-serve)
2. [Installazione](#2-installazione)
3. [Primo avvio](#3-primo-avvio)
4. [Login e primi passi](#4-login-e-primi-passi)
5. [Test delle funzionalita](#5-test-delle-funzionalita)
   - [5.1 Dashboard](#51-dashboard)
   - [5.2 Richieste d'acquisto](#52-richieste-dacquisto)
   - [5.3 Fornitori](#53-fornitori)
   - [5.4 Fatture e riconciliazione](#54-fatture-e-riconciliazione)
   - [5.5 Approvazioni](#55-approvazioni)
   - [5.6 Budget](#56-budget)
   - [5.7 Inventario e magazzino](#57-inventario-e-magazzino)
   - [5.8 Analytics e ROI](#58-analytics-e-roi)
   - [5.9 AI Agent (Chat)](#59-ai-agent-chat)
   - [5.10 Impostazioni e sicurezza](#510-impostazioni-e-sicurezza)
6. [Test dell'automazione email (n8n)](#6-test-dellautomazione-email-n8n)
7. [Test dei webhook e integrazioni](#7-test-dei-webhook-e-integrazioni)
   - [7.1 Creazione automatica RdA da email](#71-creazione-automatica-rda-da-email)
   - [7.2 Aggiornamento automatico RdA da email fornitore](#72-aggiornamento-automatico-rda-da-email-fornitore)
   - [7.3 Email informativa (solo log nella timeline)](#73-email-informativa-solo-log-nella-timeline)
   - [7.4 Ricezione fattura SDI (Sistema di Interscambio)](#74-ricezione-fattura-sdi-sistema-di-interscambio)
   - [7.5 Aggiornamento fornitore da sistema esterno](#75-aggiornamento-fornitore-da-sistema-esterno)
   - [7.6 Approvazione/Rifiuto via webhook](#76-approvazionerifiuto-via-webhook)
   - [7.7 Auto-approvazione per soglia importo](#77-auto-approvazione-per-soglia-importo)
   - [7.8 Protezione duplicati (idempotenza)](#78-protezione-duplicati-idempotenza)
   - [7.9 Health check](#79-health-check)
8. [Test end-to-end: flusso completo ordine](#8-test-end-to-end-flusso-completo-ordine)
9. [Spegnere e riavviare](#9-spegnere-e-riavviare)
10. [Problemi comuni](#10-problemi-comuni)

---

## 1. Cosa ti serve

| Requisito | Come verificare | Come installare |
|-----------|----------------|-----------------|
| **Docker Desktop** | Apri il Terminale e scrivi `docker --version` | Scarica da [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Git** | `git --version` | Su Mac: `xcode-select --install`. Su Windows: [git-scm.com](https://git-scm.com/) |
| **Un browser** | Chrome, Firefox, Safari, Edge | Gia installato |

**Spazio disco necessario:** circa 2 GB per le immagini Docker.

**RAM consigliata:** almeno 4 GB disponibili (Docker ne usa circa 1.5 GB).

### Come aprire il Terminale

- **Mac:** Cerca "Terminale" in Spotlight (Cmd + Spazio) oppure vai in Applicazioni > Utility > Terminale
- **Windows:** Cerca "PowerShell" nel menu Start, oppure "cmd"
- **Linux:** Ctrl + Alt + T

---

## 2. Installazione

### Passo 1: Scarica il progetto

Apri il Terminale e copia-incolla questi comandi uno alla volta, premendo Invio dopo ciascuno:

```bash
cd ~/Desktop
git clone <URL-del-repository> procureflow
cd procureflow/procureflow
```

> Se hai gia il progetto, vai direttamente nella cartella:
> ```bash
> cd ~/Desktop/procureflow/procureflow
> ```

### Passo 2: Crea il file di configurazione

```bash
cp .env.production.example .env
```

### Passo 3: Modifica le password

Apri il file `.env` con un editor di testo (TextEdit su Mac, Blocco Note su Windows, oppure `nano .env` da Terminale) e cambia queste righe:

```
POSTGRES_PASSWORD=una-password-a-tua-scelta
NEXTAUTH_SECRET=una-stringa-lunga-qualsiasi-di-almeno-32-caratteri
N8N_WEBHOOK_SECRET=un-segreto-qualsiasi
N8N_PASSWORD=una-password-per-n8n
```

**Suggerimento rapido:** se non vuoi pensarci, usa queste password di test (NON usarle in produzione):

```
POSTGRES_PASSWORD=procureflow-test-2026
NEXTAUTH_SECRET=procureflow-nextauth-secret-test-2026-very-long
N8N_WEBHOOK_SECRET=procureflow-webhook-secret-test
N8N_PASSWORD=n8n-test-2026
```

### Passo 4: Abilita i dati demo

Assicurati che nel file `.env` ci sia questa riga:

```
SEED_ON_STARTUP=true
```

Questo carichera automaticamente utenti, fornitori, richieste e fatture di esempio al primo avvio.

---

## 3. Primo avvio

### Avvia tutti i servizi

Da Terminale, nella cartella `procureflow/procureflow`:

```bash
docker compose up --build -d
```

**Cosa succede:**
1. Docker scarica le immagini necessarie (~2 minuti la prima volta)
2. Costruisce l'applicazione (~3-5 minuti)
3. Avvia 3 servizi: database (PostgreSQL), applicazione (Next.js), automazione (n8n)
4. Esegue le migrazioni del database
5. Carica i dati demo (se `SEED_ON_STARTUP=true`)

### Verifica che tutto funzioni

Aspetta 1-2 minuti dopo il comando, poi:

```bash
docker compose ps
```

Dovresti vedere 3 servizi con stato `Up` o `running`:

```
NAME                  STATUS
procureflow-db-1      Up (healthy)
procureflow-app-1     Up
procureflow-n8n-1     Up
```

### Verifica la salute dell'applicazione

Apri il browser e vai a:

```
http://localhost:3000/api/health
```

Se vedi `{"status":"ok",...}` tutto funziona. Se vedi `error` o la pagina non carica, aspetta ancora 30 secondi e riprova.

---

## 4. Login e primi passi

### Apri ProcureFlow

Vai nel browser a: **http://localhost:3000**

### Utenti demo disponibili

Il sistema viene precaricato con 5 utenti. Usa queste credenziali per accedere:

| Ruolo | Email | Password | Cosa puo fare |
|-------|-------|----------|---------------|
| **Amministratore** | `marco.rossi@procureflow.it` | `admin123` | Tutto: gestione utenti, impostazioni, approvazioni, analytics |
| **Manager Acquisti** | `laura.bianchi@procureflow.it` | `password123` | Approvare richieste, gestire fornitori, vedere analytics |
| **Richiedente (Produzione)** | `giuseppe.verde@procureflow.it` | `password123` | Creare richieste d'acquisto, vedere le proprie richieste |
| **Richiedente (IT)** | `francesca.neri@procureflow.it` | `password123` | Creare richieste d'acquisto, vedere le proprie richieste |
| **Osservatore** | `alessio.conti@procureflow.it` | `password123` | Solo visualizzazione, nessuna modifica |

**Consiglio:** per la prima esplorazione, accedi come **Marco Rossi (admin)** — vedi tutto.

---

## 5. Test delle funzionalita

Per ogni sezione: cosa testare, dove trovarla, e cosa aspettarsi.

---

### 5.1 Dashboard

**Dove:** Pagina iniziale dopo il login (`http://localhost:3000`)

**Cosa vedere:**
- 4 card statistiche in alto (richieste attive, in attesa approvazione, ordini in corso, consegnati)
- Grafico andamento richieste nel tempo
- Lista richieste recenti
- Tab "Analisi" con metriche ROI sintetiche

**Test:**
1. Verifica che i numeri nelle card corrispondano ai dati demo
2. Clicca sulle tab (Panoramica, Analisi) — devono cambiare senza errori
3. Clicca su una richiesta dalla lista — deve aprire il dettaglio

---

### 5.2 Richieste d'acquisto

**Dove:** Menu laterale > "Richieste" (`http://localhost:3000/requests`)

**Test — visualizzazione:**
1. Vedi la lista delle richieste demo con stato, priorita, fornitore
2. Usa i **filtri** in alto: filtra per stato (es. "Approvate"), per priorita (es. "Alta")
3. Usa la **barra di ricerca**: cerca "carta" o "monitor" — devono apparire i risultati
4. Cambia la **vista**: clicca l'icona griglia per passare alla vista Kanban (colonne per stato)
5. Nella Kanban, verifica che tutte le richieste siano visibili su una sola pagina

**Test — creazione:**
1. Clicca **"Nuova Richiesta"**
2. Compila: Titolo = "Test stampante ufficio", Priorita = "Alta"
3. Aggiungi un articolo: Nome = "Stampante laser", Quantita = 1, Prezzo = 350
4. Salva — deve apparire nella lista con stato "Bozza"
5. Apri la richiesta creata — verifica che i dati siano corretti

**Test — dettaglio richiesta:**
1. Apri una richiesta esistente (es. clicca su una dalla lista)
2. Verifica: titolo, stato, fornitore, articoli, timeline degli eventi
3. Se lo stato lo permette, prova a cambiare stato (es. da Bozza a Inviata)

---

### 5.3 Fornitori

**Dove:** Menu laterale > "Fornitori" (`http://localhost:3000/vendors`)

**Test:**
1. Vedi la lista dei fornitori demo con nome, codice, stato, rating
2. Clicca su un fornitore per vedere il dettaglio
3. Nel dettaglio: verifica contatti, richieste associate, rating
4. Prova a creare un nuovo fornitore con il pulsante "Nuovo Fornitore"
5. Compila: Nome = "Test Forniture SRL", Codice = "TST-001", Email = "info@test.it"
6. Salva e verifica che appaia nella lista

---

### 5.4 Fatture e riconciliazione

**Dove:** Menu laterale > "Fatture" (`http://localhost:3000/invoices`)

**Test — visualizzazione:**
1. Vedi le fatture demo con numero, fornitore, importo, stato riconciliazione
2. Filtra per stato: "In attesa", "Riconciliate", "Con discrepanze"

**Test — caricamento fattura XML:**
1. Clicca **"Carica Fattura"**
2. Se hai un file XML di fattura elettronica italiana, caricalo
3. Il sistema dovrebbe: parsare il file, estrarre i dati, cercare il fornitore per P.IVA
4. Se il fornitore non esiste, ne crea uno automaticamente in stato "Da verificare"
5. Se la fattura corrisponde a un ordine, il matching avviene automaticamente

**Test — caricamento fattura PDF/immagine (richiede AI):**
1. Solo se hai configurato `ANTHROPIC_API_KEY` nel `.env`
2. Carica un PDF o foto di una fattura
3. L'AI analizza il documento e estrae i dati
4. Viene mostrata la confidenza dell'AI (es. 85%)

---

### 5.5 Approvazioni

**Dove:** Menu laterale > "Approvazioni" (`http://localhost:3000/approvals`)

**Test:**
1. Accedi come **Laura Bianchi** (manager) — dovrebbe vedere richieste in attesa
2. Apri un'approvazione pendente
3. Clicca **"Approva"** o **"Rifiuta"** con un commento
4. Verifica che lo stato della richiesta cambi di conseguenza
5. Accedi come **Marco Rossi** (admin) — verifica che veda la stessa approvazione con il nuovo stato

**Regole di auto-approvazione (preconfigurate nel seed):**
- Importo < 500 EUR → approvazione automatica
- Importo 500-5000 EUR → serve approvazione del manager
- Importo > 5000 EUR → serve approvazione del direttore

---

### 5.6 Budget

**Dove:** Menu laterale > "Budget" (`http://localhost:3000/budgets`)

**Test:**
1. Vedi i budget demo per dipartimento/centro di costo
2. Verifica: importo allocato, speso, disponibile, percentuale utilizzo
3. I budget con utilizzo alto (>80%) dovrebbero essere evidenziati in giallo/rosso

---

### 5.7 Inventario e magazzino

**Dove:** Menu laterale > "Materiali" (`http://localhost:3000/materials`)

**Test:**
1. Vedi la lista dei materiali demo con stock attuale, livello minimo
2. Materiali sotto il livello minimo dovrebbero essere evidenziati
3. Apri un materiale per vedere: lotti, movimenti, previsione WMA
4. La sezione "Forecast" mostra la proiezione di consumo per i prossimi 3 mesi
5. Se lo stock e basso, il sistema suggerisce un riordino

---

### 5.8 Analytics e ROI

**Dove:** Menu laterale > "Analytics" (`http://localhost:3000/analytics`)

**Test:**
1. Vedi 6 card di riepilogo: ciclo medio, tempo approvazione, savings, compliance, ecc.
2. Seleziona un **periodo** diverso (es. ultimo mese, ultimo trimestre)
3. Verifica i 4 grafici:
   - **Efficienza**: ciclo medio e tempo approvazione nel tempo
   - **Savings**: risparmi da negoziazione e compliance budget
   - **Automazione**: three-way matching e consegne puntuali
   - **Automazione email/fatture**: email processate, fatture SDI vs OCR, auto-riconciliazione
4. Clicca **"Esporta CSV"** — scarica un file con tutte le metriche
5. Apri il CSV con Excel/Numbers — verifica che contenga tutte le sezioni

---

### 5.9 AI Agent (Chat)

**Dove:** Icona chat in basso a destra (se configurato `ANTHROPIC_API_KEY`)

**Prerequisito:** Devi avere `ANTHROPIC_API_KEY=sk-ant-...` nel file `.env`

**Test:**
1. Clicca l'icona chat
2. Scrivi: "Quante richieste sono in attesa di approvazione?"
3. L'agente dovrebbe consultare il database e rispondere con il numero corretto
4. Scrivi: "Quali fornitori hanno il rating piu basso?"
5. L'agente usa tool-use per interrogare i dati e rispondere

**Se non hai la chiave API:** La chat non sara disponibile. Le altre funzionalita funzionano normalmente.

---

### 5.10 Impostazioni e sicurezza

**Dove:** Menu laterale > "Impostazioni" (`http://localhost:3000/settings`)

**Test — Profilo:**
1. Verifica i dati del profilo utente
2. Cambia il nome visualizzato e salva

**Test — Sicurezza (MFA):**
1. Vai su Impostazioni > Sicurezza
2. Clicca **"Attiva autenticazione a due fattori"**
3. Viene mostrato un QR code — scansionalo con un'app come Google Authenticator o Authy
4. Inserisci il codice a 6 cifre dall'app
5. Salva i **codici di recupero** mostrati (servono se perdi l'accesso all'app)
6. Al prossimo login, il sistema chiedera il codice oltre alla password

**Test — Moduli:**
1. Nella sezione Impostazioni, verifica quali moduli sono attivi/disattivi
2. Prova a disattivare un modulo (es. "Inventario") — le voci di menu corrispondenti spariscono

---

## 6. Test dell'automazione email (n8n)

n8n e il motore di automazione che processa le email dei fornitori.

### Accedere a n8n

Apri nel browser: **http://localhost:5678**

- Username: il valore di `N8N_USER` nel `.env` (default: `admin`)
- Password: il valore di `N8N_PASSWORD` nel `.env`

### Importare il workflow

1. In n8n, clicca **"Add workflow"** (o il pulsante +)
2. Clicca i tre puntini (...) in alto a destra > **"Import from file"**
3. Seleziona il file: `n8n/email-ingestion.json` (nella cartella del progetto)
4. Il workflow appare con 7 nodi collegati:

```
Gmail Trigger → Parsa Email → AI Parsing → Combina → Invia a ProcureFlow → Verifica → Log
```

### Configurare le credenziali

**Per far funzionare il workflow completo servono:**

| Credenziale | Dove configurarla | Note |
|-------------|-------------------|------|
| Gmail OAuth2 | n8n > Credentials > Gmail OAuth2 | Serve un account Google con Gmail API abilitata |
| OpenAI API | n8n > Credentials > OpenAI API | Per il parsing AI delle email |

**Se non hai queste credenziali**, puoi comunque testare il webhook manualmente (vedi sezione 7).

### Test senza credenziali Gmail/OpenAI

Puoi verificare che la connessione n8n → ProcureFlow funzioni senza configurare Gmail:

1. In n8n, apri il nodo **"Invia a ProcureFlow"**
2. Verifica che l'URL sia `http://app:3000/api/webhooks/email-ingestion`
3. Verifica che l'header Authorization contenga il webhook secret
4. Per un test manuale, usa il Terminale (vedi sezione 7)

---

## 7. Test dei webhook e integrazioni

I webhook sono le "porte" attraverso cui i sistemi esterni comunicano con ProcureFlow.
Puoi testarli tutti da Terminale senza bisogno di n8n, Gmail o altri servizi.

> **Prima di iniziare:** sostituisci `TUO-WEBHOOK-SECRET` in ogni comando con il valore di `N8N_WEBHOOK_SECRET` dal tuo file `.env`. Se hai usato le password di test suggerite sopra, il valore e `procureflow-webhook-secret-test`.

---

### 7.1 Creazione automatica RdA da email

**Cosa testa:** Un'email da un fornitore arriva nella casella, n8n la analizza con l'AI, e ProcureFlow crea automaticamente una richiesta d'acquisto completa di articoli, importi e fornitore.

**Come funziona nella realta:**
1. Il fornitore manda un'email (es. "Conferma ordine carta A4")
2. n8n intercetta l'email e la passa all'AI (GPT-4o-mini)
3. L'AI estrae: titolo, articoli, prezzi, fornitore, priorita
4. n8n invia questi dati a ProcureFlow via webhook
5. ProcureFlow crea la richiesta d'acquisto, associa il fornitore (o ne crea uno nuovo), e registra tutto nella timeline

**Test da Terminale:**

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-nuova-rda-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "ordini@fornitore-test.it",
    "email_subject": "Conferma ordine materiale ufficio",
    "email_body": "Confermiamo la ricezione del vostro ordine per 10 risme di carta A4 al prezzo di 5.50 EUR/risma e 5 confezioni di penne BIC a 3.20 EUR/conf. Consegna prevista entro 5 giorni lavorativi.",
    "action": "new_request",
    "ai_title": "Materiale ufficio — carta e penne",
    "ai_description": "Ordine confermato per cancelleria: carta A4 e penne",
    "ai_priority": "MEDIUM",
    "ai_vendor_name": "Cartoleria Moderna",
    "ai_category": "Cancelleria",
    "ai_department": "Amministrazione",
    "ai_estimated_amount": 71.00,
    "ai_currency": "EUR",
    "ai_needed_by": "2026-04-15",
    "ai_items": [
      {
        "name": "Carta A4 80g",
        "quantity": 10,
        "unit": "risma",
        "unit_price": 5.50,
        "total_price": 55.00
      },
      {
        "name": "Penne BIC Cristal blu",
        "quantity": 5,
        "unit": "confezione",
        "unit_price": 3.20,
        "total_price": 16.00
      }
    ],
    "ai_summary": "Ordine confermato per carta A4 (55 EUR) e penne BIC (16 EUR). Totale 71 EUR, consegna in 5gg.",
    "ai_confidence": 0.94,
    "ai_tags": ["cancelleria", "ufficio", "ordine-confermato"],
    "attachments": []
  }'
```

**Risultato atteso:**
```json
{
  "success": true,
  "data": {
    "action": "new_request",
    "request_code": "PR-2026-XXXXX",
    "items_created": 2,
    "status_updated": false,
    "ai_confidence": 0.94
  }
}
```

**Verifica in ProcureFlow:**
1. Vai su http://localhost:3000/requests
2. Cerca "Materiale ufficio" — deve apparire una nuova richiesta in stato **Bozza**
3. Apri la richiesta e verifica:
   - **Titolo**: "Materiale ufficio — carta e penne"
   - **Articoli**: 2 righe (Carta A4 e Penne BIC) con quantita e prezzi corretti
   - **Importo stimato**: 71,00 EUR
   - **Priorita**: Media
   - **Timeline**: evento "Richiesta creata da email" con mittente `ordini@fornitore-test.it`
4. Vai su http://localhost:3000/vendors — il fornitore **"Cartoleria Moderna"** e stato creato automaticamente in stato "Da verificare"

---

### 7.2 Aggiornamento automatico RdA da email fornitore

**Cosa testa:** Un fornitore invia un'email con un aggiornamento su un ordine esistente (es. "Il vostro ordine e stato spedito, ecco il tracking"). L'AI capisce che si riferisce a una richiesta gia presente e la aggiorna automaticamente.

**Come funziona nella realta:**
1. Il fornitore manda un'email tipo "Spedizione effettuata per ordine PR-2026-00001"
2. L'AI riconosce il codice della richiesta nel testo
3. ProcureFlow aggiorna automaticamente: stato → Spedito, numero tracking, data consegna prevista
4. Il richiedente riceve una notifica dell'aggiornamento

**Prerequisito:** Devi avere una richiesta esistente. Usa il codice della richiesta creata nel test 7.1 (es. `PR-2026-00042`). Sostituisci `PR-2026-XXXXX` nel comando con il codice reale.

**Test da Terminale:**

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-aggiornamento-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "spedizioni@fornitore-test.it",
    "email_subject": "[PR-2026-XXXXX] Spedizione effettuata",
    "email_body": "Vi informiamo che il vostro ordine PR-2026-XXXXX e stato spedito con corriere BRT. Numero tracking: BRT-12345678. Consegna prevista: 10 aprile 2026.",
    "action": "update_existing",
    "ai_matched_request_code": "PR-2026-XXXXX",
    "ai_status_update": "SHIPPED",
    "ai_tracking_number": "BRT-12345678",
    "ai_expected_delivery": "2026-04-10",
    "ai_summary": "Ordine spedito con BRT, tracking BRT-12345678, consegna prevista 10/04/2026.",
    "ai_confidence": 0.97,
    "ai_currency": "EUR",
    "ai_items": [],
    "ai_tags": ["spedizione", "tracking"],
    "attachments": []
  }'
```

**Risultato atteso:**
```json
{
  "success": true,
  "data": {
    "action": "update_existing",
    "request_code": "PR-2026-XXXXX",
    "items_created": 0,
    "status_updated": true,
    "ai_confidence": 0.97
  }
}
```

**Verifica in ProcureFlow:**
1. Apri la richiesta `PR-2026-XXXXX`
2. Lo **stato** e cambiato da "Bozza" a **"Spedito"**
3. Il campo **"Tracking"** mostra `BRT-12345678`
4. La **data di consegna prevista** e il 10 aprile 2026
5. Nella **timeline** c'e un nuovo evento: "Stato aggiornato a SHIPPED — Tracking: BRT-12345678 — Consegna prevista: 10/04/2026"
6. L'icona notifiche (campanella) mostra un avviso per il richiedente

**Test aggiuntivo — Conferma consegna:**

Simula l'email del fornitore che conferma la consegna avvenuta:

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-consegna-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "spedizioni@fornitore-test.it",
    "email_subject": "[PR-2026-XXXXX] Consegna completata",
    "email_body": "Confermiamo che la consegna per ordine PR-2026-XXXXX e stata effettuata in data odierna. Importo totale fatturato: 71.00 EUR.",
    "action": "update_existing",
    "ai_matched_request_code": "PR-2026-XXXXX",
    "ai_status_update": "DELIVERED",
    "ai_actual_amount": 71.00,
    "ai_summary": "Consegna completata. Importo fatturato: 71 EUR.",
    "ai_confidence": 0.95,
    "ai_currency": "EUR",
    "ai_items": [],
    "ai_tags": ["consegna-completata"],
    "attachments": []
  }'
```

**Verifica:** Lo stato ora e **"Consegnato"** e l'importo effettivo e 71,00 EUR.

---

### 7.3 Email informativa (solo log nella timeline)

**Cosa testa:** Un'email arriva che non richiede azioni ma contiene informazioni utili su un ordine esistente (es. "Vi ricordiamo che il nostro magazzino sara chiuso dal 14 al 18 aprile"). L'AI la classifica come "solo informazione" e la registra nella timeline.

**Test da Terminale:**

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-info-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "info@fornitore-test.it",
    "email_subject": "[PR-2026-XXXXX] Avviso chiusura magazzino",
    "email_body": "Gentile cliente, vi informiamo che il nostro magazzino sara chiuso dal 14 al 18 aprile per inventario. Gli ordini in corso non subiranno ritardi.",
    "action": "info_only",
    "ai_matched_request_code": "PR-2026-XXXXX",
    "ai_summary": "Fornitore avvisa chiusura magazzino 14-18 aprile. Nessun impatto sugli ordini in corso.",
    "ai_confidence": 0.88,
    "ai_currency": "EUR",
    "ai_items": [],
    "ai_tags": ["avviso", "chiusura"],
    "attachments": []
  }'
```

**Risultato atteso:**
```json
{
  "success": true,
  "data": {
    "action": "info_only",
    "request_code": "PR-2026-XXXXX",
    "items_created": 0,
    "status_updated": false
  }
}
```

**Verifica in ProcureFlow:**
1. Apri la richiesta — lo **stato NON cambia** (resta quello precedente)
2. Nella **timeline** c'e un nuovo evento tipo "Email informativa" con il riassunto dell'avviso
3. Nessun campo della richiesta viene modificato

---

### 7.4 Ricezione fattura SDI (Sistema di Interscambio)

**Cosa testa:** Una fattura elettronica arriva dal Sistema di Interscambio (SDI). ProcureFlow la processa automaticamente: parsing XML, deduplicazione, creazione record, matching con ordine esistente, riconciliazione three-way, e notifiche.

**Come funziona nella realta:**
1. Il fornitore emette una fattura elettronica (formato XML FatturaPA)
2. L'SDI la inoltra al tuo sistema (tramite provider o n8n)
3. ProcureFlow la parsa, cerca se corrisponde a un ordine esistente
4. Se trova un match: collega fattura → ordine, cambia stato a "Fatturato", esegue three-way matching
5. Se non trova match: la registra comunque e notifica gli admin

**Test da Terminale — Fattura senza ordine associato:**

```bash
curl -X POST http://localhost:3000/api/webhooks/sdi-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-sdi-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "event_type": "invoice_received",
    "sdi_id": "SDI-TEST-001",
    "sdi_filename": "IT12345678901_test1.xml",
    "sdi_status": "RECEIVED",
    "sender_vat_id": "IT12345678901",
    "sender_name": "Fornitore Demo SRL",
    "invoice_number": "FT-2026-001",
    "invoice_date": "2026-04-01",
    "document_type": "TD01",
    "total_taxable": 1000.00,
    "total_tax": 220.00,
    "total_amount": 1220.00,
    "currency": "EUR",
    "line_items": [
      {
        "description": "Servizio consulenza IT",
        "quantity": 1,
        "unit_of_measure": "ore",
        "unit_price": 1000.00,
        "total_price": 1000.00,
        "vat_rate": 22
      }
    ],
    "payment_method": "Bonifico bancario",
    "payment_iban": "IT60X0542811101000000123456",
    "payment_due_date": "2026-05-01"
  }'
```

**Risultato atteso:**
```json
{
  "success": true,
  "data": {
    "invoice_id": "...",
    "invoice_number": "FT-2026-001",
    "match_status": "UNMATCHED",
    "match_confidence": 0,
    "matched_request_id": null,
    "reconciliation": null,
    "deduplicated": false
  }
}
```

**Verifica in ProcureFlow:**
1. Vai su http://localhost:3000/invoices
2. Cerca "FT-2026-001" — la fattura e stata registrata
3. **Stato match**: "Non associata" (nessun ordine corrispondente trovato)
4. **Fornitore**: "Fornitore Demo SRL" creato automaticamente in stato "Da verificare"
5. Gli admin hanno ricevuto una **notifica**: "Fattura senza ordine: FT-2026-001"

**Test protezione duplicati SDI:**

Invia di nuovo la stessa fattura (stesso `sdi_id`):

```bash
curl -X POST http://localhost:3000/api/webhooks/sdi-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-sdi-dup-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "event_type": "invoice_received",
    "sdi_id": "SDI-TEST-001",
    "sdi_filename": "IT12345678901_test1.xml",
    "sender_vat_id": "IT12345678901",
    "sender_name": "Fornitore Demo SRL",
    "invoice_number": "FT-2026-001",
    "total_amount": 1220.00,
    "currency": "EUR",
    "line_items": []
  }'
```

**Risultato atteso:** `"deduplicated": true` — la fattura non viene creata una seconda volta.

---

### 7.5 Aggiornamento fornitore da sistema esterno

**Cosa testa:** Un sistema esterno (ERP, gestionale, portale fornitori) invia un aggiornamento sui dati di un fornitore. ProcureFlow lo recepisce e aggiorna l'anagrafica.

**Prerequisito:** Serve il **codice fornitore** di un vendor esistente. Puoi trovarlo nella pagina Fornitori — usa il codice di uno dei vendor demo (es. lo trovi nella colonna "Codice" della tabella).

Apri ProcureFlow > Fornitori e copia il codice di un fornitore (es. `TECH-001`). Sostituiscilo nel comando.

**Test da Terminale:**

```bash
curl -X POST http://localhost:3000/api/webhooks/vendor-update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-vendor-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "vendor_code": "CODICE-FORNITORE",
    "updates": {
      "email": "nuova-email@fornitore.it",
      "phone": "+39 02 1234567",
      "rating": 4.5
    }
  }'
```

**Risultato atteso:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "...",
    "code": "CODICE-FORNITORE",
    "email": "nuova-email@fornitore.it",
    "phone": "+39 02 1234567",
    "rating": 4.5
  }
}
```

**Verifica in ProcureFlow:**
1. Vai su Fornitori > apri il fornitore aggiornato
2. L'**email** e ora `nuova-email@fornitore.it`
3. Il **telefono** e `+39 02 1234567`
4. Il **rating** e 4.5

**Test cambio stato fornitore:**

```bash
curl -X POST http://localhost:3000/api/webhooks/vendor-update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-vendor-status-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "vendor_code": "CODICE-FORNITORE",
    "updates": {
      "status": "INACTIVE"
    }
  }'
```

**Verifica:** Lo stato del fornitore e ora "Inattivo". Stati validi: `ACTIVE`, `INACTIVE`, `BLACKLISTED`, `PENDING_REVIEW`.

---

### 7.6 Approvazione/Rifiuto via webhook

**Cosa testa:** Un sistema esterno (es. email con pulsante "Approva", app mobile, Slack bot) invia la decisione di un approvatore su una richiesta.

**Prerequisito:** Serve l'**ID di un'approvazione** in stato "In attesa". Per trovarlo:
1. Accedi come admin a ProcureFlow
2. Vai su una richiesta in stato "In attesa approvazione"
3. L'ID approvazione lo trovi nell'URL del dettaglio o tramite l'interfaccia

In alternativa, crea una nuova richiesta con importo > 500 EUR e inviala per approvazione.

**Test approvazione:**

```bash
curl -X POST http://localhost:3000/api/webhooks/approval-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-approval-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "approval_id": "ID-APPROVAZIONE",
    "action": "APPROVED",
    "comment": "Approvato — budget disponibile verificato"
  }'
```

**Verifica in ProcureFlow:**
1. L'approvazione risulta **"Approvata"** con il commento
2. Se era l'ultima approvazione necessaria, la richiesta cambia stato a **"Approvata"**
3. Nella timeline: evento "Approvazione: Approvata"

**Test rifiuto:**

```bash
curl -X POST http://localhost:3000/api/webhooks/approval-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-reject-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "approval_id": "ID-APPROVAZIONE",
    "action": "REJECTED",
    "comment": "Budget esaurito per questo trimestre"
  }'
```

**Verifica:** Se anche una sola approvazione e "Rifiutata", la richiesta passa a stato **"Rifiutata"**.

---

### 7.7 Auto-approvazione per soglia importo

**Cosa testa:** ProcureFlow approva automaticamente le richieste sotto una certa soglia di importo, senza intervento umano. Questo accelera gli acquisti di piccolo importo.

**Come funziona:**
- Importo **< 500 EUR** → approvazione automatica (per manager/admin)
- Importo **500 - 5.000 EUR** → serve approvazione del manager
- Importo **> 5.000 EUR** → serve approvazione del direttore

**Test: crea una richiesta da email con importo basso da un utente manager**

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-auto-approve-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "laura.bianchi@procureflow.it",
    "email_subject": "Ordine toner stampante",
    "email_body": "Ordino 2 toner per la stampante del reparto acquisti. Costo 45 EUR cadauno.",
    "action": "new_request",
    "ai_title": "Toner stampante reparto acquisti",
    "ai_priority": "LOW",
    "ai_vendor_name": "Office Depot",
    "ai_category": "Cancelleria",
    "ai_estimated_amount": 90.00,
    "ai_currency": "EUR",
    "ai_items": [
      {
        "name": "Toner HP 305A nero",
        "quantity": 2,
        "unit": "pz",
        "unit_price": 45.00,
        "total_price": 90.00
      }
    ],
    "ai_summary": "Ordine 2 toner HP 305A a 90 EUR totali.",
    "ai_confidence": 0.96,
    "ai_tags": ["cancelleria", "toner"],
    "attachments": []
  }'
```

**Risultato atteso:** `"status_updated": true` — la richiesta e stata **auto-approvata** perche:
1. L'email `laura.bianchi@procureflow.it` corrisponde a un utente con ruolo MANAGER
2. L'importo (90 EUR) e sotto la soglia di 500 EUR

**Verifica in ProcureFlow:**
1. Cerca "Toner stampante" nella lista richieste
2. Lo stato e direttamente **"Approvata"** (non passa per "Bozza" o "In attesa")
3. Nella timeline: "Auto-approvato per ruolo MANAGER"

---

### 7.8 Protezione duplicati (idempotenza)

**Cosa testa:** Se un webhook viene inviato due volte (es. per un errore di rete), ProcureFlow non crea duplicati. Usa l'header `x-webhook-id` per riconoscere i messaggi gia processati.

**Test:**

```bash
# Prima volta — crea la richiesta
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-idem-123" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{"email_from":"a@b.it","email_subject":"Test idempotenza","email_body":"Test","action":"new_request","ai_title":"Test Idempotenza","ai_items":[],"ai_tags":[],"ai_currency":"EUR","attachments":[]}'

# Seconda volta — stesso x-webhook-id, non crea duplicato
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-idem-123" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{"email_from":"a@b.it","email_subject":"Test idempotenza","email_body":"Test","action":"new_request","ai_title":"Test Idempotenza","ai_items":[],"ai_tags":[],"ai_currency":"EUR","attachments":[]}'
```

**Risultato atteso:** Entrambe le risposte sono **identiche**. La seconda chiamata non crea una nuova richiesta — risponde con i dati della prima. Nella lista richieste c'e un solo "Test Idempotenza".

---

### 7.9 Health check

Il controllo piu semplice — verifica che il sistema sia vivo:

```bash
curl http://localhost:3000/api/health
```

**Risultato atteso:** `{"status":"ok","timestamp":"...","uptime":...}`

---

## 8. Test end-to-end: flusso completo ordine

Questo test simula un **ciclo di vita completo** di un ordine, dall'email del fornitore fino alla riconciliazione della fattura. Eseguilo nell'ordine — ogni passo dipende dal precedente.

### Passo 1: Arriva un'email → Creazione RdA

Un dipendente riceve un'offerta da un fornitore. L'email viene processata e diventa una richiesta.

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: e2e-step1-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "laura.bianchi@procureflow.it",
    "email_subject": "Offerta monitor Dell 27 pollici",
    "email_body": "Buongiorno, confermiamo disponibilita per 3 monitor Dell P2723QE a 420 EUR cadauno. Consegna in 7 giorni lavorativi.",
    "action": "new_request",
    "ai_title": "Monitor Dell P2723QE per ufficio IT",
    "ai_priority": "HIGH",
    "ai_vendor_name": "Dell Technologies",
    "ai_category": "Hardware IT",
    "ai_department": "IT",
    "ai_estimated_amount": 1260.00,
    "ai_needed_by": "2026-04-20",
    "ai_currency": "EUR",
    "ai_items": [
      {
        "name": "Monitor Dell P2723QE 27\" 4K USB-C",
        "quantity": 3,
        "unit": "pz",
        "unit_price": 420.00,
        "total_price": 1260.00,
        "sku": "P2723QE"
      }
    ],
    "ai_summary": "Offerta per 3 monitor Dell 4K a 1260 EUR totali, consegna 7gg.",
    "ai_confidence": 0.95,
    "ai_tags": ["hardware", "monitor", "it"],
    "attachments": []
  }'
```

**Cosa succede:** La richiesta viene creata con importo 1.260 EUR. Poiche Laura e MANAGER ma l'importo supera 500 EUR, la richiesta va in **approvazione** (non auto-approvata).

**Annota il codice richiesta** dalla risposta (es. `PR-2026-00043`).

### Passo 2: Approvazione del manager

Accedi a ProcureFlow come admin (`marco.rossi@procureflow.it`), vai su Approvazioni, e approva la richiesta. In alternativa, trova l'ID approvazione e usa il webhook:

```bash
curl -X POST http://localhost:3000/api/webhooks/approval-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: e2e-step2-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "approval_id": "ID-APPROVAZIONE",
    "action": "APPROVED",
    "comment": "Budget IT disponibile, approvato"
  }'
```

**Verifica:** La richiesta passa a stato **"Approvata"**.

### Passo 3: Il fornitore conferma la spedizione

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: e2e-step3-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "logistica@dell.com",
    "email_subject": "[PR-2026-XXXXX] Spedizione confermata",
    "email_body": "I monitor Dell P2723QE sono stati spediti. Tracking DHL: DHL-9876543210. Consegna prevista 15 aprile.",
    "action": "update_existing",
    "ai_matched_request_code": "PR-2026-XXXXX",
    "ai_status_update": "SHIPPED",
    "ai_tracking_number": "DHL-9876543210",
    "ai_expected_delivery": "2026-04-15",
    "ai_summary": "Monitor spediti con DHL, consegna prevista 15/04.",
    "ai_confidence": 0.98,
    "ai_currency": "EUR",
    "ai_items": [],
    "ai_tags": ["spedizione"],
    "attachments": []
  }'
```

**Verifica:** Stato → **"Spedito"**, tracking aggiornato, data consegna prevista impostata.

### Passo 4: Consegna avvenuta

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: e2e-step4-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "logistica@dell.com",
    "email_subject": "[PR-2026-XXXXX] Consegna effettuata",
    "email_body": "La consegna dei 3 monitor e stata completata oggi.",
    "action": "update_existing",
    "ai_matched_request_code": "PR-2026-XXXXX",
    "ai_status_update": "DELIVERED",
    "ai_actual_amount": 1260.00,
    "ai_summary": "Consegna completata per 3 monitor Dell.",
    "ai_confidence": 0.96,
    "ai_currency": "EUR",
    "ai_items": [],
    "ai_tags": ["consegna"],
    "attachments": []
  }'
```

**Verifica:** Stato → **"Consegnato"**, importo effettivo aggiornato.

### Passo 5: Arriva la fattura SDI

Il fornitore emette la fattura elettronica, che arriva via SDI:

```bash
curl -X POST http://localhost:3000/api/webhooks/sdi-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: e2e-step5-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "event_type": "invoice_received",
    "sdi_id": "SDI-E2E-TEST-001",
    "sdi_filename": "IT00488410010_e2e01.xml",
    "sdi_status": "RECEIVED",
    "sender_vat_id": "IT00488410010",
    "sender_name": "Dell Technologies Italia SRL",
    "invoice_number": "FT-DELL-2026-001",
    "invoice_date": "2026-04-15",
    "document_type": "TD01",
    "total_taxable": 1260.00,
    "total_tax": 277.20,
    "total_amount": 1537.20,
    "currency": "EUR",
    "line_items": [
      {
        "description": "Monitor Dell P2723QE 27\" 4K USB-C",
        "quantity": 3,
        "unit_of_measure": "pz",
        "unit_price": 420.00,
        "total_price": 1260.00,
        "vat_rate": 22
      }
    ],
    "payment_method": "Bonifico bancario 30gg DFFM",
    "payment_iban": "IT60X0542811101000000654321",
    "payment_due_date": "2026-05-31"
  }'
```

**Verifica in ProcureFlow:**
1. Vai su **Fatture** — la fattura FT-DELL-2026-001 e stata registrata
2. Se il sistema ha trovato un match con la richiesta dei monitor:
   - La fattura mostra **"Auto-matched"** con la richiesta
   - La richiesta passa a stato **"Fatturato"**
   - Il **three-way matching** confronta: ordine (1.260 EUR) vs fattura (1.537,20 EUR IVA inclusa)
3. Se non ha trovato un match automatico: gli admin ricevono una notifica per associare manualmente

### Riepilogo del ciclo

Apri la richiesta e guarda la **timeline completa**. Dovresti vedere 5+ eventi:

| # | Evento | Fonte |
|---|--------|-------|
| 1 | Richiesta creata da email | Email ingestion |
| 2 | Approvazione | Manager/Webhook |
| 3 | Stato → Spedito + tracking | Email fornitore |
| 4 | Stato → Consegnato | Email fornitore |
| 5 | Fattura ricevuta e associata | SDI |

Questo e il flusso che nella vita reale richiederebbe settimane di lavoro manuale — ProcureFlow lo gestisce automaticamente grazie alle email e al Sistema di Interscambio.

---

## 9. Spegnere e riavviare

### Spegnere tutto

```bash
cd ~/Desktop/procureflow/procureflow
docker compose down
```

I dati nel database vengono **mantenuti** (salvati nel volume Docker).

### Riavviare

```bash
docker compose up -d
```

Non serve `--build` a meno che tu non abbia modificato il codice.

### Ripartire da zero (cancella tutti i dati)

```bash
docker compose down -v
```

Il flag `-v` cancella i volumi (database). Al prossimo avvio, se `SEED_ON_STARTUP=true`, i dati demo vengono ricaricati.

### Vedere i log in tempo reale

```bash
# Tutti i servizi
docker compose logs -f

# Solo l'applicazione
docker compose logs -f app

# Solo il database
docker compose logs -f db

# Solo n8n
docker compose logs -f n8n
```

Premi `Ctrl + C` per uscire dai log.

---

## 10. Problemi comuni

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| **La pagina non carica** (localhost:3000) | L'app non e ancora pronta | Aspetta 1-2 minuti. Controlla con `docker compose logs app` |
| **Errore "Set NEXTAUTH_SECRET"** | Manca la variabile nel `.env` | Apri `.env` e aggiungi `NEXTAUTH_SECRET=una-stringa-lunga` |
| **Login fallisce con credenziali corrette** | Il seed non e stato eseguito | Controlla i log: `docker compose logs app`. Se dice "Seed failed", prova `docker compose down -v` e riavvia |
| **"Database connection failed"** su /api/health | PostgreSQL non e pronto | Aspetta 30 secondi. Se persiste: `docker compose restart db` |
| **n8n non si apre** (localhost:5678) | Il servizio non e partito | `docker compose logs n8n` per vedere l'errore |
| **Webhook restituisce 401** | Secret non corrispondente | Verifica che `N8N_WEBHOOK_SECRET` nel `.env` corrisponda al Bearer token usato nel curl |
| **"Module not enabled"** su una pagina | Il modulo e disattivato | Vai su Impostazioni > Moduli e attivalo |
| **AI Agent non risponde** | Manca `ANTHROPIC_API_KEY` | Aggiungi la chiave API Anthropic nel `.env` e riavvia: `docker compose restart app` |
| **Fattura PDF rifiutata** | Manca `ANTHROPIC_API_KEY` | Il parsing AI delle fatture non-XML richiede Claude. Usa fatture XML come alternativa |
| **Docker dice "port already in use"** | Un altro servizio usa la porta 3000/5432/5678 | Chiudi l'altro servizio oppure cambia le porte nel `docker-compose.yml` |
| **Build Docker fallisce** | Cache corrotta | Prova: `docker compose build --no-cache` |
| **Tutto funzionava, ora non parte** | Aggiornamento Docker o spazio disco | Libera spazio: `docker system prune` (attenzione: cancella container fermi) |

### Serve aiuto?

- Controlla i log: `docker compose logs -f` mostra cosa succede in tempo reale
- Riparti da zero: `docker compose down -v && docker compose up --build -d`
- Apri un issue su GitHub con il testo dell'errore dai log

---

## Riepilogo URL

| Servizio | URL | Note |
|----------|-----|------|
| **ProcureFlow** | http://localhost:3000 | Applicazione principale |
| **Health Check** | http://localhost:3000/api/health | Stato del sistema |
| **n8n** | http://localhost:5678 | Automazione workflow |
| **PostgreSQL** | localhost:5432 | Database (non ha interfaccia web) |
| **Prisma Studio** | `npx prisma studio` (da terminale, in dev) | Esplora il database visualmente |
