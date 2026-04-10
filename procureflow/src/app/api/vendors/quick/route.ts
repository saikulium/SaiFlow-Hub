import { prisma } from '@/lib/db'
import { successResponse } from '@/lib/api-response'
import { quickCreateVendorSchema } from '@/lib/validations/vendor'
import { withApiHandler } from '@/lib/api-handler'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'

// POST /api/vendors/quick — Quick-create vendor with auto-generated code
// Minimal fields: name, email, phone. Status: PENDING_REVIEW.
// Available to any authenticated user (so operators can create vendors inline).

export const POST = withApiHandler(
  {
    auth: true,
    bodySchema: quickCreateVendorSchema,
    errorMessage: 'Errore creazione rapida fornitore',
  },
  async ({ body }) => {
    const vendor = await prisma.$transaction(async (tx) => {
      const code = await generateNextCodeAtomic('FOR', 'vendors', tx, true)

      return tx.vendor.create({
        data: {
          code,
          name: body.name,
          email: body.email || null,
          phone: body.phone || null,
          status: 'PENDING_REVIEW',
        },
        select: {
          id: true,
          code: true,
          name: true,
          email: true,
          phone: true,
          status: true,
        },
      })
    })

    return successResponse(vendor)
  },
)
