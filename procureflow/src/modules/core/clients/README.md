# Clients Module

Gestisce l'anagrafica clienti (soggetti che ricevono i progetti/commesse).
Client + Vendor sono entità distinte: vendor = da chi compriamo,
client = a chi vendiamo/per chi facciamo la commessa.

## Pack

`core` — sempre disponibile.

## Dependencies

- `@/lib/db` — Prisma client
- `@/server/services/code-generator.service` — generazione codici atomic
- `@/types` — shared types (ClientListItem, ClientDetail)

## Public API

Import via `@/modules/core/clients`:

### Tools AI
- `searchClientsTool`, `findOrCreateClientTool`, `CLIENT_TOOLS`

### Validations (Zod)
- `createClientSchema`, `updateClientSchema`
- Types: `CreateClientInput`, `UpdateClientInput`

### Hooks
- `useClients`, `useClient`, `useCreateClient`, `useUpdateClient`,
  `useDeleteClient`

### Components
- `ClientsPageContent`, `ClientDialog`

## Consumers

- `src/app/api/clients/**` — REST routes (se presenti)
- `src/app/(dashboard)/clients/**` — pagina dashboard
- `src/server/agents/email-intelligence.agent.ts` — email agent AI
- `src/modules/core/commesse` — collega commesse ai clienti
