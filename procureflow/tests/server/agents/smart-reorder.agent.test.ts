import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
  materialAlert: {
    findMany: vi.fn(),
  },
  material: {
    findUnique: vi.fn(),
  },
  requestItem: {
    findMany: vi.fn(),
  },
  purchaseRequest: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  vendor: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  budget: { findMany: vi.fn() },
  invoice: {
    count: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  stockLot: {
    aggregate: vi.fn(),
  },
  stockMovement: { count: vi.fn() },
  tender: {
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  approval: { create: vi.fn() },
  notification: { create: vi.fn() },
  timelineEvent: { create: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
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

vi.mock('@/lib/constants/forecast', () => ({
  WMA_WEIGHTS: [3, 2, 1],
  WMA_MONTHS: 3,
  FORECAST_MONTHS_AHEAD: 3,
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

import { runReorderAgent } from '@/server/agents/smart-reorder.agent'
import type { ReorderResult } from '@/server/agents/smart-reorder.agent'
import { INVENTORY_TOOLS } from '@/server/agents/tools/inventory.tools'

// ---------------------------------------------------------------------------
// Tests: Module Exports
// ---------------------------------------------------------------------------

describe('smart-reorder.agent module exports', () => {
  it('exports runReorderAgent as a function', () => {
    expect(typeof runReorderAgent).toBe('function')
  })
})

describe('inventory tools registry', () => {
  it('INVENTORY_TOOLS contains 3 tools', () => {
    expect(INVENTORY_TOOLS).toHaveLength(3)
  })

  it('each tool has a name, description, and input_schema', () => {
    for (const tool of INVENTORY_TOOLS) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.input_schema).toBeDefined()
    }
  })

  it('each tool has run and parse functions', () => {
    for (const tool of INVENTORY_TOOLS) {
      expect(typeof tool.run).toBe('function')
      expect(typeof tool.parse).toBe('function')
    }
  })

  it('contains expected tool names', () => {
    const names = INVENTORY_TOOLS.map((t) => t.name)
    expect(names).toContain('get_active_alerts')
    expect(names).toContain('get_material_forecast')
    expect(names).toContain('get_material_price_history')
  })
})

// ---------------------------------------------------------------------------
// Tests: Agent Loop
// ---------------------------------------------------------------------------

describe('runReorderAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns result when agent completes without tool calls', async () => {
    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"drafts_created": 0, "alerts_processed": 0, "skipped_budget": 0, "summary": "Nessun alert attivo trovato."}',
        },
      ],
      usage: { input_tokens: 50, output_tokens: 80 },
    })

    const result: ReorderResult = await runReorderAgent('user-1')

    expect(result.drafts_created).toBe(0)
    expect(result.alerts_processed).toBe(0)
    expect(result.skipped_budget).toBe(0)
    expect(result.summary).toBe('Nessun alert attivo trovato.')
  })

  it('returns error result when API call fails', async () => {
    mockBetaMessagesCreate.mockRejectedValueOnce(new Error('API down'))

    const result = await runReorderAgent('user-1')

    expect(result.drafts_created).toBe(0)
    expect(result.summary).toContain('Errore nella chiamata AI')
  })

  it('executes tool calls and feeds results back', async () => {
    // Round 1: model calls get_active_alerts
    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tu-1',
          name: 'get_active_alerts',
          input: {},
        },
      ],
      usage: { input_tokens: 50, output_tokens: 30 },
    })

    // Mock prisma for get_active_alerts
    mockPrisma.materialAlert.findMany.mockResolvedValueOnce([])

    // Round 2: model produces final text
    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"drafts_created": 0, "alerts_processed": 0, "skipped_budget": 0, "summary": "Nessun alert da processare."}',
        },
      ],
      usage: { input_tokens: 100, output_tokens: 30 },
    })

    const result = await runReorderAgent('user-1')

    expect(mockBetaMessagesCreate).toHaveBeenCalledTimes(2)
    expect(result.summary).toBe('Nessun alert da processare.')
  })

  it('includes manager notification instruction when notifyManagerId is provided', async () => {
    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"drafts_created": 0, "alerts_processed": 0, "skipped_budget": 0, "summary": "Completato con notifica."}',
        },
      ],
      usage: { input_tokens: 50, output_tokens: 80 },
    })

    await runReorderAgent('user-1', 'manager-1')

    const callArgs = mockBetaMessagesCreate.mock.calls[0]![0]
    const userMessage = callArgs.messages[0]
    expect(userMessage.content).toContain('manager-1')
  })
})
