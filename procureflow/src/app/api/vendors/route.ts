import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response'
import { createVendorSchema } from '@/lib/validations/vendor'

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get('search') || undefined
    const status = req.nextUrl.searchParams.get('status') || undefined

    const where = {
      ...(status && { status: { equals: status as 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED' | 'PENDING_REVIEW' } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { code: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const vendors = await prisma.vendor.findMany({
      where,
      include: {
        _count: { select: { requests: true } },
      },
      orderBy: { name: 'asc' },
    })

    return successResponse(vendors)
  } catch (error) {
    console.error('GET /api/vendors error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = createVendorSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.vendor.findUnique({
      where: { code: parsed.data.code },
    })

    if (existing) {
      return errorResponse('DUPLICATE_CODE', 'Codice fornitore già esistente', 409)
    }

    const vendor = await prisma.vendor.create({
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
        website: parsed.data.website || null,
        portal_url: parsed.data.portal_url || null,
      },
    })

    return successResponse(vendor)
  } catch (error) {
    console.error('POST /api/vendors error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore creazione fornitore', 500)
  }
}
