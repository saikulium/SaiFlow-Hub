import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  purchaseRequest: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
  approval: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  invoice: {
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  budget: { findMany: vi.fn() },
  vendor: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  notification: { create: vi.fn() },
  timelineEvent: { create: vi.fn() },
  stockMovement: { count: vi.fn() },
  material: {
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  tender: {
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  $transaction: vi.fn(),
}))

const mockToolRunner = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/ai/models', () => ({
  MODELS: {
    SONNET: 'claude-sonnet-4-6',
    OPUS: 'claude-opus-4-6',
    HAIKU: 'claude-haiku-4-5',
  },
}))

vi.mock('@/lib/ai/claude-client', () => ({
  getClaudeClient: () => ({
    beta: {
      messages: {
        toolRunner: mockToolRunner,
      },
    },
  }),
}))

vi.mock('@/lib/constants/agent', () => ({
  PENDING_ACTION_TTL_MS: 300_000,
}))

vi.mock('@/lib/ai/pending-actions', () => ({
  storePendingAction: vi.fn().mockReturnValue('test-action-id'),
}))

vi.mock('@/lib/ai/prompts', () => ({
  AGENT_SYSTEM_PROMPT: 'test-system-prompt',
  COMPANY_CONTEXT: 'test-context',
  SAFETY_GUARDRAILS: 'test-guardrails',
}))

// ---------------------------------------------------------------------------
// Helper: create async iterable from messages
// ---------------------------------------------------------------------------

function createMockRunner(messages: Array<{ content: Array<{ type: string; text?: string; name?: string; id?: string; input?: unknown }> }>) {
  const iterator = {
    [Symbol.asyncIterator]() {
      let index = 0
      return {
        async next() {
          if (index < messages.length) {
            return { value: messages[index++], done: false }
          }
          return { value: undefined, done: true }
        },
      }
    },
  }
  return iterator
}

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { runComplianceCheck } from '@/server/agents/compliance-monitor.agent'
import type { ComplianceCheckResult } from '@/server/agents/compliance-monitor.agent'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupEmptyPrefetch() {
  // overdue orders
  mockPrisma.purchaseRequest.findMany.mockResolvedValueOnce([])
  // stale approvals
  mockPrisma.approval.findMany.mockResolvedValueOnce([])
  // unreconciled invoices
  mockPrisma.invoice.findMany.mockResolvedValueOnce([])
}

// ---------------------------------------------------------------------------
// Tests: Module Exports
// ---------------------------------------------------------------------------

describe('compliance-monitor.agent module exports', () => {
  it('exports runComplianceCheck as a function', () => {
    expect(typeof runComplianceCheck).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Tests: Agent Loop
// ---------------------------------------------------------------------------

describe('runComplianceCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns result when agent completes without tool calls', async () => {
    setupEmptyPrefetch()

    mockToolRunner.mockReturnValueOnce(
      createMockRunner([
        {
          content: [
            {
              type: 'text',
              text: '{"alerts_found": 0, "notifications_sent": 0, "summary": "Nessun problema di compliance trovato."}',
            },
          ],
        },
      ]),
    )

    const result: ComplianceCheckResult =
      await runComplianceCheck('admin-user-1')

    expect(result.alerts_found).toBe(0)
    expect(result.notifications_sent).toBe(0)
    expect(result.summary).toBe('Nessun problema di compliance trovato.')
  })

  it('returns error result when API call fails', async () => {
    setupEmptyPrefetch()

    mockToolRunner.mockImplementationOnce(() => {
      throw new Error('API down')
    })

    const result = await runComplianceCheck('admin-user-1')

    expect(result.alerts_found).toBe(0)
    expect(result.summary).toContain('Errore nella chiamata AI')
  })

  it('processes tool_use blocks from yielded messages', async () => {
    setupEmptyPrefetch()

    mockToolRunner.mockReturnValueOnce(
      createMockRunner([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu-1',
              name: 'get_budget_overview',
              input: {},
            },
          ],
        },
        {
          content: [
            {
              type: 'text',
              text: '{"alerts_found": 0, "notifications_sent": 0, "summary": "Budget nella norma, nessun problema."}',
            },
          ],
        },
      ]),
    )

    const result = await runComplianceCheck('admin-user-1')

    expect(mockToolRunner).toHaveBeenCalledTimes(1)
    expect(result.summary).toBe('Budget nella norma, nessun problema.')
  })

  it('tracks notification count when create_notification is called', async () => {
    setupEmptyPrefetch()

    mockToolRunner.mockReturnValueOnce(
      createMockRunner([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu-1',
              name: 'create_notification',
              input: {
                user_id: 'user-1',
                title: 'Ordine scaduto',
                body: 'PR-2025-00001 e scaduto da 10 giorni',
                type: 'compliance_alert',
              },
            },
          ],
        },
        {
          content: [
            {
              type: 'text',
              text: '{"alerts_found": 1, "notifications_sent": 1, "summary": "Trovato 1 ordine scaduto, notifica inviata."}',
            },
          ],
        },
      ]),
    )

    const result = await runComplianceCheck('admin-user-1')

    expect(result.notifications_sent).toBe(1)
    expect(result.alerts_found).toBe(1)
  })

  it('includes pre-fetched overdue orders in context message', async () => {
    const pastDate = new Date('2025-12-01T00:00:00Z')
    mockPrisma.purchaseRequest.findMany.mockResolvedValueOnce([
      {
        id: 'pr-1',
        code: 'PR-2025-00001',
        title: 'Materiale urgente',
        status: 'ORDERED',
        expected_delivery: pastDate,
        requester_id: 'user-1',
        requester: { name: 'Mario Rossi' },
        vendor: { name: 'Fornitore SRL' },
      },
    ])
    // stale approvals
    mockPrisma.approval.findMany.mockResolvedValueOnce([])
    // unreconciled invoices
    mockPrisma.invoice.findMany.mockResolvedValueOnce([])

    mockToolRunner.mockReturnValueOnce(
      createMockRunner([
        {
          content: [
            {
              type: 'text',
              text: '{"alerts_found": 1, "notifications_sent": 0, "summary": "1 ordine scaduto trovato."}',
            },
          ],
        },
      ]),
    )

    await runComplianceCheck('admin-user-1')

    const callArgs = mockToolRunner.mock.calls[0]![0]
    const userMessage = callArgs.messages[0]
    expect(userMessage.content).toContain('PR-2025-00001')
    expect(userMessage.content).toContain('Mario Rossi')
    expect(userMessage.content).toContain('Fornitore SRL')
  })
})
