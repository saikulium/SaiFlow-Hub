import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse } from '@/lib/api-response'
import { dismissInsight } from '@/server/services/insight.service'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params
  await dismissInsight(id)
  return successResponse({ dismissed: true })
}
