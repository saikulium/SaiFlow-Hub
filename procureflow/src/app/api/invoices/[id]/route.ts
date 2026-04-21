import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'

const invoicePatchSchema = z
  .object({
    reconciliation_notes: z.string().max(2000).optional(),
    sdi_status: z.enum(['RECEIVED', 'ACCEPTED', 'REJECTED']).optional(),
  })
  .refine(
    (data) =>
      data.reconciliation_notes !== undefined || data.sdi_status !== undefined,
    { message: 'Almeno un campo da aggiornare' },
  )

// ---------------------------------------------------------------------------
// GET /api/invoices/[id] — Dettaglio fattura
// PATCH /api/invoices/[id] — Aggiornamento manuale
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/invoices')
  if (blocked) return blocked
  try {
    const authResult = await requireRole(
      'ADMIN',
      'MANAGER',
      'REQUESTER',
      'VIEWER',
    )
    if (authResult instanceof NextResponse) return authResult

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        line_items: { orderBy: { line_number: 'asc' } },
        vendor: { select: { id: true, name: true, code: true, email: true } },
        purchase_request: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            estimated_amount: true,
            actual_amount: true,
            requester: { select: { id: true, name: true } },
            items: true,
          },
        },
        timeline_events: {
          orderBy: { created_at: 'desc' },
          take: 20,
        },
      },
    })

    if (!invoice) {
      return notFoundResponse('Fattura non trovata')
    }

    return successResponse(invoice)
  } catch (error) {
    console.error('GET /api/invoices/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/invoices')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = invoicePatchSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!invoice) {
      return notFoundResponse('Fattura non trovata')
    }

    const updateData: Record<string, string> = {}
    if (parsed.data.reconciliation_notes !== undefined) {
      updateData.reconciliation_notes = parsed.data.reconciliation_notes
    }
    if (parsed.data.sdi_status !== undefined) {
      updateData.sdi_status = parsed.data.sdi_status
    }

    const updated = await prisma.invoice.update({
      where: { id: params.id },
      data: updateData,
    })

    return successResponse(updated)
  } catch (error) {
    console.error('PATCH /api/invoices/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/invoices')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { id: true, reconciliation_status: true },
    })

    if (!invoice) return notFoundResponse('Fattura non trovata')

    if (['APPROVED', 'PAID'].includes(invoice.reconciliation_status)) {
      return errorResponse(
        'INVALID_STATE',
        'Impossibile eliminare fatture approvate o pagate',
        400,
      )
    }

    await prisma.invoice.delete({ where: { id: params.id } })

    return successResponse({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/invoices/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore eliminazione fattura', 500)
  }
}
