import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  $transaction: vi.fn(),
  aiInsight: {
    findMany: vi.fn(),
    update: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  purchaseRequest: { groupBy: vi.fn(), findMany: vi.fn() },
  approval: { findMany: vi.fn() },
  invoice: { groupBy: vi.fn() },
  budget: { findMany: vi.fn() },
  requestItem: { groupBy: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/ai/claude-client', () => ({
  callClaude: vi.fn(),
}))

describe('insight.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getActiveInsights returns non-dismissed, non-expired insights', async () => {
    const mockInsights = [
      { id: '1', type: 'SPEND_ANOMALY', severity: 'HIGH', title: 'Test', dismissed: false },
    ]
    mockPrisma.aiInsight.findMany.mockResolvedValue(mockInsights)

    const { getActiveInsights } = await import('@/server/services/insight.service')
    const result = await getActiveInsights()

    expect(result).toEqual(mockInsights)
    expect(mockPrisma.aiInsight.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dismissed: false }),
        orderBy: expect.arrayContaining([{ severity: 'asc' }]),
        take: 6,
      }),
    )
  })

  it('dismissInsight updates dismissed field', async () => {
    mockPrisma.aiInsight.update.mockResolvedValue({ id: '1', dismissed: true })

    const { dismissInsight } = await import('@/server/services/insight.service')
    await dismissInsight('1')

    expect(mockPrisma.aiInsight.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { dismissed: true },
    })
  })

  it('generateInsights handles Claude API failure gracefully', async () => {
    const { callClaude } = await import('@/lib/ai/claude-client')
    vi.mocked(callClaude).mockRejectedValue(new Error('timeout'))

    // Mock the DB queries to return empty data
    mockPrisma.$transaction.mockResolvedValue([[], [], [], [], []])
    mockPrisma.aiInsight.findMany.mockResolvedValue([])
    mockPrisma.aiInsight.deleteMany.mockResolvedValue({ count: 0 })

    const { generateInsights } = await import('@/server/services/insight.service')
    const result = await generateInsights()

    expect(result.generated).toBe(0)
    expect(result.error).toBe('claude_unavailable')
  })
})
