import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: 'invalid_input' }, { status: 400 })
  }

  const { prisma } = await import('@/lib/db')
  const bcrypt = (await import('bcryptjs')).default
  const { checkAccountLocked, recordFailedLogin } = await import(
    '@/server/services/auth.service'
  )

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      password_hash: true,
      failed_login_attempts: true,
      locked_until: true,
      totp_enabled: true,
      totp_secret: true,
    },
  })

  // No user or no password — same generic response to avoid user enumeration
  if (!user?.password_hash) {
    return NextResponse.json({ ok: false, reason: 'invalid_credentials' })
  }

  // Lockout check
  const lockStatus = checkAccountLocked(user)
  if (lockStatus.isLocked) {
    return NextResponse.json({
      ok: false,
      reason: 'locked',
      lockMinutes: lockStatus.remainingMinutes,
    })
  }

  // Password check
  const valid = await bcrypt.compare(parsed.data.password, user.password_hash)
  if (!valid) {
    await recordFailedLogin(user.id)
    return NextResponse.json({ ok: false, reason: 'invalid_credentials' })
  }

  // Credentials valid — return MFA status
  return NextResponse.json({
    ok: true,
    needsMfa: user.totp_enabled && Boolean(user.totp_secret),
  })
}
