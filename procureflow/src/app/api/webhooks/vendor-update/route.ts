import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/api-response'

// ---------------------------------------------------------------------------
// HMAC Signature Verification
// ---------------------------------------------------------------------------

function verifySignature(payload: string, signature: string): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  if (signature.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

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

    // --- Validazione firma HMAC ---
    const signature = req.headers.get('x-webhook-signature') ?? ''
    if (!signature || !verifySignature(rawBody, signature)) {
      return errorResponse(
        'UNAUTHORIZED',
        'Firma webhook non valida',
        401,
      )
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

    return successResponse(updatedVendor)
  } catch (error) {
    console.error('POST /api/webhooks/vendor-update error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
