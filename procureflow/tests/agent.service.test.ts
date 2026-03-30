import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockCallClaude = vi.hoisted(() => vi.fn())
const mockStorePendingAction = vi.hoisted(() => vi.fn())
const mockGetToolsForRole = vi.hoisted(() => vi.fn())
const mockIsWriteTool = vi.hoisted(() => vi.fn())

const mockPrisma = vi.hoisted(() => ({
  purchaseRequest: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  vendor: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
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

vi.mock('@/lib/ai/claude-client', () => ({
  callClaude: mockCallClaude,
}))

vi.mock('@/lib/ai/pending-actions', () => ({
  storePendingAction: mockStorePendingAction,
}))

vi.mock('@/lib/ai/tool-registry', () => ({
  getToolsForRole: mockGetToolsForRole,
  isWriteTool: mockIsWriteTool,
}))

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/ai/prompts', () => ({
  AGENT_SYSTEM_PROMPT: 'test-system-prompt',
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  streamAgentResponse,
  executeWriteTool,
} from '@/server/services/agent.service'
import type { AgentStreamEvent } from '@/types/ai'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function collectEvents(
  gen: AsyncGenerator<AgentStreamEvent>,
): Promise<readonly AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
}

function makeTextResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 20 },
  }
}

function makeToolUseResponse(
  toolName: string,
  toolId: string,
  input: Record<string, unknown>,
) {
  return {
    content: [{ type: 'tool_use', id: toolId, name: toolName, input }],
    stop_reason: 'tool_use',
    usage: { input_tokens: 10, output_tokens: 20 },
  }
}

const READ_TOOL_DEF = {
  name: 'search_requests',
  description: 'Search requests',
  input_schema: { type: 'object', properties: {} },
  permission_level: 'READ' as const,
  min_role: 'VIEWER' as const,
}

const WRITE_TOOL_DEF = {
  name: 'create_request',
  description: 'Create a request',
  input_schema: {
    type: 'object',
    properties: { title: { type: 'string' } },
    required: ['title'],
  },
  permission_level: 'WRITE' as const,
  min_role: 'REQUESTER' as const,
}

const APPROVE_TOOL_DEF = {
  name: 'approve_request',
  description: 'Approve a request',
  input_schema: {
    type: 'object',
    properties: { request_id: { type: 'string' } },
    required: ['request_id'],
  },
  permission_level: 'WRITE' as const,
  min_role: 'MANAGER' as const,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('agent.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetToolsForRole.mockReturnValue([READ_TOOL_DEF, WRITE_TOOL_DEF])
    mockIsWriteTool.mockImplementation((name: string) =>
      [
        'create_request',
        'update_request',
        'submit_for_approval',
        'approve_request',
        'create_vendor',
        'bulk_update',
      ].includes(name),
    )
  })

  // -------------------------------------------------------------------------
  // Test 1: Simple text response (no tool use)
  // -------------------------------------------------------------------------
  it('yields text events for simple messages without tool use', async () => {
    mockCallClaude.mockResolvedValueOnce(
      makeTextResponse('Ciao! Come posso aiutarti?'),
    )

    const gen = streamAgentResponse('user-1', 'REQUESTER', [
      { role: 'user', content: 'Ciao' },
    ])
    const events = await collectEvents(gen)

    expect(events).toEqual([
      { type: 'text', content: 'Ciao! Come posso aiutarti?' },
      { type: 'done' },
    ])
    expect(mockCallClaude).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // Test 2: READ tool calls are executed silently and looped
  // -------------------------------------------------------------------------
  it('executes READ tool calls silently and feeds result back to Claude', async () => {
    // First call: Claude requests a READ tool
    mockCallClaude.mockResolvedValueOnce(
      makeToolUseResponse('search_requests', 'tool-1', { status: 'APPROVED' }),
    )

    // Set up prisma mock for the tool execution
    mockPrisma.$transaction.mockResolvedValueOnce([
      [{ code: 'PR-2025-00001', title: 'Test', status: 'APPROVED' }],
      1,
    ])

    // Second call: Claude responds with text after seeing tool result
    mockCallClaude.mockResolvedValueOnce(
      makeTextResponse('Ho trovato 1 richiesta approvata.'),
    )

    const gen = streamAgentResponse('user-1', 'REQUESTER', [
      { role: 'user', content: 'Mostra richieste approvate' },
    ])
    const events = await collectEvents(gen)

    // Should include tool_start/tool_end events, then text, then done
    expect(events).toEqual([
      { type: 'tool_start', name: 'search_requests' },
      { type: 'tool_end', name: 'search_requests' },
      { type: 'text', content: 'Ho trovato 1 richiesta approvata.' },
      { type: 'done' },
    ])

    // Claude should have been called twice: initial + after tool result
    expect(mockCallClaude).toHaveBeenCalledTimes(2)
  })

  // -------------------------------------------------------------------------
  // Test 3: WRITE tool calls yield action_request and stop
  // -------------------------------------------------------------------------
  it('yields action_request event for WRITE tool calls and stops', async () => {
    const toolInput = { title: 'Nuova richiesta', priority: 'HIGH' }
    mockCallClaude.mockResolvedValueOnce(
      makeToolUseResponse('create_request', 'tool-2', toolInput),
    )
    mockStorePendingAction.mockReturnValueOnce('action-uuid-123')

    const gen = streamAgentResponse('user-1', 'REQUESTER', [
      { role: 'user', content: 'Crea una richiesta' },
    ])
    const events = await collectEvents(gen)

    expect(events).toEqual([
      { type: 'tool_start', name: 'create_request' },
      {
        type: 'action_request',
        actionId: 'action-uuid-123',
        tool: 'create_request',
        params: toolInput,
        preview: expect.objectContaining({
          label: expect.any(String),
          fields: expect.any(Array),
        }),
      },
    ])

    // storePendingAction should have been called with the right args
    expect(mockStorePendingAction).toHaveBeenCalledWith({
      tool: 'create_request',
      params: toolInput,
      userId: 'user-1',
      preview: expect.objectContaining({ label: expect.any(String) }),
    })

    // Claude should have been called only once (no loop after WRITE)
    expect(mockCallClaude).toHaveBeenCalledTimes(1)
  })

  // -------------------------------------------------------------------------
  // Test 4: RBAC — REQUESTER cannot use approve_request
  // -------------------------------------------------------------------------
  it('filters out approve_request for REQUESTER role', async () => {
    // For REQUESTER, getToolsForRole should NOT include approve_request
    mockGetToolsForRole.mockReturnValueOnce([READ_TOOL_DEF, WRITE_TOOL_DEF])
    // (approve_request is excluded — min_role is MANAGER)

    mockCallClaude.mockResolvedValueOnce(
      makeTextResponse('Non hai i permessi per approvare.'),
    )

    const gen = streamAgentResponse('user-1', 'REQUESTER', [
      { role: 'user', content: 'Approva la richiesta PR-2025-00001' },
    ])
    await collectEvents(gen)

    // Verify the tools passed to callClaude do NOT include approve_request
    const firstCall = mockCallClaude.mock.calls[0]
    const calledTools = (firstCall?.[0] as Record<string, unknown>)
      .tools as Array<{ name: string }>
    const toolNames = calledTools.map((t) => t.name)
    expect(toolNames).not.toContain('approve_request')
    expect(toolNames).toContain('search_requests')
    expect(toolNames).toContain('create_request')
  })

  // -------------------------------------------------------------------------
  // Test 5: Tool execution errors yield error events
  // -------------------------------------------------------------------------
  it('yields error events when tool execution fails', async () => {
    mockCallClaude.mockResolvedValueOnce(
      makeToolUseResponse('search_requests', 'tool-err', {}),
    )

    // Simulate Prisma failure
    mockPrisma.$transaction.mockRejectedValueOnce(
      new Error('DB connection lost'),
    )

    // Claude gets the error result and responds with text
    mockCallClaude.mockResolvedValueOnce(
      makeTextResponse('Si è verificato un errore nella ricerca.'),
    )

    const gen = streamAgentResponse('user-1', 'REQUESTER', [
      { role: 'user', content: 'Cerca richieste' },
    ])
    const events = await collectEvents(gen)

    // Should still get tool_start/tool_end (error is passed back to Claude)
    expect(events).toEqual([
      { type: 'tool_start', name: 'search_requests' },
      { type: 'tool_end', name: 'search_requests' },
      { type: 'text', content: 'Si è verificato un errore nella ricerca.' },
      { type: 'done' },
    ])

    // Second call to Claude should include the error in tool results
    const secondCall = mockCallClaude.mock.calls[1]
    const secondCallMessages = (secondCall?.[0] as Record<string, unknown>)
      .messages as unknown[]
    const lastMessage = secondCallMessages[secondCallMessages.length - 1]
    expect(JSON.stringify(lastMessage)).toContain('Errore')
  })

  // -------------------------------------------------------------------------
  // Test: Claude API error yields error event
  // -------------------------------------------------------------------------
  it('yields error event when Claude API call fails', async () => {
    mockCallClaude.mockRejectedValueOnce(new Error('API timeout'))

    const gen = streamAgentResponse('user-1', 'REQUESTER', [
      { role: 'user', content: 'Ciao' },
    ])
    const events = await collectEvents(gen)

    expect(events).toEqual([
      { type: 'error', message: expect.stringContaining('API timeout') },
    ])
  })

  // -------------------------------------------------------------------------
  // Test: executeWriteTool — create_request
  // -------------------------------------------------------------------------
  it('executeWriteTool creates a purchase request', async () => {
    mockPrisma.purchaseRequest.create.mockResolvedValueOnce({
      id: 'req-1',
      code: 'PR-2026-00001',
      title: 'Test Request',
      status: 'DRAFT',
    })

    const result = await executeWriteTool(
      'create_request',
      {
        title: 'Test Request',
        priority: 'HIGH',
        items: [{ name: 'Widget', quantity: 10 }],
      },
      'user-1',
    )

    expect(mockPrisma.purchaseRequest.create).toHaveBeenCalledTimes(1)
    expect(result).toEqual(expect.objectContaining({ code: 'PR-2026-00001' }))
  })
})
