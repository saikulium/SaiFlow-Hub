import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'

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

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!invoice) {
      return notFoundResponse('Fattura non trovata')
    }

    // Campi aggiornabili manualmente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    if (body.reconciliation_notes !== undefined) {
      updateData.reconciliation_notes = body.reconciliation_notes
    }
    if (body.sdi_status !== undefined) {
      updateData.sdi_status = body.sdi_status
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse('NO_CHANGES', 'Nessun campo da aggiornare', 400)
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
