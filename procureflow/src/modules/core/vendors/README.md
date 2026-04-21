# Vendors Module

Gestisce fornitori (da chi compriamo): anagrafica, contatti, portali, rating,
stati ACTIVE/INACTIVE/BLACKLISTED e invio ordini al fornitore (email/PDF).

## Pack

`core` — sempre disponibile.

## Dependencies

- `@/lib/db` — Prisma client
- `@/lib/state-machine` — transizioni ordine → vendor
- `@/server/services/code-generator.service` — generazione codici atomic

## Public API

Import via `@/modules/core/vendors`:

### Services
- `sendOrderToVendor` — invio ordine al fornitore

### Tools AI
- `findOrCreateVendorTool`, `updateVendorTool`, `VENDOR_TOOLS`

### Validations (Zod)
- `createVendorSchema`, `updateVendorSchema`, `quickCreateVendorSchema`
- Types: `CreateVendorInput`, `UpdateVendorInput`, `QuickCreateVendorInput`

### Hooks
- `useVendors`, `useVendor`, `useCreateVendor`, `useUpdateVendor`
- Types: `VendorListItem`, `VendorDetail`, `VendorContact`, `VendorRequest`,
  `VendorListParams`

### Components
- `VendorsPageContent`, `VendorDetailContent`, `VendorCard`
- `VendorCreateDialog`, `VendorEditDialog`

## Consumers

- `src/app/api/vendors/**` — REST routes
- `src/app/(dashboard)/vendors/**` — pagine dashboard
- `src/server/agents/tools/procurement.tools.ts` — aggregator
- `src/server/agents/email-intelligence.agent.ts` — email agent AI
