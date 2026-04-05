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
import { updateArticleSchema } from '@/lib/validations/article'

async function findArticle(idOrCode: string) {
  const article = await prisma.article.findUnique({
    where: { id: idOrCode },
    include: {
      aliases: { orderBy: { created_at: 'desc' } },
      prices: {
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      },
      _count: {
        select: {
          aliases: true,
          prices: true,
          request_items: true,
          invoice_items: true,
          materials: true,
        },
      },
    },
  })

  if (article) return article

  return prisma.article.findUnique({
    where: { code: idOrCode },
    include: {
      aliases: { orderBy: { created_at: 'desc' } },
      prices: {
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      },
      _count: {
        select: {
          aliases: true,
          prices: true,
          request_items: true,
          invoice_items: true,
          materials: true,
        },
      },
    },
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const article = await findArticle(params.id)
    if (!article) return notFoundResponse('Articolo non trovato')

    return successResponse({
      ...article,
      prices: article.prices.map((p) => ({
        ...p,
        unit_price: Number(p.unit_price),
      })),
    })
  } catch (error) {
    console.error('GET /api/articles/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = updateArticleSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!existing) return notFoundResponse('Articolo non trovato')

    const { aliases: _aliases, ...data } = parsed.data

    const updated = await prisma.article.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.category !== undefined && { category: data.category || null }),
        ...(data.unit_of_measure !== undefined && { unit_of_measure: data.unit_of_measure }),
        ...(data.manufacturer !== undefined && { manufacturer: data.manufacturer || null }),
        ...(data.manufacturer_code !== undefined && { manufacturer_code: data.manufacturer_code || null }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.tags !== undefined && { tags: data.tags }),
      },
      include: {
        aliases: true,
        _count: { select: { aliases: true, prices: true } },
      },
    })

    return successResponse(updated)
  } catch (error) {
    console.error('PATCH /api/articles/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiornamento', 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const existing = await prisma.article.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        _count: { select: { request_items: true, invoice_items: true } },
      },
    })

    if (!existing) return notFoundResponse('Articolo non trovato')

    if (existing._count.request_items > 0 || existing._count.invoice_items > 0) {
      const updated = await prisma.article.update({
        where: { id: params.id },
        data: { is_active: false },
      })
      return successResponse({ ...updated, soft_deleted: true })
    }

    await prisma.article.delete({ where: { id: params.id } })
    return successResponse({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/articles/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore eliminazione', 500)
  }
}
