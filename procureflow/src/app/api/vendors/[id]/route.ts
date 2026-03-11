import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { updateVendorSchema } from '@/lib/validations/vendor'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: params.id },
      include: {
        contacts: true,
        requests: {
          take: 20,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            priority: true,
            estimated_amount: true,
            created_at: true,
          },
        },
        _count: { select: { requests: true } },
      },
    })

    if (!vendor) return notFoundResponse('Fornitore non trovato')

    return successResponse(vendor)
  } catch (error) {
    console.error('GET /api/vendors/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    const parsed = updateVendorSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.vendor.findUnique({
      where: { id: params.id },
    })

    if (!existing) return notFoundResponse('Fornitore non trovato')

    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
        website: parsed.data.website || null,
        portal_url: parsed.data.portal_url || null,
      },
    })

    return successResponse(vendor)
  } catch (error) {
    console.error('PATCH /api/vendors/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiornamento', 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: params.id },
      include: { _count: { select: { requests: true } } },
    })

    if (!vendor) return notFoundResponse('Fornitore non trovato')

    if (vendor._count.requests > 0) {
      return errorResponse(
        'HAS_REQUESTS',
        'Impossibile eliminare: il fornitore ha richieste associate',
        400,
      )
    }

    await prisma.vendor.delete({ where: { id: params.id } })

    return successResponse({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/vendors/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore eliminazione', 500)
  }
}
