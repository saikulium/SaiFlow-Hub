import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { dismissInsight } from '@/server/services/insight.service'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)
  }

  const { id } = await params
  await dismissInsight(id)
  return successResponse({ dismissed: true })
}
