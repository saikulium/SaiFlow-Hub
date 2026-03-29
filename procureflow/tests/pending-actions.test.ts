import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('pending-actions', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('storePendingAction stores and getPendingAction retrieves', async () => {
    const { storePendingAction, getPendingAction } = await import('@/lib/ai/pending-actions')
    const actionId = storePendingAction({
      tool: 'create_request',
      params: { title: 'Test' },
      userId: 'user1',
      preview: { label: 'Crea richiesta', fields: [] },
    })

    const action = getPendingAction(actionId, 'user1')
    expect(action).toBeTruthy()
    expect(action!.tool).toBe('create_request')
  })

  it('getPendingAction returns null for wrong userId', async () => {
    const { storePendingAction, getPendingAction } = await import('@/lib/ai/pending-actions')
    const actionId = storePendingAction({
      tool: 'create_request',
      params: {},
      userId: 'user1',
      preview: { label: 'Test', fields: [] },
    })

    const action = getPendingAction(actionId, 'user2')
    expect(action).toBeNull()
  })

  it('removePendingAction removes the action', async () => {
    const { storePendingAction, getPendingAction, removePendingAction } = await import(
      '@/lib/ai/pending-actions'
    )
    const actionId = storePendingAction({
      tool: 'create_request',
      params: {},
      userId: 'user1',
      preview: { label: 'Test', fields: [] },
    })

    removePendingAction(actionId)
    expect(getPendingAction(actionId, 'user1')).toBeNull()
  })

  it('expired actions are cleaned up on access', async () => {
    vi.useFakeTimers()
    const { storePendingAction, getPendingAction } = await import('@/lib/ai/pending-actions')

    const actionId = storePendingAction({
      tool: 'create_request',
      params: {},
      userId: 'user1',
      preview: { label: 'Test', fields: [] },
    })

    // Advance time beyond TTL (5 minutes)
    vi.advanceTimersByTime(6 * 60 * 1000)

    expect(getPendingAction(actionId, 'user1')).toBeNull()
    vi.useRealTimers()
  })
})
