import {
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  PIPELINE_STATUSES,
} from '../constants'
import type { GoNoGoScoreInput } from '@/types'

/**
 * Validates whether a status transition is allowed in the tender state machine.
 * Pure function — no side effects.
 */
export function validateStatusTransition(
  from: string,
  to: string,
): { valid: boolean; reason?: string } {
  const allowed = VALID_TRANSITIONS[from]

  if (!allowed) {
    return {
      valid: false,
      reason: `Stato "${from}" non riconosciuto nella macchina a stati delle gare.`,
    }
  }

  if (allowed.includes(to)) {
    return { valid: true }
  }

  const reason =
    allowed.length === 0
      ? `Dallo stato "${from}" non è possibile effettuare alcuna transizione (stato terminale).`
      : `Transizione da "${from}" a "${to}" non consentita. Transizioni valide: ${allowed.join(', ')}.`

  return { valid: false, reason }
}

/**
 * Computes a Go/No-Go aggregate score and recommendation.
 *
 * Thresholds:
 *   0–40  → NO_GO
 *   41–60 → VALUTARE
 *   61–100 → GO
 */
export function computeGoNoGoScore(scores: GoNoGoScoreInput): {
  totalScore: number
  recommendation: 'GO' | 'VALUTARE' | 'NO_GO'
} {
  const totalScore =
    scores.margin +
    scores.technical +
    scores.experience +
    scores.risk +
    scores.workload +
    scores.strategic

  const recommendation: 'GO' | 'VALUTARE' | 'NO_GO' =
    totalScore >= 61 ? 'GO' : totalScore >= 41 ? 'VALUTARE' : 'NO_GO'

  return { totalScore, recommendation }
}

/**
 * Generates a tender code in the format GARA-YYYY-NNNNN.
 */
export function generateTenderCode(
  year: number,
  sequenceNumber: number,
): string {
  const paddedSeq = String(sequenceNumber).padStart(5, '0')
  return `GARA-${year}-${paddedSeq}`
}

/**
 * Returns true if the given status is terminal (no outgoing transitions).
 */
export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status)
}

/**
 * Returns true if the given status is part of the active pipeline.
 */
export function isPipelineStatus(status: string): boolean {
  return (PIPELINE_STATUSES as readonly string[]).includes(status)
}

// ---------------------------------------------------------------------------
// DB-dependent functions
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db'
import { TENDER_STATUS_CONFIG } from '../constants'
import type { TenderDashboardStats } from '@/types'

/**
 * Generates the next sequential tender code for the current year.
 * Format: GARA-YYYY-NNNNN
 */
export async function getNextTenderCode(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `GARA-${year}-`

  const latest = await prisma.tender.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  })

  const nextSeq = latest ? Number(latest.code.replace(prefix, '')) + 1 : 1

  return generateTenderCode(year, nextSeq)
}

/**
 * Computes dashboard statistics for the Tenders module.
 */
export async function getTenderDashboardStats(): Promise<TenderDashboardStats> {
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const twelveMonthsAgo = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
  )
  const twentyFourMonthsAgo = new Date(
    now.getFullYear() - 2,
    now.getMonth(),
    now.getDate(),
  )

  const terminalList = [...TERMINAL_STATUSES] as string[]

  // Run independent queries in parallel
  const [
    activeTenders,
    pipelineAgg,
    upcomingDeadlines,
    wonRecent,
    lostRecent,
    wonPrevious,
    lostPrevious,
    statusGroups,
    nearDeadlines,
  ] = await Promise.all([
    // Active tenders: status NOT terminal
    prisma.tender.count({
      where: { status: { notIn: terminalList as never[] } },
    }),

    // Pipeline value: sum base_amount where status in pipeline
    prisma.tender.aggregate({
      _sum: { base_amount: true },
      where: { status: { in: [...PIPELINE_STATUSES] as never[] } },
    }),

    // Upcoming deadlines within 7 days, non-terminal
    prisma.tender.count({
      where: {
        submission_deadline: { gte: now, lte: sevenDaysFromNow },
        status: { notIn: terminalList as never[] },
      },
    }),

    // Win rate numerator: WON in last 12 months
    prisma.tender.count({
      where: { status: 'WON', updated_at: { gte: twelveMonthsAgo } },
    }),

    // Win rate denominator part: LOST in last 12 months
    prisma.tender.count({
      where: { status: 'LOST', updated_at: { gte: twelveMonthsAgo } },
    }),

    // Previous win rate: WON 12-24 months ago
    prisma.tender.count({
      where: {
        status: 'WON',
        updated_at: { gte: twentyFourMonthsAgo, lt: twelveMonthsAgo },
      },
    }),

    // Previous: LOST 12-24 months ago
    prisma.tender.count({
      where: {
        status: 'LOST',
        updated_at: { gte: twentyFourMonthsAgo, lt: twelveMonthsAgo },
      },
    }),

    // Group by status
    prisma.tender.groupBy({
      by: ['status'],
      _count: { id: true },
    }),

    // Near deadlines: top 5
    prisma.tender.findMany({
      where: {
        submission_deadline: { gte: now },
        status: { notIn: terminalList as never[] },
      },
      orderBy: { submission_deadline: 'asc' },
      take: 5,
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        submission_deadline: true,
        contracting_authority: { select: { name: true } },
      },
    }),
  ])

  // Win rates
  const winRate =
    wonRecent + lostRecent > 0
      ? Math.round((wonRecent / (wonRecent + lostRecent)) * 100)
      : 0

  const winRatePrevious =
    wonPrevious + lostPrevious > 0
      ? Math.round((wonPrevious / (wonPrevious + lostPrevious)) * 100)
      : 0

  // By status with label and color
  const byStatus = statusGroups.map((g) => {
    const config = TENDER_STATUS_CONFIG[g.status]
    return {
      status: g.status,
      label: config?.label ?? g.status,
      count: g._count.id,
      color: config?.color ?? 'text-zinc-400',
    }
  })

  // Recent results: monthly won/lost for last 6 months
  const recentResults: TenderDashboardStats['recentResults'] = []
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() - i + 1,
      0,
      23,
      59,
      59,
      999,
    )
    const period = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`

    const [won, lost] = await Promise.all([
      prisma.tender.count({
        where: {
          status: 'WON',
          updated_at: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.tender.count({
        where: {
          status: 'LOST',
          updated_at: { gte: monthStart, lte: monthEnd },
        },
      }),
    ])

    recentResults.push({ period, won, lost })
  }

  return {
    activeTenders,
    pipelineValue: Number(pipelineAgg._sum.base_amount ?? 0),
    upcomingDeadlines,
    winRate,
    winRatePrevious,
    byStatus,
    recentResults,
    nearDeadlines: nearDeadlines.map((t) => {
      const deadline = t.submission_deadline!
      const diffMs = deadline.getTime() - now.getTime()
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      return {
        id: t.id,
        code: t.code,
        title: t.title,
        authority: t.contracting_authority?.name ?? null,
        submissionDeadline: deadline.toISOString(),
        daysRemaining,
        status: t.status,
      }
    }),
  }
}
