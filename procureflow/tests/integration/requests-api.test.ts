import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-1',
  name: 'Mario Rossi',
  email: 'mario@test.it',
  role: 'MANAGER',
}

const mockPrisma = {
  purchaseRequest: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(() => Promise.resolve(mockUser)),
  requireAuth: vi.fn(() => Promise.resolve({ user: { id: mockUser.id } })),
}))
vi.mock('@/server/services/code-generator.service', () => ({
  generateNextCodeAtomic: vi.fn(() => Promise.resolve('PR-2026-00042')),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns paginated requests with default params', async () => {
    const mockRequests = [
      {
        id: 'req-1',
        code: 'PR-2026-00001',
        title: 'Carta A4',
        status: 'DRAFT',
        priority: 'MEDIUM',
        estimated_amount: { toNumber: () => 50 },
        actual_amount: null,
        vendor: { id: 'v-1', name: 'Acme', code: 'ACM' },
        requester: { id: 'u-1', name: 'Mario' },
        _count: { items: 2, comments: 0 },
      },
    ]

    mockPrisma.purchaseRequest.findMany.mockResolvedValue(mockRequests)
    mockPrisma.purchaseRequest.count.mockResolvedValue(1)

    const { GET } = await import('@/app/api/requests/route')
    const req = new NextRequest('http://localhost:3000/api/requests')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.meta.total).toBe(1)
    expect(body.meta.page).toBe(1)
  })

  it('applies status filter', async () => {
    mockPrisma.purchaseRequest.findMany.mockResolvedValue([])
    mockPrisma.purchaseRequest.count.mockResolvedValue(0)

    const { GET } = await import('@/app/api/requests/route')
    const req = new NextRequest(
      'http://localhost:3000/api/requests?status=APPROVED,ORDERED',
    )
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockPrisma.purchaseRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['APPROVED', 'ORDERED'] },
        }),
      }),
    )
  })

  it('applies search filter across title, code, and vendor name', async () => {
    mockPrisma.purchaseRequest.findMany.mockResolvedValue([])
    mockPrisma.purchaseRequest.count.mockResolvedValue(0)

    const { GET } = await import('@/app/api/requests/route')
    const req = new NextRequest(
      'http://localhost:3000/api/requests?search=carta',
    )
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.purchaseRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              title: { contains: 'carta', mode: 'insensitive' },
            }),
          ]),
        }),
      }),
    )
  })

  it('rejects invalid page parameter', async () => {
    const { GET } = await import('@/app/api/requests/route')
    const req = new NextRequest('http://localhost:3000/api/requests?page=-1')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /api/requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new request with items', async () => {
    const mockCreated = {
      id: 'req-new',
      code: 'PR-2026-00042',
      title: 'Monitor 27"',
      status: 'DRAFT',
      vendor: { id: 'v-1', name: 'Dell' },
      requester: { id: 'user-1', name: 'Mario Rossi' },
      items: [{ id: 'item-1', name: 'Monitor Dell 27"', quantity: 2 }],
    }

    mockPrisma.purchaseRequest.create.mockResolvedValue(mockCreated)

    const { POST } = await import('@/app/api/requests/route')
    const req = new NextRequest('http://localhost:3000/api/requests', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Monitor 27"',
        priority: 'HIGH',
        items: [{ name: 'Monitor Dell 27"', quantity: 2, unit: 'pz' }],
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.code).toBe('PR-2026-00042')
    expect(mockPrisma.purchaseRequest.create).toHaveBeenCalledTimes(1)
  })

  it('rejects missing title', async () => {
    const { POST } = await import('@/app/api/requests/route')
    const req = new NextRequest('http://localhost:3000/api/requests', {
      method: 'POST',
      body: JSON.stringify({ items: [{ name: 'X', quantity: 1 }] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('accepts request with default empty items', async () => {
    mockPrisma.purchaseRequest.create.mockResolvedValue({
      id: 'req-empty',
      code: 'PR-2026-00042',
      title: 'Test',
      status: 'DRAFT',
      vendor: null,
      requester: { id: 'user-1', name: 'Mario Rossi' },
      items: [],
    })

    const { POST } = await import('@/app/api/requests/route')
    const req = new NextRequest('http://localhost:3000/api/requests', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
  })
})
