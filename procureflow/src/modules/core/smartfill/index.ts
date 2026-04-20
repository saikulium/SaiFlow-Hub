// ---------------------------------------------------------------------------
// SmartFill module — public API
//
// Auto-compilazione dei campi di una RDA partendo dal titolo:
// 1. Match storico su PR completate simili (zero-cost DB lookup)
// 2. Fallback Claude single-shot JSON (solo se nessun match DB)
// ---------------------------------------------------------------------------

// Server
export { getSuggestions } from './server/suggest.service'
export type {
  RequestSuggestion,
  SuggestedItem,
} from './server/suggest.service'

// Validations
export { suggestRequestSchema } from './validations/suggest'
export type { SuggestRequestInput } from './validations/suggest'

// Hooks
export { useRequestSuggestions } from './hooks/use-request-suggestions'

// Components
export { SuggestionPanel } from './components/suggestion-panel'
