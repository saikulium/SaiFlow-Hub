import { TOTP, Secret } from 'otpauth'
import QRCode from 'qrcode'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma } from '@/lib/db'

const ISSUER = 'ProcureFlow'
const RECOVERY_CODE_COUNT = 10
const RECOVERY_CODE_LENGTH = 8

// ---------------------------------------------------------------------------
// Generate TOTP secret
// ---------------------------------------------------------------------------

interface TotpSecretResult {
  readonly secret: string
  readonly otpauthUrl: string
}

export function generateTotpSecret(userEmail: string): TotpSecretResult {
  const totp = new TOTP({
    issuer: ISSUER,
    label: userEmail,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: new Secret(),
  })

  return {
    secret: totp.secret.base32,
    otpauthUrl: totp.toString(),
  }
}

// ---------------------------------------------------------------------------
// Generate QR code as data URL
// ---------------------------------------------------------------------------

export async function generateQrCodeDataUrl(
  otpauthUrl: string,
): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, {
    width: 256,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
  })
}

// ---------------------------------------------------------------------------
// Verify TOTP code (window=1 allows 30s tolerance)
// ---------------------------------------------------------------------------

export function verifyTotpCode(secret: string, code: string): boolean {
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  })

  const delta = totp.validate({ token: code, window: 1 })
  return delta !== null
}

// ---------------------------------------------------------------------------
// Recovery codes
// ---------------------------------------------------------------------------

function generateRandomCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  let code = ''
  const bytes = crypto.randomBytes(length)
  for (let i = 0; i < length; i++) {
    code += chars[(bytes[i] ?? 0) % chars.length]
  }
  return code
}

interface RecoveryCodesResult {
  readonly codes: readonly string[]
  readonly hashedCodes: readonly string[]
}

export async function generateRecoveryCodes(): Promise<RecoveryCodesResult> {
  const codes: string[] = []
  const hashedCodes: string[] = []

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = generateRandomCode(RECOVERY_CODE_LENGTH)
    codes.push(code)
    hashedCodes.push(await bcrypt.hash(code, 10))
  }

  return { codes, hashedCodes }
}

interface RecoveryVerifyResult {
  readonly valid: boolean
  readonly remainingCodes: readonly string[]
}

export async function verifyRecoveryCode(
  code: string,
  hashedCodes: readonly string[],
): Promise<RecoveryVerifyResult> {
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(code, hashedCodes[i]!)
    if (match) {
      // Return remaining codes without the matched one
      const remainingCodes = [
        ...hashedCodes.slice(0, i),
        ...hashedCodes.slice(i + 1),
      ]
      return { valid: true, remainingCodes }
    }
  }
  return { valid: false, remainingCodes: [...hashedCodes] }
}

// ---------------------------------------------------------------------------
// DB: Enable / Disable TOTP
// ---------------------------------------------------------------------------

export async function enableTotp(
  userId: string,
  secret: string,
  hashedRecoveryCodes: readonly string[],
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totp_secret: secret,
      totp_enabled: true,
      recovery_codes: [...hashedRecoveryCodes],
    },
  })
}

export async function disableTotp(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totp_secret: null,
      totp_enabled: false,
      recovery_codes: [],
    },
  })
}

// ---------------------------------------------------------------------------
// DB: Consume a recovery code
// ---------------------------------------------------------------------------

export async function consumeRecoveryCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { recovery_codes: true },
  })

  if (!user) return false

  const result = await verifyRecoveryCode(code, user.recovery_codes)
  if (!result.valid) return false

  await prisma.user.update({
    where: { id: userId },
    data: { recovery_codes: [...result.remainingCodes] },
  })

  return true
}
