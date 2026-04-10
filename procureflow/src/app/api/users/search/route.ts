import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  try {
    const query = req.nextUrl.searchParams.get('q')

    if (!query || query.trim().length < 1) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Il parametro di ricerca deve contenere almeno 1 carattere',
        400,
      )
    }

    const users = await prisma.user.findMany({
      where: {
        name: { contains: query.trim(), mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        role: true,
        department: true,
      },
      take: 5,
    })

    return successResponse(users)
  } catch (error) {
    console.error('GET /api/users/search error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
