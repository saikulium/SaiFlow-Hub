import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'

export async function GET() {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked

  try {
    const count = await prisma.article.count({
      where: { verified: false, is_active: true },
    })

    return successResponse({ count })
  } catch (error) {
    console.error('GET /api/articles/unverified/count error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}
