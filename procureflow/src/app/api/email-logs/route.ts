import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getEmailLogs } from '@/server/services/email-log.service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authResult = await requireRole('ADMIN', 'MANAGER')
  if (authResult instanceof NextResponse) return authResult

  try {
    const params = req.nextUrl.searchParams
    const result = await getEmailLogs({
      intent: params.get('intent') ?? undefined,
      requires_human_decision:
        params.get('requires_human_decision') === 'true' ? true : undefined,
      matched_request_code: params.get('request_code') ?? undefined,
      page: params.get('page') ? Number(params.get('page')) : undefined,
      pageSize: params.get('pageSize')
        ? Number(params.get('pageSize'))
        : undefined,
    })
    return successResponse(result.logs, {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    })
  } catch (error) {
    console.error('GET /api/email-logs error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}
