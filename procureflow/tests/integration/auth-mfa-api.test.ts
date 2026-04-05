import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-1',
  email: 'mario@test.it',
  name: 'Mario Rossi',
  role: 'ADMIN',
}

const mockGenerateTotpSecret = vi.fn()
const mockGenerateQrCodeDataUrl = vi.fn()
const mockVerifyTotpCode = vi.fn()
const mockEnableTotp = vi.fn()
const mockGenerateRecoveryCodes = vi.fn()

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(() => Promise.resolve(mockUser)),
}))
vi.mock('@/server/services/totp.service', () => ({
  generateTotpSecret: mockGenerateTotpSecret,
  generateQrCodeDataUrl: mockGenerateQrCodeDataUrl,
  verifyTotpCode: mockVerifyTotpCode,
  enableTotp: mockEnableTotp,
  generateRecoveryCodes: mockGenerateRecoveryCodes,
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/mfa/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns TOTP secret and QR code for authenticated user', async () => {
    mockGenerateTotpSecret.mockReturnValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUrl: 'otpauth://totp/ProcureFlow:mario@test.it?secret=JBSWY3DPEHPK3PXP',
    })
    mockGenerateQrCodeDataUrl.mockResolvedValue('data:image/png;base64,QR...')

    const { POST } = await import('@/app/api/auth/mfa/setup/route')
    const res = await POST()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.secret).toBe('JBSWY3DPEHPK3PXP')
    expect(body.data.qrCodeDataUrl).toContain('data:image/png')
  })
})

describe('POST /api/auth/mfa/verify-setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enables MFA and returns recovery codes on valid TOTP code', async () => {
    mockVerifyTotpCode.mockReturnValue(true)
    mockGenerateRecoveryCodes.mockResolvedValue({
      codes: ['CODE1', 'CODE2', 'CODE3'],
      hashedCodes: ['hash1', 'hash2', 'hash3'],
    })
    mockEnableTotp.mockResolvedValue(undefined)

    const { POST } = await import('@/app/api/auth/mfa/verify-setup/route')
    const req = new Request('http://localhost:3000/api/auth/mfa/verify-setup', {
      method: 'POST',
      body: JSON.stringify({ secret: 'JBSWY3DPEHPK3PXP', code: '123456' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.recoveryCodes).toEqual(['CODE1', 'CODE2', 'CODE3'])
    expect(mockEnableTotp).toHaveBeenCalledWith(
      'user-1',
      'JBSWY3DPEHPK3PXP',
      ['hash1', 'hash2', 'hash3'],
    )
  })

  it('rejects invalid TOTP code', async () => {
    mockVerifyTotpCode.mockReturnValue(false)

    const { POST } = await import('@/app/api/auth/mfa/verify-setup/route')
    const req = new Request('http://localhost:3000/api/auth/mfa/verify-setup', {
      method: 'POST',
      body: JSON.stringify({ secret: 'JBSWY3DPEHPK3PXP', code: '000000' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_CODE')
    expect(mockEnableTotp).not.toHaveBeenCalled()
  })

  it('rejects missing code field', async () => {
    const { POST } = await import('@/app/api/auth/mfa/verify-setup/route')
    const req = new Request('http://localhost:3000/api/auth/mfa/verify-setup', {
      method: 'POST',
      body: JSON.stringify({ secret: 'JBSWY3DPEHPK3PXP' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects code with wrong length', async () => {
    const { POST } = await import('@/app/api/auth/mfa/verify-setup/route')
    const req = new Request('http://localhost:3000/api/auth/mfa/verify-setup', {
      method: 'POST',
      body: JSON.stringify({ secret: 'JBSWY3DPEHPK3PXP', code: '12345' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
