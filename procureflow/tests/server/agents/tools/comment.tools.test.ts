import { describe, it, expect } from 'vitest'
import { COMMENT_TOOLS } from '@/server/agents/tools/comment.tools'

describe('comment.tools', () => {
  it('exports 2 tools', () => {
    expect(COMMENT_TOOLS).toHaveLength(2)
    const names = COMMENT_TOOLS.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['add_comment', 'list_comments']),
    )
  })

  it('add_comment run returns placeholder error', async () => {
    const tool = COMMENT_TOOLS.find((t) => t.name === 'add_comment')!
    const parsed = tool.parse({
      request_id: 'test',
      content: 'Hello',
    })
    const result = await tool.run(parsed as never)
    const json = JSON.parse(
      typeof result === 'string' ? result : JSON.stringify(result),
    )
    expect(json.error).toBeDefined()
  })
})
