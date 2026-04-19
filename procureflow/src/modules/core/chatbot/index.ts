// ---------------------------------------------------------------------------
// Chatbot module — public API
//
// Procurement assistant AI conversazionale: streaming SSE, tool-use,
// WRITE-action confirm flow.
// ---------------------------------------------------------------------------

// Server — agent
export {
  streamAssistantResponse,
  executeWriteTool,
} from './server/procurement-assistant.agent'
export type { UserRole } from './server/procurement-assistant.agent'

// Server — pending-actions store (used by /api/chat/confirm)
export {
  storePendingAction,
  getPendingAction,
  removePendingAction,
} from './server/pending-actions'

// Components
export { ChatPanel } from './components/chat-panel'
export { ChatMessageBubble } from './components/chat-message'
export { ActionConfirmationDialog } from './components/action-confirmation'

// Hooks
export { useChat, getToolLabel } from './hooks/use-chat'
export type { ChatMessage, PendingActionState } from './hooks/use-chat'
