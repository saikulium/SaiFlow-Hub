import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const requestId = searchParams.get('request_id')
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const pageSize = Math.min(
      50,
      Math.max(1, Number(searchParams.get('pageSize') ?? '20')),
    )

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (requestId) where.request_id = requestId

    const [reviews, total] = await prisma.$transaction([
      prisma.priceVarianceReview.findMany({
        where,
        include: {
          request: {
            select: { id: true, code: true, title: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.priceVarianceReview.count({ where }),
    ])

    const results = reviews.map((r) => ({
      ...r,
      total_old_amount: Number(r.total_old_amount),
      total_new_amount: Number(r.total_new_amount),
      total_delta: Number(r.total_delta),
    }))

    return successResponse(results, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/price-variance error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}
