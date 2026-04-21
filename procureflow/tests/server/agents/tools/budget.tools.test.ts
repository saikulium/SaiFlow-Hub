import { describe, it, expect } from 'vitest'
import { BUDGET_TOOLS } from '@/modules/core/budgets'

describe('budget.tools', () => {
  it('exports 1 tool', () => {
    expect(BUDGET_TOOLS).toHaveLength(1)
    expect(BUDGET_TOOLS[0]!.name).toBe('list_budgets')
  })
})
