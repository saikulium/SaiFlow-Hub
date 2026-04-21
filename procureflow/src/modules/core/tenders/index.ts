// Export pubblico del modulo tenders (gare/bandi).
// Chi vuole usare il modulo importa DA QUI, non dai file interni.

// Services
export {
  validateStatusTransition,
  computeGoNoGoScore,
  generateTenderCode,
  isTerminalStatus,
  isPipelineStatus,
  getNextTenderCode,
  getTenderDashboardStats,
} from './server/tenders.service'

// Agent
export {
  analyzeTender,
  type TenderAnalysisResult,
} from './server/tender-analysis.agent'

// Tools AI
export {
  createTenderTool,
  getTenderDetailTool,
  updateTenderStatusTool,
  decideTenderGoNogoTool,
  saveTenderAnalysisTool,
  TENDER_TOOLS,
} from './server/tender.tools'

// Schema
export {
  TenderRiskSchema,
  TenderAnalysisSchema,
  type TenderRisk,
  type TenderAnalysis,
} from './server/tender-analysis.schema'

// Constants (state machine + UI labels)
export {
  TENDER_STATUS_CONFIG,
  TENDER_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  VALID_TRANSITIONS,
  GO_NO_GO_CRITERIA,
  TERMINAL_STATUSES,
  PIPELINE_STATUSES,
} from './constants'

// Validations
export {
  createTenderSchema,
  updateTenderSchema,
  tenderQuerySchema,
  goNoGoSchema,
  statusTransitionSchema,
  type CreateTenderInput,
  type UpdateTenderInput,
  type GoNoGoInput,
  type StatusTransitionInput,
} from './validations/tenders'

// Hooks
export {
  useTender,
  useUpdateTender,
  useUpdateTenderStatus,
  useGoNoGoDecision,
} from './hooks/use-tender'

export {
  useTenders,
  useCreateTender,
  useDeleteTender,
} from './hooks/use-tenders'

// Components
export { TendersPageContent } from './components/tenders-page-content'
export { TenderDetailContent } from './components/tender-detail-content'
export { TenderStatusBadge } from './components/tender-status-badge'
export { TenderFormDialog } from './components/tender-form-dialog'
export {
  TenderFiltersBar,
  type TenderFilters,
} from './components/tender-filters'
export { GoNoGoDialog } from './components/go-no-go-dialog'
