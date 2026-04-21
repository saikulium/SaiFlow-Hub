import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { approvalDecisionSchema, decideApproval } from '@/modules/core/requests'
import { withApiHandler } from '@/lib/api-handler'

export const POST = withApiHandler(
  { auth: true, errorMessage: 'Errore nella decisione' },
  async ({ req, user, params }) => {
    const approvalId = params.id as string

    const body = await req.json()
    const parsed = approvalDecisionSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.approval.findUnique({
      where: { id: approvalId },
      select: { id: true, status: true, approver_id: true },
    })

    if (!existing) return notFoundResponse('Approvazione non trovata')

    // Verify the caller is the assigned approver (or ADMIN)
    if (existing.approver_id !== user.id && user.role !== 'ADMIN') {
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
      approvalId,
      parsed.data.action,
      parsed.data.notes,
    )

    return successResponse(result)
  },
)
