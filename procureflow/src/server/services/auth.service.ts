import { prisma } from '@/lib/db'
import {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
} from '@/lib/constants/auth'

// ---------------------------------------------------------------------------
// Pure function — no DB call
// ---------------------------------------------------------------------------

interface LockableUser {
  readonly locked_until: Date | null
}

interface LockStatus {
  readonly isLocked: boolean
  readonly remainingMinutes: number
}

export function checkAccountLocked(user: LockableUser): LockStatus {
  if (!user.locked_until) {
    return { isLocked: false, remainingMinutes: 0 }
  }

  const now = Date.now()
  const lockedUntilMs = user.locked_until.getTime()

  if (lockedUntilMs <= now) {
    return { isLocked: false, remainingMinutes: 0 }
  }

  const remainingMinutes = Math.ceil((lockedUntilMs - now) / 60_000)
  return { isLocked: true, remainingMinutes }
}

// ---------------------------------------------------------------------------
// DB functions
// ---------------------------------------------------------------------------

export async function recordFailedLogin(
  userId: string,
): Promise<{ isNowLocked: boolean }> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      failed_login_attempts: { increment: 1 },
    },
    select: { failed_login_attempts: true },
  })

  if (updated.failed_login_attempts >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(
      Date.now() + LOCKOUT_DURATION_MINUTES * 60_000,
    )
    await prisma.user.update({
      where: { id: userId },
      data: { locked_until: lockedUntil },
    })
    return { isNowLocked: true }
  }

  return { isNowLocked: false }
}

export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date(),
    },
  })
}
