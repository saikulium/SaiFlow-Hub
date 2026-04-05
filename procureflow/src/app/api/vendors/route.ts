import { prisma } from '@/lib/db'
import { successResponse } from '@/lib/api-response'
import { createVendorSchema } from '@/lib/validations/vendor'
import { withApiHandler } from '@/lib/api-handler'

export const GET = withApiHandler(
  { auth: true, errorMessage: 'Errore nel recupero fornitori' },
  async ({ req }) => {
    const search = req.nextUrl.searchParams.get('search') || undefined
    const status = req.nextUrl.searchParams.get('status') || undefined

    const where = {
      ...(status && {
        status: {
          equals: status as
            | 'ACTIVE'
            | 'INACTIVE'
            | 'BLACKLISTED'
            | 'PENDING_REVIEW',
        },
      }),
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
  },
)

export const POST = withApiHandler(
  {
    auth: ['ADMIN', 'MANAGER'],
    bodySchema: createVendorSchema,
    errorMessage: 'Errore creazione fornitore',
  },
  async ({ body }) => {
    const vendor = await prisma.vendor.create({
      data: {
        ...body,
        email: body.email || null,
        website: body.website || null,
        portal_url: body.portal_url || null,
      },
    })

    return successResponse(vendor)
  },
)
