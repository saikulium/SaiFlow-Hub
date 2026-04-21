import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { REFRESH_TOKEN_MAX_AGE_DAYS } from '@/lib/constants/auth'

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

interface CreatedToken {
  readonly token: string
  readonly expiresAt: Date
}

export async function createRefreshToken(
  userId: string,
): Promise<CreatedToken> {
  const token = crypto.randomUUID()
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  )

  await prisma.refreshToken.create({
    data: {
      token,
      user_id: userId,
      expires_at: expiresAt,
    },
  })

  return { token, expiresAt }
}

// ---------------------------------------------------------------------------
// Rotate — atomic: revoke old + create new
// ---------------------------------------------------------------------------

interface RotatedToken {
  readonly token: string
  readonly expiresAt: Date
  readonly userId: string
}

export async function rotateRefreshToken(
  oldToken: string,
): Promise<RotatedToken | null> {
  const existing = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    select: { id: true, user_id: true, revoked: true, expires_at: true },
  })

  if (!existing || existing.revoked || existing.expires_at <= new Date()) {
    return null
  }

  const newToken = crypto.randomUUID()
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  )

  // Batch transaction — compatible with PgBouncer connection_limit=1
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revoked: true },
    }),
    prisma.refreshToken.create({
      data: {
        token: newToken,
        user_id: existing.user_id,
        expires_at: expiresAt,
      },
    }),
  ])

  return { token: newToken, expiresAt, userId: existing.user_id }
}

// ---------------------------------------------------------------------------
// Revoke all tokens for a user (force logout)
// ---------------------------------------------------------------------------

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked: false },
      data: { revoked: true },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { token_version: { increment: 1 } },
    }),
  ])
}

// ---------------------------------------------------------------------------
// Revoke single token
// ---------------------------------------------------------------------------

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token, revoked: false },
    data: { revoked: true },
  })
}

// ---------------------------------------------------------------------------
// Cleanup expired tokens (for cron job)
// ---------------------------------------------------------------------------

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: { expires_at: { lt: new Date() } },
  })
  return result.count
}
