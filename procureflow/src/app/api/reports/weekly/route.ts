import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { errorResponse } from '@/lib/api-response'

// ---------------------------------------------------------------------------
// GET /api/reports/weekly
//
// Genera un report settimanale in CSV con:
//   - Richieste create, approvate, consegnate
//   - Fatture ricevute e riconciliate
//   - Spesa totale ordinato
//   - Fornitori più attivi
//   - Consegne in ritardo
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [
      requestsCreated,
      requestsApproved,
      requestsDelivered,
      invoicesReceived,
      invoicesReconciled,
      spendResult,
      overdueCount,
      topVendors,
      recentRequests,
    ] = await prisma.$transaction([
      // Richieste create questa settimana
      prisma.purchaseRequest.count({
        where: { created_at: { gte: weekAgo } },
      }),
      // Richieste approvate
      prisma.purchaseRequest.count({
        where: {
          status: { in: ['APPROVED', 'ORDERED', 'SHIPPED', 'DELIVERED'] },
          updated_at: { gte: weekAgo },
        },
      }),
      // Richieste consegnate
      prisma.purchaseRequest.count({
        where: {
          status: 'DELIVERED',
          delivered_at: { gte: weekAgo },
        },
      }),
      // Fatture ricevute
      prisma.invoice.count({
        where: { received_at: { gte: weekAgo } },
      }),
      // Fatture riconciliate
      prisma.invoice.count({
        where: {
          reconciliation_status: { in: ['MATCHED', 'APPROVED', 'PAID'] },
          updated_at: { gte: weekAgo },
        },
      }),
      // Spesa totale ordinato questa settimana
      prisma.purchaseRequest.aggregate({
        _sum: { actual_amount: true },
        where: {
          status: { in: ['ORDERED', 'SHIPPED', 'DELIVERED'] },
          ordered_at: { gte: weekAgo },
        },
      }),
      // Consegne in ritardo
      prisma.purchaseRequest.count({
        where: {
          status: { in: ['ORDERED', 'SHIPPED'] },
          expected_delivery: { lt: now },
        },
      }),
      // Top 5 fornitori per richieste create
      prisma.purchaseRequest.groupBy({
        by: ['vendor_id'],
        _count: { id: true },
        where: {
          created_at: { gte: weekAgo },
          vendor_id: { not: null },
        },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      // Ultime 10 richieste create
      prisma.purchaseRequest.findMany({
        where: { created_at: { gte: weekAgo } },
        select: {
          code: true,
          title: true,
          status: true,
          estimated_amount: true,
          created_at: true,
          vendor: { select: { name: true } },
          requester: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),
    ])

    // Resolve vendor names
    const vendorIds = topVendors
      .map((v) => v.vendor_id)
      .filter((id): id is string => id !== null)

    const vendors =
      vendorIds.length > 0
        ? await prisma.vendor.findMany({
            where: { id: { in: vendorIds } },
            select: { id: true, name: true },
          })
        : []

    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]))

    const totalSpend = Number(spendResult._sum.actual_amount ?? 0)

    // Build CSV
    const dateStr = now.toLocaleDateString('it-IT')
    const weekAgoStr = weekAgo.toLocaleDateString('it-IT')

    const lines: string[] = [
      `Report Settimanale ProcureFlow`,
      `Periodo: ${weekAgoStr} - ${dateStr}`,
      ``,
      `--- RIEPILOGO ---`,
      `Metrica,Valore`,
      `Richieste create,${requestsCreated}`,
      `Richieste approvate,${requestsApproved}`,
      `Richieste consegnate,${requestsDelivered}`,
      `Fatture ricevute,${invoicesReceived}`,
      `Fatture riconciliate,${invoicesReconciled}`,
      `Spesa totale ordinato,"${totalSpend.toLocaleString('it-IT', { minimumFractionDigits: 2 })} EUR"`,
      `Consegne in ritardo,${overdueCount}`,
      ``,
      `--- FORNITORI PIU ATTIVI ---`,
      `Fornitore,Richieste`,
      ...topVendors.map((v) => {
        const name = v.vendor_id
          ? (vendorMap.get(v.vendor_id) ?? 'Sconosciuto')
          : 'N/D'
        const count =
          typeof v._count === 'object' && v._count
            ? ((v._count as Record<string, number>).id ?? 0)
            : 0
        return `${name},${count}`
      }),
      ``,
      `--- RICHIESTE DELLA SETTIMANA ---`,
      `Codice,Titolo,Stato,Importo,Fornitore,Richiedente,Data`,
      ...recentRequests.map((r) =>
        [
          r.code,
          `"${r.title.replace(/"/g, '""')}"`,
          r.status,
          r.estimated_amount ? Number(r.estimated_amount).toFixed(2) : '',
          r.vendor?.name ?? '',
          r.requester.name,
          r.created_at.toLocaleDateString('it-IT'),
        ].join(','),
      ),
    ]

    const csv = lines.join('\n')
    const filename = `report-settimanale-${now.toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/reports/weekly error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore generazione report', 500)
  }
}
