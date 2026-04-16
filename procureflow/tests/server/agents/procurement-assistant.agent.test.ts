import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockPrisma = vi.hoisted(() => ({
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
  material: {
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  stockMovement: { count: vi.fn() },
  tender: {
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  approval: { create: vi.fn() },
  $transaction: vi.fn(),
}))

const mockStorePendingAction = vi.hoisted(() =>
  vi.fn().mockReturnValue('test-action-id'),
)

const mockBetaMessagesCreate = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/ai/pending-actions', () => ({
  storePendingAction: mockStorePendingAction,
}))

vi.mock('@/lib/ai/prompts', () => ({
  AGENT_SYSTEM_PROMPT: 'test-system-prompt',
  COMPANY_CONTEXT: 'test-context',
  SAFETY_GUARDRAILS: 'test-guardrails',
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

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  streamAssistantResponse,
  executeWriteTool,
} from '@/server/agents/procurement-assistant.agent'
import {
  getToolsForRole,
  isWriteTool,
  generateActionPreview,
  ALL_TOOLS,
} from '@/server/agents/tools/procurement.tools'
import type { AgentStreamEvent } from '@/types/ai'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function collectEvents(
  gen: AsyncGenerator<AgentStreamEvent>,
): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
}

// ---------------------------------------------------------------------------
// Tests: Module Exports
// ---------------------------------------------------------------------------

describe('procurement-assistant.agent module exports', () => {
  it('exports streamAssistantResponse as an async generator function', () => {
    expect(typeof streamAssistantResponse).toBe('function')
  })

  it('exports executeWriteTool as a function', () => {
    expect(typeof executeWriteTool).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Tests: Tool Registry
// ---------------------------------------------------------------------------

describe('procurement tools registry', () => {
  it('ALL_TOOLS contains all 34 tools', () => {
    expect(ALL_TOOLS).toHaveLength(34)
  })

  it('each tool has a name, description, and input_schema', () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.input_schema).toBeDefined()
    }
  })

  it('each tool has run and parse functions', () => {
    for (const tool of ALL_TOOLS) {
      expect(typeof tool.run).toBe('function')
      expect(typeof tool.parse).toBe('function')
    }
  })

  it('getToolsForRole returns only VIEWER tools for VIEWER role', () => {
    const tools = getToolsForRole('VIEWER')
    const names = tools.map((t) => t.name)
    expect(names).toContain('search_requests')
    expect(names).toContain('get_request_detail')
    expect(names).not.toContain('create_request')
    expect(names).not.toContain('approve_request')
  })

  it('getToolsForRole returns READ + REQUESTER tools for REQUESTER role', () => {
    const tools = getToolsForRole('REQUESTER')
    const names = tools.map((t) => t.name)
    expect(names).toContain('search_requests')
    expect(names).toContain('create_request')
    expect(names).not.toContain('approve_request')
  })

  it('getToolsForRole returns all tools for ADMIN role', () => {
    const tools = getToolsForRole('ADMIN')
    expect(tools).toHaveLength(ALL_TOOLS.length)
  })

  it('isWriteTool correctly identifies write tools', () => {
    expect(isWriteTool('create_request')).toBe(true)
    expect(isWriteTool('approve_request')).toBe(true)
    expect(isWriteTool('search_requests')).toBe(false)
    expect(isWriteTool('get_request_detail')).toBe(false)
    expect(isWriteTool('nonexistent_tool')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tests: Action Preview
// ---------------------------------------------------------------------------

describe('generateActionPreview', () => {
  it('generates preview for create_request', () => {
    const preview = generateActionPreview('create_request', {
      title: 'Ordine carta',
      priority: 'HIGH',
      items: [{ name: 'A4', quantity: 10 }],
    })
    expect(preview.label).toBe("Crea richiesta d'acquisto")
    expect(preview.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'Titolo', value: 'Ordine carta' }),
        expect.objectContaining({ key: 'Priorita', value: 'HIGH' }),
        expect.objectContaining({ key: 'Articoli', value: '1 articoli' }),
      ]),
    )
  })

  it('generates preview for approve_request', () => {
    const preview = generateActionPreview('approve_request', {
      request_id: 'req-123',
      notes: 'Approvato',
    })
    expect(preview.label).toBe('Approva richiesta')
    expect(preview.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'Richiesta', value: 'req-123' }),
        expect.objectContaining({ key: 'Note', value: 'Approvato' }),
      ]),
    )
  })

  it('returns generic preview for unknown tools', () => {
    const preview = generateActionPreview('unknown_tool', {})
    expect(preview.label).toBe('unknown_tool')
    expect(preview.fields).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Tests: Agent Loop — text only response
// ---------------------------------------------------------------------------

describe('streamAssistantResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('yields text and done for a simple text response', async () => {
    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Ciao, come posso aiutarti?' }],
      usage: { input_tokens: 10, output_tokens: 20 },
    })

    const events = await collectEvents(
      streamAssistantResponse('user-1', 'VIEWER', [
        { role: 'user', content: 'Ciao' },
      ]),
    )

    expect(events).toEqual([
      { type: 'text', content: 'Ciao, come posso aiutarti?' },
      { type: 'done' },
    ])
  })

  it('yields error event when API call fails', async () => {
    mockBetaMessagesCreate.mockRejectedValueOnce(new Error('API down'))

    const events = await collectEvents(
      streamAssistantResponse('user-1', 'VIEWER', [
        { role: 'user', content: 'Ciao' },
      ]),
    )

    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('error')
  })

  it('yields action_request for write tool and stops', async () => {
    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'Creo la richiesta per te.',
        },
        {
          type: 'tool_use',
          id: 'tu-1',
          name: 'create_request',
          input: { title: 'Test order' },
        },
      ],
      usage: { input_tokens: 50, output_tokens: 80 },
    })

    const events = await collectEvents(
      streamAssistantResponse('user-1', 'REQUESTER', [
        { role: 'user', content: 'Crea una richiesta per carta A4' },
      ]),
    )

    const types = events.map((e) => e.type)
    expect(types).toContain('text')
    expect(types).toContain('tool_start')
    expect(types).toContain('action_request')
    // Should NOT contain tool_end or done (stops after action_request)
    expect(types).not.toContain('done')

    const actionEvent = events.find((e) => e.type === 'action_request')
    expect(actionEvent).toMatchObject({
      type: 'action_request',
      actionId: 'test-action-id',
      tool: 'create_request',
    })
  })

  it('executes read tool and feeds result back for next round', async () => {
    // Round 1: model calls search_requests tool
    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          id: 'tu-1',
          name: 'search_requests',
          input: { status: 'APPROVED' },
        },
      ],
      usage: { input_tokens: 50, output_tokens: 30 },
    })

    // Mock the Prisma transaction for search_requests
    mockPrisma.$transaction.mockResolvedValueOnce([
      [{ code: 'PR-2025-00001', title: 'Test', status: 'APPROVED' }],
      1,
    ])

    // Round 2: model produces final text
    mockBetaMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Ho trovato 1 richiesta approvata.' }],
      usage: { input_tokens: 100, output_tokens: 30 },
    })

    const events = await collectEvents(
      streamAssistantResponse('user-1', 'VIEWER', [
        { role: 'user', content: 'Mostrami le richieste approvate' },
      ]),
    )

    const types = events.map((e) => e.type)
    expect(types).toContain('tool_start')
    expect(types).toContain('tool_end')
    expect(types).toContain('text')
    expect(types).toContain('done')

    // The API should have been called twice (2 rounds)
    expect(mockBetaMessagesCreate).toHaveBeenCalledTimes(2)
  })
})
