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

const approvalResponseSchema = z.object({
  approval_id: z.string().min(1, 'approval_id obbligatorio'),
  action: z.enum(['APPROVED', 'REJECTED'], {
    error: 'action deve essere "APPROVED" o "REJECTED"',
  }),
  comment: z.string().optional(),
})

// ---------------------------------------------------------------------------
// POST /api/webhooks/approval-response
// Riceve risposte di approvazione / rifiuto e aggiorna lo stato.
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
        console.log(
          `[approval-response] Idempotency hit: webhook_id=${webhookId}`,
        )
        return NextResponse.json(existing.response)
      }
    } else {
      console.warn(
        '[approval-response] Webhook ricevuto senza x-webhook-id — idempotency disattivata',
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

    const parsed = approvalResponseSchema.safeParse(rawJson)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }))
      return validationErrorResponse(issues)
    }

    const body = parsed.data

    // --- Recupero approvazione ---
    const existing = await prisma.approval.findUnique({
      where: { id: body.approval_id },
      select: { id: true, status: true, request_id: true },
    })

    if (!existing) {
      return errorResponse('NOT_FOUND', 'Approvazione non trovata', 404)
    }

    if (existing.status !== 'PENDING') {
      return errorResponse(
        'ALREADY_DECIDED',
        'Questa approvazione è già stata elaborata',
        409,
      )
    }

    // --- Aggiornamento approvazione ---
    const updatedApproval = await prisma.approval.update({
      where: { id: body.approval_id },
      data: {
        status: body.action,
        decision_at: new Date(),
        notes: body.comment ?? null,
      },
    })

    // --- Calcolo stato complessivo della richiesta ---
    const allApprovals = await prisma.approval.findMany({
      where: { request_id: existing.request_id },
      select: { status: true },
    })

    const hasRejected = allApprovals.some((a) => a.status === 'REJECTED')
    const allApproved = allApprovals.every((a) => a.status === 'APPROVED')

    let newRequestStatus: string | null = null

    if (hasRejected) {
      newRequestStatus = 'REJECTED'
    } else if (allApproved) {
      newRequestStatus = 'APPROVED'
    }

    if (newRequestStatus) {
      await prisma.purchaseRequest.update({
        where: { id: existing.request_id },
        data: {
          status: newRequestStatus as 'APPROVED' | 'REJECTED',
        },
      })
    }

    // --- Evento timeline ---
    const actionLabel = body.action === 'APPROVED' ? 'Approvata' : 'Rifiutata'

    await prisma.timelineEvent.create({
      data: {
        request_id: existing.request_id,
        type: body.action === 'APPROVED' ? 'approved' : 'rejected',
        title: `Approvazione: ${actionLabel}`,
        description: body.comment ?? undefined,
        metadata: { approval_id: body.approval_id },
      },
    })

    const responseData = { success: true, data: updatedApproval }

    // Registra idempotency
    if (webhookId) {
      await recordWebhookProcessed(
        webhookId,
        'approval-response',
        200,
        responseData,
      )
    }

    return successResponse(updatedApproval)
  } catch (error) {
    console.error('POST /api/webhooks/approval-response error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
