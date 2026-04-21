import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response'
import {
  verifyTotpCode,
  enableTotp,
  generateRecoveryCodes,
} from '@/server/services/totp.service'

const bodySchema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6),
})

/**
 * POST /api/auth/mfa/verify-setup
 * Verify TOTP code against provided secret, then enable MFA.
 * Returns plaintext recovery codes (shown once).
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

    const { secret, code } = parsed.data

    if (!verifyTotpCode(secret, code)) {
      return errorResponse('INVALID_CODE', 'Codice TOTP non valido', 400)
    }

    const { codes, hashedCodes } = await generateRecoveryCodes()

    await enableTotp(authResult.id, secret, hashedCodes)

    return successResponse({ recoveryCodes: codes })
  } catch (error) {
    console.error('POST /api/auth/mfa/verify-setup error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
