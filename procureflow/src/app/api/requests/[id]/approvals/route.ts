import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response'
import { initiateApprovalWorkflow } from '@/server/services/approval.service'
import { requireAuth } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!request) return notFoundResponse('Richiesta non trovata')

    const approvals = await prisma.approval.findMany({
      where: { request_id: params.id },
      include: {
        approver: { select: { id: true, name: true, role: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    return successResponse(approvals)
  } catch (error) {
    console.error('GET /api/requests/[id]/approvals error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, estimated_amount: true },
    })

    if (!request) return notFoundResponse('Richiesta non trovata')

    if (!['DRAFT', 'SUBMITTED'].includes(request.status)) {
      return errorResponse(
        'INVALID_STATE',
        'Solo richieste in Bozza o Inviate possono essere inviate per approvazione',
        400,
      )
    }

    // Check for duplicate submission (PENDING approvals already exist)
    const pendingApprovals = await prisma.approval.count({
      where: { request_id: params.id, status: 'PENDING' },
    })

    if (pendingApprovals > 0) {
      return errorResponse(
        'CONFLICT',
        'Esistono già approvazioni in attesa per questa richiesta',
        409,
      )
    }

    const estimatedAmount = request.estimated_amount
      ? Number(request.estimated_amount)
      : 0

    const result = await initiateApprovalWorkflow(params.id, estimatedAmount)

    return successResponse(result)
  } catch (error) {
    console.error('POST /api/requests/[id]/approvals error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      "Errore nell'avvio dell'approvazione",
      500,
    )
  }
}
