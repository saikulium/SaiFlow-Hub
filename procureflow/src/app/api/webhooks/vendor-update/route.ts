import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/api-response'
import { verifyWebhookAuth } from '@/lib/webhook-auth'
import {
  checkWebhookProcessed,
  recordWebhookProcessed,
} from '@/server/services/webhook-idempotency.service'

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

interface VendorUpdatePayload {
  vendor_code: string
  updates: {
    name?: string
    email?: string
    phone?: string
    rating?: number
    status?: string
  }
}

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
        return Response.json(existing.response, { status: 200 })
      }
    } else {
      console.warn('[vendor-update] Webhook ricevuto senza x-webhook-id — idempotency disattivata')
    }

    // --- Parsing e validazione body ---
    let body: VendorUpdatePayload
    try {
      body = JSON.parse(rawBody) as VendorUpdatePayload
    } catch {
      return errorResponse(
        'INVALID_PAYLOAD',
        'Il corpo della richiesta non è un JSON valido',
        400,
      )
    }

    if (!body.vendor_code || !body.updates) {
      return errorResponse(
        'VALIDATION_ERROR',
        'I campi vendor_code e updates sono obbligatori',
        400,
      )
    }

    if (typeof body.updates !== 'object' || Array.isArray(body.updates)) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Il campo updates deve essere un oggetto',
        400,
      )
    }

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

    if (body.updates.name !== undefined) {
      updateData.name = body.updates.name
    }
    if (body.updates.email !== undefined) {
      updateData.email = body.updates.email
    }
    if (body.updates.phone !== undefined) {
      updateData.phone = body.updates.phone
    }
    if (body.updates.rating !== undefined) {
      if (typeof body.updates.rating !== 'number') {
        return errorResponse(
          'VALIDATION_ERROR',
          'Il campo rating deve essere un numero',
          400,
        )
      }
      updateData.rating = body.updates.rating
    }
    if (body.updates.status !== undefined) {
      const validStatuses = new Set([
        'ACTIVE',
        'INACTIVE',
        'BLACKLISTED',
        'PENDING_REVIEW',
      ])
      if (!validStatuses.has(body.updates.status)) {
        return errorResponse(
          'VALIDATION_ERROR',
          `Stato non valido: "${body.updates.status}". Valori ammessi: ACTIVE, INACTIVE, BLACKLISTED, PENDING_REVIEW`,
          400,
        )
      }
      updateData.status = body.updates.status
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Nessun campo valido da aggiornare fornito',
        400,
      )
    }

    // --- Aggiornamento fornitore ---
    const updatedVendor = await prisma.vendor.update({
      where: { id: existing.id },
      data: updateData,
    })

    const responseData = { success: true, data: updatedVendor }

    // Registra idempotency
    if (webhookId) {
      await recordWebhookProcessed(webhookId, 'vendor-update', 200, responseData)
    }

    return Response.json(responseData, { status: 200 })
  } catch (error) {
    console.error('POST /api/webhooks/vendor-update error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
