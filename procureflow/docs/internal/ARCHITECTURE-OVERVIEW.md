# Architecture Overview — ProcureFlow

> Per owner, CTO-consulenti, stakeholder tecnici che vogliono capire la forma del sistema senza leggere codice.

## Cos'è ProcureFlow

Un hub procurement single-tenant per PMI italiane. Ogni cliente ha il suo deploy Docker (niente multi-tenant a livello DB). Lo stack:

- **Next.js 14** (App Router, TypeScript strict)
- **Prisma + PostgreSQL** (single DB per deploy)
- **n8n** per automazioni (email ingestion, monitoring consegne)
- **Single-tenant Docker su VPS** gestito dall'owner

## Forma del sistema: Modular Monolith

Non è micro-servizi. Non è un monolite caotico. È un **modular monolith**:

- Un'unica app Next.js, un unico DB, un unico deploy.
- Il codice è organizzato in **moduli** autosufficienti sotto `src/modules/`.
- Ogni modulo ha la sua public API via un `index.ts` barrel.
- I moduli possono essere **abilitati/disabilitati per deploy**, tramite configurazione.

### Perché modular monolith?

- Un cliente piccolo compra solo il core → abilitiamo solo i moduli essenziali.
- Un cliente Faleni (defense) compra il pack `defense` → abilitiamo moduli extra.
- Zero forking: un codebase unico, differenziato dalla configurazione.
- Aggiornamenti e bugfix propagati a tutti i deploy automaticamente.

---

## I Pack commerciali

Un **pack** è un raggruppamento commerciale di moduli. Oggi ci sono due pack:

| Pack | Moduli inclusi |
|---|---|
| **core** | core, requests, vendors, clients, articles, commesse, invoicing, budgets, tenders, inventory, analytics, chatbot, smartfill, email-intelligence |
| **defense** | (roadmap: compliance-specifica, gestione gare pubbliche avanzata, tracciamento CIG/CUP) |

Un deploy può attivare moduli **da più pack**. Il `primaryPack` è determinato dalla presenza di moduli defense.

---

## I moduli: chi c'è

### Sempre attivi (alwaysOn)

Formano la base del sistema — senza uno di questi, l'app non parte:

- **core** — utenti, ruoli, autenticazione, layout, notifiche
- **requests** — richieste d'acquisto (RDA), stati, workflow
- **vendors** — anagrafica fornitori, contatti
- **clients** — anagrafica clienti
- **articles** — anagrafica articoli, alias cross-vendor
- **commesse** — commesse cliente, margine, pipeline

### Opzionali

Attivabili per deploy:

- **invoicing** — fatture elettroniche SDI, riconciliazione three-way-match
- **tenders** — gare d'appalto, Go/No-Go, CIG/CUP
- **budgets** — plafond per centro di costo, controllo spesa
- **inventory** — magazzino, lotti, movimenti
- **analytics** — dashboard avanzata, trend spesa
- **chatbot** — assistente AI conversazionale
- **smartfill** — auto-compilazione AI per RDA
- **email-intelligence** — agente che processa email in arrivo da clienti/fornitori

---

## Come si configura un deploy

Due variabili d'ambiente:

```bash
# obbligatoria per deploy custom, opzionale per default
ENABLED_MODULES=core,requests,vendors,clients,articles,commesse,invoicing,tenders

# per customizzazioni customer-specific (Faleni, ...)
CUSTOMER_CODE=faleni
```

Se `ENABLED_MODULES` è vuota, vengono abilitati tutti i moduli del pack `core` (backward compat per deploy esistenti).

Il runtime valida al boot:
- Ogni modulo richiesto esiste nel registry.
- Ogni modulo ha le sue dipendenze attive (es. `invoicing` richiede `requests` e `vendors`).

Se la config è inconsistente, l'app **fallisce al boot** con messaggio chiaro. Meglio fallire subito che avere bug strani a runtime.

---

## Il layer `customers/`

Per customizzazioni customer-specifiche che non possono stare nel codice comune:

```
src/customers/
├── _shared/        # Pattern condivisi tra più customer
└── faleni/         # Codice isolato per Faleni
    ├── components/
    ├── workflows/
    └── ...
```

Regola: il core **non importa mai** da `customers/`. Il customer code importa dai moduli. Lo switch avviene tramite `CUSTOMER_CODE` env var + dynamic import.

---

## Due sistemi di gate: perché

Oggi convivono due meccanismi per controllare l'attivazione dei moduli:

### Pack gate (compile-time, env-based)

- Letto da `ENABLED_MODULES` al boot.
- Determina **cosa può esistere** in questo deploy.
- Non modificabile da utente finale.
- Utile per: "questo cliente ha comprato il pack `core + defense`".

### DB gate (runtime)

- Letto da `DeployConfig.enabled_modules` nel DB.
- Determina **cosa è attivo ora** in questo deploy.
- Modificabile da admin via `/admin/config`.
- Utile per: "spegni temporaneamente `analytics` perché sta bloccando il DB".

I due sono **layered**: una richiesta passa prima il pack gate (env), poi il DB gate. Se il pack gate dice no, non importa cosa dica il DB gate.

In futuro il DB gate potrebbe essere deprecato a favore di un sistema unificato. Oggi sono entrambi operativi per evitare breaking change sui deploy esistenti.

---

## Come ragionare sul sistema

Quando lavori a ProcureFlow, chiediti:

1. **A quale modulo appartiene questo codice?** Se non c'è un modulo ovvio, probabilmente va in `core` o va creato un nuovo modulo.
2. **Sto importando da un modulo?** Passa sempre per il barrel `@/modules/<pack>/<name>`, non da file interni.
3. **Questa API route va protetta?** Se sì, aggiungi `assertModuleEnabled('<name>')` in testa.
4. **Questo codice è specifico di un cliente?** Se sì, va in `src/customers/<cliente>/`, non nel core.
5. **Questo modulo va attivo sempre?** Se sì, `alwaysOn: true`. Se è opzionale, `alwaysOn: false`.

---

## Cosa NON è modular monolith

Per evitare ambiguità:

- **Non è micro-services**: un solo processo, un solo DB.
- **Non è multi-tenant**: ogni customer ha il suo deploy/DB separati.
- **Non è plug-in system dinamico**: i moduli sono compilati nel bundle, solo il gate è configurabile a deploy.
- **Non è DDD puro**: i moduli sono unità di deployment, non bounded context (anche se tendono a coincidere).

---

## Riferimenti

- Developer guide: `docs/internal/MODULE-SYSTEM.md`
- Come migrare un modulo esistente: `docs/internal/MODULE-MIGRATION-GUIDE.md`
- Esempio di modulo migrato: `src/modules/core/commesse/`
