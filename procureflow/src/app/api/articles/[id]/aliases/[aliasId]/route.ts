import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
} from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; aliasId: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult
    const alias = await prisma.articleAlias.findFirst({
      where: { id: params.aliasId, article_id: params.id },
    })

    if (!alias) return notFoundResponse('Alias non trovato')

    await prisma.articleAlias.delete({ where: { id: params.aliasId } })

    return successResponse({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/articles/[id]/aliases/[aliasId] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore eliminazione alias', 500)
  }
}
