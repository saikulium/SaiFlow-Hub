import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response'
import { verifyTotpCode, disableTotp } from '@/server/services/totp.service'

const bodySchema = z.object({
  code: z.string().length(6),
})

/**
 * POST /api/auth/mfa/disable
 * Disable MFA after verifying a valid TOTP code.
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const body = await request.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const user = await prisma.user.findUnique({
      where: { id: authResult.id },
      select: { totp_secret: true, totp_enabled: true },
    })

    if (!user?.totp_enabled || !user.totp_secret) {
      return errorResponse('MFA_NOT_ENABLED', 'MFA non attiva', 400)
    }

    if (!verifyTotpCode(user.totp_secret, parsed.data.code)) {
      return errorResponse('INVALID_CODE', 'Codice TOTP non valido', 400)
    }

    await disableTotp(authResult.id)

    return successResponse({ message: 'MFA disattivata con successo' })
  } catch (error) {
    console.error('POST /api/auth/mfa/disable error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
