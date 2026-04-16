import { describe, it, expect } from 'vitest'
import { REQUEST_STATUS_TOOLS } from '@/server/agents/tools/request-status.tools'

describe('request-status.tools', () => {
  it('exports all 7 tools', () => {
    expect(REQUEST_STATUS_TOOLS).toHaveLength(7)
    const names = REQUEST_STATUS_TOOLS.map((t) => t.name)
    expect(names).toContain('cancel_request')
    expect(names).toContain('submit_for_approval')
    expect(names).toContain('reject_request')
    expect(names).toContain('put_request_on_hold')
    expect(names).toContain('resume_request')
    expect(names).toContain('mark_ordered')
    expect(names).toContain('mark_delivered')
  })

  it('all tools have a placeholder run returning error', async () => {
    for (const tool of REQUEST_STATUS_TOOLS) {
      const parsed = tool.parse({
        request_id: 'test',
        code: 'test',
        target_status: 'ORDERED',
        approval_id: 'test',
      })
      const result = await tool.run(parsed as never)
      const json = JSON.parse(
        typeof result === 'string' ? result : JSON.stringify(result),
      )
      expect(json.error).toBeDefined()
    }
  })
})
