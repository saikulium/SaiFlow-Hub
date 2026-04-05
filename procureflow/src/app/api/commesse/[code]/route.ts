import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { updateCommessaSchema } from '@/lib/validations/commesse'
import {
  getCommessaDetail,
  updateCommessaStatus,
  CommessaTransitionError,
} from '@/server/services/commessa.service'
import { Prisma, type CommessaStatus } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  const blocked = await requireModule('/api/commesse')
  if (blocked) return blocked

  try {
    const detail = await getCommessaDetail(params.code)

    if (!detail) return notFoundResponse('Commessa non trovata')

    return successResponse(detail)
  } catch (error) {
    console.error('GET /api/commesse/[code] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const blocked = await requireModule('/api/commesse')
  if (blocked) return blocked

  try {
    const body = await req.json()
    const parsed = updateCommessaSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.commessa.findUnique({
      where: { code: params.code },
    })

    if (!existing) return notFoundResponse('Commessa non trovata')

    const { status, client_value, deadline, ...rest } = parsed.data

    // Handle status change through the state machine
    if (status && status !== existing.status) {
      try {
        await updateCommessaStatus(params.code, status as CommessaStatus)
      } catch (error) {
        if (error instanceof CommessaTransitionError) {
          return errorResponse('INVALID_TRANSITION', error.message, 400)
        }
        throw error
      }
    }

    // Build update payload for non-status fields
    const hasFieldUpdates = Object.keys(rest).length > 0 ||
      client_value !== undefined ||
      deadline !== undefined

    if (hasFieldUpdates) {
      await prisma.commessa.update({
        where: { code: params.code },
        data: {
          ...rest,
          ...(client_value !== undefined && {
            client_value: client_value != null
              ? new Prisma.Decimal(client_value)
              : null,
          }),
          ...(deadline !== undefined && {
            deadline: deadline ? new Date(deadline) : null,
          }),
        },
      })
    }

    // Return fresh detail
    const detail = await getCommessaDetail(params.code)

    return successResponse(detail)
  } catch (error) {
    console.error('PATCH /api/commesse/[code] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiornamento commessa', 500)
  }
}
