// Export pubblico del modulo commesse.
// Chi vuole usare il modulo importa DA QUI, non dai file interni.

// Services
export {
  computeMargin,
  getCommessaDetail,
  getCommessaDashboardStats,
  updateCommessaStatus,
  CommessaTransitionError,
} from './server/commessa.service'

// Tools AI
export {
  searchCommesseTool,
  createCommessaTool,
  updateCommessaStatusTool,
  COMMESSA_TOOLS,
} from './server/commessa.tools'

// State machine
export {
  VALID_COMMESSA_TRANSITIONS,
  canCommessaTransition,
  assertCommessaTransition,
} from './server/state-machine'

// Validations
export {
  createCommessaSchema,
  updateCommessaSchema,
  type CreateCommessaInput,
  type UpdateCommessaInput,
} from './validations/commesse'

// Components
export { CommessePageContent } from './components/commesse-page-content'
export { CommessaCreateDialog } from './components/commessa-create-dialog'
export { CommessaDetail } from './components/commessa-detail'
export { SuggestionCard } from './components/suggestion-card'
