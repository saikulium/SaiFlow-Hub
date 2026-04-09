import { describe, it, expect } from 'vitest'

describe('EmailIntelligenceAgent', () => {
  it('exports processEmail function', async () => {
    const mod = await import('@/server/agents/email-intelligence.agent')
    expect(typeof mod.processEmail).toBe('function')
  })
})
