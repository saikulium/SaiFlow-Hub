import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'

// ---------------------------------------------------------------------------
// GET /api/invoices — Lista fatture paginata con filtri
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const blocked = await requireModule('/api/invoices')
  if (blocked) return blocked
  try {
    const url = req.nextUrl
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)),
    )
    const matchStatus = url.searchParams.get('match_status')
    const reconciliationStatus = url.searchParams.get('reconciliation_status')
    const vendorId = url.searchParams.get('vendor_id')
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    const search = url.searchParams.get('search')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (matchStatus) {
      where.match_status = matchStatus
    }
    if (reconciliationStatus) {
      where.reconciliation_status = reconciliationStatus
    }
    if (vendorId) {
      where.vendor_id = vendorId
    }
    if (dateFrom) {
      where.invoice_date = { ...where.invoice_date, gte: new Date(dateFrom) }
    }
    if (dateTo) {
      where.invoice_date = { ...where.invoice_date, lte: new Date(dateTo) }
    }
    if (search) {
      where.OR = [
        { invoice_number: { contains: search, mode: 'insensitive' } },
        { supplier_name: { contains: search, mode: 'insensitive' } },
        { causale: { contains: search, mode: 'insensitive' } },
        { pr_code_extracted: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { received_at: 'desc' },
        select: {
          id: true,
          invoice_number: true,
          invoice_date: true,
          document_type: true,
          total_amount: true,
          currency: true,
          supplier_name: true,
          supplier_vat_id: true,
          match_status: true,
          match_confidence: true,
          reconciliation_status: true,
          pr_code_extracted: true,
          received_at: true,
          vendor: { select: { id: true, name: true, code: true } },
          purchase_request: { select: { id: true, code: true, title: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ])

    return successResponse(invoices, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/invoices error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}
