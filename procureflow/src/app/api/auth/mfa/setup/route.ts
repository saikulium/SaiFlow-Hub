import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import {
  generateTotpSecret,
  generateQrCodeDataUrl,
} from '@/server/services/totp.service'

/**
 * POST /api/auth/mfa/setup
 * Generate TOTP secret + QR code for the authenticated user.
 */
export async function POST() {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const { secret, otpauthUrl } = generateTotpSecret(authResult.email)
    const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUrl)

    return successResponse({ secret, qrCodeDataUrl })
  } catch (error) {
    console.error('POST /api/auth/mfa/setup error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
