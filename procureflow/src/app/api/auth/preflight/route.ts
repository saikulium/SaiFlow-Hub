import { NextRequest } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse } from '@/lib/api-response'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return errorResponse('INVALID_INPUT', 'Dati non validi', 400)
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
      return errorResponse('INVALID_CREDENTIALS', 'Credenziali non valide', 401)
    }

    // Lockout check
    const lockStatus = checkAccountLocked(user)
    if (lockStatus.isLocked) {
      return errorResponse(
        'ACCOUNT_LOCKED',
        `Account bloccato. Riprova tra ${lockStatus.remainingMinutes} minuti`,
        429,
      )
    }

    // Password check
    const valid = await bcrypt.compare(parsed.data.password, user.password_hash)
    if (!valid) {
      await recordFailedLogin(user.id)
      return errorResponse('INVALID_CREDENTIALS', 'Credenziali non valide', 401)
    }

    // Credentials valid — return MFA status
    return successResponse({
      needsMfa: user.totp_enabled && Boolean(user.totp_secret),
    })
  } catch (error) {
    console.error('POST /api/auth/preflight error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
