import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getCurrentUserId } from '@/lib/auth'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const statusFilter = req.nextUrl.searchParams.get('status')

    const where: Prisma.ApprovalWhereInput = {
      approver_id: userId,
    }

    if (statusFilter) {
      where.status = statusFilter as Prisma.EnumApprovalStatusFilter['equals']
    }

    const approvals = await prisma.approval.findMany({
      where,
      include: {
        approver: {
          select: { id: true, name: true, role: true },
        },
        request: {
          select: {
            id: true,
            code: true,
            title: true,
            estimated_amount: true,
            priority: true,
            requester: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    const data = approvals.map((a) => ({
      id: a.id,
      status: a.status,
      notes: a.notes,
      decision_at: a.decision_at,
      created_at: a.created_at,
      approver: a.approver,
      request: {
        id: a.request.id,
        code: a.request.code,
        title: a.request.title,
        priority: a.request.priority,
        estimated_amount: a.request.estimated_amount
          ? Number(a.request.estimated_amount)
          : null,
        requester: a.request.requester,
      },
    }))

    return successResponse(data)
  } catch (error) {
    console.error('GET /api/approvals error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
