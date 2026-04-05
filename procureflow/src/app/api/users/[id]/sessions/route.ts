import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { revokeAllUserTokens } from '@/server/services/refresh-token.service'

/**
 * DELETE /api/users/:id/sessions
 * Admin-only: revoke all refresh tokens for a user (force logout)
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const { id: targetUserId } = await params

    await revokeAllUserTokens(targetUserId)

    return successResponse({ message: 'Tutte le sessioni sono state revocate' })
  } catch (error) {
    console.error('DELETE /api/users/[id]/sessions error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore revoca sessioni', 500)
  }
}
