import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { approvalDecisionSchema, decideApproval } from '@/modules/core/requests'
import { requireAuth } from '@/lib/auth'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await req.json()
    const parsed = approvalDecisionSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.approval.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, approver_id: true },
    })

    if (!existing) return notFoundResponse('Approvazione non trovata')

    // Verify the caller is the assigned approver (or ADMIN)
    if (existing.approver_id !== authResult.id && authResult.role !== 'ADMIN') {
      return errorResponse(
        'FORBIDDEN',
        'Non hai il permesso di decidere su questa approvazione',
        403,
      )
    }

    if (existing.status !== 'PENDING') {
      return errorResponse(
        'INVALID_STATE',
        'Questa approvazione è già stata processata',
        400,
      )
    }

    const result = await decideApproval(
      params.id,
      parsed.data.action,
      parsed.data.notes,
    )

    return successResponse(result)
  } catch (error) {
    console.error('POST /api/approvals/[id]/decide error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nella decisione', 500)
  }
}
