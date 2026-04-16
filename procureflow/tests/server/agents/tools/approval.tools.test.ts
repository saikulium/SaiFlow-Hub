import { describe, it, expect } from 'vitest'
import { APPROVAL_TOOLS } from '@/server/agents/tools/approval.tools'

describe('approval.tools', () => {
  it('exports 3 tools', () => {
    expect(APPROVAL_TOOLS).toHaveLength(3)
    const names = APPROVAL_TOOLS.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'list_pending_approvals',
        'get_approval_detail',
        'decide_approval',
      ]),
    )
  })

  it('decide_approval run returns placeholder error', async () => {
    const tool = APPROVAL_TOOLS.find((t) => t.name === 'decide_approval')!
    const parsed = tool.parse({ approval_id: 'test', decision: 'APPROVED' })
    const result = await tool.run(parsed as never)
    const json = JSON.parse(
      typeof result === 'string' ? result : JSON.stringify(result),
    )
    expect(json.error).toBeDefined()
  })
})
