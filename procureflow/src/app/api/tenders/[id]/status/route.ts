import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { assertModuleEnabled } from '@/lib/module-guard'
import { statusTransitionSchema } from '@/lib/validations/tenders'
import { validateStatusTransition } from '@/server/services/tenders.service'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const packGate = assertModuleEnabled('tenders')
  if (packGate) return packGate
  const blocked = await requireModule('/api/tenders')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = statusTransitionSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const tender = await prisma.tender.findUnique({ where: { id } })
    if (!tender) return notFoundResponse('Gara non trovata')

    const validation = validateStatusTransition(
      tender.status,
      parsed.data.status,
    )
    if (!validation.valid) {
      return errorResponse('INVALID_TRANSITION', validation.reason!, 400)
    }

    const newStatus = parsed.data.status

    await prisma.$transaction([
      prisma.tender.update({
        where: { id },
        data: { status: newStatus as never },
      }),
      prisma.tenderTimeline.create({
        data: {
          tender_id: id,
          type: 'status_change',
          title: `Stato cambiato: ${tender.status} \u2192 ${newStatus}`,
          description: parsed.data.notes ?? null,
          actor: authResult.name,
        },
      }),
    ])

    return successResponse({ id, status: newStatus })
  } catch (error) {
    console.error('PATCH /api/tenders/[id]/status error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel cambio stato gara', 500)
  }
}
