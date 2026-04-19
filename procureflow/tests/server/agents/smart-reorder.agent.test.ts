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

vi.mock('@/modules/core/inventory/constants/forecast', () => ({
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
// Helper: create async iterable from messages
// ---------------------------------------------------------------------------

function createMockRunner(
  messages: Array<{
    content: Array<{
      type: string
      text?: string
      name?: string
      id?: string
      input?: unknown
    }>
  }>,
) {
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

import {
  runReorderAgent,
  INVENTORY_TOOLS,
  type ReorderResult,
} from '@/modules/core/inventory'

// ---------------------------------------------------------------------------
// Tests: Module Exports
// ---------------------------------------------------------------------------

describe('smart-reorder.agent module exports', () => {
  it('exports runReorderAgent as a function', () => {
    expect(typeof runReorderAgent).toBe('function')
  })
})

describe('inventory tools registry', () => {
  it('INVENTORY_TOOLS contains 6 tools', () => {
    expect(INVENTORY_TOOLS).toHaveLength(6)
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
    mockToolRunner.mockReturnValueOnce(
      createMockRunner([
        {
          content: [
            {
              type: 'text',
              text: '{"drafts_created": 0, "alerts_processed": 0, "skipped_budget": 0, "summary": "Nessun alert attivo trovato."}',
            },
          ],
        },
      ]),
    )

    const result: ReorderResult = await runReorderAgent('user-1')

    expect(result.drafts_created).toBe(0)
    expect(result.alerts_processed).toBe(0)
    expect(result.skipped_budget).toBe(0)
    expect(result.summary).toBe('Nessun alert attivo trovato.')
  })

  it('returns error result when API call fails', async () => {
    mockToolRunner.mockImplementationOnce(() => {
      throw new Error('API down')
    })

    const result = await runReorderAgent('user-1')

    expect(result.drafts_created).toBe(0)
    expect(result.summary).toContain('Errore nella chiamata AI')
  })

  it('processes tool_use blocks from yielded messages', async () => {
    mockToolRunner.mockReturnValueOnce(
      createMockRunner([
        {
          content: [
            {
              type: 'tool_use',
              id: 'tu-1',
              name: 'get_active_alerts',
              input: {},
            },
          ],
        },
        {
          content: [
            {
              type: 'text',
              text: '{"drafts_created": 0, "alerts_processed": 0, "skipped_budget": 0, "summary": "Nessun alert da processare."}',
            },
          ],
        },
      ]),
    )

    const result = await runReorderAgent('user-1')

    expect(mockToolRunner).toHaveBeenCalledTimes(1)
    expect(result.summary).toBe('Nessun alert da processare.')
  })

  it('includes manager notification instruction when notifyManagerId is provided', async () => {
    mockToolRunner.mockReturnValueOnce(
      createMockRunner([
        {
          content: [
            {
              type: 'text',
              text: '{"drafts_created": 0, "alerts_processed": 0, "skipped_budget": 0, "summary": "Completato con notifica."}',
            },
          ],
        },
      ]),
    )

    await runReorderAgent('user-1', 'manager-1')

    const callArgs = mockToolRunner.mock.calls[0]![0]
    const userMessage = callArgs.messages[0]
    expect(userMessage.content).toContain('manager-1')
  })
})
