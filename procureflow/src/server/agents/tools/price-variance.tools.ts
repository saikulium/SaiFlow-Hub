import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import { createNotification } from '@/server/services/notification.service'

// ---------------------------------------------------------------------------
// Price Variance Review Tools
//
// Three tools:
// 1. create_price_variance_review  — WRITE-direct (email agent, autonomous)
// 2. list_price_variance_reviews   — READ (chat assistant)
// 3. decide_price_variance         — WRITE-intercepted (chat assistant, confirmed)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const priceVarianceItemSchema = z.object({
  item_name: z.string(),
  old_price: z.number(),
  new_price: z.number(),
  delta_pct: z.number(),
  quantity: z.number().optional(),
})

const createPriceVarianceInputSchema = z.object({
  request_id: z.string(),
  email_log_id: z.string().optional(),
  items: z.array(priceVarianceItemSchema).min(1),
  total_old_amount: z.number(),
  total_new_amount: z.number(),
})

const listPriceVarianceInputSchema = z.object({
  status: z
    .enum(['PENDING', 'ACCEPTED', 'REJECTED', 'NEGOTIATING'])
    .optional()
    .describe('Filtra per stato'),
  request_id: z.string().optional().describe('Filtra per richiesta'),
})

const decidePriceVarianceInputSchema = z.object({
  review_id: z.string().describe('ID della review'),
  status: z
    .enum(['ACCEPTED', 'REJECTED', 'NEGOTIATING'])
    .describe('Decisione'),
  notes: z.string().optional().describe('Note sulla decisione'),
})

// ---------------------------------------------------------------------------
// Tool: create_price_variance_review (WRITE-direct for email agent)
// ---------------------------------------------------------------------------

export const createPriceVarianceReviewTool = betaZodTool({
  name: 'create_price_variance_review',
  description:
    "Crea una review di variazione prezzo per una richiesta d'acquisto. Usato quando il fornitore comunica prezzi diversi dall'ordine.",
  inputSchema: createPriceVarianceInputSchema,
  run: async (input) => {
    try {
      // Calculate derived fields
      const totalDelta = input.total_new_amount - input.total_old_amount
      const maxDeltaPercent = input.items.reduce(
        (max, item) => Math.max(max, Math.abs(item.delta_pct)),
        0,
      )

      const review = await prisma.priceVarianceReview.create({
        data: {
          request_id: input.request_id,
          email_log_id: input.email_log_id ?? null,
          items: input.items,
          total_old_amount: input.total_old_amount,
          total_new_amount: input.total_new_amount,
          total_delta: totalDelta,
          max_delta_percent: maxDeltaPercent,
          status: 'PENDING',
        },
      })

      // Find the first MANAGER or ADMIN user to notify
      const managerUser = await prisma.user.findFirst({
        where: { role: { in: ['MANAGER', 'ADMIN'] } },
        select: { id: true },
        orderBy: { role: 'desc' }, // MANAGER before ADMIN (alphabetical)
      })

      if (managerUser) {
        await createNotification({
          userId: managerUser.id,
          title: 'Variazione prezzo in attesa',
          body: `Variazione prezzo rilevata (max ${maxDeltaPercent.toFixed(1)}%, delta ${totalDelta >= 0 ? '+' : ''}${totalDelta.toFixed(2)} EUR). Richiede decisione.`,
          type: 'approval_required',
          link: `/requests/${input.request_id}`,
        })
      }

      return JSON.stringify({
        success: true,
        review_id: review.id,
        max_delta_percent: maxDeltaPercent,
        total_delta: totalDelta,
      })
    } catch (err) {
      return JSON.stringify({
        error: `Errore nella creazione price variance review: ${String(err)}`,
      })
    }
  },
})

// ---------------------------------------------------------------------------
// Tool: list_price_variance_reviews (READ)
// ---------------------------------------------------------------------------

export const listPriceVarianceReviewsTool = betaZodTool({
  name: 'list_price_variance_reviews',
  description: 'Lista delle variazioni prezzo in attesa di decisione.',
  inputSchema: listPriceVarianceInputSchema,
  run: async (input) => {
    try {
      const where: Record<string, unknown> = {}
      if (input.status) where.status = input.status
      if (input.request_id) where.request_id = input.request_id

      const reviews = await prisma.priceVarianceReview.findMany({
        where,
        include: {
          request: {
            select: { code: true, title: true },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      })

      const results = reviews.map((r) => ({
        id: r.id,
        request_code: r.request.code,
        request_title: r.request.title,
        status: r.status,
        max_delta_percent: r.max_delta_percent,
        total_delta: Number(r.total_delta),
        total_old_amount: Number(r.total_old_amount),
        total_new_amount: Number(r.total_new_amount),
        items: r.items,
        created_at: r.created_at.toISOString(),
      }))

      return JSON.stringify({ total: results.length, results })
    } catch (err) {
      return JSON.stringify({
        error: `Errore nella lista price variance reviews: ${String(err)}`,
      })
    }
  },
})

// ---------------------------------------------------------------------------
// Tool: decide_price_variance (WRITE-intercepted for chat assistant)
// ---------------------------------------------------------------------------

export const decidePriceVarianceTool = betaZodTool({
  name: 'decide_price_variance',
  description:
    'Registra decisione su una variazione prezzo (accetta, rifiuta, negozia).',
  inputSchema: decidePriceVarianceInputSchema,
  run: async () => {
    // Placeholder: intercepted in chat — real execution via executeWriteTool
    return JSON.stringify({ error: 'Write tools require confirmation' })
  },
})

// ---------------------------------------------------------------------------
// Export grouped
// ---------------------------------------------------------------------------

export const PRICE_VARIANCE_TOOLS = [
  listPriceVarianceReviewsTool,
  decidePriceVarianceTool,
] as const
