import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { CommessaStatus } from '@prisma/client'
import {
  assertCommessaTransition,
  CommessaTransitionError,
} from '@/lib/commessa-state-machine'
import type {
  CommessaDetail,
  CommessaRequestItem,
  CommessaDashboardStats,
} from '@/types'

// Re-export for consumer convenience
export { CommessaTransitionError }

// ---------------------------------------------------------------------------
// computeMargin — pure function, never stored
// ---------------------------------------------------------------------------

export function computeMargin(
  clientValue: Prisma.Decimal | null,
  totalActual: Prisma.Decimal | null,
  totalEstimated: Prisma.Decimal | null,
): { margin: number | null; marginPercent: number | null } {
  if (!clientValue) {
    return { margin: null, marginPercent: null }
  }

  const cv = Number(clientValue)
  const cost =
    totalActual != null
      ? Number(totalActual)
      : totalEstimated != null
        ? Number(totalEstimated)
        : null

  if (cost == null) {
    return { margin: cv, marginPercent: 100 }
  }

  const margin = cv - cost
  const marginPercent = cv === 0 ? null : (margin / cv) * 100

  return {
    margin: Math.round(margin * 100) / 100,
    marginPercent:
      marginPercent != null ? Math.round(marginPercent * 100) / 100 : null,
  }
}

// ---------------------------------------------------------------------------
// getCommessaDetail — full detail with margin, requests, suggestions, timeline
// ---------------------------------------------------------------------------

export async function getCommessaDetail(
  code: string,
): Promise<CommessaDetail | null> {
  const commessa = await prisma.commessa.findUnique({
    where: { code },
    include: {
      client: { select: { name: true, code: true } },
      requests: {
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          priority: true,
          estimated_amount: true,
          actual_amount: true,
          is_ai_suggested: true,
          vendor: { select: { name: true } },
        },
      },
      timeline: {
        orderBy: { created_at: 'desc' },
        take: 50,
      },
    },
  })

  if (!commessa) return null

  const confirmedRequests = commessa.requests.filter((r) => !r.is_ai_suggested)
  const suggestions = commessa.requests.filter((r) => r.is_ai_suggested)

  const totalActual = confirmedRequests.reduce((sum, r) => {
    const val = r.actual_amount ? Number(r.actual_amount) : 0
    return sum + val
  }, 0)

  const totalEstimated = confirmedRequests.reduce((sum, r) => {
    const val = r.estimated_amount ? Number(r.estimated_amount) : 0
    return sum + val
  }, 0)

  const totalActualDecimal =
    totalActual > 0 ? new Prisma.Decimal(totalActual) : null
  const totalEstimatedDecimal =
    totalEstimated > 0 ? new Prisma.Decimal(totalEstimated) : null

  const { margin, marginPercent } = computeMargin(
    commessa.client_value,
    totalActualDecimal,
    totalEstimatedDecimal,
  )

  const mapRequest = (
    r: (typeof commessa.requests)[number],
  ): CommessaRequestItem => ({
    id: r.id,
    code: r.code,
    title: r.title,
    status: r.status,
    priority: r.priority,
    estimatedAmount: r.estimated_amount ? Number(r.estimated_amount) : null,
    actualAmount: r.actual_amount ? Number(r.actual_amount) : null,
    vendorName: r.vendor?.name ?? null,
    isAiSuggested: r.is_ai_suggested,
  })

  return {
    id: commessa.id,
    code: commessa.code,
    title: commessa.title,
    description: commessa.description,
    status: commessa.status,
    clientId: commessa.client_id,
    clientName: commessa.client.name,
    clientCode: commessa.client.code,
    clientValue: commessa.client_value ? Number(commessa.client_value) : null,
    totalCosts: totalActual > 0 ? totalActual : totalEstimated,
    margin,
    marginPercent,
    currency: commessa.currency,
    receivedAt: commessa.received_at?.toISOString() ?? null,
    deadline: commessa.deadline?.toISOString() ?? null,
    completedAt: commessa.completed_at?.toISOString() ?? null,
    category: commessa.category,
    department: commessa.department,
    priority: commessa.priority,
    tags: commessa.tags,
    assignedTo: commessa.assigned_to,
    emailMessageId: commessa.email_message_id,
    requestsCount: confirmedRequests.length,
    suggestionsCount: suggestions.length,
    createdAt: commessa.created_at.toISOString(),
    requests: confirmedRequests.map(mapRequest),
    suggestions: suggestions.map(mapRequest),
    timeline: commessa.timeline.map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      description: t.description,
      metadata: t.metadata as Record<string, unknown> | null,
      actor: t.actor,
      createdAt: t.created_at.toISOString(),
    })),
  }
}

// ---------------------------------------------------------------------------
// updateCommessaStatus — validates transition via state machine, creates timeline
// ---------------------------------------------------------------------------

export async function updateCommessaStatus(
  code: string,
  newStatus: CommessaStatus,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const commessa = await tx.commessa.findUnique({
      where: { code },
      select: { id: true, status: true },
    })

    if (!commessa) {
      throw new Error('Commessa non trovata')
    }

    assertCommessaTransition(commessa.status, newStatus)

    const completedAt = newStatus === 'COMPLETED' ? new Date() : undefined

    await tx.commessa.update({
      where: { code },
      data: {
        status: newStatus,
        ...(completedAt && { completed_at: completedAt }),
      },
    })

    await tx.commessaTimeline.create({
      data: {
        commessa_id: commessa.id,
        type: 'status_change',
        title: `Stato aggiornato: ${commessa.status} → ${newStatus}`,
        metadata: {
          from: commessa.status,
          to: newStatus,
        },
      },
    })
  })
}

// ---------------------------------------------------------------------------
// getCommessaDashboardStats — used by /api/commesse/stats
// ---------------------------------------------------------------------------

export async function getCommessaDashboardStats(): Promise<CommessaDashboardStats> {
  const activeStatuses: CommessaStatus[] = [
    'DRAFT',
    'PLANNING',
    'ACTIVE',
    'ON_HOLD',
  ]

  const activeCommesse = await prisma.commessa.findMany({
    where: { status: { in: activeStatuses } },
    include: {
      client: { select: { name: true } },
      requests: {
        where: { is_ai_suggested: false },
        select: {
          estimated_amount: true,
          actual_amount: true,
        },
      },
    },
    orderBy: { deadline: 'asc' },
  })

  const now = new Date()
  const dueSoonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  let totalValue = 0
  const margins: number[] = []
  let dueSoonCount = 0

  const enriched = activeCommesse.map((c) => {
    const totalActual = c.requests.reduce(
      (sum, r) => sum + (r.actual_amount ? Number(r.actual_amount) : 0),
      0,
    )
    const totalEstimated = c.requests.reduce(
      (sum, r) => sum + (r.estimated_amount ? Number(r.estimated_amount) : 0),
      0,
    )

    const { marginPercent } = computeMargin(
      c.client_value,
      totalActual > 0 ? new Prisma.Decimal(totalActual) : null,
      totalEstimated > 0 ? new Prisma.Decimal(totalEstimated) : null,
    )

    if (c.client_value) {
      totalValue += Number(c.client_value)
    }

    if (marginPercent != null) {
      margins.push(marginPercent)
    }

    if (c.deadline && c.deadline <= dueSoonThreshold && c.deadline >= now) {
      dueSoonCount++
    }

    return {
      code: c.code,
      title: c.title,
      clientName: c.client.name,
      deadline: c.deadline?.toISOString() ?? null,
      marginPercent,
      status: c.status,
    }
  })

  const avgMarginPercent =
    margins.length > 0
      ? Math.round(
          (margins.reduce((a, b) => a + b, 0) / margins.length) * 100,
        ) / 100
      : 0

  const topCommesse = enriched.slice(0, 5)

  return {
    activeCount: activeCommesse.length,
    totalValueInProgress: Math.round(totalValue * 100) / 100,
    avgMarginPercent,
    dueSoonCount,
    topCommesse,
  }
}
