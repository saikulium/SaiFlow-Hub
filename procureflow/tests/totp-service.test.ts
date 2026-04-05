import { describe, it, expect, vi } from 'vitest'
import { TOTP, Secret } from 'otpauth'

// Mock Prisma
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  }
  return { mockPrisma }
})

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

import {
  generateTotpSecret,
  verifyTotpCode,
  generateRecoveryCodes,
  verifyRecoveryCode,
  enableTotp,
  disableTotp,
} from '../src/server/services/totp.service'

// ---------------------------------------------------------------------------
// generateTotpSecret
// ---------------------------------------------------------------------------

describe('generateTotpSecret', () => {
  it('returns a base32 secret and otpauth URL', () => {
    const result = generateTotpSecret('test@example.com')

    expect(result.secret).toBeTruthy()
    expect(result.secret.length).toBeGreaterThan(10)
    expect(result.otpauthUrl).toContain('otpauth://totp/')
    expect(result.otpauthUrl).toContain('ProcureFlow')
    expect(decodeURIComponent(result.otpauthUrl)).toContain('test@example.com')
  })
})

// ---------------------------------------------------------------------------
// verifyTotpCode
// ---------------------------------------------------------------------------

describe('verifyTotpCode', () => {
  it('accepts a valid current code', () => {
    const secret = new Secret()
    const totp = new TOTP({
      issuer: 'ProcureFlow',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    })
    const validCode = totp.generate()

    expect(verifyTotpCode(secret.base32, validCode)).toBe(true)
  })

  it('rejects an invalid code', () => {
    const secret = new Secret()
    expect(verifyTotpCode(secret.base32, '000000')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// generateRecoveryCodes
// ---------------------------------------------------------------------------

describe('generateRecoveryCodes', () => {
  it('produces 10 plaintext codes and 10 hashed codes', async () => {
    const result = await generateRecoveryCodes()

    expect(result.codes).toHaveLength(10)
    expect(result.hashedCodes).toHaveLength(10)
    // Each plaintext code is 8 chars
    result.codes.forEach((code) => {
      expect(code.length).toBe(8)
    })
    // Each hash starts with bcrypt prefix
    result.hashedCodes.forEach((hash) => {
      expect(hash).toMatch(/^\$2[aby]\$/)
    })
  })

  it('produces unique codes', async () => {
    const result = await generateRecoveryCodes()
    const unique = new Set(result.codes)
    expect(unique.size).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// verifyRecoveryCode
// ---------------------------------------------------------------------------

describe('verifyRecoveryCode', () => {
  it('matches a valid code and removes it', async () => {
    const { codes, hashedCodes } = await generateRecoveryCodes()

    const result = await verifyRecoveryCode(codes[0]!, hashedCodes)

    expect(result.valid).toBe(true)
    expect(result.remainingCodes).toHaveLength(9)
  })

  it('rejects an invalid code', async () => {
    const { hashedCodes } = await generateRecoveryCodes()

    const result = await verifyRecoveryCode('ZZZZZZZZ', hashedCodes)

    expect(result.valid).toBe(false)
    expect(result.remainingCodes).toHaveLength(10)
  })
})

// ---------------------------------------------------------------------------
// enableTotp / disableTotp
// ---------------------------------------------------------------------------

describe('enableTotp', () => {
  it('updates user with TOTP data', async () => {
    mockPrisma.user.update.mockResolvedValue({})

    await enableTotp('user-1', 'SECRET123', ['hash1', 'hash2'])

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        totp_secret: 'SECRET123',
        totp_enabled: true,
        recovery_codes: ['hash1', 'hash2'],
      },
    })
  })
})

describe('disableTotp', () => {
  it('clears TOTP fields on user', async () => {
    mockPrisma.user.update.mockResolvedValue({})

    await disableTotp('user-1')

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        totp_secret: null,
        totp_enabled: false,
        recovery_codes: [],
      },
    })
  })
})
