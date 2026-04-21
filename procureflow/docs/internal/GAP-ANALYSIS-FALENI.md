# ProcureFlow — Gap Analysis Faleni vs Codebase Attuale

**Data**: 17 aprile 2026
**Commit analizzato**: `689013a` (branch `main`)
**Codebase**: ~497 file TS/TSX, 43 modelli Prisma, 1.352 righe di schema, 57 tool AI, 7 agenti, 28+ servizi

---

## 0. Executive Summary

ProcureFlow è un hub di procurement per PMI italiane con uno stack maturo (Next.js 14, Prisma, PostgreSQL, 7 agenti AI Anthropic). Il codebase copre già il ciclo richiesta d'acquisto completo (DRAFT → CLOSED con 13 stati), fatturazione elettronica SDI, magazzino con lotti e movimenti, gare d'appalto con Go/No-Go, commesse cliente, e un sistema di email intelligence che classifica ed esegue azioni su email commerciali.

**Rispetto ai 18 takeaway Faleni**:

- **Già coperti (parzialmente o totalmente)**: 8 su 18 — il sistema ha fondamenta solide per hub centralizzato, gestione codici multi-livello, tracking base, email intelligence, magazzino e CSV export/import
- **Gap parziali**: 6 su 18 — esistono basi ma mancano componenti significativi (flusso unico RDO→Delivery, audit trail immutabile, morning dashboard, analytics per competenza, tracciabilità lotti end-to-end, magazzini logici)
- **Gap totali**: 4 su 18 — non esiste nulla nel codebase (workflow Non Conformità, firma elettronica, automazione scarico produzione con FIFO, barcode/NFC)
- **Connettori piattaforme**: 0 su 5 implementati — nessun connettore verso SAP Ariba, SupplyOn, Ivalua, Fincantieri o MBDA

**Effort totale stimato per Defense Pack completo**: 180-280 giornate-persona (9-14 mesi per 1 persona, 5-7 mesi per 2, 3-5 mesi per 3).

**3 raccomandazioni immediate**:
1. Partire dal flusso unificato RDO→Delivery (T1) perché è il prerequisito architetturale per tutto il resto
2. Investire nei connettori piattaforme (SAP Ariba e SupplyOn) come secondo blocco — è il dolore primario di Faleni
3. Rimandare firma digitale e NC workflow alla milestone 3 — richiedono ricerca significativa prima dell'implementazione

---

## 1. Stato Attuale del Codebase (baseline)

ProcureFlow è un'applicazione Next.js 14 (App Router) con TypeScript strict, Prisma ORM su PostgreSQL, e un'architettura a moduli. L'applicazione è single-tenant per design (un deploy Docker per cliente).

**Modulo Core (Richieste d'Acquisto)**: ciclo di vita completo con 13 stati (DRAFT, SUBMITTED, PENDING_APPROVAL, APPROVED, REJECTED, ORDERED, SHIPPED, DELIVERED, INVOICED, RECONCILED, CLOSED, CANCELLED, ON_HOLD), state machine validata, sistema di approvazione con soglie per importo/ruolo, commenti, allegati, timeline. 8 route API, 38 tool AI per il chat assistant.

**Fatturazione Elettronica**: parsing XML FatturaPA, three-way matching (ordine vs ricevuta vs fattura), riconciliazione con soglie configurabili. Webhook SDI funzionante. 7 route API, agente AI dedicato (invoice-reconciliation).

**Magazzino**: schema completo con Material, Warehouse, WarehouseZone, StockLot, StockMovement, StockReservation, StockInventory. Movimenti tipizzati (INBOUND, OUTBOUND, TRANSFER, ADJUSTMENT, RETURN) con motivi categorizzati. Alert automatici (LOW_STOCK, OUT_OF_STOCK, REORDER_SUGGESTED). Forecast WMA su 6 mesi. Agente smart-reorder che crea RDA automaticamente. 12 route API.

**Articoli**: catalogo con codice univoco (ART-YYYY-NNNNN), sistema di alias multi-tipo (VENDOR, CLIENT, STANDARD) con deduplicazione fuzzy su codice normalizzato. Prezzi per fornitore con storico, quantità minima, validità temporale. Import CSV supportato.

**Gare d'Appalto**: 12 stati, 7 tipi (OPEN, RESTRICTED, NEGOTIATED, DIRECT_AWARD, MEPA, FRAMEWORK, PRIVATE), decisione Go/No-Go con scoring a 6 criteri, documenti tipizzati (11 categorie: BANDO, CAPITOLATO, OFFERTA_TECNICA, etc.), analisi AI con Opus. 5 route API.

**Commesse**: ciclo DRAFT → PLANNING → ACTIVE → COMPLETED, collegamento a client e purchase requests, calcolo margine (valore commessa - somma costi RDA), timeline dedicata. 5 route API.

**Email Intelligence**: agente autonomo che classifica email (7 intent) e esegue azioni corrispondenti — crea commesse, RDA, aggiorna stati, notifica. WriteCounter con limite 10 operazioni/email. Classificatore AI separato con confidence scoring. EmailLog per audit.

**Integrazioni**: configurazione per IMAP, SDI e Vendor API con cifratura AES-256-GCM. UI admin per gestione. Solo SDI effettivamente operativo. Workflow n8n per email ingestion (Gmail → OpenAI → webhook ProcureFlow). Export CSV per 6 entità.

---

## 2. Analisi Takeaway-per-Takeaway

### 2.1 — Flusso unico RDO→Delivery (Takeaway 1)

#### Cosa chiede Faleni
Un operatore riceve una RDO (Richiesta di Offerta) da un committente come Leonardo tramite SAP Ariba. Deve preparare un'offerta, inviarla, attendere l'aggiudicazione, ricevere l'ordine, gestire la produzione, spedire e chiudere. Tutto in un flusso continuo senza separazione artificiale tra "fase offerta" e "fase ordine".

#### Cosa esiste oggi nel codebase
Il codebase ha **due cicli separati che non si parlano**:

1. **Tender** (gara d'appalto): DISCOVERED → EVALUATING → GO/NO_GO → PREPARING → SUBMITTED → UNDER_EVALUATION → WON/LOST. Ha documenti (OFFERTA_TECNICA, OFFERTA_ECONOMICA) ma sono semplici allegati senza dati strutturati. Non esiste un modello "Offerta" con righe, prezzi, quantità.

2. **PurchaseRequest** (ordine): DRAFT → APPROVED → ORDERED → DELIVERED → CLOSED. È un ciclo d'acquisto verso fornitori, non di risposta a committenti.

3. **Commessa**: lega un ordine cliente a delle RDA ma non ha fase di offerta.

Il flusso Faleni è l'inverso: Faleni è il **fornitore** che risponde a un committente, non il compratore. Il modello mentale di ProcureFlow oggi è "PMI che compra", non "PMI che vende e compra".

#### Gap rispetto a quanto richiesto

- **Modello `Offer` (Offerta)** mancante: entità con righe (codice articolo, quantità, prezzo offerto, revisione), collegata a Tender e poi a Commessa quando aggiudicata. Schema indicativo:
  ```
  Offer: id, tender_id, code, status (DRAFT/SUBMITTED/AWARDED/LOST), 
         items: OfferItem[], total_amount, submitted_at, valid_until
  OfferItem: article_id, quantity, unit_price, notes, delivery_days
  ```
- **Transizione Tender→Commessa→RDA**: oggi non esiste una catena automatica. Quando un Tender passa a WON, dovrebbe creare una Commessa e generare RDA per i materiali necessari.
- **Stato "produzione"** sulla Commessa: la commessa ha ACTIVE ma non distingue tra "acquisto materiali in corso" e "produzione in corso" e "pronto per spedizione".
- **Collegamento bidirezionale Offer↔Commessa↔PR**: la navigazione RDO → offerta presentata → ordine ricevuto → materiali acquistati → consegnato non è possibile oggi.

#### Complessità di implementazione
**ALTA**. Richiede un nuovo modello dati (Offer + OfferItem), estensione degli stati Commessa, nuova UI per preparazione offerte, e rewiring dell'intera catena. Stima: **15-25 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK**. Il flusso RDO→Delivery è specifico per fornitori Tier 2/3 che rispondono a committenti. Una PMI generica che compra non ha questo bisogno.

#### Prerequisiti e dipendenze
Nessun prerequisito tecnico — è un modulo nuovo. Richiede decisione su come rappresentare la "fase offerta" (estensione del Tender esistente o entità separata).

#### Rischi tecnici o aperti
La complessità vera è la varietà: ogni committente ha un formato RDO diverso. Il modello deve essere abbastanza flessibile da accogliere RDO SAP Ariba (strutturate) e RDO via email (destrutturate). Decidere se un'offerta è un documento monolitico o un insieme di righe prezzo per articolo.

---

### 2.2 — Hub centralizzato multi-committente (Takeaway 2)

#### Cosa chiede Faleni
Una dashboard unica che mostra lo stato aggregato di tutte le piattaforme committente: ordini da confermare su SupplyOn, gare in scadenza su Ariba, modifiche ricevute su Ivalua, NC aperte su Fincantieri, spedizioni in corso, fatture bloccate. L'operatore deve controllare un solo posto invece di 5 portali.

#### Cosa esiste oggi nel codebase
La dashboard principale (`src/app/(dashboard)/page.tsx`) mostra KPI aggregati: richieste per stato, approvazioni pending, fatture da riconciliare, alert magazzino, budget overview, delivery timeline. Il componente `stats-row.tsx` mostra 6 card con contatori. Ma i dati sono **tutti interni** — nessun dato proviene da piattaforme esterne.

Il servizio `dashboard.service.ts` aggrega da tabelle Prisma locali: conta PR per stato, somma importi pending, calcola scadenze. Nessuna chiamata a sistemi esterni.

#### Gap rispetto a quanto richiesto

- **Nessun dato esterno nella dashboard**: serve un layer "external sync" che polling/webhook i dati da Ariba, SupplyOn, etc. e li salva in tabelle locali shadow
- **Schema `ExternalOrder`** o equivalente: una tabella che traccia l'ordine/RDO così come esiste nella piattaforma committente, con timestamp dell'ultimo sync e link alla piattaforma
- **Widget dashboard per-committente**: sezione dedicata per ogni piattaforma con contatori specifici (ordini da confermare, gare in scadenza, modifiche)
- **Diff detector**: meccanismo che confronta lo stato esterno con lo stato interno e evidenzia le discrepanze

#### Complessità di implementazione
**MOLTO ALTA**. La dashboard in sé è la parte facile (5-8 giornate UI). Il collo di bottiglia è l'acquisizione dei dati dalle piattaforme esterne, trattata nella Sezione 3 (connettori). La dashboard è un visualizzatore — senza connettori, non c'è nulla da visualizzare.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK**. La morning dashboard multi-committente è specifica per fornitori che gestiscono molte piattaforme. Il core ProcureFlow ha già una dashboard interna sufficiente per PMI generiche.

#### Prerequisiti e dipendenze
Dipende interamente dai connettori piattaforme (Sezione 3). Senza almeno 1 connettore funzionante, questa è solo una dashboard vuota.

#### Rischi tecnici o aperti
L'aggiornamento dei dati potrebbe essere in ritardo rispetto alle piattaforme reali (es. sync ogni 15 min), creando una falsa sensazione di sicurezza. Serve un indicatore "ultimo sync: X minuti fa" per ogni piattaforma.

---

### 2.3 — Sistema notifiche obbligatorio (Takeaway 3)

#### Cosa chiede Faleni
Ogni modifica nel sistema (cambio data, nuovo documento, variazione prezzo, stato che cambia) deve generare una notifica automatica in-app e via email. La notifica deve indicare **cosa è cambiato** (diff), non solo "è cambiato qualcosa". Citazione Faleni: *"Devi renderlo rigido."*

#### Cosa esiste oggi nel codebase
Il sistema ha un modello `Notification` (id, user_id, title, body, type, link, read, created_at) con 15 tipi predefiniti nel servizio (`notification.service.ts`). Le notifiche vengono create in-app da vari eventi: approvazioni, email processate, delivery, etc. C'è anche `TimelineEvent` che traccia cambiamenti sulle PR.

L'agente email crea notifiche automaticamente dopo ogni azione. Il servizio approvazione crea notifiche al requester quando una PR viene approvata/rifiutata.

#### Gap rispetto a quanto richiesto

- **Nessun canale email**: le notifiche sono solo in-app. Il modello non ha un campo `email_sent` e non c'è un servizio di invio email. Manca un transport layer (SMTP/SendGrid/SES).
- **Nessun diff strutturato**: le notifiche hanno `title` e `body` come testo libero. Non esiste un campo `old_value` / `new_value` o un payload strutturato che mostri cosa è cambiato prima vs dopo.
- **Nessun middleware di intercettazione**: le notifiche sono create manualmente in ogni servizio/route. Non c'è un Prisma middleware o un event bus che intercetti automaticamente ogni modifica e generi notifica. Se uno sviluppatore dimentica di aggiungere `createNotification()` in una nuova route, la modifica passa silenziosamente.
- **Nessuna preferenza utente**: non esiste un modello di preferenze notifica (quale tipo voglio via email, quale in-app, quale disabilitato).

#### Complessità di implementazione
**MEDIA**. Il modello notifica esiste già. Serve: (1) aggiungere trasporto email — 3-5 giornate includendo template HTML, (2) aggiungere diff payload — 2-3 giornate, (3) Prisma middleware per intercettazione automatica — 3-5 giornate, (4) preferenze utente — 2-3 giornate. Totale: **10-16 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**CORE**. Il sistema di notifiche robusto serve a qualsiasi PMI, non solo difesa.

#### Prerequisiti e dipendenze
Richiede una decisione sul provider SMTP (Resend, SendGrid, Amazon SES, o SMTP diretto). Le variabili `SMTP_*` esistono già in `.env.example` ma non sono usate da nessun servizio.

#### Rischi tecnici o aperti
Il volume di notifiche email potrebbe essere alto in un contesto con 1.600 righe ordine. Serve un meccanismo di digest (raggruppa le notifiche degli ultimi 15 min in un'unica email) per evitare di inondare le caselle.

---

### 2.4 — Integrazione ERP bidirezionale (Takeaway 4)

#### Cosa chiede Faleni
Il gestionale interno di Faleni non dialoga con le piattaforme esterne. Serve almeno un import/export via CSV/XLSX per sincronizzare anagrafica articoli, ordini, giacenze.

#### Cosa esiste oggi nel codebase
Il servizio `export.service.ts` genera CSV per 6 entità (vendors, materials, requests, invoices, users, budgets) con sanitizzazione anti-injection. L'import esiste per vendors (`/api/admin/import/vendors`) e materials (`/api/admin/import/materials`) via file upload, con parsing AI-assisted per vendor CSV. Il servizio `article-import.service.ts` gestisce import articoli da CSV con supporto alias.

L'onboarding agent può parsare CSV di fornitori usando l'AI per mappare colonne non standard.

#### Gap rispetto a quanto richiesto

- **Nessun export XLSX**: solo CSV. Per PMI italiane che usano Excel, il formato nativo .xlsx è importante. Manca una libreria come `exceljs` o `xlsx`.
- **Nessun import ordini**: si possono importare anagrafiche (vendor, material, article) ma non ordini in corso. Manca un flusso "importa 1.600 righe ordine aperte da SupplyOn in formato CSV".
- **Nessuna schedulazione export/import**: l'export è manuale (bottone UI). Non c'è un export automatico periodico verso una cartella condivisa o un FTP.
- **Nessuna API per ERP**: non esiste un endpoint `/api/erp/sync` che un gestionale esterno possa chiamare per push/pull dati. L'architettura attuale è web-UI + webhook, non API-first per integrazione machine-to-machine.

#### Complessità di implementazione
**MEDIA**. Export XLSX: 3-5 giornate (integrare `exceljs`). Import ordini bulk: 5-8 giornate (parsing, validazione, creazione PR/commesse, deduplicazione). API ERP: 5-10 giornate (progettare schema API, autenticazione API key, rate limiting, documentazione). Totale: **13-23 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**CORE** per CSV/XLSX base. **DEFENSE PACK** per API ERP dedicata con mapping specifici per gestionali difesa.

#### Prerequisiti e dipendenze
Richiede sapere quale gestionale usa Faleni internamente (SAP, TeamSystem, gestionale custom?) per definire il formato di scambio.

#### Rischi tecnici o aperti
L'import bulk di 1.600 righe ordine richiede: deduplicazione robusta (non creare duplicati), mapping codici articolo (codice interno vs codice Leonardo), e gestione errori parziali (se la riga 847 fallisce, le 846 precedenti devono restare valide).

---

### 2.5 — Gestione codici multi-livello (Takeaway 5)

#### Cosa chiede Faleni
Ogni articolo ha: un codice interno Faleni, un codice diverso per ogni committente (Leonardo usa il suo, Fincantieri il suo), una revisione disegno, una revisione lista parti. Serve una mappatura unificata: dato un codice committente, trovare il codice interno e viceversa.

#### Cosa esiste oggi nel codebase
Il modello `ArticleAlias` supporta già 3 tipi di alias (VENDOR, CLIENT, STANDARD) con constraint di unicità `(alias_type, alias_code, entity_id)`. Ogni alias è collegato a un'entità (Vendor o Client) e a un Article. Il tool `find_or_create_article` cerca per alias normalizzato (stripping hyphens, spazi, slashes) e per manufacturer_code.

Il modello `ArticlePrice` traccia prezzi per vendor con validità temporale e quantità minima.

#### Gap rispetto a quanto richiesto

- **Nessun campo revisione**: l'Article non ha `drawing_revision` (revisione disegno) né `bom_revision` (revisione lista parti). Sono informazioni critiche nel MIL-SPEC: un connettore MS3106A-18-1S rev. 3 non è intercambiabile con rev. 2.
- **Nessun storico revisioni**: quando cambia la revisione, non c'è traccia del cambio. Serve un modello `ArticleRevision` o almeno un log dei cambiamenti.
- **Nessuna distinzione committente**: l'alias CLIENT esiste ma non c'è una UI dedicata per gestire "i codici di Leonardo per questo articolo" vs "i codici di Fincantieri". L'UI attuale mostra alias flat senza raggruppamento per committente.
- **Nessuna navigazione inversa da alias**: dato il codice Leonardo "14-ABC-123", posso trovare l'articolo internamente (il tool AI lo fa), ma non c'è una pagina UI dedicata tipo "Mappatura Codici per Committente".

#### Complessità di implementazione
**MEDIA**. Aggiungere campi revisione all'Article: 1-2 giornate. Creare ArticleRevision per storico: 2-3 giornate. UI mappatura codici per committente: 3-5 giornate. Totale: **6-10 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK** per revisioni disegno/BOM (specifiche MIL-SPEC). **CORE** per il multi-code base (già strutturato, serve solo UI migliore).

#### Prerequisiti e dipendenze
Nessuno — il modello alias esiste già. Le revisioni sono un'estensione del modello Article.

#### Rischi tecnici o aperti
Il mapping codici committente potrebbe essere complesso: un codice Leonardo potrebbe mappare a più articoli interni (se l'articolo è stato sostituito/evoluto). Servono regole di validità temporale sugli alias.

---

### 2.6 — Audit trail completo (Takeaway 6)

#### Cosa chiede Faleni
Tracciabilità di chi ha fatto cosa, quando, con vecchio e nuovo valore. Esteso a offerte, comunicazioni, documenti. Nel settore difesa è un requisito normativo (D.Lgs. 231/2001, NATO AQAP).

#### Cosa esiste oggi nel codebase
`TimelineEvent` traccia eventi sulle PR (status_change, comment, approval, email) con metadata JSON. `CommessaTimeline` fa lo stesso per le commesse. `TenderTimeline` per le gare. `EmailLog` registra email processate con actions_taken.

L'audit report (AUDIT-REPORT.md) ha identificato questo come finding PF-006 (HIGH): "Nessun audit log immutabile. TimelineEvent è legato alle PR e può essere cancellato (onDelete: Cascade)."

#### Gap rispetto a quanto richiesto

- **Nessun audit log immutabile e centralizzato**: i TimelineEvent sono per-entità, cancellabili con la PR, e non coprono tutte le entità (vendor, user, budget non hanno timeline).
- **Nessun old_value/new_value**: i TimelineEvent hanno un campo `metadata` JSON generico, ma non c'è un pattern consistente per salvare "campo X cambiato da Y a Z".
- **Nessuna protezione anti-cancellazione**: un ADMIN può cancellare una PR e tutti i TimelineEvent vanno con CASCADE. Per difesa serve un log che sopravvive alla cancellazione della risorsa.
- **Schema mancante**: serve un modello tipo:
  ```
  AuditLog: id, timestamp, actor_id, action (CREATE/UPDATE/DELETE), 
            entity_type, entity_id, field_name, old_value, new_value,
            ip_address, user_agent
  ```
  Con policy: nessuna DELETE permessa, nemmeno per ADMIN.

#### Complessità di implementazione
**ALTA**. Schema + servizio: 3-5 giornate. Prisma middleware per intercettazione automatica su tutte le entità: 5-8 giornate. UI per consultazione log: 3-5 giornate. Totale: **11-18 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**CORE**. Ogni PMI con più utenti beneficia di un audit trail. Per difesa è mandatorio.

#### Prerequisiti e dipendenze
Nessuno. È un modulo trasversale che può essere aggiunto senza modificare modelli esistenti.

#### Rischi tecnici o aperti
Il volume di log può crescere rapidamente (ogni modifica a ogni campo = un record). Serve una strategia di retention e archiviazione. Per difesa, i log devono essere conservati per periodi specifici (tipicamente 10 anni).

---

### 2.7 — Workflow NC (Non Conformità) con contraddittorio (Takeaway 7)

#### Cosa chiede Faleni
Un workflow strutturato: apertura NC → evidenza documentale → risposta fornitore → valutazione congiunta → chiusura concordata. Citazione Faleni: *"C'è bisogno di un contraddittorio."* Il fornitore deve poter rispondere e contestare, e la chiusura richiede accordo di entrambe le parti.

#### Cosa esiste oggi nel codebase
**Nessun componente del codebase attuale affronta questo punto.** L'unica parvenza di "non conformità" è il campo `discrepancy_type` su Invoice (AMOUNT_MISMATCH, QUANTITY_MISMATCH, PRICE_MISMATCH, ITEM_MISMATCH) che riguarda discrepanze fattura, non qualità prodotto.

Non esistono modelli, servizi, route API, o UI per gestire NC.

#### Gap rispetto a quanto richiesto

Serve un modulo completamente nuovo:

- **Modello `NonConformity`**: id, code (NC-YYYY-NNNNN), type (QUALITY, DELIVERY, DOCUMENTATION), status (state machine: OPENED → EVIDENCE_SUBMITTED → VENDOR_RESPONSE → JOINT_EVALUATION → CLOSED), request_id (collegamento a PR/ordine), vendor_id, opened_by, description, severity (MINOR/MAJOR/CRITICAL)
- **Modello `NCEvidence`**: documenti allegati, foto, report di ispezione
- **Modello `NCResponse`**: risposta del fornitore con timestamp, documenti di supporto
- **Modello `NCResolution`**: decisione finale concordata, azioni correttive, costi sostenuti, responsabilità (committente vs fornitore)
- **State machine NC**: con regole su chi può fare cosa (solo l'aperturista può chiudere, il fornitore può rispondere ma non chiudere, etc.)
- **UI**: lista NC, dettaglio con timeline, form di risposta fornitore (potenzialmente via link esterno o portale fornitore)
- **Integrazione con commesse**: una NC su un articolo in produzione impatta la deadline della commessa

#### Complessità di implementazione
**ALTA**. Schema DB: 3-5 giornate. State machine + servizi: 5-8 giornate. UI completa (lista, dettaglio, form risposta, documenti): 8-12 giornate. Portale fornitore (opzionale — link condiviso per risposta): 5-8 giornate. Totale: **21-33 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK**. Le NC con contraddittorio formale sono un requisito specifico del settore difesa (AQAP-2110, NATO quality assurance). Una PMI generica gestisce reclami in modo meno strutturato.

#### Prerequisiti e dipendenze
Richiede audit log (T6) per tracciare ogni azione nella NC. Richiede anche il sistema notifiche email (T3) per notificare il fornitore.

#### Rischi tecnici o aperti
Il "contraddittorio" implica che il fornitore deve poter accedere al sistema per rispondere. Oggi ProcureFlow è single-tenant senza portale fornitore. Opzioni: (a) il fornitore risponde via email e l'operatore registra manualmente, (b) link condiviso con token (come un Google Form, ma interno), (c) portale fornitore dedicato. L'opzione (b) è il pragmatic choice per l'MVP.

---

### 2.8 — Motivi modifica categorizzati (Takeaway 8)

#### Cosa chiede Faleni
Ogni modifica di ordine/data deve essere categorizzata con: Responsabilità (L = committente, S = fornitore) e Categoria (modifica tecnica, NC, materiale mancante, etc.). Questi dati sono fondamentali per AI predittiva dei ritardi.

#### Cosa esiste oggi nel codebase
Il modello `StockMovement` ha un campo `reason` tipizzato con enum `MovementReason` (ACQUISTO, RESO_CLIENTE, PRODUZIONE, etc.) — 12 valori. Ma questo è per movimenti di magazzino, non per modifiche di ordine.

Il modello `TimelineEvent` ha campi `type` e `metadata` JSON che potrebbero ospitare categorizzazione, ma non c'è nessuno schema strutturato per "motivo di modifica ordine".

Il `PriceVarianceReview` traccia variazioni prezzo con delta percentuale per riga, ma non categorizza la responsabilità (L/S).

#### Gap rispetto a quanto richiesto

- **Enum `ModificationResponsibility`** mancante: (COMMITTENTE, FORNITORE, INTERNO)
- **Enum `ModificationCategory`** mancante: (MODIFICA_TECNICA, NON_CONFORMITA, MATERIALE_MANCANTE, CAMBIO_PRIORITA, ERRORE_ORDINE, FORZA_MAGGIORE, etc.)
- **Modello `OrderModification`**: id, request_id, field_changed (date, quantity, spec), old_value, new_value, responsibility, category, notes, actor_id, created_at
- **UI per categorizzazione**: ogni volta che un campo critico cambia (data consegna, quantità, specifica tecnica), l'operatore deve selezionare responsabilità e categoria
- **Report aggregati**: conteggio modifiche per responsabilità/categoria per mese, per committente, per fornitore

#### Complessità di implementazione
**MEDIA**. Schema + enum: 1-2 giornate. Servizio + intercettazione modifiche: 3-5 giornate. UI (dialog categorizzazione + report): 3-5 giornate. Totale: **7-12 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK**. La categorizzazione L/S è specifica per relazioni committente-subfornitore nel settore difesa. Una PMI generica che compra non ha il concetto di "responsabilità committente".

#### Prerequisiti e dipendenze
Richiede audit log (T6) come infrastruttura sottostante. I dati alimentano la predizione ritardi (T15).

#### Rischi tecnici o aperti
La categorizzazione è soggettiva — l'operatore potrebbe sempre scegliere "committente" per proteggere il fornitore. Serve un meccanismo di review o almeno di report che evidenzi pattern anomali.

---

### 2.9 — Supporto firma elettronica (Takeaway 9)

#### Cosa chiede Faleni
Offerte e conferme d'ordine firmate digitalmente. Integrazione nativa o con sistemi esterni (Aruba, Namirial, InfoCert). MBDA richiede doppia firma elettronica sulle conferme d'ordine.

#### Cosa esiste oggi nel codebase
**Nessun componente del codebase attuale affronta questo punto.** Non esiste nessun modello, servizio, o UI per firma digitale. Non ci sono librerie di firma (come `pdf-lib`, `node-forge`, `pkcs11`) nelle dipendenze.

#### Gap rispetto a quanto richiesto

Serve un modulo completamente nuovo:

- **Integrazione con provider firma**: Aruba, Namirial, InfoCert offrono API REST per firma remota (FEQ — Firma Elettronica Qualificata). Richiede account business con il provider.
- **Modello `SignatureRequest`**: id, document_id (allegato da firmare), signatories (array di firmatari con ordine), status (PENDING/PARTIALLY_SIGNED/COMPLETED/REJECTED), provider (ARUBA/NAMIRIAL/INFOCERT)
- **Flusso UI**: l'operatore seleziona un documento → sceglie i firmatari → il sistema genera la richiesta di firma → i firmatari ricevono notifica → firmano via OTP/smart card → il documento firmato viene salvato
- **Verifica firma**: validazione del certificato e dell'integrità del documento firmato
- **Archiviazione**: il documento firmato con marca temporale va conservato per 10 anni

#### Complessità di implementazione
**MOLTO ALTA**. Integrazione API provider (1 provider): 8-15 giornate. UI flusso firma: 5-8 giornate. Verifica e archiviazione: 3-5 giornate. Supporto multi-provider: 5-8 giornate aggiuntive per provider. Totale per 1 provider: **16-28 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK**. La firma elettronica qualificata è un requisito normativo nel settore difesa. Una PMI generica usa firme semplici (email di conferma).

#### Prerequisiti e dipendenze
Richiede sapere quale provider di firma usa Faleni (se ne ha già uno). Richiede decisione se implementare firma remota (OTP) o firma locale (smart card). La "doppia firma" di MBDA deve essere chiarita (2 firmatari sequenziali? 2 algoritmi?).

#### Rischi tecnici o aperti
Le API dei provider di firma italiani non sono standardizzate — ogni provider ha la sua. La conformità eIDAS richiede certificazione specifica. Il costo per transazione (firma) varia: Aruba ~0.50€/firma, Namirial ~0.40€/firma. Per 1.600 righe ordine/anno, il costo è significativo.

---

### 2.10 — Blocco fatture con motivazione strutturata (Takeaway 10)

#### Cosa chiede Faleni
Quando una fattura viene bloccata (merce non conforme, merce non ordinata, prezzo errato, etc.), il motivo deve essere strutturato con un codice e visibile nello scadenzario.

#### Cosa esiste oggi nel codebase
Il modello `Invoice` ha: `reconciliation_status` (PENDING, MATCHED, APPROVED, DISPUTED, REJECTED, PAID), `reconciliation_notes` (testo libero), `discrepancy_type` (AMOUNT_MISMATCH, QUANTITY_MISMATCH, PRICE_MISMATCH, ITEM_MISMATCH, NONE), `discrepancy_resolved` (boolean).

Il tool `disputeInvoiceTool` permette di contestare una fattura con tipo discrepanza e note. La UI di riconciliazione (`reconciliation-dialog.tsx`) mostra le discrepanze e permette di approvarle/contestarle.

#### Gap rispetto a quanto richiesto

- **Enum discrepanza incompleto**: mancano motivi specifici del blocco fattura: MERCE_NON_CONFORME, MERCE_NON_ORDINATA, SERVIZIO_NON_RESO, IMPORTO_NON_CONCORDATO, DOCUMENTO_MANCANTE, FATTURA_DUPLICATA
- **Nessuno scadenzario**: non esiste una vista "fatture in scadenza" con colonna "motivo blocco". La pagina fatture lista tutte le fatture con filtri per stato, ma non c'è un concetto di "scadenzario pagamento"
- **Nessun campo `blocked_at` / `blocked_by`**: il passaggio a DISPUTED non traccia chi e quando ha bloccato
- **Nessun campo `payment_due_date` calcolato**: la `due_date` è estratta dal XML ma non c'è logica per calcolarla dai termini di pagamento del fornitore (30gg DFFM, 60gg, etc.)

#### Complessità di implementazione
**TRIVIALE → MEDIA**. Estendere l'enum discrepanza: 1 giornata. Aggiungere campi blocco: 1 giornata. Vista scadenzario: 3-5 giornate. Calcolo scadenze da termini pagamento: 2-3 giornate. Totale: **7-10 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**CORE**. Lo scadenzario fatture è utile a qualsiasi PMI.

#### Prerequisiti e dipendenze
Nessuno — estensione del modulo fatturazione esistente.

#### Rischi tecnici o aperti
I termini di pagamento italiani sono complessi (30gg DFFM = 30 giorni data fattura fine mese, 60gg DF = 60 giorni data fattura). Serve un parser dedicato o un campo configurabile per fornitore.

---

### 2.11 — Tracciabilità lotti end-to-end (Takeaway 11)

#### Cosa chiede Faleni
Da componente acquistato → lotto in ingresso → scarico in produzione → lotto prodotto finito → consegna. Navigazione bidirezionale: dato un pezzo consegnato, risalire al lotto materia prima; dato un lotto materia prima, trovare tutti i prodotti finiti fatti con quello.

#### Cosa esiste oggi nel codebase
Il modello `StockLot` traccia lotti con numero univoco, materiale, magazzino, zona, quantità iniziale/corrente, costo unitario, data scadenza, stato (AVAILABLE, RESERVED, DEPLETED, EXPIRED). Collegato a `PurchaseRequest` (da quale acquisto proviene il lotto).

`StockMovement` registra ogni movimentazione con tipo (INBOUND, OUTBOUND, TRANSFER, ADJUSTMENT, RETURN), motivo (12 enum values incluso PRODUZIONE), quantità, e collegamento opzionale a lot_id.

La navigazione backward parziale esiste: StockLot → PurchaseRequest (da dove è arrivato). StockMovement traccia consumo (OUTBOUND + PRODUZIONE) con lot_id.

#### Gap rispetto a quanto richiesto

- **Nessun modello "Lotto Prodotto Finito"**: il sistema traccia solo lotti di materie prime. Non c'è un `ProductionLot` o `FinishedGoodsLot` che colleghi materie prime consumate → prodotto finito → consegna al committente.
- **Nessun modello "Ordine di Produzione"**: per collegare lo scarico materiali alla produzione serve un'entità che rappresenti "sto producendo X pezzi di articolo Y usando i lotti Z1, Z2, Z3".
- **Nessuna navigazione forward**: dato un lotto MP, non posso trovare in quali prodotti finiti è finito — manca il collegamento OUTBOUND → produzione → lotto PF.
- **Nessuna navigazione backward completa**: dato un prodotto finito consegnato, non posso risalire ai lotti MP — manca il collegamento consegna → lotto PF → lotti MP consumati.
- **Formato lotto non personalizzabile**: il sistema genera LOT-YYYY-NNNNN. Faleni usa ACQ+AAAAMMGG+progressivo (es. ACQ2026041701). Serve un generatore configurabile.

#### Complessità di implementazione
**ALTA**. Schema produzione (ProductionOrder, ProductionLot, BOMConsumption): 5-8 giornate. Servizi di tracciabilità bidirezionale: 5-8 giornate. UI navigazione lotti (tree view forward/backward): 5-8 giornate. Generatore lotti personalizzabile: 1-2 giornate. Totale: **16-26 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK**. La tracciabilità lotti end-to-end con navigazione bidirezionale è un requisito MIL-SPEC (AS9100, AQAP-2110). Una PMI generica non ha necessità di risalire dal prodotto finito alla materia prima.

#### Prerequisiti e dipendenze
Richiede il modello di produzione (Ordine di Produzione, BOM). Collegato a T12 (automazione scarico) e T14 (magazzini logici).

#### Rischi tecnici o aperti
La granularità della tracciabilità deve essere definita: si traccia a livello di lotto (ACQ20260417) o a livello di singolo pezzo (serial number)? Per componenti MIL-SPEC con serial tracking, la complessità aumenta significativamente.

---

### 2.12 — Automazione scarico produzione (Takeaway 12)

#### Cosa chiede Faleni
La bolla di produzione deve suggerire automaticamente quali lotti prelevare, seguendo regola FIFO (First In, First Out). Citazione: *"Sarebbe opportuno che il programma ti dica: per produrre questo, prendi questo, questo e questo."*

#### Cosa esiste oggi nel codebase
Il servizio `inventory-db.service.ts` ha una funzione `getSuggestedInbounds()` che suggerisce carichi a magazzino per PR in stato DELIVERED senza movimenti registrati. Ma non esiste nessuna funzione di suggerimento scarico (outbound) per produzione.

`StockLot` ha `status` (AVAILABLE, RESERVED, DEPLETED, EXPIRED) e `current_quantity` — i dati per un algoritmo FIFO esistono. `StockReservation` supporta prenotazione di quantità su lotti specifici.

#### Gap rispetto a quanto richiesto

- **Nessun algoritmo FIFO**: non esiste una funzione che, dato un materiale e una quantità richiesta, selezioni automaticamente i lotti più vecchi (per data ingresso o per expiry date) e proponga lo scarico.
- **Nessun modello "Kit di Produzione"**: per assemblare un prodotto servono N componenti diversi. Il sistema dovrebbe generare una "lista di prelievo" con un lotto suggerito per ogni componente.
- **Nessuna BOM (Bill of Materials)**: senza distinta base, il sistema non sa quali materiali servono per produrre un articolo.
- **Nessuna UI di prelievo**: manca una schermata "Prepara kit per ordine X" con checkbox per confermare il prelievo di ogni lotto.

#### Complessità di implementazione
**ALTA**. Algoritmo FIFO di selezione lotti: 3-5 giornate. Modello BOM (Bill of Materials): 5-8 giornate. Servizio generazione kit: 3-5 giornate. UI prelievo con conferma: 5-8 giornate. Totale: **16-26 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK**. L'automazione dello scarico produzione con FIFO è specifica per aziende manifatturiere con tracciabilità.

#### Prerequisiti e dipendenze
Richiede BOM (distinta base) e modello produzione. Dipende da T11 (tracciabilità lotti).

#### Rischi tecnici o aperti
FIFO puro potrebbe non essere sempre desiderabile — alcuni lotti potrebbero avere vincoli (es. lotto con certificato materiale specifico per un committente). Serve un FIFO con override manuale.

---

### 2.13 — Barcode/NFC per movimenti magazzino (Takeaway 13)

#### Cosa chiede Faleni
Scansione componenti con pistola o tablet. Kit preparation automatizzata. Movimenti registrati automaticamente alla scansione.

#### Cosa esiste oggi nel codebase
Il modello `Material` ha campi `barcode` (String?) e `qr_code` (String?), ma sono semplici stringhe — non c'è nessuna logica di generazione, validazione, o scansione. Non c'è un endpoint `/api/scan` o simile. Non ci sono librerie di barcode/QR nelle dipendenze npm.

#### Gap rispetto a quanto richiesto

- **Nessuna generazione barcode/QR**: i campi esistono ma non vengono popolati automaticamente
- **Nessuna UI di scansione**: serve un componente camera/scanner che legga barcode da dispositivo mobile o pistola USB
- **Nessuna API di scansione**: endpoint che riceve un codice barcode → identifica il materiale/lotto → registra il movimento
- **Nessuna PWA/app mobile**: la scansione da tablet richiede accesso alla camera e un'interfaccia touch-friendly
- **Nessun supporto NFC**: NFC richiede API Web NFC (supporto limitato: Chrome Android only)

#### Complessità di implementazione
**ALTA**. Generazione barcode/QR (EAN-13 o Code 128): 2-3 giornate. UI scansione con camera: 5-8 giornate (libreria `html5-qrcode` o `quagga2`). API scan→movement: 3-5 giornate. PWA per mobile: 5-8 giornate. NFC (opzionale): 3-5 giornate aggiuntive. Totale senza NFC: **15-24 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK**. La scansione barcode in magazzino è tipica di aziende manifatturiere con volumi significativi. Una PMI che fa solo procurement non ne ha bisogno.

#### Prerequisiti e dipendenze
Richiede la logica FIFO (T12) per suggerire quale lotto scansionare. Richiede decisione hardware: pistola USB barcode (più economica, funziona ovunque) vs scansione da camera tablet (più flessibile, richiede PWA).

#### Rischi tecnici o aperti
La scansione da camera in ambiente industriale (scarsa illuminazione, etichette sporche/danneggiate) è meno affidabile di una pistola laser. Consigliare pistola USB come primary e camera come fallback.

---

### 2.14 — Gestione magazzini logici (Takeaway 14)

#### Cosa chiede Faleni
Tre magazzini: arrivo (centrale) → lavorazione (produzione) → prodotto finito. Movimenti automatici tra magazzini quando cambia lo stato dell'ordine di produzione.

#### Cosa esiste oggi nel codebase
I modelli `Warehouse` e `WarehouseZone` esistono. Un magazzino ha codice, nome, indirizzo. Le zone sono sottoaree di un magazzino. `StockLot` ha sia `warehouse_id` che `zone_id`. `StockMovement` ha tipo TRANSFER con `to_warehouse_id` e `to_zone_id`.

La logica di trasferimento tra magazzini esiste nei movimenti (TRANSFER). La UI `warehouses/page.tsx` permette di gestire magazzini e zone.

#### Gap rispetto a quanto richiesto

- **Nessun magazzino logico predefinito**: i magazzini sono generici. Non c'è un concetto di "tipo magazzino" (ARRIVO, LAVORAZIONE, PRODOTTO_FINITO) che il sistema usa per automatizzare i flussi.
- **Nessun movimento automatico**: il trasferimento tra magazzini è manuale. Non c'è un trigger "quando un ordine di produzione inizia, trasferisci automaticamente i materiali dal magazzino arrivo al magazzino lavorazione".
- **Nessun collegamento produzione→magazzino**: senza ordine di produzione, non c'è modo di sapere quando un materiale deve passare da "arrivo" a "lavorazione" a "prodotto finito".

#### Complessità di implementazione
**MEDIA**. Aggiungere `warehouse_type` (RECEIVING, PRODUCTION, FINISHED_GOODS): 1-2 giornate. Automazione trasferimenti legata a ordine produzione: 3-5 giornate. UI dedicata per flusso materiali tra magazzini: 3-5 giornate. Totale: **7-12 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK**. I magazzini logici con flusso automatizzato sono specifici per manifattura.

#### Prerequisiti e dipendenze
Richiede ordine di produzione (T11/T12). Senza produzione, il flusso arrivo→lavorazione→prodotto finito non ha senso.

#### Rischi tecnici o aperti
Faleni potrebbe avere magazzini fisici separati o solo zone diverse nello stesso capannone. Il modello Warehouse+WarehouseZone copre entrambi i casi, ma la semantica "logica" vs "fisica" va chiarita.

---

### 2.15 — Predizione ritardi da cause storiche (Takeaway 15)

#### Cosa chiede Faleni
Usare i dati dei motivi di modifica (Responsabilità L/S + Categoria) come dataset per modelli predittivi di ritardi.

#### Cosa esiste oggi nel codebase
Il servizio `forecast.service.ts` usa un Weighted Moving Average (WMA) su 6 mesi per previsione consumo materiali. L'agente AI (`compliance-monitor.agent.ts`) analizza dati pre-fetchati e genera insight (SPEND_ANOMALY, VENDOR_RISK, SAVINGS, BOTTLENECK, BUDGET_ALERT). Il modello `AiInsight` persiste insight con severità e azione suggerita.

Il prompt `FORECAST_SYSTEM_PROMPT` chiede all'AI di considerare "stagionalità, trend recenti, ordini aperti, affidabilità fornitore" — un approccio qualitativo, non basato su feature engineering strutturato.

#### Gap rispetto a quanto richiesto

- **Nessun dataset strutturato per training**: i motivi di modifica (T8) non esistono ancora. Senza dati L/S categorizzati, non c'è input per il modello predittivo.
- **Nessun modello predittivo specifico per ritardi**: il forecast WMA predice consumo, non ritardi di consegna. Serve un modello diverso: dato un ordine con caratteristiche X (fornitore, categoria, importo, storia modifiche), qual è la probabilità di ritardo?
- **Nessuno storico consegne strutturato**: non c'è un campo `original_expected_delivery` vs `actual_delivery_date` che permetta di calcolare lo scostamento storico per fornitore/categoria.
- **Volume dati insufficiente**: Faleni ha 1.600 righe aperte, ma per un modello predittivo servono migliaia di ordini chiusi con esiti noti. Serve un periodo di raccolta dati (6-12 mesi) prima che le predizioni siano significative.

#### Complessità di implementazione
**ALTA**. Raccolta dati strutturata (dipende da T8): parte del costo di T8. Feature engineering + modello predittivo: 8-15 giornate. Dashboard predittiva: 3-5 giornate. Ma il modello sarà significativo solo dopo 6-12 mesi di dati. Totale per infrastruttura: **11-20 giornate** + tempo di maturazione dati.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK**. La predizione ritardi con dati L/S è specifica per subforniture difesa con relazioni committente strutturate.

#### Prerequisiti e dipendenze
Dipende da T8 (motivi modifica categorizzati) come fonte dati primaria. Richiede decisione: modello ML classico (logistic regression, random forest) o AI generativa (Claude analizza pattern in linguaggio naturale)?

#### Rischi tecnici o aperti
Il founder deve accettare che le predizioni saranno poor per i primi 6-12 mesi di raccolta dati. Proporre un approccio incrementale: (1) iniziare con regole semplici ("fornitore X ha storicamente 30% di ritardi"), (2) evolvere verso ML quando ci sono abbastanza dati. L'approccio Claude-based attuale (FORECAST_SYSTEM_PROMPT) è un buon ponte per la fase iniziale.

---

### 2.16 — Morning dashboard intelligente (Takeaway 16)

#### Cosa chiede Faleni
Aggregazione multi-piattaforma: ordini da confermare, gare in scadenza, modifiche ricevute, NC aperte, spedizioni, fatture bloccate. Tutto in una vista mattutina.

#### Cosa esiste oggi nel codebase
La dashboard attuale (6 KPI cards, delivery timeline, budget trend, inventory overview) è interna. `dashboard.service.ts` aggrega: PR per stato, approvazioni pending, fatture da riconciliare, alert magazzino, scadenze.

#### Gap rispetto a quanto richiesto
Questo takeaway è una combinazione di T2 (hub multi-committente) e T3 (notifiche). I gap specifici sono:
- **Widget "Ordini da confermare"**: richiede dati da SupplyOn (connettore)
- **Widget "Gare in scadenza"**: i Tender hanno `submission_deadline` — questo widget è fattibile con dati interni
- **Widget "Modifiche ricevute ieri"**: richiede diff tracking (parte di T3)
- **Widget "NC aperte"**: richiede modulo NC (T7)
- **Widget "Fatture bloccate"**: fattibile con dati interni (Invoice con DISPUTED status)

#### Complessità di implementazione
**MEDIA** per parti interne. I widget basati su dati interni (gare in scadenza, fatture bloccate) sono 3-5 giornate. I widget che richiedono dati esterni dipendono dai connettori. Totale solo interno: **5-8 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**DEFENSE PACK** per la versione multi-piattaforma. **CORE** per la versione basata su dati interni.

#### Prerequisiti e dipendenze
La versione completa dipende dai connettori (Sezione 3). La versione interna è implementabile subito.

#### Rischi tecnici o aperti
La dashboard deve caricare velocemente (<2s) anche con 1.600 righe ordine. Il `dashboard.service.ts` attuale fa query Prisma dirette senza cache — potrebbe servire caching Redis per i contatori aggregati.

---

### 2.17 — Analytics fatturato per competenza (Takeaway 17)

#### Cosa chiede Faleni
Report che distinguono data registrazione vs data competenza economica. "Quanto fatturato è di competenza Q1 2026?" indipendentemente da quando la fattura è stata registrata.

#### Cosa esiste oggi nel codebase
Il modello `Invoice` ha `invoice_date` (data fattura) e `received_at` (data ricezione). Il report settimanale (`/api/reports/weekly/route.ts`) e l'analytics ROI (`roi-metrics.service.ts`) aggregano per data registrazione. Non c'è un concetto di "data competenza".

#### Gap rispetto a quanto richiesto

- **Nessun campo `competence_date` o `competence_period`**: serve un campo per indicare a quale periodo economico si riferisce la fattura
- **Nessuna logica di rateo/risconto**: se una fattura copre un periodo (es. manutenzione gen-giu), l'importo va spalmato sui 6 mesi
- **Nessun report per competenza**: i report esistenti aggregano per data fattura, non per data competenza

#### Complessità di implementazione
**MEDIA**. Aggiungere campo competenza: 1 giornata. Logica di assegnazione automatica (data fattura ≈ data competenza in prima approssimazione): 2-3 giornate. Report per competenza: 3-5 giornate. Totale: **6-9 giornate**.

#### Dove collocarlo nell'architettura a edizioni
**CORE**. La distinzione registrazione vs competenza è utile a qualsiasi PMI con contabilità.

#### Prerequisiti e dipendenze
Nessuno — estensione del modulo fatturazione.

#### Rischi tecnici o aperti
La competenza può essere complessa per fatture multi-periodo. In prima approssimazione, usare `invoice_date` come proxy per competenza è sufficiente per il 90% dei casi.

---

### 2.18 — La complessità stessa è il mercato (Takeaway 18)

Questo non è un requisito tecnico ma un'osservazione strategica: ogni fornitore Tier 2/3 difesa italiano ha lo stesso problema di Faleni. L'analisi tecnica non produce un gap per questo punto — è un validazione del product-market fit del Defense Pack.

**Implicazione tecnica**: l'architettura deve essere progettata per essere replicabile (onboarding < 1 giorno per nuovo cliente, configurazione per-committente senza custom code). L'attuale architettura single-tenant Docker è un buon punto di partenza ma richiede evoluzione verso un onboarding automatizzato (trattato nell'OPS-RUNBOOK).

---

## 3. Connettori Piattaforme Committenti

### 3.1 — SAP Ariba (Leonardo — gare/RDO)

#### Cosa fa la piattaforma
SAP Ariba è la piattaforma di procurement di Leonardo per gestire gare, RDO (Richieste di Offerta) e procurement strategico. Faleni riceve RDO su Ariba, deve preparare offerte, e non riceve notifiche email quando le specifiche cambiano.

#### Modalità di integrazione possibili

1. **API ufficiale (Ariba Network API)**: SAP Ariba offre API REST per supplier — "SAP Ariba APIs for Supplier" includono: lettura PO, conferma ordini, invio fatture, aggiornamento catalogo. Documentazione su `api.sap.com/package/AribaNetwork`. **Ma**: l'abilitazione richiede che Leonardo (il buyer) attivi l'accesso API per Faleni. Non è in controllo di Faleni. Fattibilità: media. Effort se disponibili: 15-25 giornate. Rischio rottura: basso (API enterprise, versionate). Effort iniziale: 2-3 giornate per proof-of-concept se API abilitate.

2. **Webhook/notifiche email**: Ariba non invia email strutturate per modifiche — è il dolore di Faleni. Fattibilità: nulla. Non c'è niente da parsare.

3. **Export CSV/XLSX**: Ariba permette export manuale di liste ordini e RDO. L'operatore può scaricare un CSV e caricarlo in ProcureFlow. Fattibilità: alta. Effort: 3-5 giornate (parser CSV specifico per formato Ariba). Rischio rottura: basso (formato tabellare stabile).

4. **Scraping autenticato**: accesso via credenziali Faleni, estrazione dati con browser automation (Playwright). Legale solo con autorizzazione scritta. Fattibilità: alta tecnicamente, rischiosa legalmente. Effort: 10-15 giornate + manutenzione continua. Rischio rottura: alto (UI Ariba cambia 2-3 volte/anno).

#### Raccomandazione pragmatica
Iniziare con **import CSV manuale** (l'operatore scarica da Ariba e carica in ProcureFlow) — 3-5 giornate. In parallelo, chiedere a Leonardo di abilitare le API supplier di Ariba Network. Se abilitate, migrare a **API ufficiale** — 15-25 giornate aggiuntive. Non fare scraping.

#### Gap con il codebase attuale
L'import CSV generico esiste (`article-import.service.ts`), ma non c'è un parser specifico per il formato CSV di Ariba. L'email agent potrebbe parsare email di notifica Ariba se ne arrivassero, ma il problema è che non arrivano.

#### Stima di implementazione
MVP (import CSV): **3-5 giornate**. Versione solida (API ufficiale): **15-25 giornate aggiuntive**.

#### Rischi
L'abilitazione API da parte di Leonardo è una decisione politica/contrattuale, non tecnica. Se Leonardo non abilita, le opzioni sono: CSV manuale (funziona ma non scala) o scraping (fragile e borderline). Ricerca necessaria: verificare esattamente quali API sono disponibili nel piano supplier di SAP Ariba Network.

---

### 3.2 — SupplyOn (Leonardo — ordini)

#### Cosa fa la piattaforma
SupplyOn è la piattaforma di supply chain management usata da Leonardo per la gestione ordini quotidiana. Faleni ha 1.600 righe d'ordine aperte qui. Non riceve email quando arrivano nuovi ordini — deve controllare manualmente ogni mattina.

#### Modalità di integrazione possibili

1. **API ufficiale (SupplyOn Integration Platform)**: SupplyOn offre un'Integration Platform per supplier con connettori EDI/API. Documentazione non pubblica — richiede richiesta al team SupplyOn. Fattibilità: media (dipende dall'account di Faleni). Effort se disponibili: 15-25 giornate. Rischio rottura: basso.

2. **Webhook/notifiche email**: SupplyOn ha un sistema di notifiche configurabile dall'utente. Faleni potrebbe attivare notifiche email per nuovi ordini/modifiche e poi parsarle con l'email agent ProcureFlow. Fattibilità: alta. Effort: 2-3 giornate (configurazione SupplyOn + tuning email agent). Rischio rottura: medio (se SupplyOn cambia formato email).

3. **Export CSV/XLSX**: SupplyOn permette export di liste ordini. Fattibilità: alta. Effort: 3-5 giornate per parser dedicato.

4. **Scraping autenticato**: stesse considerazioni di Ariba. SupplyOn è basato su Angular — scraping più complesso. Fattibilità: media. Effort: 12-18 giornate. Rischio rottura: alto.

#### Raccomandazione pragmatica
**Fase 1**: attivare notifiche email in SupplyOn + configurare l'email agent di ProcureFlow per parsarle (intent CONFERMA_ORDINE, RITARDO_CONSEGNA). Effort: **2-3 giornate**. **Fase 2**: esplorare API SupplyOn Integration Platform. **Fase 3**: import CSV periodico per sincronizzazione bulk delle 1.600 righe.

#### Gap con il codebase attuale
L'email agent già gestisce intent come CONFERMA_ORDINE e RITARDO_CONSEGNA. Se SupplyOn invia email strutturate, l'agente potrebbe processarle con minime modifiche al prompt. Il workflow n8n per email ingestion (Gmail → webhook) è già operativo.

#### Stima di implementazione
MVP (email parsing): **2-3 giornate**. Import CSV bulk: **3-5 giornate aggiuntive**. API (se disponibili): **15-25 giornate aggiuntive**.

#### Rischi
La qualità delle email di SupplyOn determina l'efficacia del parsing AI. Se le email sono generiche ("Hai nuove attività in SupplyOn"), il valore è limitato. Ricerca necessaria: ottenere un campione delle email che SupplyOn invia e verificare se contengono dati strutturati.

---

### 3.3 — Ivalua (vari committenti — gare/RDO)

#### Cosa fa la piattaforma
Ivalua è una piattaforma di procurement usata da vari committenti di Faleni per gare d'appalto e RDO. Notifica le modifiche solo sulla piattaforma, non via email.

#### Modalità di integrazione possibili

1. **API ufficiale**: Ivalua offre API REST/SOAP per supplier. Documentazione non pubblica — richiede abilitazione per committente. Ricerca necessaria prima di stimare.

2. **Webhook/notifiche email**: simile ad Ariba — notifiche limitate o assenti. Fattibilità: bassa.

3. **Export CSV/XLSX**: generalmente disponibile. Effort: 3-5 giornate per parser.

4. **Scraping**: applicazione moderna SPA — scraping complesso. Effort: 10-15 giornate. Rischio rottura: alto.

#### Raccomandazione pragmatica
Iniziare con **import CSV**. Esplorare API in parallelo. Priorità inferiore rispetto ad Ariba e SupplyOn (che sono il canale Leonardo, il committente principale).

#### Gap con il codebase attuale
Identico agli altri: nessun connettore specifico, ma l'infrastruttura base (import CSV, email parsing) è riusabile.

#### Stima di implementazione
MVP (CSV): **3-5 giornate**. API (se disponibili): **15-25 giornate**.

#### Rischi
Ivalua è usata da committenti diversi che potrebbero avere configurazioni diverse della stessa piattaforma. Ricerca necessaria: quanti committenti Faleni usano Ivalua e con quali configurazioni.

---

### 3.4 — Fincantieri portal

#### Cosa fa la piattaforma
Portale procurement proprietario di Fincantieri. Gestisce intero ciclo da qualifica fornitore a ordine a consegna. Fincantieri ha un processo di qualifica centralizzato che è prerequisito per qualsiasi fornitura.

#### Modalità di integrazione possibili

1. **API ufficiale**: ricerca necessaria. I portali proprietari delle grandi aziende italiane raramente hanno API supplier pubbliche. Fattibilità: bassa senza contatto diretto con IT Fincantieri.

2. **Webhook/notifiche email**: ricerca necessaria. Verificare se il portale invia email strutturate.

3. **Export CSV/XLSX**: probabilmente disponibile. Effort: 3-5 giornate per parser specifico.

4. **Scraping**: portale proprietario — struttura sconosciuta. Effort: stime impossibili senza analisi.

#### Raccomandazione pragmatica
Raccogliere informazioni prima di stimare. Chiedere a Faleni: (a) il portale invia email? (b) è possibile esportare dati? (c) c'è documentazione API? Iniziare con CSV se disponibile.

#### Gap con il codebase attuale
Nessun codice specifico. Riusabile: infrastruttura import CSV e email agent.

#### Stima di implementazione
MVP (CSV, se formato disponibile): **3-5 giornate**. Scraping/API: impossibile stimare senza ricerca.

#### Rischi
Fincantieri potrebbe non permettere scraping o API non autorizzate. Il processo di qualifica centralizzato implica che l'integrazione potrebbe richiedere un processo formale di approvazione da parte di Fincantieri.

---

### 3.5 — MBDA portal

#### Cosa fa la piattaforma
Portale MBDA per ordini e conferme d'ordine. Peculiarità: richiede doppia firma elettronica sulle conferme d'ordine.

#### Modalità di integrazione possibili

1. **API ufficiale**: ricerca necessaria. MBDA è un consorzio europeo — potrebbe avere standard EDI per supplier.

2. **Webhook/notifiche email**: ricerca necessaria.

3. **Export CSV/XLSX**: probabile. Effort: 3-5 giornate.

4. **Scraping**: portale proprietario — rischi etici/legali elevati con un committente difesa.

#### Raccomandazione pragmatica
Priorità più bassa dei 5 connettori (volume minore rispetto a Leonardo/SupplyOn). Iniziare con CSV. La doppia firma elettronica (T9) è il prerequisito bloccante per l'interazione completa con MBDA.

#### Gap con il codebase attuale
Nessun codice specifico. Il requisito firma elettronica (T9) è il gap più significativo per MBDA.

#### Stima di implementazione
MVP (CSV): **3-5 giornate**. Firma elettronica (prerequisito): vedi T9.

#### Rischi
La "doppia firma" deve essere chiarita tecnicamente. Se MBDA richiede FEQ (Firma Elettronica Qualificata) con due firmatari diversi in sequenza, l'implementazione è significativamente più complessa di una firma singola.

---

## 4. Mappa Moduli Esistenti vs Takeaway

| Modulo ProcureFlow esistente | Takeaway già affronta | Estensioni per Defense Pack |
|---|---|---|
| **PR / Approvazioni** (8 route, 13 stati, state machine) | T1 (ciclo ordine base), T6 (timeline), T10 (dispute fattura) | Aggiungere flusso offerta→ordine, motivi modifica (T8) |
| **Tender / Gare** (5 route, 12 stati, Go/No-Go) | T1 (fase gara), T16 (gare in scadenza) | RDO/Offerte strutturate, collegamento Tender→Commessa |
| **Commesse** (5 route, 6 stati, margine) | T1 (ordine→produzione linkage), T2 (vista cliente) | Stati produzione, collegamento a BOM, NC |
| **Articoli / Alias** (8 route, 3 alias types, fuzzy match) | T5 (codici multi-livello base) | Revisioni disegno, mappatura per committente, BOM |
| **Magazzino** (12 route, 7 modelli, alert, forecast) | T11 (lotti base), T14 (warehouse+zone), T16 (alert stock) | FIFO, tracciabilità end-to-end, barcode, magazzini logici |
| **Fatturazione SDI** (7 route, three-way match, XML parser) | T10 (dispute base), T17 (report base) | Scadenzario, competenza, motivi blocco strutturati |
| **Email Intelligence** (7 intent, 33 tool, WriteCounter) | T3 (notifiche email parziali), T4 (import email) | Parsing email da piattaforme, notifiche email outbound |
| **Dashboard** (KPI cards, timeline, budget trend) | T16 (morning view base) | Widget multi-piattaforma, diff tracker, NC counter |
| **Budget** (3 route, snapshot, enforcement) | — | Nessuna estensione specifica per Defense |
| **AI Insights / Compliance** (5 tipi insight, WMA forecast) | T15 (base predittiva) | Feature engineering su dati L/S, modello ritardi |
| **Export CSV** (6 entità, sanitizzazione) | T4 (export base) | XLSX, export automatico schedulato, API ERP |
| **Import** (vendor CSV, material CSV, article CSV) | T4 (import base) | Import ordini bulk, parser per formato piattaforme |
| **IntegrationConfig** (IMAP, SDI, Vendor API, cifratura) | T2 (config connettori) | Config per ogni piattaforma committente, sync scheduling |
| **Notifiche in-app** (15 tipi, modello base) | T3 (notifiche parziali) | Transport email, diff, preferenze, digest |

---

## 5. Effort Totale e Milestones Proposte

### 5.1 Stima totale

| Blocco | Takeaway inclusi | Range giornate |
|---|---|---|
| Flusso RDO→Delivery + Offerte | T1 | 15-25 |
| Connettori piattaforme (MVP CSV tutti + API Ariba+SupplyOn) | T2, parte T16 | 30-60 |
| Notifiche complete (email + diff + preferenze) | T3 | 10-16 |
| Integrazione ERP (XLSX + import ordini + API) | T4 | 13-23 |
| Codici multi-livello (revisioni, UI committente) | T5 | 6-10 |
| Audit trail immutabile | T6 | 11-18 |
| NC workflow con contraddittorio | T7 | 21-33 |
| Motivi modifica categorizzati | T8 | 7-12 |
| Firma elettronica (1 provider) | T9 | 16-28 |
| Blocco fatture + scadenzario | T10 | 7-10 |
| Tracciabilità lotti end-to-end + produzione | T11 | 16-26 |
| Automazione scarico FIFO + BOM | T12 | 16-26 |
| Barcode/NFC | T13 | 15-24 |
| Magazzini logici | T14 | 7-12 |
| Predizione ritardi | T15 | 11-20 |
| Morning dashboard completa | T16 | 5-8 |
| Analytics per competenza | T17 | 6-9 |
| **TOTALE** | **T1-T17** | **212-360** |

Escludendo le stime più conservative e più ottimistiche, il range realistico è **180-280 giornate-persona**.

**Traduzione in calendario**:
- 1 persona full-time: **9-14 mesi**
- 2 persone full-time: **5-7 mesi**
- 3 persone full-time: **3-5 mesi**

Di queste, circa 80-120 giornate sono **CORE** (utili a tutti i clienti) e 100-160 sono **DEFENSE PACK** (specifiche per Tier 2/3 difesa).

### 5.2 Milestones logiche

#### Milestone 1 — "Fondamenta Defense" (60-90 giornate, 2-3 mesi)
**Takeaway**: T1, T5, T6, T8
**Valore**: il flusso RDO→Delivery con offerte strutturate, codici multi-livello con revisioni, audit trail immutabile, motivi modifica categorizzati. Dopo questa milestone, Faleni può usare ProcureFlow per gestire il ciclo completo di una commessa.

#### Milestone 2 — "Connettori e Notifiche" (40-70 giornate, 1.5-2.5 mesi)
**Takeaway**: T2, T3, T4, T16, T17
**Valore**: import dati da piattaforme committenti (CSV + email parsing per SupplyOn), notifiche email con diff, morning dashboard multi-sorgente, export XLSX, analytics per competenza. Dopo questa milestone, Faleni non deve più controllare 5 piattaforme manualmente ogni mattina.

#### Milestone 3 — "Qualità e Compliance" (40-65 giornate, 1.5-2 mesi)
**Takeaway**: T7, T9, T10
**Valore**: workflow NC con contraddittorio, firma elettronica per conferme MBDA, scadenzario fatture con motivi blocco. Dopo questa milestone, Faleni gestisce la qualità e la compliance documentale nel sistema.

#### Milestone 4 — "Magazzino Avanzato" (55-90 giornate, 2-3 mesi)
**Takeaway**: T11, T12, T13, T14
**Valore**: tracciabilità lotti end-to-end, BOM, FIFO automatico, barcode, magazzini logici. Dopo questa milestone, Faleni ha un sistema di tracciabilità MIL-SPEC completo.

#### Milestone 5 — "Intelligence" (20-35 giornate, 1-1.5 mesi)
**Takeaway**: T15, connettori API avanzati
**Valore**: predizione ritardi da dati storici, connettori API verso Ariba/SupplyOn (se abilitati dai committenti). Richiede 6-12 mesi di dati raccolti nelle milestone precedenti.

### 5.3 Quick Win — primi 60 giorni

Le 3-5 cose da fare nei primi 60 giorni per consegnare valore visibile:

1. **Import CSV bulk da SupplyOn** (3-5 gg): Faleni scarica le 1.600 righe ordine, le carica in ProcureFlow, e ha una vista unificata. Valore immediato enorme — elimina il problema più acuto.

2. **Notifiche email** (5-8 gg): configurare trasporto SMTP e inviare email per approvazioni, ritardi, variazioni prezzo. Il sistema già crea notifiche in-app — aggiungere il canale email.

3. **Attivare email SupplyOn + tuning agent** (2-3 gg): far arrivare le email da SupplyOn al ProcureFlow email agent per parsing automatico di conferme ordine e ritardi.

4. **Audit trail base** (5-8 gg): Prisma middleware che logga automaticamente ogni modifica su PR, Commessa, Vendor. Necessario per conformità difesa.

5. **Motivi modifica su timeline** (3-5 gg): aggiungere campi L/S e categoria al TimelineEvent per iniziare a raccogliere dati strutturati per la futura predizione.

Totale quick win: **18-29 giornate** = valore tangibile in 4-6 settimane.

### 5.4 Il pezzo più rischioso

**Connettori API verso piattaforme committenti** (T2, specificamente SAP Ariba e SupplyOn). Rischi:

- **Dipendenza da terze parti**: l'abilitazione API richiede decisione di Leonardo/committente — fuori dal controllo di Faleni e del team di sviluppo
- **Documentazione non pubblica**: le API supplier di queste piattaforme non sono documentate pubblicamente — serve accesso al Developer Program del committente
- **Manutenzione continua**: le piattaforme enterprise cambiano API/UI regolarmente — budget di manutenzione annuo da preventivare
- **Fallback fragile**: se le API non vengono abilitate, l'alternativa (scraping) è legalmente e tecnicamente rischiosa nel contesto difesa

Mitigazione: il percorso CSV + email parsing non dipende da terze parti ed è fattibile subito. Le API sono un'evoluzione desiderabile ma non bloccante.

---

## 6. Decisioni Aperte per Founder + Consulente

1. **Leonardo è disposto ad abilitare le API Supplier di SAP Ariba per Faleni?** Senza questa informazione, non è possibile stimare il connettore Ariba. Faleni ha un referente IT in Leonardo?

2. **Quale gestionale interno usa Faleni?** (SAP Business One, TeamSystem, gestionale custom, Excel?) Il formato di scambio per l'integrazione ERP (T4) dipende da questo.

3. **Faleni ha già un provider di firma digitale aziendale?** (Aruba, Namirial, InfoCert, altro?) Se sì, quale piano/contratto? Questo determina quale API integrare per T9.

4. **Il requisito "doppia firma elettronica" di MBDA cosa significa esattamente?** Due firmatari diversi in sequenza sullo stesso PDF? Oppure firma + controfirma? O doppio algoritmo (CAdES + PAdES)?

5. **La convenzione lotti ACQ+AAAAMMGG+progressivo si applica solo ai materiali in ingresso o anche ai prodotti finiti?** E per i prodotti finiti, quale convenzione usano?

6. **Faleni traccia oggi i serial number dei singoli pezzi, o solo i lotti?** Per componenti MIL-SPEC con serial tracking, la complessità di T11 aumenta significativamente.

7. **Quanti committenti Faleni usano Ivalua, e con quali configurazioni?** (stesso account per tutti? account diversi per committente?)

8. **Il portale Fincantieri invia email di notifica?** Se sì, in che formato? Un campione di email sarebbe utile per valutare se l'email agent può parsarle.

9. **Per la predizione ritardi (T15), il founder accetta di partire con 6-12 mesi di raccolta dati prima di avere modelli utili?** O serve "intelligenza" fin dal giorno 1 anche con pochi dati?

10. **Qual è la priorità relativa tra connettori piattaforme (T2) e magazzino avanzato (T11-14)?** Entrambi sono blocchi grandi — fare uno prima dell'altro impatta la roadmap di mesi.

11. **Per il contraddittorio NC (T7), il fornitore deve poter accedere al sistema?** Se sì, serve un portale fornitore (scope aggiuntivo significativo). Se no, l'operatore Faleni registra le risposte manualmente.

12. **Faleni ha una distinta base (BOM) strutturata per i suoi prodotti?** In che formato? (Excel, gestionale, carta?) Questo impatta T12 (automazione scarico).

13. **Qual è il budget annuo accettabile per costi API/firma digitale?** (Firma: ~0.40-0.50€/transazione. API Ariba: pricing enterprise. Anthropic AI: ~$80/mese attuale per agenti.)

14. **Il founder vuole procedere con un team interno, un team esterno, o ibrido?** Questo impatta le milestone e i tempi.

15. **Ci sono requisiti di certificazione specifici?** (AS9100, AQAP-2110, NATO clearance per il software?) Questi possono aggiungere vincoli architetturali non banali.

---

## 7. Appendici

### A. Glossario dominio difesa/procurement

| Termine | Significato |
|---|---|
| RDO | Richiesta di Offerta — il committente chiede un prezzo al fornitore |
| Tier 2/3 | Livello nella catena di fornitura. Tier 1 = fornitore diretto del committente, Tier 2 = sub-fornitore del Tier 1, Tier 3 = sub-sub-fornitore |
| MIL-SPEC | Military Specification — standard tecnici per componenti militari |
| NC | Non Conformità — difetto o scostamento dalle specifiche |
| BOM | Bill of Materials — distinta base, lista componenti per assemblare un prodotto |
| FIFO | First In, First Out — regola di prelievo magazzino (usa prima i lotti più vecchi) |
| Three-way match | Confronto ordine vs ricevuta vs fattura per verificare coerenza |
| SDI | Sistema di Interscambio — hub italiano per fatturazione elettronica |
| FatturaPA | Formato XML standard per fatture elettroniche italiane |
| CIG | Codice Identificativo Gara — codice univoco per gare pubbliche |
| CUP | Codice Unico Progetto — codice per finanziamenti pubblici |
| MEPA | Mercato Elettronico della Pubblica Amministrazione |
| FEQ | Firma Elettronica Qualificata — equivalente legale della firma autografa |
| AQAP | Allied Quality Assurance Publication — standard NATO per qualità |
| AS9100 | Standard qualità per aerospazio e difesa (estensione di ISO 9001) |
| 231 | D.Lgs. 231/2001 — responsabilità amministrativa delle persone giuridiche |
| DFFM | Data Fattura Fine Mese — termine di pagamento italiano |
| L/S | Leonardo/Supplier — codifica responsabilità nelle modifiche ordine |

### B. Tabella classificazione CORE / DEFENSE / CUSTOM

| # | Takeaway | Edizione | Motivazione |
|---|---|---|---|
| T1 | Flusso unico RDO→Delivery | DEFENSE PACK | Specifico per fornitori che rispondono a committenti |
| T2 | Hub centralizzato multi-committente | DEFENSE PACK | Multi-piattaforma è specifico per Tier 2/3 |
| T3 | Sistema notifiche obbligatorio | CORE | Utile a qualsiasi PMI |
| T4 | Integrazione ERP bidirezionale | CORE (base) + DEFENSE (avanzato) | CSV/XLSX è core, API ERP difesa è defense |
| T5 | Gestione codici multi-livello | CORE (alias) + DEFENSE (revisioni) | Alias multi-vendor è core, revisioni MIL-SPEC sono defense |
| T6 | Audit trail completo | CORE | Utile a qualsiasi PMI, mandatorio per difesa |
| T7 | Workflow NC con contraddittorio | DEFENSE PACK | Specifico per relazioni committente-fornitore difesa |
| T8 | Motivi modifica categorizzati | DEFENSE PACK | L/S è specifico per subforniture |
| T9 | Firma elettronica | DEFENSE PACK | FEQ è requisito normativo difesa |
| T10 | Blocco fatture strutturato | CORE | Scadenzario utile a qualsiasi PMI |
| T11 | Tracciabilità lotti end-to-end | DEFENSE PACK | Requisito MIL-SPEC |
| T12 | Automazione scarico FIFO | DEFENSE PACK | Manifattura con tracciabilità |
| T13 | Barcode/NFC | DEFENSE PACK | Volumi magazzino manifatturiero |
| T14 | Magazzini logici | DEFENSE PACK | Flusso produttivo manifatturiero |
| T15 | Predizione ritardi | DEFENSE PACK | Feature engineering su dati L/S |
| T16 | Morning dashboard intelligente | CORE (base) + DEFENSE (multi-piattaforma) | Base interna è core, aggregazione esterna è defense |
| T17 | Analytics per competenza | CORE | Contabilità standard |
| T18 | Complessità = mercato | N/A | Osservazione strategica, non requisito tecnico |

### C. Riferimenti al codice (per sviluppatori)

| Area | File principali | Righe chiave |
|---|---|---|
| Schema DB | `prisma/schema.prisma` | 1.352 righe, 43 modelli |
| State machine PR | `src/lib/state-machine.ts` | 65 righe, 13 stati |
| Email agent | `src/server/agents/email-intelligence.agent.ts` | 819 righe, 7 intent, 33 tool |
| Chat agent | `src/server/agents/procurement-assistant.agent.ts` | 195 righe, 38 tool |
| Tool principali | `src/server/agents/tools/procurement.tools.ts` | 12 tool, classificazione READ/WRITE |
| Articoli + alias | `src/server/agents/tools/article.tools.ts` | fuzzy match riga 15, alias riga 59 |
| Stock tools | `src/server/agents/tools/stock.tools.ts` | get_stock_for_article, pending orders |
| Inventory service | `src/server/services/inventory-db.service.ts` | getSuggestedInbounds riga 355 |
| Forecast | `src/server/services/forecast.service.ts` | WMA riga 56 |
| Three-way match | `src/server/services/three-way-matching.service.ts` | soglie configurabili |
| Export CSV | `src/server/services/export.service.ts` | 6 entità, sanitizzazione |
| Email classifier | `src/server/services/email-ai-classifier.service.ts` | classifyEmailIntent() |
| Email ingestion | `src/server/services/email-ingestion.service.ts` | 4 action types, 886 righe |
| Integration config | `src/components/admin/integrations-tab.tsx` | IMAP, SDI, Vendor API |
| Dashboard | `src/server/services/dashboard.service.ts` | KPI aggregati |
| Tender state machine | `src/server/services/tenders.service.ts` | validateStatusTransition() |
| Commessa margin | `src/server/services/commessa.service.ts` | computeMargin() |
| Approval rules | `src/server/services/approval.service.ts` | soglie importo/ruolo |
| Webhook auth | `src/lib/webhook-auth.ts` | HMAC-SHA256 + timestamp |
| n8n workflow | `n8n/email-ingestion.json` | Gmail → OpenAI → webhook |
| Audit report | `AUDIT-REPORT.md` | 44 finding, 7 CRITICAL |
