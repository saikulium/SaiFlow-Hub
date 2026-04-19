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
import { createPriceSchema } from '@/modules/core/articles'
import { Prisma } from '@prisma/client'

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

    const prices = await prisma.articlePrice.findMany({
      where: { article_id: params.id },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
    })

    return successResponse(
      prices.map((p) => ({ ...p, unit_price: Number(p.unit_price) })),
    )
  } catch (error) {
    console.error('GET /api/articles/[id]/prices error:', error)
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
    const authResult = await requireRole('ADMIN', 'MANAGER', 'REQUESTER')
    if (authResult instanceof NextResponse) return authResult

    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!article) return notFoundResponse('Articolo non trovato')

    const body = await req.json()
    const parsed = createPriceSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const price = await prisma.articlePrice.create({
      data: {
        article_id: params.id,
        vendor_id: parsed.data.vendor_id,
        unit_price: new Prisma.Decimal(parsed.data.unit_price),
        currency: parsed.data.currency,
        min_quantity: parsed.data.min_quantity,
        valid_from: parsed.data.valid_from
          ? new Date(parsed.data.valid_from)
          : new Date(),
        valid_until: parsed.data.valid_until
          ? new Date(parsed.data.valid_until)
          : null,
        source: parsed.data.source,
        notes: parsed.data.notes || null,
      },
      include: { vendor: { select: { id: true, name: true } } },
    })

    return successResponse({ ...price, unit_price: Number(price.unit_price) })
  } catch (error) {
    console.error('POST /api/articles/[id]/prices error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiunta prezzo', 500)
  }
}
