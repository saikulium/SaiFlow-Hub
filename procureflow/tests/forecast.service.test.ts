import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  $queryRaw: vi.fn(),
  stockMovement: { groupBy: vi.fn() },
  stockLot: { aggregate: vi.fn() },
  material: { findMany: vi.fn(), findUnique: vi.fn() },
  materialAlert: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
}

const mockCallClaude = vi.fn()

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/ai/claude-client', () => ({
  callClaude: mockCallClaude,
  extractJsonFromAiResponse: (raw: string) => {
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fence) return fence[1]!.trim()
    const brace = raw.match(/\{[\s\S]*\}/)
    if (brace) return brace[0]!
    return raw.trim()
  },
}))

describe('forecast.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('computeWMA', () => {
    it('computes correct weighted average with 6 months of data', async () => {
      const { computeWMA } = await import('@/server/services/forecast.service')

      const result = computeWMA([100, 80, 90, 70, 60, 50])

      // (100*3 + 80*2.5 + 90*2 + 70*1.5 + 60*1 + 50*0.5) / (3+2.5+2+1.5+1+0.5)
      // = (300 + 200 + 180 + 105 + 60 + 25) / 10.5
      // = 870 / 10.5
      // ≈ 82.857
      expect(result).toBeCloseTo(82.857, 2)
    })

    it('pads with zeros when fewer than 6 months provided', async () => {
      const { computeWMA } = await import('@/server/services/forecast.service')

      const result = computeWMA([100, 80, 60])

      // Padded: [100, 80, 60, 0, 0, 0]
      // (100*3 + 80*2.5 + 60*2 + 0*1.5 + 0*1 + 0*0.5) / 10.5
      // = (300 + 200 + 120) / 10.5
      // = 620 / 10.5
      // ≈ 59.048
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThan(100)
      expect(result).toBeCloseTo(59.048, 2)
    })

    it('returns 0 for empty input', async () => {
      const { computeWMA } = await import('@/server/services/forecast.service')

      expect(computeWMA([])).toBe(0)
    })
  })

  describe('getBasicForecast', () => {
    it('returns forecast with reorderNeeded when stock is low', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'mat-1',
        name: 'Steel Bolts',
        min_stock_level: { toNumber: () => 100 },
      })

      mockPrisma.stockLot.aggregate.mockResolvedValue({
        _sum: { current_quantity: { toNumber: () => 50 } },
      })

      // Last 6 months outbound movements grouped by month
      mockPrisma.$queryRaw.mockResolvedValue([
        { month: '2026-03', total: 30 },
        { month: '2026-02', total: 25 },
        { month: '2026-01', total: 20 },
        { month: '2025-12', total: 15 },
        { month: '2025-11', total: 10 },
        { month: '2025-10', total: 5 },
      ])

      const { getBasicForecast } =
        await import('@/server/services/forecast.service')
      const result = await getBasicForecast('mat-1')

      expect(result.materialId).toBe('mat-1')
      expect(result.materialName).toBe('Steel Bolts')
      expect(result.currentStock).toBe(50)
      expect(result.projected).toHaveLength(3)
      expect(result.reorderNeeded).toBe(true)
      expect(result.daysRemaining).toBeGreaterThan(0)
    })

    it('throws when material not found', async () => {
      mockPrisma.material.findUnique.mockResolvedValue(null)

      const { getBasicForecast } =
        await import('@/server/services/forecast.service')

      await expect(getBasicForecast('nonexistent')).rejects.toThrow(
        'Material not found',
      )
    })
  })

  describe('getAiForecast', () => {
    it('returns AI-enriched forecast on success', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'mat-1',
        name: 'Steel Bolts',
        min_stock_level: { toNumber: () => 100 },
      })

      mockPrisma.stockLot.aggregate.mockResolvedValue({
        _sum: { current_quantity: { toNumber: () => 200 } },
      })

      mockPrisma.$queryRaw.mockResolvedValue([
        { month: '2026-03', total: 40 },
        { month: '2026-02', total: 35 },
      ])

      mockCallClaude.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              projected: [42, 45, 48],
              confidence: 0.75,
              reasoning: 'Trend in crescita costante',
              risks: ['Possibile interruzione forniture'],
            }),
          },
        ],
      } as never)

      const { getAiForecast } =
        await import('@/server/services/forecast.service')
      const result = await getAiForecast('mat-1')

      expect(result.aiProjected).toEqual([42, 45, 48])
      expect(result.confidence).toBe(0.75)
      expect(result.reasoning).toBe('Trend in crescita costante')
      expect(result.risks).toEqual(['Possibile interruzione forniture'])
    })

    it('falls back gracefully when AI call fails', async () => {
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'mat-1',
        name: 'Steel Bolts',
        min_stock_level: { toNumber: () => 100 },
      })

      mockPrisma.stockLot.aggregate.mockResolvedValue({
        _sum: { current_quantity: { toNumber: () => 200 } },
      })

      mockPrisma.$queryRaw.mockResolvedValue([])

      mockCallClaude.mockRejectedValue(new Error('API unavailable'))

      const { getAiForecast } =
        await import('@/server/services/forecast.service')
      const result = await getAiForecast('mat-1')

      // Should fall back to basic forecast values
      expect(result.confidence).toBe(0)
      expect(result.reasoning).toContain('AI non disponibile')
      expect(result.risks).toEqual([])
      expect(result.aiProjected).toEqual(result.projected)
    })
  })

  describe('checkReorderAlerts', () => {
    it('creates alerts for materials below min stock level', async () => {
      mockPrisma.material.findMany.mockResolvedValue([
        {
          id: 'mat-1',
          name: 'Bolts',
          code: 'BLT-001',
          min_stock_level: { toNumber: () => 100 },
          preferred_vendor_id: 'vendor-1',
        },
        {
          id: 'mat-2',
          name: 'Nuts',
          code: 'NUT-001',
          min_stock_level: { toNumber: () => 50 },
          preferred_vendor_id: null,
        },
      ])

      // mat-1: stock 80 (below 100) → alert
      // mat-2: stock 60 (above 50) → no alert, resolve existing
      mockPrisma.stockLot.aggregate
        .mockResolvedValueOnce({
          _sum: { current_quantity: { toNumber: () => 80 } },
        })
        .mockResolvedValueOnce({
          _sum: { current_quantity: { toNumber: () => 60 } },
        })

      // mat-1: no existing active alert
      mockPrisma.materialAlert.findFirst
        .mockResolvedValueOnce(null)
        // mat-2: check for existing alerts to resolve
        .mockResolvedValueOnce(null)

      mockPrisma.materialAlert.create.mockResolvedValue({ id: 'alert-1' })
      mockPrisma.materialAlert.updateMany.mockResolvedValue({ count: 0 })

      const { checkReorderAlerts } =
        await import('@/server/services/forecast.service')
      const result = await checkReorderAlerts()

      expect(result.alerts_created).toBe(1)
      expect(mockPrisma.materialAlert.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.materialAlert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          material_id: 'mat-1',
          type: 'REORDER_SUGGESTED',
          suggested_vendor_id: 'vendor-1',
        }),
      })
    })
  })

  describe('getActiveAlerts', () => {
    it('returns non-dismissed alerts with material info', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          material: { name: 'Bolts', code: 'BLT-001' },
          suggested_vendor: { name: 'Acme Corp' },
          dismissed: false,
          created_at: new Date(),
        },
      ]
      mockPrisma.materialAlert.findMany.mockResolvedValue(mockAlerts)

      const { getActiveAlerts } =
        await import('@/server/services/forecast.service')
      const result = await getActiveAlerts()

      expect(result).toEqual(mockAlerts)
      expect(mockPrisma.materialAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dismissed: false },
          orderBy: { created_at: 'desc' },
        }),
      )
    })
  })

  describe('dismissAlert', () => {
    it('sets dismissed to true', async () => {
      mockPrisma.materialAlert.updateMany.mockResolvedValue({ count: 1 })

      const { dismissAlert } =
        await import('@/server/services/forecast.service')
      await dismissAlert('alert-1')

      expect(mockPrisma.materialAlert.updateMany).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: { dismissed: true },
      })
    })
  })

  describe('resolveAlert', () => {
    it('sets resolved_by and dismissed', async () => {
      mockPrisma.materialAlert.updateMany.mockResolvedValue({ count: 1 })

      const { resolveAlert } =
        await import('@/server/services/forecast.service')
      await resolveAlert('alert-1', 'req-123')

      expect(mockPrisma.materialAlert.updateMany).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: { resolved_by: 'req-123', dismissed: true },
      })
    })
  })
})
