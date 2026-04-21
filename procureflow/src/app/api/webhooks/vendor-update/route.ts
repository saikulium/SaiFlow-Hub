import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { verifyWebhookAuth } from '@/lib/webhook-auth'
import {
  checkWebhookProcessed,
  recordWebhookProcessed,
} from '@/server/services/webhook-idempotency.service'

// ---------------------------------------------------------------------------
// Validazione
// ---------------------------------------------------------------------------

const vendorUpdateSchema = z.object({
  vendor_code: z.string().min(1, 'vendor_code obbligatorio'),
  updates: z
    .object({
      name: z.string().optional(),
      email: z.string().email('Email non valida').optional(),
      phone: z.string().optional(),
      rating: z.number().min(0).max(5).optional(),
      status: z
        .enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED', 'PENDING_REVIEW'], {
          error:
            'Stato non valido. Valori ammessi: ACTIVE, INACTIVE, BLACKLISTED, PENDING_REVIEW',
        })
        .optional(),
    })
    .refine((u) => Object.values(u).some((v) => v !== undefined), {
      message: 'Nessun campo valido da aggiornare fornito',
    }),
})

// ---------------------------------------------------------------------------
// POST /api/webhooks/vendor-update
// Riceve aggiornamenti vendor da sistemi esterni e sincronizza i dati.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // --- Autenticazione + Timestamp ---
    const isAuthed = verifyWebhookAuth(
      rawBody,
      req.headers.get('x-webhook-signature'),
      req.headers.get('authorization'),
      process.env.WEBHOOK_SECRET,
      req.headers.get('x-webhook-timestamp'),
    )

    if (!isAuthed) {
      return errorResponse('UNAUTHORIZED', 'Firma webhook non valida', 401)
    }

    // --- Idempotency Key ---
    const webhookId = req.headers.get('x-webhook-id')
    if (webhookId) {
      const existing = await checkWebhookProcessed(webhookId)
      if (existing.processed && existing.response) {
        console.log(`[vendor-update] Idempotency hit: webhook_id=${webhookId}`)
        // Replay the exact stored response for idempotency
        return NextResponse.json(existing.response)
      }
    } else {
      console.warn(
        '[vendor-update] Webhook ricevuto senza x-webhook-id — idempotency disattivata',
      )
    }

    // --- Parsing e validazione body ---
    let rawJson: unknown
    try {
      rawJson = JSON.parse(rawBody)
    } catch {
      return errorResponse(
        'INVALID_PAYLOAD',
        'Il corpo della richiesta non è un JSON valido',
        400,
      )
    }

    const parsed = vendorUpdateSchema.safeParse(rawJson)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }))
      return validationErrorResponse(issues)
    }

    const body = parsed.data

    // --- Recupero fornitore ---
    const existing = await prisma.vendor.findUnique({
      where: { code: body.vendor_code },
      select: { id: true },
    })

    if (!existing) {
      return errorResponse(
        'NOT_FOUND',
        `Fornitore con codice "${body.vendor_code}" non trovato`,
        404,
      )
    }

    // --- Costruzione dati aggiornamento (solo campi forniti) ---
    const updateData: Record<string, unknown> = {}
    const { updates } = body

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.email !== undefined) updateData.email = updates.email
    if (updates.phone !== undefined) updateData.phone = updates.phone
    if (updates.rating !== undefined) updateData.rating = updates.rating
    if (updates.status !== undefined) updateData.status = updates.status

    // --- Aggiornamento fornitore ---
    const updatedVendor = await prisma.vendor.update({
      where: { id: existing.id },
      data: updateData,
    })

    const responseData = { success: true, data: updatedVendor }

    // Registra idempotency
    if (webhookId) {
      await recordWebhookProcessed(
        webhookId,
        'vendor-update',
        200,
        responseData,
      )
    }

    return successResponse(updatedVendor)
  } catch (error) {
    console.error('POST /api/webhooks/vendor-update error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
