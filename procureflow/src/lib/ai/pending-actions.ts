import { PENDING_ACTION_TTL_MS } from '@/lib/constants/agent'
import type { ActionPreview } from '@/types/ai'

// ---------------------------------------------------------------------------
// In-memory store for pending AI agent write actions
// ---------------------------------------------------------------------------

interface StoredAction {
  readonly tool: string
  readonly params: Record<string, unknown>
  readonly userId: string
  readonly preview: ActionPreview
  readonly expiresAt: number
}

const store = new Map<string, StoredAction>()

function cleanup(): void {
  const now = Date.now()
  store.forEach((action, id) => {
    if (action.expiresAt <= now) {
      store.delete(id)
    }
  })
}

export function storePendingAction(input: {
  readonly tool: string
  readonly params: Record<string, unknown>
  readonly userId: string
  readonly preview: ActionPreview
}): string {
  cleanup()
  const actionId = crypto.randomUUID()
  store.set(actionId, {
    ...input,
    expiresAt: Date.now() + PENDING_ACTION_TTL_MS,
  })
  return actionId
}

export function getPendingAction(
  actionId: string,
  userId: string,
): StoredAction | null {
  cleanup()
  const action = store.get(actionId)
  if (!action) return null
  if (action.userId !== userId) return null
  return action
}

export function removePendingAction(actionId: string): void {
  store.delete(actionId)
}
