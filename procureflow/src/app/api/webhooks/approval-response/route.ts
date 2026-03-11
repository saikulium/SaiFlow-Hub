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

interface ApprovalPayload {
  approval_id: string
  action: 'APPROVED' | 'REJECTED'
  comment?: string
}

const VALID_ACTIONS = new Set<string>(['APPROVED', 'REJECTED'])

// ---------------------------------------------------------------------------
// POST /api/webhooks/approval-response
// Riceve risposte di approvazione / rifiuto e aggiorna lo stato.
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
    let body: ApprovalPayload
    try {
      body = JSON.parse(rawBody) as ApprovalPayload
    } catch {
      return errorResponse(
        'INVALID_PAYLOAD',
        'Il corpo della richiesta non è un JSON valido',
        400,
      )
    }

    if (!body.approval_id || !body.action) {
      return errorResponse(
        'VALIDATION_ERROR',
        'I campi approval_id e action sono obbligatori',
        400,
      )
    }

    if (!VALID_ACTIONS.has(body.action)) {
      return errorResponse(
        'VALIDATION_ERROR',
        'Il campo action deve essere "APPROVED" o "REJECTED"',
        400,
      )
    }

    // --- Recupero approvazione ---
    const existing = await prisma.approval.findUnique({
      where: { id: body.approval_id },
      select: { id: true, status: true, request_id: true },
    })

    if (!existing) {
      return errorResponse(
        'NOT_FOUND',
        'Approvazione non trovata',
        404,
      )
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

    return successResponse(updatedApproval)
  } catch (error) {
    console.error('POST /api/webhooks/approval-response error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
