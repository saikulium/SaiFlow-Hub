import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Prisma (hoisted to avoid TDZ issues)
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  return { mockPrisma }
})

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// Mock Node crypto module
vi.mock('crypto', () => ({
  default: { randomUUID: () => 'mock-uuid-token' },
  randomUUID: () => 'mock-uuid-token',
}))

import {
  createRefreshToken,
  rotateRefreshToken,
  revokeAllUserTokens,
  revokeRefreshToken,
  cleanupExpiredTokens,
} from '../src/server/services/refresh-token.service'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// createRefreshToken
// ---------------------------------------------------------------------------

describe('createRefreshToken', () => {
  it('creates a token and returns it with expiry', async () => {
    mockPrisma.refreshToken.create.mockResolvedValue({})

    const result = await createRefreshToken('user-1')

    expect(result.token).toBe('mock-uuid-token')
    expect(result.expiresAt).toBeInstanceOf(Date)
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        token: 'mock-uuid-token',
        user_id: 'user-1',
      }),
    })
  })
})

// ---------------------------------------------------------------------------
// rotateRefreshToken
// ---------------------------------------------------------------------------

describe('rotateRefreshToken', () => {
  it('revokes old token and creates new one', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      user_id: 'user-1',
      revoked: false,
      expires_at: new Date(Date.now() + 60_000),
    })
    mockPrisma.$transaction.mockResolvedValue([{}, {}])

    const result = await rotateRefreshToken('old-token')

    expect(result).not.toBeNull()
    expect(result!.token).toBe('mock-uuid-token')
    expect(result!.userId).toBe('user-1')
    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })

  it('returns null for already revoked token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      user_id: 'user-1',
      revoked: true,
      expires_at: new Date(Date.now() + 60_000),
    })

    const result = await rotateRefreshToken('revoked-token')
    expect(result).toBeNull()
  })

  it('returns null for expired token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      user_id: 'user-1',
      revoked: false,
      expires_at: new Date(Date.now() - 60_000),
    })

    const result = await rotateRefreshToken('expired-token')
    expect(result).toBeNull()
  })

  it('returns null for non-existent token', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null)

    const result = await rotateRefreshToken('nonexistent')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// revokeAllUserTokens
// ---------------------------------------------------------------------------

describe('revokeAllUserTokens', () => {
  it('calls $transaction to revoke tokens and increment version', async () => {
    mockPrisma.$transaction.mockResolvedValue([{}, {}])

    await revokeAllUserTokens('user-1')

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// revokeRefreshToken
// ---------------------------------------------------------------------------

describe('revokeRefreshToken', () => {
  it('marks a single token as revoked', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 })

    await revokeRefreshToken('some-token')

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { token: 'some-token', revoked: false },
      data: { revoked: true },
    })
  })
})

// ---------------------------------------------------------------------------
// cleanupExpiredTokens
// ---------------------------------------------------------------------------

describe('cleanupExpiredTokens', () => {
  it('deletes expired tokens and returns count', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 })

    const count = await cleanupExpiredTokens()

    expect(count).toBe(5)
    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { expires_at: { lt: expect.any(Date) } },
    })
  })
})
