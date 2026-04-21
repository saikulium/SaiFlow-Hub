import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { updateUserRoleSchema } from '@/lib/validations/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const { id } = await params

    const body = await request.json()
    const parsed = updateUserRoleSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten().fieldErrors)
    }

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      return notFoundResponse('Utente non trovato')
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role: parsed.data.role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        created_at: true,
      },
    })

    return successResponse(user)
  } catch (error) {
    console.error('[api/users/[id]] PATCH error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiornamento utente', 500)
  }
}
