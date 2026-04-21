import { describe, it, expect } from 'vitest'
import { ATTACHMENT_TOOLS } from '@/server/agents/tools/attachment.tools'

describe('attachment.tools', () => {
  it('exports 2 tools', () => {
    expect(ATTACHMENT_TOOLS).toHaveLength(2)
    const names = ATTACHMENT_TOOLS.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['add_attachment', 'list_attachments']),
    )
  })

  it('add_attachment run returns placeholder error', async () => {
    const tool = ATTACHMENT_TOOLS.find((t) => t.name === 'add_attachment')!
    const parsed = tool.parse({
      request_id: 'test',
      filename: 'test.pdf',
      file_url: 'https://example.com/test.pdf',
    })
    const result = await tool.run(parsed as never)
    const json = JSON.parse(
      typeof result === 'string' ? result : JSON.stringify(result),
    )
    expect(json.error).toBeDefined()
  })
})
