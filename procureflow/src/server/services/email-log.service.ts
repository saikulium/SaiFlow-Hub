import { prisma } from '@/lib/db'

// ---------------------------------------------------------------------------
// EmailLog Service — Persistence layer for email processing audit trail
// ---------------------------------------------------------------------------

interface CreateEmailLogInput {
  // Email
  readonly email_from: string
  readonly email_to?: string
  readonly email_subject: string
  readonly email_body: string
  readonly email_date?: string
  readonly email_message_id?: string
  // Classification
  readonly intent: string
  readonly confidence: number
  readonly requires_human_decision: boolean
  readonly decision_reason?: string | null
  // Extracted data
  readonly matched_request_code?: string
  readonly matched_vendor_name?: string
  readonly extracted_amount?: number
  readonly extracted_old_price?: number
  readonly extracted_new_price?: number
  readonly price_delta_percent?: number
  readonly extracted_old_date?: Date
  readonly extracted_new_date?: Date
  // Result
  readonly actions_taken: readonly string[]
  readonly summary?: string
  // Links
  readonly request_id?: string
  readonly commessa_id?: string
  readonly invoice_id?: string
  // Metadata
  readonly attachments_count?: number
  readonly processed_by_user_id?: string
  readonly ai_model?: string
  readonly processing_time_ms?: number
}

export async function createEmailLog(input: CreateEmailLogInput) {
  return prisma.emailLog.create({
    data: {
      email_from: input.email_from,
      email_to: input.email_to,
      email_subject: input.email_subject,
      email_body: input.email_body,
      email_date: input.email_date,
      email_message_id: input.email_message_id,
      intent: input.intent,
      confidence: input.confidence,
      requires_human_decision: input.requires_human_decision,
      decision_reason: input.decision_reason,
      matched_request_code: input.matched_request_code,
      matched_vendor_name: input.matched_vendor_name,
      extracted_amount: input.extracted_amount,
      extracted_old_price: input.extracted_old_price,
      extracted_new_price: input.extracted_new_price,
      price_delta_percent: input.price_delta_percent,
      extracted_old_date: input.extracted_old_date,
      extracted_new_date: input.extracted_new_date,
      actions_taken: [...input.actions_taken],
      summary: input.summary,
      request_id: input.request_id,
      commessa_id: input.commessa_id,
      invoice_id: input.invoice_id,
      attachments_count: input.attachments_count ?? 0,
      processed_by_user_id: input.processed_by_user_id,
      ai_model: input.ai_model,
      processing_time_ms: input.processing_time_ms,
    },
  })
}

interface EmailLogFilters {
  readonly intent?: string
  readonly requires_human_decision?: boolean
  readonly matched_request_code?: string
  readonly from_date?: Date
  readonly to_date?: Date
  readonly page?: number
  readonly pageSize?: number
}

export async function getEmailLogs(filters: EmailLogFilters = {}) {
  const where: Record<string, unknown> = {}
  if (filters.intent) where.intent = filters.intent
  if (filters.requires_human_decision !== undefined)
    where.requires_human_decision = filters.requires_human_decision
  if (filters.matched_request_code)
    where.matched_request_code = filters.matched_request_code
  if (filters.from_date || filters.to_date) {
    where.created_at = {
      ...(filters.from_date && { gte: filters.from_date }),
      ...(filters.to_date && { lte: filters.to_date }),
    }
  }

  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20

  const [logs, total] = await prisma.$transaction([
    prisma.emailLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.emailLog.count({ where }),
  ])

  return { logs, total, page, pageSize }
}

export async function getEmailLogsByRequest(requestId: string) {
  return prisma.emailLog.findMany({
    where: { request_id: requestId },
    orderBy: { created_at: 'desc' },
  })
}

export async function getPendingDecisions() {
  return prisma.emailLog.findMany({
    where: { requires_human_decision: true },
    orderBy: { created_at: 'desc' },
    take: 50,
  })
}
