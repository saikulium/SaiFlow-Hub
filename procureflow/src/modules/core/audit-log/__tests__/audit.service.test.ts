import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

import {
  writeAuditLog,
  searchAuditLogs,
  getEntityAuditHistory,
} from '../server/audit.service'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('writeAuditLog', () => {
  it('forwards params to prisma.auditLog.create with snake_case mapping', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({})

    await writeAuditLog({
      actorId: 'u1',
      actorType: 'USER',
      actorLabel: 'alice@example.com',
      action: 'UPDATE',
      entityType: 'PurchaseRequest',
      entityId: 'pr-1',
      entityLabel: 'PR-2026-001',
      changes: { status: { old: 'DRAFT', new: 'SUBMITTED' } },
      correlationId: 'c-1',
      ipAddress: '1.1.1.1',
      userAgent: 'ua',
    })

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actor_id: 'u1',
        actor_type: 'USER',
        actor_label: 'alice@example.com',
        action: 'UPDATE',
        entity_type: 'PurchaseRequest',
        entity_id: 'pr-1',
        entity_label: 'PR-2026-001',
        correlation_id: 'c-1',
        ip_address: '1.1.1.1',
        user_agent: 'ua',
      }),
    })
  })

  it('coerces missing optionals to null', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({})

    await writeAuditLog({
      actorType: 'SYSTEM',
      action: 'CREATE',
      entityType: 'Vendor',
      entityId: 'v-1',
    })

    const arg = mockPrisma.auditLog.create.mock.calls[0]![0]
    expect(arg.data.actor_id).toBeNull()
    expect(arg.data.actor_label).toBeNull()
    expect(arg.data.correlation_id).toBeNull()
  })
})

describe('searchAuditLogs', () => {
  it('applies filters and cursor pagination with +1 limit probe', async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      id: `a-${i}`,
      timestamp: new Date(),
    }))
    mockPrisma.auditLog.findMany.mockResolvedValue(rows)

    const out = await searchAuditLogs({
      actorId: 'u1',
      action: 'CREATE',
      limit: 50,
    })

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { actor_id: 'u1', action: 'CREATE' },
        take: 51,
      }),
    )
    expect(out.items).toHaveLength(50)
    expect(out.hasMore).toBe(true)
    expect(out.nextCursor).toBe('a-49')
  })

  it('returns hasMore=false when exactly at limit', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ id: `a-${i}`, timestamp: new Date() })),
    )
    const out = await searchAuditLogs({ limit: 50 })
    expect(out.hasMore).toBe(false)
    expect(out.nextCursor).toBeNull()
    expect(out.items).toHaveLength(10)
  })

  it('builds timestamp range when from/to provided', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([])
    const from = new Date('2026-01-01')
    const to = new Date('2026-12-31')
    await searchAuditLogs({ from, to })
    const call = mockPrisma.auditLog.findMany.mock.calls[0]![0]
    expect(call.where.timestamp).toEqual({ gte: from, lte: to })
  })

  it('clamps limit to MAX_LIMIT (200)', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([])
    await searchAuditLogs({ limit: 500 })
    const call = mockPrisma.auditLog.findMany.mock.calls[0]![0]
    expect(call.take).toBe(201)
  })
})

describe('getEntityAuditHistory', () => {
  it('queries by entity_type + entity_id in DESC order', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([])
    await getEntityAuditHistory('PurchaseRequest', 'pr-42')
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { entity_type: 'PurchaseRequest', entity_id: 'pr-42' },
      orderBy: { timestamp: 'desc' },
      take: 100,
    })
  })

  it('clamps limit to MAX_LIMIT', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([])
    await getEntityAuditHistory('X', 'y', 999)
    const call = mockPrisma.auditLog.findMany.mock.calls[0]![0]
    expect(call.take).toBe(200)
  })
})
