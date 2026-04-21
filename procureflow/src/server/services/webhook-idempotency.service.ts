import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

// ---------------------------------------------------------------------------
// Webhook Idempotency Service
//
// Previene il processing duplicato di webhook usando un ID univoco
// (header x-webhook-id). Salva gli ID processati in DB con la risposta
// originale, permettendo idempotent replay.
// ---------------------------------------------------------------------------

/**
 * Controlla se un webhook con questo ID è già stato processato.
 * Ritorna la risposta salvata se trovato, per replay idempotente.
 */
export async function checkWebhookProcessed(
  webhookId: string,
): Promise<{ processed: boolean; response?: object }> {
  const existing = await prisma.processedWebhook.findUnique({
    where: { webhook_id: webhookId },
    select: { response: true },
  })

  if (existing) {
    return {
      processed: true,
      response: (existing.response as object) ?? undefined,
    }
  }

  return { processed: false }
}

/**
 * Registra un webhook come processato.
 * Usa upsert per gestire race condition (due richieste identiche in parallelo).
 */
export async function recordWebhookProcessed(
  webhookId: string,
  endpoint: string,
  statusCode: number,
  response: object,
): Promise<void> {
  await prisma.processedWebhook.upsert({
    where: { webhook_id: webhookId },
    create: {
      webhook_id: webhookId,
      endpoint,
      status_code: statusCode,
      response: response as unknown as Prisma.InputJsonValue,
    },
    update: {},
  })
}

/**
 * Elimina record di webhook processati più vecchi di N giorni.
 * Da invocare periodicamente (cron job o API admin).
 */
export async function cleanupOldWebhooks(
  olderThanDays: number = 30,
): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - olderThanDays)

  const result = await prisma.processedWebhook.deleteMany({
    where: { created_at: { lt: cutoff } },
  })

  return result.count
}
