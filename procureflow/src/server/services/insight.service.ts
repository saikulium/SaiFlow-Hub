import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { callClaude } from '@/lib/ai/claude-client'
import { INSIGHT_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import {
  INSIGHT_TTL_HOURS,
  INSIGHT_SEVERITY_ORDER,
  MAX_ACTIVE_INSIGHTS,
} from '@/lib/constants/insights'
import type { GenerateInsightsResult } from '@/types/ai'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InsightType = keyof typeof INSIGHT_TTL_HOURS
type SeverityKey = keyof typeof INSIGHT_SEVERITY_ORDER

interface RawInsightFromClaude {
  readonly type?: string
  readonly severity?: string
  readonly title?: string
  readonly description?: string
  readonly action_label?: string
  readonly action_url?: string
  readonly metadata?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TYPES = new Set<string>(Object.keys(INSIGHT_TTL_HOURS))
const VALID_SEVERITIES = new Set<string>(Object.keys(INSIGHT_SEVERITY_ORDER))

function isValidInsightType(value: string): value is InsightType {
  return VALID_TYPES.has(value)
}

function isValidSeverity(value: string): value is SeverityKey {
  return VALID_SEVERITIES.has(value)
}

function isValidRawInsight(
  raw: RawInsightFromClaude,
): raw is Required<
  Pick<RawInsightFromClaude, 'type' | 'severity' | 'title' | 'description'>
> &
  RawInsightFromClaude {
  return (
    typeof raw.type === 'string' &&
    typeof raw.severity === 'string' &&
    typeof raw.title === 'string' &&
    typeof raw.description === 'string' &&
    isValidInsightType(raw.type) &&
    isValidSeverity(raw.severity)
  )
}

function computeExpiresAt(type: InsightType): Date {
  const ttlHours = INSIGHT_TTL_HOURS[type]
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + ttlHours)
  return expiresAt
}

function sortBySeverity<T extends { severity: string }>(
  insights: readonly T[],
): readonly T[] {
  return [...insights].sort((a, b) => {
    const aOrder = INSIGHT_SEVERITY_ORDER[a.severity as SeverityKey] ?? 999
    const bOrder = INSIGHT_SEVERITY_ORDER[b.severity as SeverityKey] ?? 999
    return aOrder - bOrder
  })
}

function parseClaudeInsights(
  responseText: string,
): readonly RawInsightFromClaude[] {
  try {
    const parsed: unknown = JSON.parse(responseText)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidRawInsight)
  } catch {
    return []
  }
}

function buildDataSummary(
  spendByVendor: readonly unknown[],
  pendingApprovals: readonly unknown[],
  invoiceDiscrepancies: readonly unknown[],
  budgetUtilization: readonly unknown[],
  bottleneckRequests: readonly unknown[],
): string {
  return [
    `## Spesa per Fornitore\n${JSON.stringify(spendByVendor)}`,
    `## Approvazioni in Attesa\n${JSON.stringify(pendingApprovals)}`,
    `## Discrepanze Fatture\n${JSON.stringify(invoiceDiscrepancies)}`,
    `## Utilizzo Budget\n${JSON.stringify(budgetUtilization)}`,
    `## Richieste Bloccate\n${JSON.stringify(bottleneckRequests)}`,
  ].join('\n\n')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getActiveInsights() {
  const now = new Date()

  const insights = await prisma.aiInsight.findMany({
    where: {
      dismissed: false,
      expires_at: { gt: now },
    },
    orderBy: [{ severity: 'asc' }, { created_at: 'desc' }],
    take: MAX_ACTIVE_INSIGHTS,
  })

  return sortBySeverity(insights)
}

export async function dismissInsight(id: string): Promise<void> {
  await prisma.aiInsight.update({
    where: { id },
    data: { dismissed: true },
  })
}

export async function generateInsights(): Promise<GenerateInsightsResult> {
  // 1. Clean up expired insights
  const cleanupResult = await prisma.aiInsight.deleteMany({
    where: { expires_at: { lt: new Date() } },
  })
  const expiredCleaned = cleanupResult.count

  // 2. Gather procurement data via transaction
  const [
    spendByVendor,
    pendingApprovals,
    invoiceDiscrepancies,
    budgetUtilization,
    bottleneckRequests,
  ] = await prisma.$transaction([
    prisma.purchaseRequest.groupBy({
      by: ['vendor_id'],
      _sum: { actual_amount: true },
      where: { status: { in: ['ORDERED', 'DELIVERED'] } },
      orderBy: { vendor_id: 'asc' },
    }),
    prisma.approval.findMany({
      where: { status: 'PENDING' },
      include: {
        request: {
          select: { code: true, title: true, estimated_amount: true },
        },
      },
    }),
    prisma.invoice.groupBy({
      by: ['match_status'],
      _count: { id: true },
      _sum: { total_amount: true },
      orderBy: { match_status: 'asc' },
    }),
    prisma.budget.findMany({
      select: {
        id: true,
        cost_center: true,
        allocated_amount: true,
        alert_threshold_percent: true,
        snapshots: {
          select: { spent: true, committed: true },
          orderBy: { computed_at: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['PENDING_APPROVAL', 'ON_HOLD'] },
        updated_at: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { code: true, title: true, status: true, updated_at: true },
    }),
  ])

  // 3. Get existing active insights to deduplicate
  const existingInsights = await prisma.aiInsight.findMany({
    where: { dismissed: false, expires_at: { gt: new Date() } },
    select: { type: true, title: true },
  })
  const existingKeys = new Set(
    existingInsights.map((i) => `${i.type}::${i.title}`),
  )

  // 4. Call Claude for analysis
  const dataSummary = buildDataSummary(
    spendByVendor,
    pendingApprovals,
    invoiceDiscrepancies,
    budgetUtilization,
    bottleneckRequests,
  )

  let rawInsights: readonly RawInsightFromClaude[]
  try {
    const response = await callClaude({
      system: INSIGHT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: dataSummary }],
      maxTokens: 2048,
    })

    const textBlock = response.content.find((block) => block.type === 'text')
    const responseText = textBlock && 'text' in textBlock ? textBlock.text : ''
    rawInsights = parseClaudeInsights(responseText)
  } catch {
    return {
      generated: 0,
      expired_cleaned: expiredCleaned,
      error: 'claude_unavailable',
    }
  }

  // 5. Deduplicate and prepare new insights
  const newInsights = rawInsights
    .filter((insight) => !existingKeys.has(`${insight.type}::${insight.title}`))
    .map((insight) => ({
      type: insight.type as InsightType,
      severity: insight.severity as SeverityKey,
      title: insight.title!,
      description: insight.description!,
      action_label: insight.action_label ?? null,
      action_url: insight.action_url ?? null,
      metadata: (insight.metadata ?? Prisma.DbNull) as Prisma.InputJsonValue,
      dismissed: false,
      expires_at: computeExpiresAt(insight.type as InsightType),
    }))

  // 6. Save new insights
  if (newInsights.length > 0) {
    await prisma.aiInsight.createMany({ data: newInsights })
  }

  return { generated: newInsights.length, expired_cleaned: expiredCleaned }
}
