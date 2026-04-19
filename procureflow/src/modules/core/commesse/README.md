# Modulo Commesse

**Pack**: core
**Always on**: true
**Dipendenze**: core, clients, requests

## Scopo

Gestione commesse cliente: ordini ricevuti, collegamento a RDA fornitori,
calcolo margine, timeline eventi, stato del ciclo di vita.

## Entità Prisma coinvolte

- `Commessa` (prisma/schema.prisma)
- `CommessaTimelineEvent`
- `CommessaSuggestion`
- `PurchaseRequest.commessa_id` (FK opzionale)

## Struttura interna

```
src/modules/core/commesse/
├── server/
│   ├── commessa.service.ts     # computeMargin, getCommessaDetail, getCommessaDashboardStats, updateCommessaStatus
│   ├── commessa.tools.ts       # tool AI: search_commesse, create_commessa, update_commessa_status
│   └── state-machine.ts        # transizioni di stato valide
├── validations/
│   └── commesse.ts             # schemi Zod create/update
├── components/
│   ├── commesse-page-content.tsx
│   ├── commessa-create-dialog.tsx
│   ├── commessa-detail.tsx
│   └── suggestion-card.tsx
└── index.ts                    # export pubblico (barrel)
```

## API esposte

Le route API risiedono in `src/app/api/commesse/` (convenzione Next.js App Router)
e importano da questo modulo via `@/modules/core/commesse`:

- `GET/POST /api/commesse`
- `GET/PATCH /api/commesse/[code]`
- `GET /api/commesse/stats`
- `POST /api/commesse/[code]/accept-suggestion`
- `PATCH /api/commesse/[code]/suggestions/[id]`

## Tool AI esposti

`search_commesse`, `create_commessa`, `update_commessa_status` (array `COMMESSA_TOOLS`).
Usati da `email-intelligence.agent` e dal procurement assistant.

## Regola d'oro

Chi importa dal modulo importa **sempre** dall'`index.ts`, mai dai file interni.

Unica eccezione tollerata: le route API in `src/app/api/commesse/**` (che sono
logicamente parte del modulo ma fisicamente devono vivere nel file-system
routing di Next.js) possono importare dai file interni se serve — ma per
consistenza usano anch'esse il barrel `@/modules/core/commesse`.

## Extension points per Defense Pack

Nessuno attualmente. Future: collegamento `Offer → Commessa`, stati di produzione,
tracciabilità lotti.
