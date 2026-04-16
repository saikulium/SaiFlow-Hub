import { describe, it, expect } from 'vitest'
import { STOCK_TOOLS } from '@/server/agents/tools/stock.tools'

describe('stock.tools', () => {
  it('exports 2 tools', () => {
    expect(STOCK_TOOLS).toHaveLength(2)
    const names = STOCK_TOOLS.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'get_stock_for_article',
        'get_pending_orders_for_material',
      ]),
    )
  })
})
