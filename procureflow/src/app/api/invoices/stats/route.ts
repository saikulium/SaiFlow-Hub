import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { requireAuth } from '@/lib/auth'

// ---------------------------------------------------------------------------
// GET /api/invoices/stats — Badge counts + KPI per dashboard
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const blocked = await requireModule('/api/invoices')
    if (blocked) return blocked

    const [
      totalInvoices,
      unmatchedInvoices,
      pendingReconciliation,
      disputedInvoices,
      totalInvoicedResult,
      totalApprovedResult,
    ] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.count({
        where: { match_status: 'UNMATCHED' },
      }),
      prisma.invoice.count({
        where: { reconciliation_status: { in: ['PENDING', 'MATCHED'] } },
      }),
      prisma.invoice.count({
        where: { reconciliation_status: 'DISPUTED' },
      }),
      prisma.invoice.aggregate({
        _sum: { total_amount: true },
      }),
      prisma.invoice.aggregate({
        _sum: { total_amount: true },
        where: { reconciliation_status: 'APPROVED' },
      }),
    ])

    return successResponse({
      totalInvoices,
      unmatchedInvoices,
      pendingReconciliation,
      disputedInvoices,
      totalInvoicedAmount: Number(totalInvoicedResult._sum.total_amount ?? 0),
      totalApprovedAmount: Number(totalApprovedResult._sum.total_amount ?? 0),
      // Badge counts for sidebar
      unmatched: unmatchedInvoices,
    })
  } catch (error) {
    console.error('GET /api/invoices/stats error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
