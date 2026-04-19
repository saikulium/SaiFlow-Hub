import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { articleSearchSchema } from '@/modules/core/articles'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = articleSearchSchema.safeParse(params)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { q, limit } = parsed.data
    const upperQ = q.toUpperCase()

    const articles = await prisma.article.findMany({
      where: {
        is_active: true,
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { manufacturer_code: { contains: q, mode: 'insensitive' } },
          {
            aliases: {
              some: { alias_code: { contains: upperQ, mode: 'insensitive' } },
            },
          },
        ],
      },
      include: {
        aliases: {
          where: { alias_code: { contains: upperQ, mode: 'insensitive' } },
          take: 1,
        },
      },
      take: limit,
      orderBy: { name: 'asc' },
    })

    const results = articles.map((a) => {
      let matched_via = 'name'
      let matched_value = a.name

      if (a.code.toLowerCase().includes(q.toLowerCase())) {
        matched_via = 'code'
        matched_value = a.code
      } else if (a.aliases.length > 0 && a.aliases[0]) {
        matched_via = 'alias'
        matched_value = a.aliases[0].alias_code
      } else if (
        a.manufacturer_code &&
        a.manufacturer_code.toLowerCase().includes(q.toLowerCase())
      ) {
        matched_via = 'manufacturer_code'
        matched_value = a.manufacturer_code
      }

      return {
        id: a.id,
        code: a.code,
        name: a.name,
        category: a.category,
        unit_of_measure: a.unit_of_measure,
        matched_via,
        matched_value,
      }
    })

    return successResponse(results)
  } catch (error) {
    console.error('GET /api/articles/search error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore ricerca', 500)
  }
}
