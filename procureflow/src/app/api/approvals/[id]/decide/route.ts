import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { approvalDecisionSchema } from '@/lib/validations/approval'
import { decideApproval } from '@/server/services/approval.service'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    const parsed = approvalDecisionSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.approval.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    })

    if (!existing) return notFoundResponse('Approvazione non trovata')

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
