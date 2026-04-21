# ProcureFlow — Flussi Utente

Data snapshot: 2026-04-17

---

## 1. Personas

### ADMIN — Il titolare / responsabile IT

**Chi e**: il founder o il responsabile IT della PMI. Configura il sistema, gestisce utenti, abilita moduli.
**Attivita quotidiane**: controlla il compliance monitor, esporta report, onboarda fornitori, configura integrazioni.
**Obiettivo**: visibilita totale sul procurement, costi sotto controllo, sistema funzionante.
**Schermata piu vista**: Dashboard (KPI) e Admin Config.
**Permessi**: tutto. Unico ruolo che accede a: gestione utenti, configurazione admin, export/backup, eliminazione fornitori/gare, creazione budget.

### MANAGER — Il buyer / responsabile acquisti

**Chi e**: la persona che approva ordini e gestisce i fornitori. Spesso anche il referente per le commesse.
**Attivita quotidiane**: approvare richieste, importare email fornitori, riconciliare fatture, analizzare gare.
**Obiettivo**: processare le richieste in tempo, negoziare con i fornitori, gestire i margini commessa.
**Schermata piu vista**: Approvazioni e Richieste.
**Permessi**: tutto tranne gestione utenti, config admin, eliminazione fornitori/gare, creazione budget. MFA obbligatorio.

### REQUESTER — L'operatore / tecnico

**Chi e**: chi ha bisogno di materiale. Puo essere un tecnico di laboratorio, un operaio, un project manager.
**Attivita quotidiane**: creare richieste d'acquisto, consultare lo stato degli ordini, commentare sulle PR.
**Obiettivo**: ottenere il materiale in tempo, con il minimo sforzo burocratico.
**Schermata piu vista**: Richieste (le proprie) e Dettaglio Richiesta.
**Permessi**: crea/modifica richieste, consulta fornitori, upload fatture, commenta. Non approva, non gestisce fornitori, non accede a budget.

### VIEWER — Il consulente / contabile esterno

**Chi e**: un professionista esterno che consulta i dati senza modificarli.
**Attivita quotidiane**: consultare fatture, budget, report.
**Obiettivo**: avere i dati aggiornati per la contabilita o l'audit.
**Schermata piu vista**: Fatture e Budget.
**Permessi**: solo lettura su tutto. Non puo creare, modificare, approvare nulla.

---

## 2. Flussi End-to-End

### 2.1 Flusso A — Crea Richiesta d'Acquisto Manuale

**Persona**: REQUESTER (o MANAGER, ADMIN)
**Trigger**: click su "Nuova Richiesta" dalla sidebar, dalla command palette (Cmd+K), o dal pulsante + nella pagina Richieste

**Step**:

1. **Utente apre il form**: naviga a `/requests/new`. Il sistema carica `RequestForm` con campi vuoti. Dropdown fornitori e commesse vengono caricati via React Query (`/api/vendors`, `/api/commesse`).

2. **Utente compila il titolo**: appena il titolo supera ~3 parole, il sistema attiva **SmartFill** — una richiesta debounced a `/api/requests/suggest` che usa Claude per suggerire fornitore, categoria, priorita, dipartimento, importo e articoli. I suggerimenti appaiono come chip cliccabili sotto ogni campo.

3. **Utente sceglie il fornitore**: dropdown con ricerca. Se il fornitore non esiste, il bottone "Crea nuovo fornitore" apre un form inline rapido (`useQuickCreateVendor`) con solo nome, email, telefono. Il fornitore viene creato via POST `/api/vendors/quick` e selezionato.

4. **Utente aggiunge articoli**: sezione "Righe" con bottone "Aggiungi riga". Ogni riga ha: nome, quantita, unita, prezzo unitario, prezzo totale, SKU. Il totale stimato si aggiorna live.

5. **Utente (opzionale) apre la sezione Compliance**: collapsibile, mostra campi MePA (OdA number), CIG (10 char), CUP (15 char). Visibile solo se pertinente.

6. **Utente (opzionale) seleziona commessa**: dropdown con commesse in stato PLANNING/ACTIVE. Collega la RDA alla commessa per tracking margine.

7. **Utente clicca "Crea Richiesta"**: POST `/api/requests` con tutti i dati. Il server genera il codice sequenziale (PR-2026-NNNNN via `SELECT ... FOR UPDATE`), crea la PR in stato DRAFT con gli items.

8. **Feedback**: toast "Richiesta creata" + redirect alla pagina dettaglio della PR (`/requests/[id]`).

**Componenti UI**: `request-form.tsx`, `vendor-dropdown.tsx` (con quick-create), campo items con `useFieldArray`
**API**: POST `/api/requests`, GET `/api/vendors`, GET `/api/commesse`, POST `/api/requests/suggest`
**Friction**:
- SmartFill richiede che l'utente scriva un titolo significativo — titoli generici ("materiale") non producono suggerimenti utili
- Il dropdown fornitore carica tutti i fornitori: con 500+ fornitori, la ricerca testuale diventa necessaria
- La sezione Compliance e nascosta: l'utente potrebbe non sapere che deve compilare CIG/CUP per determinati acquisti
- Nessun salvataggio in bozza automatico: se il browser crasha, il form e perso

---

### 2.2 Flusso B — Approva una Richiesta come Manager

**Persona**: MANAGER (o ADMIN)
**Trigger**: notifica in-app (badge rosso sulla campanella) o navigazione alla pagina Approvazioni

**Step**:

1. **Utente naviga a `/approvals`**: vede la lista con tab filtro (Tutti / In attesa / Approvate / Rifiutate). Di default vede "In attesa" (`PENDING`). Ogni card mostra: codice PR, titolo, richiedente, importo stimato, data richiesta.

2. **Utente clicca su una card**: si espande il dettaglio inline (o naviga al dettaglio PR).

3. **Utente clicca "Approva" o "Rifiuta"**: appare un form inline con textarea per note opzionali.

4. **Utente clicca "Conferma"**: POST `/api/approvals/[id]/decide` con `{ action: "APPROVED", notes: "..." }`. Il server aggiorna lo stato dell'approvazione e, se tutte le approvazioni sono complete, cambia lo stato della PR (PENDING_APPROVAL → APPROVED o REJECTED).

5. **Feedback**: la card si aggiorna, la lista si ricarica (invalidazione query `['requests']` e `['my-approvals']`). Il richiedente riceve una notifica "Richiesta approvata/rifiutata".

**Componenti UI**: `approvals/page.tsx` (tab filtro), `approval-card.tsx`, `approval-actions.tsx` (bottoni + form note)
**API**: GET `/api/approvals`, POST `/api/approvals/[id]/decide`
**Friction**:
- Nessun contesto fornitore nella card approvazione: il manager vede importo e titolo ma deve cliccare per capire da chi si compra
- Nessun confronto budget: il manager non vede se l'acquisto sfora il budget senza navigare altrove
- Approvazione singola: non c'e bulk approve per 10 richieste sotto-soglia

---

### 2.3 Flusso C — Carica una Fattura PEC e Fai Matching

**Persona**: MANAGER o REQUESTER
**Trigger**: ricezione fattura via PEC, utente la scarica e la carica nel sistema

**Step**:

1. **Utente naviga a `/invoices`**: vede la lista fatture con filtri (stato match, stato riconciliazione, fornitore, data).

2. **Utente clicca "Carica fattura"**: apre dialog/pagina di upload. Accetta XML FatturaPA (.xml, .p7m) o PDF/immagine.

3. **Sistema processa il file**:
   - **XML/P7M**: parser deterministico `parseFatturaPA()` estrae numero, data, fornitore (P.IVA), righe, totale. Nessun costo AI.
   - **PDF/JPG/PNG**: Claude Sonnet analizza il documento via Vision API. Estrae gli stessi campi. Costo: ~$0.01.

4. **Sistema cerca il fornitore**: lookup per P.IVA. Se non trovato, crea vendor in stato `PENDING_REVIEW`.

5. **Sistema auto-matcha**: `matchInvoiceToOrder()` cerca PR correlate per: codice PR nell'email/note, external_ref del fornitore, importo simile. Risultato: `AUTO_MATCHED` (match sicuro), `SUGGESTED` (match probabile), `UNMATCHED` (nessun match).

6. **Sistema esegue three-way match**: se match trovato, confronta fattura vs ordine vs ricezione. Calcola discrepanze.

7. **Utente vede il risultato**: pagina dettaglio fattura (`/invoices/[id]`) mostra: dati fattura, stato match, confidence AI, discrepanze eventuali.

8. **Se UNMATCHED**: utente clicca "Associa manualmente" → apre `match-dialog.tsx` con ricerca PR. Cerca per codice o titolo, seleziona, clicca "Associa" → POST `/api/invoices/[id]/match`.

9. **Riconciliazione**: utente clicca "Riconcilia" → `reconciliation-dialog.tsx` con tre opzioni: Approva (verde), Contesta (ambra), Rifiuta (rosso). Note opzionali. POST `/api/invoices/[id]/reconcile`.

**Componenti UI**: `invoices-page-content.tsx`, upload dialog, `match-dialog.tsx`, `reconciliation-dialog.tsx`
**API**: POST `/api/invoices/upload`, GET `/api/invoices`, POST `/api/invoices/[id]/match`, POST `/api/invoices/[id]/reconcile`
**Friction**:
- L'utente deve scaricare la fattura dalla PEC e poi caricarla manualmente — nessuna integrazione PEC diretta
- Il match automatico funziona solo se la fattura contiene riferimenti chiari (codice PR, external_ref): fatture generiche restano UNMATCHED
- La riconciliazione manuale richiede che l'utente verifichi le discrepanze da solo — il sistema mostra i numeri ma non evidenzia le differenze

---

### 2.4 Flusso D — Importa Email Cliente con Ordine

**Persona**: MANAGER o ADMIN
**Trigger**: ricezione email da cliente con ordine di acquisto (spesso con PDF allegato)

**Step**:

1. **Utente clicca l'icona email import**: dall'header o da una quick action. Apre il dialog di import email.

2. **Utente incolla l'email**: compila campi Da, Oggetto, Corpo. Opzionalmente allega PDF (max 5 file, 10 MB ciascuno) via drag-and-drop o file picker.

3. **Utente clicca "Importa"**: POST `/api/email-import` (multipart/form-data se allegati, JSON altrimenti).

4. **Sistema processa**: l'Email Intelligence Agent (Sonnet 4.6, max 10 iterazioni) analizza l'email. Per un ORDINE_CLIENTE tipico:
   - Cerca/crea il cliente (`find_or_create_client`)
   - Crea la commessa (`create_commessa`)
   - Per ogni articolo: cerca/crea nel catalogo (`find_or_create_article`), verifica stock (`get_stock_for_article`), crea RDA con quantita netta (`create_request`)
   - Cerca fornitori potenziali (`search_vendors`)
   - Crea notifica riepilogo (`create_notification`)
   - Salva EmailLog in DB

5. **Feedback**: il dialog mostra il risultato JSON: intent classificato, confidence, azioni eseguite, summary. Toast di conferma.

6. **Side-effect**: nuove entita nel sistema — Commessa, 1-N RDA in DRAFT, Articoli nel catalogo, Client se nuovo. Notifica al requester con link alle PR create.

**Componenti UI**: email import dialog (nell'header), risultato inline
**API**: POST `/api/email-import`
**Tool agente**: search_clients, find_or_create_client, create_commessa, find_or_create_article, get_stock_for_article, create_request, search_vendors, create_notification
**Friction**:
- L'utente deve manualmente copiare/incollare l'email — nessuna integrazione IMAP diretta
- Il risultato dell'agente e un blob JSON: l'utente deve interpretare actions_taken[] per capire cosa e successo
- Se l'agente classifica male (confidence < 0.7), l'utente non ha un modo semplice per correggere — deve andare a modificare manualmente le entita create
- Il processing puo richiedere 10-30 secondi (6+ round API Anthropic): l'utente aspetta senza progress bar dettagliato
- PDF allegati corposi (cataloghi, specifiche) rallentano l'upload e il processing

---

### 2.5 Flusso E — Configura un Nuovo Fornitore

**Persona**: ADMIN o MANAGER
**Trigger**: necessita di censire un nuovo fornitore nel sistema

**Step**:

1. **Utente naviga a `/vendors`**: vede la lista fornitori con ricerca e filtri per stato.

2. **Utente clicca "Nuovo Fornitore"**: apre `vendor-create-dialog.tsx` — modal a schermo pieno.

3. **Utente compila**: nome e codice (obbligatori), poi email, telefono, sito web, tipo portale (WEBSITE/EMAIL_ONLY/API/MARKETPLACE/PHONE), URL portale, condizioni pagamento, rating (0-5 stelle), categorie merceologiche, note.

4. **Utente clicca "Crea"**: POST `/api/vendors`. Validazione Zod lato client e server. Se codice duplicato → errore Prisma P2002 → messaggio "Codice fornitore gia esistente".

5. **Feedback**: toast "Fornitore creato", dialog si chiude, lista si ricarica.

**Variante — Quick Create dal form richiesta**: quando l'utente crea una PR e il fornitore non esiste, il dropdown mostra "Crea nuovo fornitore" che apre un form rapido con solo nome/email/telefono. POST `/api/vendors/quick`.

**Componenti UI**: `vendor-create-dialog.tsx`, `vendor-edit-dialog.tsx`, vendor dropdown con quick-create in `request-form.tsx`
**API**: POST `/api/vendors`, POST `/api/vendors/quick`, GET `/api/vendors`
**Friction**:
- Il codice fornitore e obbligatorio e manuale: l'utente deve inventare un codice (es. "V-001") senza suggerimenti
- Le categorie merceologiche sono un campo libero: nessun autocomplete, nessuna tassonomia standard

---

### 2.6 Flusso F — Onboarding Fornitori da File

**Persona**: ADMIN
**Trigger**: primo setup del sistema o import massivo da gestionale precedente

**Step**:

1. **Utente naviga al pannello admin**: `/admin/config` (solo ADMIN).

2. **Utente seleziona "Import fornitori"**: upload CSV o file Excel.

3. **Sistema processa**: il Vendor Onboarding Agent (Sonnet 4.6) analizza il file, mappa colonne sporche ai campi ProcureFlow, normalizza P.IVA/telefono/email, assegna confidence per riga.

4. **Import automatico**: righe con confidence >= 0.5 vengono importate. Duplicati (per codice, nome, P.IVA) saltati. Fornitori creati in stato ACTIVE.

5. **Feedback**: risultato con contatori (importati/saltati) e lista warnings per riga.

**Componenti UI**: admin panel, upload form
**API**: POST `/api/agents/onboarding`
**Friction**:
- Nessuna preview pre-import: l'utente non vede cosa verra importato prima di confermare
- I fornitori saltati per bassa confidence non hanno un flusso di revisione — l'utente deve ricrearli manualmente
- Nessun mapping colonne manuale: se l'AI mappa male, non c'e modo di correggere

---

### 2.7 Flusso G — Registra Movimento Magazzino + Alert Sotto Scorta

**Persona**: ADMIN o MANAGER
**Trigger**: arrivo merce, prelievo, rettifica inventariale

**Step**:

1. **Utente naviga a `/inventory/movements`**: lista movimenti con filtri per tipo, magazzino, data.

2. **Utente clicca "Nuovo Movimento"**: apre `movement-form-dialog.tsx`.

3. **Utente seleziona tipo**: INBOUND (entrata), OUTBOUND (uscita), TRANSFER (trasferimento), ADJUSTMENT (rettifica), RETURN (reso). La selezione filtra le causali disponibili (es. INBOUND mostra: Acquisto, Reso cliente, Produzione, Trasferimento in, Rettifica positiva).

4. **Utente compila**: materiale (ID), quantita, magazzino origine, zona (opzionale), lotto (obbligatorio per OUTBOUND), costo unitario (solo INBOUND), riferimento (DDT/fattura/ordine), note.

5. **Per TRANSFER**: appare campo "Magazzino destinazione" + zona.

6. **Utente clicca "Registra"**: POST `/api/stock/movements`. Il sistema aggiorna le quantita di stock, crea il record movimento.

7. **Alert automatico**: se la quantita scende sotto `min_stock_level` del materiale, il sistema genera un alert. L'alert e visibile nella pagina materiale e nel forecast dashboard.

**Componenti UI**: `movement-form-dialog.tsx`, `movements-page-content.tsx`
**API**: POST `/api/stock/movements`, GET `/api/inventory/movements`
**Friction**:
- Il materiale si seleziona per ID: nessun autocomplete per nome/codice
- Il lotto e obbligatorio per uscite ma l'utente deve conoscere l'ID lotto — nessun dropdown con stock disponibile per lotto
- Il form cambia campi in base al tipo: l'utente deve capire quale tipo scegliere per la propria situazione

---

### 2.8 Flusso H — Crea e Gestisci Commessa con Margine

**Persona**: MANAGER o ADMIN
**Trigger**: ordine ricevuto da un cliente (manuale o via email import)

**Step**:

1. **Utente naviga a `/commesse`**: lista commesse con filtri per stato e cliente.

2. **Utente clicca "Nuova Commessa"**: apre `commessa-create-dialog.tsx`.

3. **Utente compila**: titolo (obbligatorio), cliente (dropdown da anagrafica clienti), valore cliente (EUR), deadline, priorita, categoria, dipartimento, descrizione.

4. **Utente clicca "Crea"**: POST `/api/commesse`. Il server genera codice COM-2026-NNNNN, stato iniziale PLANNING.

5. **Commessa creata**: l'utente vede il dettaglio (`/commesse/[code]`) con: stato, valore cliente, margine calcolato (valore cliente - somma RDA collegate), timeline, RDA collegate.

6. **Collegamento RDA**: quando l'utente crea una PR, seleziona la commessa dal dropdown. L'importo stimato della PR si sottrae dal margine commessa.

7. **Monitoraggio margine**: nella pagina dettaglio commessa, il sistema mostra in tempo reale: valore cliente, costo RDA collegate, margine residuo (in EUR e percentuale). Se il margine scende sotto soglia, evidenziazione visiva.

8. **Ciclo di vita**: PLANNING → ACTIVE → COMPLETED (o CANCELLED/ON_HOLD). Ogni transizione via `update_commessa_status`.

**Componenti UI**: `commessa-create-dialog.tsx`, `commessa-detail.tsx`, price-variance-banner (se variazioni prezzo)
**API**: POST `/api/commesse`, GET `/api/commesse/[code]`, PATCH `/api/commesse/[code]`
**Friction**:
- Il valore cliente e inserito manualmente: se l'ordine arriva via email, il valore e gia stato estratto dall'agente — ma se si crea manualmente bisogna ricopiarlo
- Il margine si basa solo sugli importi stimati delle RDA: se il costo effettivo diverge, il margine mostrato non e accurato fino alla fatturazione

---

### 2.9 Flusso I — Conversazione con il Chatbot

**Persona**: qualsiasi utente autenticato
**Trigger**: click sull'icona chat nell'header (MessageSquare, visibile solo se modulo chatbot abilitato)

**Step**:

1. **Utente clicca l'icona chat**: si apre un pannello laterale destro (400px su desktop, full-width su mobile) con `chat-panel.tsx`.

2. **Stato iniziale**: icona bot + suggerimenti rapidi cliccabili: "Quante PR sono in attesa?", "Budget IT disponibile?", "Fatture non matchate", "Ultimi ordini".

3. **Utente scrive o clicca un suggerimento**: il messaggio viene inviato via POST `/api/chat`. Il server avvia `streamAssistantResponse()`.

4. **Streaming risposta**: l'agente (Sonnet 4.6) risponde in streaming. Se chiama tool READ (es. search_requests), il risultato viene integrato nella risposta. L'utente vede il testo apparire progressivamente.

5. **Se l'agente chiama un tool WRITE**: il loop si interrompe. L'utente vede un dialog di conferma (`action-confirmation.tsx`) con: icona warning gialla, etichetta azione, tabella campi chiave/valore (es. "Titolo: Cavi rame", "Fornitore: TTI", "Importo: 1.500 EUR"). Due bottoni: Annulla / Conferma.

6. **Utente conferma**: POST `/api/chat/confirm` con actionId. Il server recupera la pending action dal memory store, esegue il tool WRITE, restituisce il risultato.

7. **Utente annulla**: l'azione scade dopo 5 minuti. Nessun feedback esplicito sulla scadenza.

**Componenti UI**: `chat-panel.tsx`, `chat-message-bubble.tsx`, `action-confirmation.tsx`
**API**: POST `/api/chat`, POST `/api/chat/confirm`
**Tool agente**: tutti i 38 tool del Procurement Assistant, filtrati per ruolo
**Friction**:
- Il pannello chat copre contenuto della pagina su schermi stretti: l'utente non puo consultare una tabella e chattare contemporaneamente
- Rate limit: 10 messaggi/minuto. Un utente che fa domande rapide puo raggiungere il limite
- Se l'utente chiude il pannello durante il processing, la risposta e persa
- Il dialog di conferma non mostra il contesto completo: es. "create_request" mostra i parametri ma non il prezzo totale calcolato
- La pending action scade dopo 5 minuti senza avviso: se l'utente va a fare altro e torna, il bottone Conferma fallisce silenziosamente

---

### 2.10 Flusso J — Analizza una Gara d'Appalto

**Persona**: MANAGER o ADMIN
**Trigger**: pubblicazione di una nuova gara su piattaforma appalti

**Step**:

1. **Utente naviga a `/tenders`**: lista gare con filtri per stato, tipo, scadenza.

2. **Utente clicca "Nuova Gara"**: apre `tender-form-dialog.tsx` — form scrollabile con 5 sezioni: informazioni base, ente e identificativi, scadenze, importi e criteri, assegnazione.

3. **Utente compila e salva**: POST `/api/tenders`. Codice generato: GARA-2026-NNNNN.

4. **Utente allega il PDF della gara**: upload nella pagina dettaglio.

5. **Utente clicca "Analisi AI"**: POST `/api/agents/tender-analysis` con ID gara + PDF opzionale. L'agente Opus 4.6 (con extended thinking) analizza la gara e produce: fit_score (0-100), recommendation (GO/NO_GO/CONDITIONAL_GO), reasoning, pro, contro, rischi con severity e mitigazione, requisiti chiave, capacita mancanti.

6. **Risultato mostrato**: nella pagina dettaglio gara, sezione analisi AI con: score numerico, raccomandazione colorata (verde GO, rosso NO_GO, ambra CONDITIONAL), reasoning dettagliato, lista pro/contro/rischi.

7. **Valutazione Go/No-Go manuale**: utente clicca "Valuta Go/No-Go" → apre `go-no-go-dialog.tsx` con 6 slider (Margine, Aspetti Tecnici, Esperienza, Rischio, Carico di Lavoro, Valore Strategico). Score totale calcolato. Raccomandazione automatica: <= 40 NO GO, 40-60 VALUTARE, > 60 GO. L'utente puo aggiungere note e decidere "Partecipare (Go)" o "Non Partecipare (No-Go)".

**Componenti UI**: `tender-form-dialog.tsx`, `go-no-go-dialog.tsx`, tender detail page, analisi AI section
**API**: POST `/api/tenders`, POST `/api/agents/tender-analysis`, POST `/api/tenders/[id]/go-no-go`, PATCH `/api/tenders/[id]/status`
**Friction**:
- L'analisi AI costa ~$0.35 per gara (Opus) e puo richiedere 15-30 secondi
- Il PDF deve essere uploadato separatamente dalla creazione gara — non in un unico step
- I 6 slider del Go/No-Go non hanno descrizione: l'utente non sa cosa significa "score 7/10 per Rischio"

---

## 3. Schermate Inventory

| Path | Titolo | Contenuto | Componente | Azioni |
|------|--------|-----------|------------|--------|
| `/` | Dashboard | KPI cards, grafici trend, tab per modulo | `DashboardTabs` | 0 (solo consultazione) |
| `/requests` | Richieste | Lista PR con filtri stato/priorita/ricerca | `RequestsPageContent` | Crea nuova, filtri |
| `/requests/new` | Nuova Richiesta | Form creazione PR multi-sezione | `RequestForm` | Salva (1 API call) |
| `/requests/[id]` | Dettaglio Richiesta | Stato, items, timeline, commenti, allegati, approvazioni | `RequestDetailContent` | Modifica, approva, cambia stato, commenta, allega |
| `/approvals` | Approvazioni | Lista con tab filtro (In attesa / Approvate / Rifiutate) | `ApprovalCard` + `ApprovalActions` | Approva/Rifiuta per card |
| `/vendors` | Fornitori | Lista con ricerca, filtro stato | `VendorsPageContent` | Crea nuovo, modifica |
| `/vendors/[id]` | Dettaglio Fornitore | Anagrafica, storico ordini, rating | `VendorDetailContent` | Modifica, cambia stato |
| `/invoices` | Fatture | Lista con filtri match/riconciliazione/fornitore/data | `InvoicesPageContent` | Carica, filtra |
| `/invoices/[id]` | Dettaglio Fattura | Dati fattura, stato match, discrepanze, righe | `InvoiceDetailContent` | Associa PR, riconcilia, contesta |
| `/articles` | Articoli | Catalogo articoli con ricerca | `ArticlesPageContent` | Crea, importa |
| `/articles/[id]` | Dettaglio Articolo | Prezzi, alias SKU, stock per magazzino | `ArticleDetailView` | Modifica, aggiungi prezzo/alias |
| `/budgets` | Budget | Lista centri di costo con snapshot | `BudgetsPageContent` | Crea (solo ADMIN) |
| `/budgets/[id]` | Dettaglio Budget | Allocato, speso, impegnato, disponibile, forecast | `BudgetDetailContent` | Modifica |
| `/tenders` | Gare | Lista gare con filtri stato/tipo | `TendersPageContent` | Crea, filtra |
| `/tenders/[id]` | Dettaglio Gara | Dati gara, analisi AI, Go/No-Go, documenti | `TenderDetailContent` | Modifica, analisi AI, Go/No-Go, cambia stato |
| `/inventory` | Magazzino — Materiali | Lista materiali con livelli stock | `MaterialsPageContent` | Crea, filtra |
| `/inventory/[id]` | Dettaglio Materiale | Stock, lotti, movimenti, forecast, alert | `MaterialDetailContent` | Modifica, aggiungi movimento |
| `/inventory/warehouses` | Magazzini | Lista magazzini con zone | `WarehousesPageContent` | Crea |
| `/inventory/movements` | Movimenti | Storico movimenti con filtri | `MovementsPageContent` | Nuovo movimento |
| `/inventory/inventories` | Inventari | Conteggi inventariali | `InventoriesPageContent` | Nuovo inventario |
| `/inventory/inventories/[id]` | Dettaglio Inventario | Righe conteggio, discrepanze | `InventoryDetailContent` | Modifica conteggi |
| `/commesse` | Commesse | Lista commesse con stato/cliente | `CommessePageContent` | Crea |
| `/commesse/[code]` | Dettaglio Commessa | Stato, margine, RDA collegate, timeline | `CommessaDetail` | Modifica stato |
| `/clients` | Clienti | Lista clienti con ricerca | `ClientsPageContent` | Crea, modifica |
| `/users` | Utenti | Lista utenti (solo ADMIN) | `UsersPageContent` | Crea, modifica ruolo |
| `/analytics` | Analytics ROI | Metriche risparmio, trend, confronti | `RoiDashboard` | 0 (solo consultazione) |
| `/settings` | Impostazioni | Preferenze utente, reset onboarding | Custom | Reset onboarding (ADMIN) |
| `/settings/security` | Sicurezza | Setup/disabilita MFA | MFA dialogs | Configura TOTP |
| `/admin/config` | Admin Config | Moduli, categorie, dipartimenti, centri di costo, integrazioni | `AdminPanel` | Configura tutto |
| `/login` | Login | Form email + password | `LoginForm` | Login |

**Totale**: 30 pagine, di cui 21 nel dashboard.

---

## 4. Notifiche e Feedback

### 4.1 Canali di notifica

| Canale | Implementato | Dettaglio |
|--------|-------------|-----------|
| Notifiche in-app | Si | Bell icon nell'header con badge contatore, dropdown con lista, navigazione al link |
| Toast (Sonner) | Si | Bottom-right, success/error/loading, durata ~4 secondi |
| Email transazionali | No | Nessuna integrazione SMTP/Resend/Nodemailer trovata |
| Push notifications | No | |
| Slack/Teams | No | |

### 4.2 Tipi di notifica in-app

| Tipo | Quando generata | Destinatario |
|------|----------------|-------------|
| `approval_required` | PR inviata per approvazione | Approvatore |
| `approval_decided` | Approvazione/rifiuto | Richiedente |
| `new_comment` | Commento aggiunto a PR | Richiedente |
| `status_changed` | Cambio stato PR | Richiedente |
| `request_approved` / `request_rejected` | Decisione approvazione | Richiedente |
| `delivery_overdue` | Consegna in ritardo | Richiedente |
| `shipment_update` | Aggiornamento spedizione | Richiedente |
| `delivery_confirmed` | Consegna confermata | Richiedente |
| `invoice_received` / `invoice_matched` | Fattura processata | Utente assegnato |
| `invoice_discrepancy` | Discrepanza fattura | Utente assegnato |
| `budget_warning` / `budget_exceeded` | Soglia budget | Admin |
| `commessa_created` | Nuova commessa | Admin |
| `weekly_report` | Report settimanale | Admin |

### 4.3 Feedback errori

- **Errori form**: testo rosso sotto il campo (Zod validation), es. "Il titolo e obbligatorio"
- **Errori API**: toast rosso con messaggio generico ("Si e verificato un errore") o specifico ("Codice fornitore gia esistente")
- **Errori pagina**: pagina error.tsx con icona AlertTriangle, messaggio "Si e verificato un errore", bottone "Riprova"
- **Rate limit**: toast "Troppe richieste. Attendi un momento." (429)

---

## 5. Dati di Contesto e Navigation

### 5.1 Header (h-16, sticky, backdrop blur)

Da sinistra a destra:
- **Mobile**: hamburger menu (md:hidden) → apre MobileDrawer
- **Breadcrumb**: Home > Richieste > PR-2026-00001 (dinamico, segmenti cliccabili, tradotti in italiano)
- **Spacer**
- **Search**: input "Cerca..." con hint Cmd+K → apre command palette (cmdk)
- **Chat AI**: icona MessageSquare (visibile solo se modulo chatbot abilitato)
- **Notifiche**: icona Bell con badge rosso (contatore non letti, max "99+")
- **Tema**: toggle dark/light
- **Avatar utente**: cerchio con iniziali, dropdown con nome, email, logout

### 5.2 Sidebar (260px, collapsibile a 64px)

- **Logo**: icona Boxes + "ProcureFlow" (nascosto quando collapsed)
- **15 voci di navigazione**: raggruppate visivamente, icona + label + badge opzionale
- **Filtro moduli**: voci nascoste se il modulo e disabilitato (es. niente Magazzino se modulo inventory off)
- **Filtro ruolo**: voce "Admin" visibile solo per ADMIN
- **Badge**: "requests" (PR in attesa), "approvals" (approvazioni pending), "invoices", "articles"
- **Footer**: "ProcureFlow v0.1"
- **Stato**: collapsed/expanded salvato nel context (`SidebarProvider`)

### 5.3 Command Palette (Cmd+K)

- **Azioni rapide**: "Nuova Richiesta" → `/requests/new`
- **Navigazione**: tutte le voci sidebar filtrate per moduli abilitati
- **Keyboard**: frecce per navigare, Enter per selezionare, Esc per chiudere

---

## 6. Mobile Readiness

### 6.1 Architettura responsive

- **Mobile-first**: si, le classi Tailwind usano breakpoint ascendenti (`sm:`, `md:`, `lg:`)
- **Sidebar**: nascosta su mobile (`hidden md:flex`), sostituita da MobileDrawer (slide-in da sinistra, 280px, z-50)
- **Header**: hamburger menu su mobile, breadcrumb abbreviato
- **Griglie**: `grid gap-4` → `sm:grid-cols-2` → `lg:grid-cols-3` (adaptive)
- **Tabelle**: colonne secondarie nascoste su mobile (`hidden md:table-cell`)
- **Dialog/modal**: full-width su mobile, max-width su desktop

### 6.2 Flusso approvazione da mobile

L'utente MANAGER puo approvare da telefono:
1. Apre il drawer hamburger → naviga a "Approvazioni"
2. Vede le card in lista verticale (1 colonna)
3. Clicca Approva/Rifiuta → form note inline
4. Conferma

Non esiste una vista approvazione mobile-specifica (es. swipe per approvare, notifica push con azione diretta). Il flusso funziona ma richiede navigazione completa.

### 6.3 Limiti mobile

- I form complessi (creazione PR con 15+ campi, form gara con 5 sezioni) sono lunghi da compilare su mobile
- Il pannello chat occupa l'intero schermo su mobile, impedendo di consultare dati
- I dialog di upload (fattura, email) non sono ottimizzati per fotocamera mobile
- Nessuna PWA / app installabile

---

## 7. Accessibilita Quick Check

| Criterio | Stato | Dettaglio |
|----------|-------|-----------|
| Label collegate ai form | ✅ | `htmlFor` usato nei form (title, email, vendor_id, ecc.) |
| aria-label sui bottoni | ✅ | Presente su: theme toggle, breadcrumb nav, filtri approvazioni, close dialog, download allegati, rimuovi articolo |
| Contrasto tema dark | ⚠️ | Testo primario #FAFAFA su bg #0A0A0B: rapporto ~18:1 (ottimo). Testo secondario #A1A1AA su bg #141416: rapporto ~6:1 (accettabile). Testo muted #52525B su bg #1C1C1F: rapporto ~2.5:1 (sotto soglia WCAG AA 4.5:1) |
| Keyboard navigation | ⚠️ | Command palette supporta frecce/Enter/Esc. Dialog chiudibili con Esc. Nessun focus trap esplicito verificato nei modal. Tab order non testato sui form complessi |
| Screen reader | ⚠️ | Semantic HTML (nav, main, header). Role attributes minimi. Nessun `aria-live` per notifiche real-time o aggiornamenti chat |
| Skip links | ❌ | Non presenti |
| Focus visible | ⚠️ | Tailwind default `focus:ring` presente ma non verificato su tutti gli elementi interattivi |

---

## 8. Performance Percepita

| Flusso | Latenza attesa | Pattern usato | Note |
|--------|---------------|---------------|------|
| Caricamento lista PR (100 record) | ~200-500ms | React Query + skeleton | Paginazione server-side, 20 record per pagina |
| Caricamento lista PR (1000 record) | ~200-500ms | Stessa paginazione | Solo 20 per pagina, non carica 1000 |
| Apertura form crea PR | ~100ms | Client-side render | Dropdown fornitori/commesse: fetch parallelo |
| SmartFill suggerimenti | 2-4s | Debounce 300ms + API Anthropic | Percepito come "lento" dopo aver digitato |
| Salvataggio PR | ~200-400ms | Mutation + invalidazione cache | Redirect immediato alla pagina dettaglio |
| Approvazione singola | ~200-400ms | Mutation + invalidazione 2 query | Badge aggiornato dopo invalidazione |
| Upload fattura XML | ~500ms-2s | Server-side parsing | Deterministico, veloce |
| Upload fattura PDF (AI) | 3-8s | Server-side + Claude Vision | Percepito come lento, nessun progress granulare |
| Import email (agente) | 10-30s | Server-side + 6-10 round Anthropic | Toast "Elaborazione in corso...", nessuna progress bar |
| Analisi gara (Opus) | 15-40s | Server-side + Opus single call | Spinner generico |
| Risposta chatbot (lettura) | 1-3s | Streaming SSE | Testo appare progressivamente |
| Risposta chatbot (con tool) | 3-10s | Streaming + tool execution | Tool start/end eventi visibili |
| Onboarding fornitori (CSV) | 5-15s | Server-side + Sonnet | Dipende dalla dimensione file |

### Pattern di caching e loading

- **React Query**: tutte le liste usano `useQuery` con chiavi strutturate (`['requests', filters]`, `['vendors']`). `staleTime` e `cacheTime` ai valori default di TanStack Query.
- **Skeleton**: ogni pagina ha un `loading.tsx` con skeleton shimmer (barre grigie animate).
- **Invalidazione**: dopo ogni mutation, `queryClient.invalidateQueries()` sulle chiavi correlate.
- **Nessun Suspense**: loading state gestito tradizionalmente con `isLoading` check.
- **Nessun caching lato server**: `force-dynamic` sulla dashboard. Nessun `revalidate` o ISR.

---

## 9. Friction Map (sintesi)

I 10 friction point piu rilevanti, ordinati per impatto sull'esperienza quotidiana dell'utente:

1. **Email import manuale**: l'utente deve copiare/incollare l'email e allegare PDF manualmente. Nessuna integrazione IMAP automatica. Impatto: ogni email richiede 1-2 minuti di lavoro manuale.

2. **Attesa agenti AI senza feedback granulare**: l'import email (10-30s) e l'analisi gara (15-40s) mostrano solo uno spinner generico. L'utente non sa se il sistema sta classificando, cercando, o creando entita.

3. **Risultato agente come JSON grezzo**: dopo l'import email, il risultato e un blob JSON con `actions_taken[]`. L'utente deve interpretare stringhe come "create_request: completato" per capire cosa e successo.

4. **Nessuna email transazionale**: le notifiche esistono solo in-app. Il manager che non ha ProcureFlow aperto non sa che c'e un'approvazione in attesa.

5. **Approvazione senza contesto**: la card approvazione mostra titolo e importo, ma non fornitore, budget residuo, o storico acquisti simili. Il manager deve navigare al dettaglio per decidere.

6. **Form creazione PR lungo senza salvataggio bozza**: 15+ campi su piu sezioni. Se il browser crasha o l'utente viene interrotto, tutto e perso. Nessun auto-save.

7. **Matching fattura manuale quando auto-match fallisce**: la ricerca PR nel dialog di match e per codice/titolo. Se la fattura non cita il codice PR, l'utente deve cercare per importo o fornitore manualmente.

8. **Nessuna correzione post-agente**: se l'agente AI classifica male un'email o crea entita sbagliate, l'utente deve trovare e correggere/cancellare manualmente ogni entita creata.

9. **Pending action chat che scade silenziosamente**: il dialog di conferma del chatbot scade dopo 5 minuti senza avviso. L'utente che si distrae trova un bottone "Conferma" che fallisce.

10. **Mobile non ottimizzato per azioni rapide**: approvare da telefono richiede: apri drawer → naviga → scorri → clicca → scrivi nota → conferma. Nessun shortcut mobile (swipe, notifica push con azione).
