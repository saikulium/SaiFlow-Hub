import { describe, it, expect } from 'vitest'

describe('EmailIntelligenceAgent', () => {
  it('exports processEmail function', async () => {
    const mod = await import('@/modules/core/email-intelligence')
    expect(typeof mod.processEmail).toBe('function')
  })
})
