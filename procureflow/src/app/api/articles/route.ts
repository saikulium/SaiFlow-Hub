import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'
import { createArticleSchema, articleQuerySchema } from '@/lib/validations/article'
import { Prisma } from '@prisma/client'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'

export async function GET(req: NextRequest) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = articleQuerySchema.safeParse(params)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { page, pageSize, search, category, is_active, sort, order } = parsed.data

    const where: Prisma.ArticleWhereInput = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { manufacturer_code: { contains: search, mode: 'insensitive' } },
        { aliases: { some: { alias_code: { contains: search.toUpperCase(), mode: 'insensitive' } } } },
      ]
    }
    if (category) {
      where.category = category
    }
    if (is_active !== undefined) {
      where.is_active = is_active
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: {
          _count: { select: { aliases: true, prices: true } },
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.article.count({ where }),
    ])

    return successResponse(articles, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/articles error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = createArticleSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { aliases, ...data } = parsed.data

    const code = await generateNextCodeAtomic('ART', 'articles')

    const article = await prisma.article.create({
      data: {
        code,
        name: data.name,
        description: data.description || null,
        category: data.category || null,
        unit_of_measure: data.unit_of_measure,
        manufacturer: data.manufacturer || null,
        manufacturer_code: data.manufacturer_code || null,
        notes: data.notes || null,
        tags: data.tags,
        aliases: {
          create: aliases.map((a) => ({
            alias_type: a.alias_type,
            alias_code: a.alias_code,
            alias_label: a.alias_label || null,
            entity_id: a.entity_id || null,
            is_primary: a.is_primary,
          })),
        },
      },
      include: {
        aliases: true,
        _count: { select: { aliases: true, prices: true } },
      },
    })

    return successResponse(article)
  } catch (error) {
    console.error('POST /api/articles error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nella creazione', 500)
  }
}
