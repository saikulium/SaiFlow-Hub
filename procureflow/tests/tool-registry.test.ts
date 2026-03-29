import { describe, it, expect } from 'vitest'
import { getToolsForRole, READ_TOOLS, WRITE_TOOLS, isWriteTool } from '@/lib/ai/tool-registry'

describe('tool-registry', () => {
  it('READ_TOOLS has exactly 8 tools', () => {
    expect(READ_TOOLS).toHaveLength(8)
  })

  it('WRITE_TOOLS has exactly 6 tools', () => {
    expect(WRITE_TOOLS).toHaveLength(6)
  })

  it('each tool has required fields', () => {
    for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.input_schema).toBeTruthy()
      expect(tool.permission_level).toMatch(/^(READ|WRITE)$/)
      expect(tool.min_role).toMatch(/^(VIEWER|REQUESTER|MANAGER|ADMIN)$/)
    }
  })

  it('VIEWER gets only READ tools', () => {
    const tools = getToolsForRole('VIEWER')
    expect(tools.every((t) => t.permission_level === 'READ')).toBe(true)
    expect(tools).toHaveLength(8)
  })

  it('REQUESTER gets READ + REQUESTER-level WRITE tools', () => {
    const tools = getToolsForRole('REQUESTER')
    const writeTools = tools.filter((t) => t.permission_level === 'WRITE')
    const writeNames = writeTools.map((t) => t.name)
    expect(writeNames).toContain('create_request')
    expect(writeNames).toContain('update_request')
    expect(writeNames).toContain('submit_for_approval')
    expect(writeNames).not.toContain('approve_request')
    expect(writeNames).not.toContain('bulk_update')
  })

  it('MANAGER gets READ + MANAGER-level WRITE tools', () => {
    const tools = getToolsForRole('MANAGER')
    const writeNames = tools.filter((t) => t.permission_level === 'WRITE').map((t) => t.name)
    expect(writeNames).toContain('approve_request')
    expect(writeNames).toContain('create_vendor')
    expect(writeNames).not.toContain('bulk_update')
  })

  it('ADMIN gets all tools', () => {
    const tools = getToolsForRole('ADMIN')
    const writeNames = tools.filter((t) => t.permission_level === 'WRITE').map((t) => t.name)
    expect(writeNames).toContain('bulk_update')
    expect(tools).toHaveLength(14) // 8 READ + 6 WRITE
  })

  it('isWriteTool identifies write tools correctly', () => {
    expect(isWriteTool('create_request')).toBe(true)
    expect(isWriteTool('search_requests')).toBe(false)
    expect(isWriteTool('nonexistent')).toBe(false)
  })
})
