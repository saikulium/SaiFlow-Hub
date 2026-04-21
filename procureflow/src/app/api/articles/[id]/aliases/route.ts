import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'
import { createAliasSchema } from '@/modules/core/articles'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!article) return notFoundResponse('Articolo non trovato')

    const aliases = await prisma.articleAlias.findMany({
      where: { article_id: params.id },
      orderBy: { created_at: 'desc' },
    })

    return successResponse(aliases)
  } catch (error) {
    console.error('GET /api/articles/[id]/aliases error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!article) return notFoundResponse('Articolo non trovato')

    const body = await req.json()
    const parsed = createAliasSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const alias = await prisma.articleAlias.create({
      data: {
        article_id: params.id,
        alias_type: parsed.data.alias_type,
        alias_code: parsed.data.alias_code,
        alias_label: parsed.data.alias_label || null,
        entity_id: parsed.data.entity_id || null,
        is_primary: parsed.data.is_primary,
      },
    })

    return successResponse(alias)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return errorResponse(
        'DUPLICATE_ALIAS',
        'Questo codice alias esiste già per questa entità',
        409,
      )
    }
    console.error('POST /api/articles/[id]/aliases error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore creazione alias', 500)
  }
}
