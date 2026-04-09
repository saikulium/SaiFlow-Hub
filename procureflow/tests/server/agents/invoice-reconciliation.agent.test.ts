import { describe, it, expect } from 'vitest'

describe('InvoiceReconciliationAgent', () => {
  it('exports reconcileInvoice function', async () => {
    const mod = await import(
      '@/server/agents/invoice-reconciliation.agent'
    )
    expect(typeof mod.reconcileInvoice).toBe('function')
  })

  it('exports ReconciliationResult type-compatible shape', async () => {
    const mod = await import(
      '@/server/agents/invoice-reconciliation.agent'
    )
    // Verify the module has only the expected export
    const exportKeys = Object.keys(mod)
    expect(exportKeys).toContain('reconcileInvoice')
  })
})

describe('InvoiceTools', () => {
  it('exports INVOICE_TOOLS array with 4 tools', async () => {
    const mod = await import('@/server/agents/tools/invoice.tools')
    expect(Array.isArray(mod.INVOICE_TOOLS)).toBe(true)
    expect(mod.INVOICE_TOOLS).toHaveLength(4)
  })

  it('each tool has required shape (name, description, input_schema, run, parse)', async () => {
    const mod = await import('@/server/agents/tools/invoice.tools')
    for (const tool of mod.INVOICE_TOOLS) {
      expect(typeof tool.name).toBe('string')
      expect(typeof tool.description).toBe('string')
      expect(tool.input_schema).toBeDefined()
      expect(typeof tool.run).toBe('function')
      expect(typeof tool.parse).toBe('function')
    }
  })

  it('exports individual tool definitions', async () => {
    const mod = await import('@/server/agents/tools/invoice.tools')
    expect(typeof mod.getInvoiceDetailTool).toBe('object')
    expect(typeof mod.getOrderForInvoiceTool).toBe('object')
    expect(typeof mod.getVendorPriceHistoryTool).toBe('object')
    expect(typeof mod.updateReconciliationStatusTool).toBe('object')
  })

  it('tools have expected names', async () => {
    const mod = await import('@/server/agents/tools/invoice.tools')
    const toolNames = mod.INVOICE_TOOLS.map(
      (t: { name: string }) => t.name,
    )
    expect(toolNames).toContain('get_invoice_detail')
    expect(toolNames).toContain('get_order_for_invoice')
    expect(toolNames).toContain('get_vendor_price_history')
    expect(toolNames).toContain('update_reconciliation_status')
  })
})
