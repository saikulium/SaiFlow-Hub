import { describe, it, expect } from 'vitest'
import { TENDER_TOOLS } from '@/modules/core/tenders'

describe('tender.tools', () => {
  it('exports 5 tools', () => {
    expect(TENDER_TOOLS).toHaveLength(5)
    const names = TENDER_TOOLS.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'create_tender',
        'get_tender_detail',
        'update_tender_status',
        'decide_tender_go_nogo',
        'save_tender_analysis',
      ]),
    )
  })

  it('intercepted tools have placeholder run', async () => {
    const intercepted = ['update_tender_status', 'decide_tender_go_nogo']
    for (const name of intercepted) {
      const tool = TENDER_TOOLS.find((t) => t.name === name)!
      const parsed = tool.parse({
        tender_id: 'test',
        new_status: 'EVALUATING',
        decision: 'GO',
      } as never)
      const result = await tool.run(parsed as never)
      const json = JSON.parse(
        typeof result === 'string' ? result : JSON.stringify(result),
      )
      expect(json.error).toBeDefined()
    }
  })
})
