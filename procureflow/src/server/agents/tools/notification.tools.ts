import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import type { ZodTool } from '@/server/agents/tools/procurement.tools'

// ---------------------------------------------------------------------------
// Notification & Timeline Tools — used by the email intelligence agent
// ---------------------------------------------------------------------------

export const createNotificationTool = betaZodTool({
  name: 'create_notification',
  description:
    'Crea una notifica in-app per un utente specifico. Usa per avvisare utenti di eventi importanti (ritardi, variazioni prezzo, nuove commesse, etc.).',
  inputSchema: z.object({
    user_id: z.string().describe('ID utente destinatario'),
    title: z.string().describe('Titolo della notifica'),
    body: z.string().describe('Corpo della notifica con dettagli'),
    type: z
      .string()
      .describe(
        'Tipo di notifica (es: delivery_delay, price_change, new_commessa, invoice_received, info_request)',
      ),
    link: z
      .string()
      .optional()
      .describe(
        'Deep link alla risorsa correlata (es: /requests/PR-2025-00001)',
      ),
  }),
  run: async (input) => {
    // Verify user exists before creating notification
    const user = await prisma.user.findUnique({
      where: { id: input.user_id },
      select: { id: true },
    })
    if (!user) {
      return JSON.stringify({
        error: `Utente con ID ${input.user_id} non trovato`,
      })
    }

    const notification = await prisma.notification.create({
      data: {
        user_id: input.user_id,
        title: input.title,
        body: input.body,
        type: input.type,
        link: input.link ?? null,
      },
      select: { id: true },
    })
    return JSON.stringify({
      success: true,
      notification_id: notification.id,
    })
  },
})

export const createTimelineEventTool = betaZodTool({
  name: 'create_timeline_event',
  description:
    "Aggiunge un evento alla timeline di una richiesta d'acquisto. Usa per registrare aggiornamenti, cambi stato, note da email.",
  inputSchema: z.object({
    request_id: z
      .string()
      .describe(
        "ID della richiesta d'acquisto (non il codice, ma l'ID interno)",
      ),
    type: z
      .string()
      .describe(
        'Tipo di evento (es: email_update, status_change, price_change, delivery_delay, ai_action)',
      ),
    title: z.string().describe("Titolo breve dell'evento"),
    description: z
      .string()
      .optional()
      .describe("Descrizione dettagliata dell'evento"),
    actor: z
      .string()
      .optional()
      .describe("Chi ha causato l'evento (default: 'AI Agent')"),
  }),
  run: async (input) => {
    // Verify request exists before creating timeline event
    const request = await prisma.purchaseRequest.findUnique({
      where: { id: input.request_id },
      select: { id: true },
    })
    if (!request) {
      return JSON.stringify({
        error: `Richiesta con ID ${input.request_id} non trovata`,
      })
    }

    const event = await prisma.timelineEvent.create({
      data: {
        request_id: input.request_id,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        actor: input.actor ?? 'AI Agent',
      },
      select: { id: true },
    })
    return JSON.stringify({
      success: true,
      event_id: event.id,
    })
  },
})

// ---------------------------------------------------------------------------
// Exported collection
// ---------------------------------------------------------------------------

export const NOTIFICATION_TOOLS: readonly ZodTool[] = [
  createNotificationTool,
  createTimelineEventTool,
] as readonly ZodTool[]
