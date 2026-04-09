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

const mockBetaMessagesCreate = vi.hoisted(() => vi.fn())

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
        create: mockBetaMessagesCreate,
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

    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"alerts_found": 0, "notifications_sent": 0, "summary": "Nessun problema di compliance trovato."}',
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    })

    const result: ComplianceCheckResult =
      await runComplianceCheck('admin-user-1')

    expect(result.alerts_found).toBe(0)
    expect(result.notifications_sent).toBe(0)
    expect(result.summary).toBe('Nessun problema di compliance trovato.')
  })

  it('returns error result when API call fails', async () => {
    setupEmptyPrefetch()

    mockBetaMessagesCreate.mockRejectedValueOnce(new Error('API down'))

    const result = await runComplianceCheck('admin-user-1')

    expect(result.alerts_found).toBe(0)
    expect(result.summary).toContain('Errore nella chiamata AI')
  })

  it('executes tool calls and feeds results back', async () => {
    setupEmptyPrefetch()

    // Round 1: model calls get_budget_overview
    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tu-1',
          name: 'get_budget_overview',
          input: {},
        },
      ],
      usage: { input_tokens: 100, output_tokens: 30 },
    })

    // Mock prisma for get_budget_overview
    mockPrisma.budget.findMany.mockResolvedValueOnce([])

    // Round 2: model produces final text
    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"alerts_found": 0, "notifications_sent": 0, "summary": "Budget nella norma, nessun problema."}',
        },
      ],
      usage: { input_tokens: 150, output_tokens: 40 },
    })

    const result = await runComplianceCheck('admin-user-1')

    expect(mockBetaMessagesCreate).toHaveBeenCalledTimes(2)
    expect(result.summary).toBe('Budget nella norma, nessun problema.')
  })

  it('tracks notification count when create_notification is called', async () => {
    setupEmptyPrefetch()

    // Round 1: model calls create_notification
    mockBetaMessagesCreate.mockResolvedValueOnce({
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
      usage: { input_tokens: 100, output_tokens: 50 },
    })

    // Mock prisma for create_notification
    mockPrisma.notification.create.mockResolvedValueOnce({ id: 'notif-1' })

    // Round 2: final text
    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"alerts_found": 1, "notifications_sent": 1, "summary": "Trovato 1 ordine scaduto, notifica inviata."}',
        },
      ],
      usage: { input_tokens: 200, output_tokens: 50 },
    })

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

    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"alerts_found": 1, "notifications_sent": 0, "summary": "1 ordine scaduto trovato."}',
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    })

    await runComplianceCheck('admin-user-1')

    const callArgs = mockBetaMessagesCreate.mock.calls[0]![0]
    const userMessage = callArgs.messages[0]
    expect(userMessage.content).toContain('PR-2025-00001')
    expect(userMessage.content).toContain('Mario Rossi')
    expect(userMessage.content).toContain('Fornitore SRL')
  })
})
