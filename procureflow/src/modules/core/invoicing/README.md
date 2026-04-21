# Invoicing Module

Gestisce il ciclo fatture elettroniche SDI: ricezione webhook, parsing AI dei PDF, matching con gli ordini, riconciliazione three-way (Ordinato / Ricevuto / Fatturato).

## Boundary

Questo modulo possiede il dominio "fattura" end-to-end:
- Ingestione fatture da SDI via webhook (`api/webhooks/sdi-invoice`)
- Parsing AI di PDF con Claude Vision (`parseInvoiceWithAI`)
- Matching con PurchaseRequest (`matchInvoiceToOrder`)
- Three-way matching (`performThreeWayMatch`) con soglie configurabili
- Agent di riconciliazione (`reconcileInvoice`) con tool set dedicati
- UI lista/dettaglio fatture, riconciliazione, match manuale

## Public API

Importa **sempre** dal barrel:

```ts
import {
  // Services
  matchInvoiceToOrder,
  performThreeWayMatch,
  parseInvoiceWithAI,
  // Agent
  reconcileInvoice,
  // Tools
  INVOICE_TOOLS,
  // Validations / schemas
  sdiInvoiceWebhookSchema,
  InvoiceExtractionSchema,
  // Constants
  SDI_CONFIG,
  MATCHING_THRESHOLDS,
  evaluateDiscrepancy,
  INVOICE_MATCH_STATUS_CONFIG,
  RECONCILIATION_STATUS_CONFIG,
  // Hooks
  useInvoice,
  useInvoices,
  useInvoiceBadgeCount,
  useMatchInvoice,
  useUnmatchInvoice,
  useReconcileInvoice,
  useUploadInvoice,
  // Components
  InvoicesPageContent,
  InvoiceDetailContent,
  InvoiceStatusBadge,
  InvoiceFiltersBar,
  InvoicesTable,
  ReconciliationDialog,
  MatchDialog,
} from '@/modules/core/invoicing'
```

## Dependencies

- `@/lib/db` — Prisma client
- `@/lib/ai/*` — Claude client + models
- `@/lib/state-machine` — transizioni stato PR (per three-way match)
- `@/types/fatturapa` — tipi FatturaPA
- `@/server/agents/tools/procurement.tools` — type `ZodTool` condiviso
- `@/server/agents/tools/notification.tools` — tool notifica (usato dall'agent)

## Not in Scope

- **Dashboard charts** (`invoice-aging-chart`, `invoice-stats-row`, `ordered-vs-invoiced-chart`) restano in `src/components/dashboard/` perché appartengono alla composizione della dashboard, non all'API del modulo.
- **Three-way match state transitions** condividono la state-machine globale (shared invariant, non dominio invoicing).
