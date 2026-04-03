import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { updateRequestSchema } from '@/lib/validations/request'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { assertTransition, TransitionError } from '@/lib/state-machine'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      include: {
        vendor: true,
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
          },
        },
        commessa: { select: { id: true, code: true, title: true } },
        items: true,
        approvals: {
          include: {
            approver: { select: { id: true, name: true, role: true } },
          },
          orderBy: { created_at: 'desc' },
        },
        timeline: { orderBy: { created_at: 'desc' } },
        comments: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { created_at: 'desc' },
        },
        attachments: { orderBy: { created_at: 'desc' } },
      },
    })

    if (!request) {
      // Try finding by code
      const byCode = await prisma.purchaseRequest.findUnique({
        where: { code: params.id },
        include: {
          vendor: true,
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: true,
            },
          },
          commessa: { select: { id: true, code: true, title: true } },
          items: true,
          approvals: {
            include: {
              approver: { select: { id: true, name: true, role: true } },
            },
            orderBy: { created_at: 'desc' },
          },
          timeline: { orderBy: { created_at: 'desc' } },
          comments: {
            include: { author: { select: { id: true, name: true } } },
            orderBy: { created_at: 'desc' },
          },
          attachments: { orderBy: { created_at: 'desc' } },
        },
      })

      if (!byCode) return notFoundResponse('Richiesta non trovata')

      return successResponse({
        ...byCode,
        estimated_amount: byCode.estimated_amount
          ? Number(byCode.estimated_amount)
          : null,
        actual_amount: byCode.actual_amount
          ? Number(byCode.actual_amount)
          : null,
      })
    }

    return successResponse({
      ...request,
      estimated_amount: request.estimated_amount
        ? Number(request.estimated_amount)
        : null,
      actual_amount: request.actual_amount
        ? Number(request.actual_amount)
        : null,
    })
  } catch (error) {
    console.error('GET /api/requests/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    const parsed = updateRequestSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    })

    if (!existing) return notFoundResponse('Richiesta non trovata')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { items: _items, status, ...data } = parsed.data

    const updateData: Prisma.PurchaseRequestUpdateInput = {}

    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined)
      updateData.description = data.description
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.vendor_id !== undefined)
      updateData.vendor = { connect: { id: data.vendor_id } }
    if (data.estimated_amount !== undefined)
      updateData.estimated_amount = new Prisma.Decimal(data.estimated_amount)
    if (data.actual_amount !== undefined)
      updateData.actual_amount = new Prisma.Decimal(data.actual_amount)
    if (data.needed_by !== undefined)
      updateData.needed_by = new Date(data.needed_by)
    if (data.category !== undefined) updateData.category = data.category
    if (data.department !== undefined) updateData.department = data.department
    if (data.tracking_number !== undefined)
      updateData.tracking_number = data.tracking_number
    if (data.external_ref !== undefined)
      updateData.external_ref = data.external_ref

    if (status && status !== existing.status) {
      // Fase 4: Enforcement transizioni di stato
      assertTransition(existing.status, status)

      updateData.status = status
      if (status === 'ORDERED') updateData.ordered_at = new Date()
      if (status === 'DELIVERED') updateData.delivered_at = new Date()

      const currentUser = await getCurrentUser()

      // Add timeline event
      await prisma.timelineEvent.create({
        data: {
          request_id: params.id,
          type: 'status_change',
          title: `Stato aggiornato a ${status}`,
          description: `Stato cambiato da ${existing.status} a ${status}`,
          actor: currentUser.name,
        },
      })
    }

    const updated = await prisma.purchaseRequest.update({
      where: { id: params.id },
      data: updateData,
      include: {
        vendor: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
      },
    })

    return successResponse(updated)
  } catch (error) {
    if (error instanceof TransitionError) {
      return errorResponse('INVALID_TRANSITION', error.message, 400)
    }
    console.error('PATCH /api/requests/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiornamento', 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const existing = await prisma.purchaseRequest.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    })

    if (!existing) return notFoundResponse('Richiesta non trovata')

    if (!['DRAFT', 'CANCELLED'].includes(existing.status)) {
      return errorResponse(
        'INVALID_STATE',
        'Solo richieste in Bozza o Annullate possono essere eliminate',
        400,
      )
    }

    await prisma.purchaseRequest.delete({ where: { id: params.id } })

    return successResponse({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/requests/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore eliminazione', 500)
  }
}
