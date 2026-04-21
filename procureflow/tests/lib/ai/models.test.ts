import { describe, it, expect } from 'vitest'
import { MODELS, getModelForTask } from '@/lib/ai/models'

describe('models', () => {
  it('exports valid model IDs', () => {
    expect(MODELS.SONNET).toBe('claude-sonnet-4-6')
    expect(MODELS.OPUS).toBe('claude-opus-4-6')
    expect(MODELS.HAIKU).toBe('claude-haiku-4-5')
  })

  it('returns correct model for task type', () => {
    expect(getModelForTask('classification')).toBe('claude-sonnet-4-6')
    expect(getModelForTask('reasoning')).toBe('claude-opus-4-6')
    expect(getModelForTask('simple')).toBe('claude-haiku-4-5')
  })
})
