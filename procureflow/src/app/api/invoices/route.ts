import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  InvoiceMatchStatus,
  ReconciliationStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { requireAuth } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Validazione query params
// ---------------------------------------------------------------------------

const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  match_status: z.nativeEnum(InvoiceMatchStatus).optional(),
  reconciliation_status: z.nativeEnum(ReconciliationStatus).optional(),
  vendor_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/invoices — Lista fatture paginata con filtri
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const blocked = await requireModule('/api/invoices')
  if (blocked) return blocked
  try {
    const url = req.nextUrl
    const queryParams = Object.fromEntries(url.searchParams.entries())
    const query = invoiceQuerySchema.parse(queryParams)

    const { page, pageSize } = query
    const matchStatus = query.match_status
    const reconciliationStatus = query.reconciliation_status
    const vendorId = query.vendor_id
    const dateFrom = query.date_from
    const dateTo = query.date_to
    const search = query.search

    const where: Prisma.InvoiceWhereInput = {}

    if (matchStatus) {
      where.match_status = matchStatus
    }
    if (reconciliationStatus) {
      where.reconciliation_status = reconciliationStatus
    }
    if (vendorId) {
      where.vendor_id = vendorId
    }
    if (dateFrom || dateTo) {
      const dateFilter: Prisma.DateTimeFilter<'Invoice'> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.invoice_date = dateFilter
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
