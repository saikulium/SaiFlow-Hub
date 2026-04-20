# Chatbot module

**Pack:** core · **alwaysOn:** false · **depends on:** core

AI conversazionale per il procurement: streaming SSE con Claude Sonnet, tool-use
(34+ tool dai moduli core), e flusso di conferma per le azioni WRITE.

## Public API

```ts
import {
  // Agent streaming
  streamAssistantResponse,
  executeWriteTool,
  // Pending-actions store (confirm flow)
  storePendingAction,
  getPendingAction,
  removePendingAction,
  // Components
  ChatPanel,
  ChatMessageBubble,
  ActionConfirmationDialog,
  // Hooks
  useChat,
  getToolLabel,
  // Types
  type UserRole,
  type ChatMessage,
  type PendingActionState,
} from '@/modules/core/chatbot'
```

## Scope

- Procurement assistant agent (server): streaming SSE, tool routing, WRITE
  intercept + pending-action queue.
- Chat UI: slide-out panel, message bubble, action confirmation dialog.
- Chat hook: stream consumption, pending-action state.

## Fuori scope

- `src/server/agents/tools/procurement.tools.ts` — aggregatore condiviso
  (importa dai barrel dei moduli). Rimane cross-cutting.
- `src/lib/ai/{claude-client,models,prompts}.ts` — infrastruttura AI condivisa
  (usata anche da compliance, onboarding, analytics insights).
- `src/app/api/chat/route.ts` e `src/app/api/chat/confirm/route.ts` — route
  Next.js che importano dal barrel.

## Dipendenze

- `@/lib/ai/{claude-client,models,prompts}` — shared AI infra.
- `@/server/agents/tools/procurement.tools` — aggregatore tool condiviso.
- `@/types/ai` — tipi SSE event e ActionPreview.
