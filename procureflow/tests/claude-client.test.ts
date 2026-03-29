import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockCreate } }
  }),
}))

describe('claude-client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports getClaudeClient that returns a singleton', async () => {
    const { getClaudeClient } = await import('@/lib/ai/claude-client')
    const a = getClaudeClient()
    const b = getClaudeClient()
    expect(a).toBe(b)
  })

  it('callClaude sends messages and returns response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })

    const { callClaude } = await import('@/lib/ai/claude-client')
    const result = await callClaude({
      system: 'You are helpful',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 1024,
    })

    expect(result.content).toEqual([{ type: 'text', text: 'Hello' }])
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('callClaude retries on transient errors', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('overloaded'))
      .mockResolvedValue({
        content: [{ type: 'text', text: 'OK' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      })

    const { callClaude } = await import('@/lib/ai/claude-client')
    const result = await callClaude({
      system: 'test',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 1024,
    })

    expect(result.content[0]).toEqual({ type: 'text', text: 'OK' })
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })
})
