// ---------------------------------------------------------------------------
// Email-intelligence tool: create_order_confirmation
//
// Wraps the `createOrderConfirmation` service so the email agent can create
// a first-class OrderConfirmation entity when parsing a supplier email.
//
// Replaces `create_price_variance_review` for the CONFERMA_ORDINE and
// VARIAZIONE_PREZZO intents. The legacy tool is kept for backward compat but
// marked deprecated in the system prompt.
//
// WRITE-direct: the email agent runs autonomously — no user confirmation.
// ---------------------------------------------------------------------------

import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { Prisma } from '@prisma/client'
import {
  createOrderConfirmation,
  InvalidConfirmationLineError,
} from '@/modules/core/requests'
import { createNotification } from '@/modules/core/notifications'
import { prisma } from '@/lib/db'

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const lineSchema = z
  .object({
    request_item_id: z
      .string()
      .optional()
      .describe('ID del RequestItem originale (preferito se noto).'),
    match_by_sku: z
      .string()
      .optional()
      .describe('SKU per tentare il match se request_item_id non è noto.'),
    match_by_name: z
      .string()
      .optional()
      .describe(
        'Nome articolo per tentare il match case-insensitive se né ID né SKU sono noti.',
      ),
    confirmed_name: z
      .string()
      .min(1)
      .optional()
      .describe('Nome articolo confermato dal fornitore.'),
    confirmed_quantity: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Quantità confermata dal fornitore.'),
    confirmed_unit: z.string().optional(),
    confirmed_unit_price: z
      .number()
      .min(0)
      .optional()
      .describe('Prezzo unitario confermato dal fornitore (EUR).'),
    confirmed_delivery: z
      .string()
      .datetime()
      .optional()
      .describe('Data di consegna confermata (ISO 8601).'),
    confirmed_sku: z.string().optional(),
    notes: z.string().max(2000).optional(),
  })
  .describe(
    'Una riga della conferma d\'ordine. Deve avere almeno un identificatore (request_item_id, match_by_sku, match_by_name) o valori confermati.',
  )

const createOrderConfirmationInputSchema = z.object({
  request_id: z
    .string()
    .min(1)
    .describe('ID della PurchaseRequest a cui si riferisce la conferma.'),
  email_log_id: z
    .string()
    .optional()
    .describe(
      'ID dell\'EmailLog che ha generato la conferma (traceability).',
    ),
  source: z
    .enum(['EMAIL', 'WEBHOOK', 'MANUAL', 'IMPORT'])
    .default('EMAIL')
    .describe('Origine della conferma. Default EMAIL per l\'email agent.'),
  vendor_reference: z
    .string()
    .max(200)
    .optional()
    .describe('Riferimento ordine fornitore (es: "Ord.TEST-0001").'),
  subject: z
    .string()
    .max(500)
    .optional()
    .describe('Oggetto dell\'email (breve descrizione della conferma).'),
  received_at: z
    .string()
    .datetime()
    .optional()
    .describe('Quando l\'email è stata ricevuta (ISO 8601).'),
  notes: z.string().max(4000).optional(),
  lines: z
    .array(lineSchema)
    .min(1)
    .describe(
      'Righe della conferma — almeno una. Snapshot originale vs confermato per ogni articolo.',
    ),
})

// ---------------------------------------------------------------------------
// Tool: create_order_confirmation (WRITE-direct)
// ---------------------------------------------------------------------------

export const createOrderConfirmationTool = betaZodTool({
  name: 'create_order_confirmation',
  description:
    "Crea una OrderConfirmation (con righe) collegata a una PurchaseRequest. Usa questo tool per registrare una conferma d'ordine ricevuta dal fornitore (email o webhook), comprese eventuali variazioni prezzo/consegna. È l'alternativa moderna a create_price_variance_review.",
  inputSchema: createOrderConfirmationInputSchema,
  run: async (input) => {
    try {
      const confirmation = await createOrderConfirmation({
        request_id: input.request_id,
        email_log_id: input.email_log_id,
        source: input.source,
        vendor_reference: input.vendor_reference,
        subject: input.subject,
        received_at: input.received_at ? new Date(input.received_at) : undefined,
        notes: input.notes,
        lines: input.lines.map((line) => ({
          request_item_id: line.request_item_id,
          match_by_sku: line.match_by_sku,
          match_by_name: line.match_by_name,
          confirmed_name: line.confirmed_name,
          confirmed_quantity: line.confirmed_quantity,
          confirmed_unit: line.confirmed_unit,
          confirmed_unit_price: line.confirmed_unit_price,
          confirmed_delivery: line.confirmed_delivery
            ? new Date(line.confirmed_delivery)
            : undefined,
          confirmed_sku: line.confirmed_sku,
          notes: line.notes,
        })),
      })

      // Derived summary for the agent's response
      const maxPriceDeltaPct = confirmation.lines.reduce((max, line) => {
        if (line.price_delta_pct == null) return max
        const absPct = Math.abs(Number(line.price_delta_pct))
        return absPct > max ? absPct : max
      }, 0)

      const maxDeliveryDelayDays = confirmation.lines.reduce((max, line) => {
        if (line.delivery_delay_days == null) return max
        const abs = Math.abs(line.delivery_delay_days)
        return abs > max ? abs : max
      }, 0)

      const hasSignificantVariance = maxPriceDeltaPct > 0.02
      const unmatchedLines = confirmation.lines.filter(
        (l) => l.request_item_id == null,
      ).length

      // Notify MANAGER/ADMIN if there's a material variance so someone can
      // apply/reject the confirmation from the PR detail page.
      if (hasSignificantVariance || maxDeliveryDelayDays > 0) {
        try {
          const managerUser = await prisma.user.findFirst({
            where: { role: { in: ['MANAGER', 'ADMIN'] } },
            select: { id: true },
            orderBy: { role: 'desc' },
          })
          if (managerUser) {
            const parts: string[] = []
            if (hasSignificantVariance) {
              parts.push(
                `variazione prezzo max ${(maxPriceDeltaPct * 100).toFixed(1)}%`,
              )
            }
            if (maxDeliveryDelayDays > 0) {
              parts.push(`ritardo consegna max ${maxDeliveryDelayDays}gg`)
            }
            await createNotification({
              userId: managerUser.id,
              title: 'Conferma ordine da verificare',
              body: `Nuova conferma d'ordine${input.vendor_reference ? ` (${input.vendor_reference})` : ''}: ${parts.join(', ')}. Richiede decisione.`,
              type: 'approval_required',
              link: `/requests/${input.request_id}`,
            })
          }
        } catch (notifyErr) {
          console.warn(
            `[email-agent] create_order_confirmation: notification failed: ${String(notifyErr)}`,
          )
        }
      }

      return JSON.stringify({
        success: true,
        confirmation_id: confirmation.id,
        status: confirmation.status,
        line_count: confirmation.lines.length,
        matched_line_count: confirmation.lines.length - unmatchedLines,
        unmatched_line_count: unmatchedLines,
        max_price_delta_pct: Number(maxPriceDeltaPct.toFixed(4)),
        max_delivery_delay_days: maxDeliveryDelayDays,
        requires_decision: hasSignificantVariance || maxDeliveryDelayDays > 0,
      })
    } catch (err) {
      if (err instanceof InvalidConfirmationLineError) {
        return JSON.stringify({
          error: `Conferma non valida: ${err.message}`,
        })
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return JSON.stringify({
          error: `Errore DB (${err.code}) nella creazione della conferma d'ordine`,
        })
      }
      return JSON.stringify({
        error: `Errore nella creazione della conferma d'ordine: ${String(err)}`,
      })
    }
  },
})
