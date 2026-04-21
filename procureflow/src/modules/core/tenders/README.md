# Modulo Tenders (Gare / Bandi)

**Pack**: core
**Always on**: false
**Dipendenze**: core, clients, vendors

## Scopo

Gestione gare e bandi pubblici/privati: discovery, analisi Go/No-Go,
preparazione offerta, partecipazione, esito, e transizione ad eventuale
contratto/commessa vinta.

## Entità Prisma coinvolte

- `Tender` (prisma/schema.prisma)
- `TenderDocument`
- `TenderTimelineEvent`
- `ContractingAuthority` (FK)

## Struttura interna

```
src/modules/core/tenders/
├── server/
│   ├── tenders.service.ts          # state machine, compute score, code generator, dashboard stats
│   ├── tender.tools.ts              # tool AI: create_tender, update_status, decide_go_nogo, save_analysis
│   ├── tender-analysis.agent.ts     # agente deep-reasoning con Opus + adaptive thinking
│   └── tender-analysis.schema.ts    # schema Zod output analisi
├── validations/
│   └── tenders.ts                   # schemi Zod create/update/query/status/go-no-go
├── hooks/
│   ├── use-tender.ts                # dettaglio + mutation update/status/go-no-go
│   └── use-tenders.ts               # list hook + createTender/deleteTender
├── components/
│   ├── tenders-page-content.tsx
│   ├── tender-detail-content.tsx
│   ├── tender-form-dialog.tsx
│   ├── tender-filters.tsx
│   ├── tender-status-badge.tsx
│   └── go-no-go-dialog.tsx
├── constants.ts                     # TENDER_STATUS_CONFIG, VALID_TRANSITIONS, labels, GO_NO_GO_CRITERIA
└── index.ts                         # export pubblico (barrel)
```

## API esposte

Le route API risiedono in `src/app/api/tenders/` (convenzione Next.js App Router)
e importano da questo modulo via `@/modules/core/tenders`:

- `GET/POST /api/tenders`
- `GET/PATCH/DELETE /api/tenders/[id]`
- `GET /api/tenders/stats`
- `PATCH /api/tenders/[id]/status`
- `POST /api/tenders/[id]/go-no-go`
- `POST /api/agents/tender-analysis`

Tutte le route applicano il doppio gate: `assertModuleEnabled('tenders')` (pack gate)
+ `requireModule('/api/tenders')` (DB toggle). Quando `ENABLED_MODULES` è unset,
il default backward-compat include `tenders` come modulo core.

## Tool AI esposti

`create_tender`, `get_tender_detail`, `update_tender_status`,
`decide_tender_go_nogo`, `save_tender_analysis` (array `TENDER_TOOLS`).
Usati dal procurement assistant e dall'agente di analisi.

## Agente dedicato

`analyzeTender(tenderId, pdfBuffer?, pdfFilename?)` — chiamata singola a Opus
con thinking mode per produrre `fit_score`, `recommendation` GO/NO-GO/CONDITIONAL,
reasoning, pros/cons, rischi, costo stimato. Output validato via
`TenderAnalysisSchema`.

## Regola d'oro

Chi importa dal modulo importa **sempre** dall'`index.ts`, mai dai file interni.
Le route API in `src/app/api/tenders/**` seguono anch'esse questa regola.

## Extension points per Defense Pack

- Analisi specifiche per bandi MOD/NATO (security clearance, ITAR, NCAGE).
- Integrazione con portali Consip / MePA / START Regione Toscana.
- Workflow offerta tecnica con capitolato vincoli Difesa.
