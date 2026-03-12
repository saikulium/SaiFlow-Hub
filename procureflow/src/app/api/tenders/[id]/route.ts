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
import { updateTenderSchema } from '@/lib/validations/tenders'
import type { TenderDetail } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/tenders')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN', 'MANAGER', 'REQUESTER')
    if (authResult instanceof NextResponse) return authResult

    const tender = await prisma.tender.findUnique({
      where: { id },
      include: {
        documents: { orderBy: { created_at: 'desc' } },
        timeline: { orderBy: { created_at: 'desc' } },
        contracting_authority: { select: { name: true } },
        assigned_to: { select: { name: true } },
        created_by: { select: { name: true } },
      },
    })

    if (!tender) return notFoundResponse('Gara non trovata')

    const detail: TenderDetail = {
      id: tender.id,
      code: tender.code,
      title: tender.title,
      status: tender.status,
      tenderType: tender.tender_type,
      contractingAuthority: tender.contracting_authority?.name ?? null,
      cig: tender.cig,
      baseAmount: tender.base_amount ? Number(tender.base_amount) : null,
      ourOfferAmount: tender.our_offer_amount
        ? Number(tender.our_offer_amount)
        : null,
      submissionDeadline: tender.submission_deadline?.toISOString() ?? null,
      goNoGo: tender.go_no_go,
      goNoGoScore: tender.go_no_go_score,
      assignedTo: tender.assigned_to?.name ?? null,
      category: tender.category,
      createdAt: tender.created_at.toISOString(),
      description: tender.description,
      cup: tender.cup,
      garaNumber: tender.gara_number,
      lottoNumber: tender.lotto_number,
      platformUrl: tender.platform_url,
      anacId: tender.anac_id,
      awardedAmount: tender.awarded_amount
        ? Number(tender.awarded_amount)
        : null,
      currency: tender.currency,
      goNoGoNotes: tender.go_no_go_notes,
      goNoGoDecidedBy: tender.go_no_go_decided_by,
      goNoGoDecidedAt: tender.go_no_go_decided_at?.toISOString() ?? null,
      publicationDate: tender.publication_date?.toISOString() ?? null,
      questionDeadline: tender.question_deadline?.toISOString() ?? null,
      openingDate: tender.opening_date?.toISOString() ?? null,
      awardDate: tender.award_date?.toISOString() ?? null,
      contractStartDate: tender.contract_start_date?.toISOString() ?? null,
      contractEndDate: tender.contract_end_date?.toISOString() ?? null,
      awardCriteria: tender.award_criteria,
      technicalWeight: tender.technical_weight,
      economicWeight: tender.economic_weight,
      ourTechnicalScore: tender.our_technical_score
        ? Number(tender.our_technical_score)
        : null,
      ourEconomicScore: tender.our_economic_score
        ? Number(tender.our_economic_score)
        : null,
      ourTotalScore: tender.our_total_score
        ? Number(tender.our_total_score)
        : null,
      winnerName: tender.winner_name,
      winnerAmount: tender.winner_amount
        ? Number(tender.winner_amount)
        : null,
      participantsCount: tender.participants_count,
      department: tender.department,
      costCenter: tender.cost_center,
      tags: tender.tags,
      createdBy: tender.created_by.name,
      notes: tender.notes,
      documents: tender.documents.map((d) => ({
        id: d.id,
        documentType: d.document_type,
        filename: d.filename,
        fileUrl: d.file_url,
        fileSize: d.file_size,
        mimeType: d.mime_type,
        version: d.version,
        notes: d.notes,
        uploadedBy: d.uploaded_by,
        createdAt: d.created_at.toISOString(),
      })),
      timeline: tender.timeline.map((t) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        description: t.description,
        metadata: t.metadata as Record<string, unknown> | null,
        actor: t.actor,
        createdAt: t.created_at.toISOString(),
      })),
    }

    return successResponse(detail)
  } catch (error) {
    console.error('GET /api/tenders/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel recupero gara', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/tenders')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = updateTenderSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const existing = await prisma.tender.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Gara non trovata')

    const dateFields = [
      'publication_date',
      'question_deadline',
      'submission_deadline',
      'opening_date',
      'contract_start_date',
      'contract_end_date',
    ] as const

    // Build update data, converting date strings to Date objects
    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === undefined) continue
      if (dateFields.includes(key as (typeof dateFields)[number])) {
        updateData[key] = value ? new Date(value as string) : null
      } else if (key === 'platform_url') {
        updateData[key] = value || null
      } else {
        updateData[key] = value
      }
    }

    await prisma.tender.update({
      where: { id },
      data: updateData,
    })

    return successResponse({ id })
  } catch (error) {
    console.error('PATCH /api/tenders/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiornamento gara', 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/tenders')
  if (blocked) return blocked
  try {
    const { id } = params
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const existing = await prisma.tender.findUnique({ where: { id } })
    if (!existing) return notFoundResponse('Gara non trovata')

    if (existing.status !== 'DISCOVERED') {
      return errorResponse(
        'INVALID_STATUS',
        'Solo le gare in stato DISCOVERED possono essere eliminate',
        400,
      )
    }

    await prisma.tender.delete({ where: { id } })

    return successResponse({ id, deleted: true })
  } catch (error) {
    console.error('DELETE /api/tenders/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore eliminazione gara', 500)
  }
}
