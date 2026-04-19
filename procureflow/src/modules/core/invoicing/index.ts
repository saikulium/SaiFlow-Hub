// ============================================================================
// Invoicing Module — Public API
//
// Gestisce fatture elettroniche SDI: ingestione, parsing AI, matching con
// ordini, riconciliazione three-way (ordinato/ricevuto/fatturato).
// ============================================================================

// --- Server: Services ---
export {
  matchInvoiceToOrder,
  type MatchResult,
} from './server/invoice-matching.service'

export {
  performThreeWayMatch,
  type ThreeWayMatchResult,
  type Discrepancy,
} from './server/three-way-matching.service'

export {
  parseInvoiceWithAI,
  mapAiResponseToInvoice,
  AiParseError,
  type AiParseResult,
  type AiMediaType,
} from './server/invoice-ai-parser.service'

// --- Server: Agents ---
export {
  reconcileInvoice,
  type ReconciliationResult,
  type ReconciliationDiscrepancy,
} from './server/invoice-reconciliation.agent'

// --- Server: Tools ---
export {
  INVOICE_TOOLS,
  getInvoiceDetailTool,
  getOrderForInvoiceTool,
  getVendorPriceHistoryTool,
  updateReconciliationStatusTool,
  disputeInvoiceTool,
  performThreeWayMatchTool,
} from './server/invoice.tools'

// --- Validations ---
export {
  sdiInvoiceWebhookSchema,
  type SdiInvoiceWebhookPayload,
} from './validations/sdi-invoice'

// --- Schemas ---
export {
  InvoiceExtractionSchema,
  type InvoiceExtraction,
} from './schemas/invoice-extraction.schema'

// --- Constants ---
export {
  SDI_CONFIG,
  MATCHING_THRESHOLDS,
  RECONCILIATION_THRESHOLDS,
  INVOICE_MATCH_STATUS_CONFIG,
  RECONCILIATION_STATUS_CONFIG,
} from './constants/sdi'

export { evaluateDiscrepancy } from './constants/reconciliation-thresholds'

// --- Hooks ---
export {
  useInvoice,
  useUploadInvoice,
  useMatchInvoice,
  useUnmatchInvoice,
  useReconcileInvoice,
  type InvoiceDetail,
  type InvoiceLineItemDetail,
} from './hooks/use-invoice'

export {
  useInvoices,
  type InvoicesParams,
  type InvoiceListItem,
} from './hooks/use-invoices'

export { useInvoiceBadgeCount } from './hooks/use-invoice-stats'

// --- Components ---
export { InvoicesPageContent } from './components/invoices-page-content'
export { InvoiceDetailContent } from './components/invoice-detail-content'
export { InvoicesTable } from './components/invoices-table'
export {
  InvoiceFiltersBar,
  type InvoiceFilters,
} from './components/invoice-filters'
export { InvoiceStatusBadge } from './components/invoice-status-badge'
export { ReconciliationDialog } from './components/reconciliation-dialog'
export { MatchDialog } from './components/match-dialog'
