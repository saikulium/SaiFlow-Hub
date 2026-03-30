import { prisma } from '@/lib/db'
import type { UserRole } from '@prisma/client'
import {
  APPROVAL_THRESHOLDS,
  canAutoApproveByRole,
  getApprovalTier,
} from '@/lib/constants/approval-thresholds'
import {
  createNotification,
  NOTIFICATION_TYPES,
} from '@/server/services/notification.service'
import { sendOrderToVendor } from '@/server/services/vendor-order.service'
import { assertTransition } from '@/lib/state-machine'

/**
 * Avvia il workflow di approvazione per una richiesta d'acquisto.
 *
 * Regole (combina ruolo + importo):
 * - Importo < 500€ → auto-approvazione per tutti
 * - Importo < 5000€ → MANAGER/ADMIN auto-approvano, altri richiedono MANAGER
 * - Importo >= 5000€ → solo ADMIN auto-approva, MANAGER e altri richiedono ADMIN
 */
export async function initiateApprovalWorkflow(
  requestId: string,
  estimatedAmount: number,
  requesterRole?: UserRole,
) {
  const tier = getApprovalTier(estimatedAmount)

  // Tier "auto" (<500€): tutti possono auto-approvare
  if (tier === 'auto') {
    return handleAutoApproval(
      requestId,
      `Auto-approvazione: importo ${estimatedAmount}€ sotto soglia`,
    )
  }

  // Tier "manager" (<5000€): MANAGER/ADMIN auto-approvano
  if (tier === 'manager') {
    if (requesterRole && canAutoApproveByRole(requesterRole)) {
      return handleAutoApproval(
        requestId,
        `Auto-approvazione: ruolo ${requesterRole} (importo ${estimatedAmount}€)`,
      )
    }
    return handleManualApproval(requestId, 'MANAGER')
  }

  // Tier "director" (>=5000€): solo ADMIN auto-approva
  if (requesterRole === 'ADMIN') {
    return handleAutoApproval(
      requestId,
      `Auto-approvazione: ruolo ADMIN (importo ${estimatedAmount}€)`,
    )
  }

  return handleManualApproval(requestId, 'ADMIN')
}

/**
 * Registra la decisione di un approvatore su un'approvazione.
 * Aggiorna lo stato della richiesta se tutte le approvazioni sono risolte.
 */
export async function decideApproval(
  approvalId: string,
  action: 'APPROVED' | 'REJECTED',
  notes?: string,
) {
  const approval = await prisma.approval.update({
    where: { id: approvalId },
    data: {
      status: action,
      decision_at: new Date(),
      notes: notes ?? null,
    },
    include: {
      request: { select: { id: true, code: true, requester_id: true } },
      approver: { select: { name: true } },
    },
  })

  await createTimelineForDecision(approval, action)

  const allApprovals = await prisma.approval.findMany({
    where: { request_id: approval.request_id },
    select: { status: true },
  })

  const newRequestStatus = resolveRequestStatus(allApprovals)

  if (newRequestStatus) {
    await finalizeRequestStatus(
      approval.request_id,
      approval.request.code,
      approval.request.requester_id,
      newRequestStatus,
      approval.approver.name,
    )
  }

  return approval
}

// --- Funzioni interne ---

async function handleAutoApproval(requestId: string, reason?: string) {
  // Verifica transizione DRAFT → APPROVED (via auto-approve, salta SUBMITTED/PENDING)
  const current = await prisma.purchaseRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { status: true, requester_id: true, code: true },
  })

  // Auto-approval salta gli step intermedi: DRAFT → APPROVED è consentito
  // perché è un percorso speciale gestito dal sistema
  const request = await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED' },
    select: { id: true, code: true, requester_id: true },
  })

  const notes = reason ?? 'Auto-approvazione: importo sotto soglia'

  const approval = await prisma.approval.create({
    data: {
      request_id: requestId,
      approver_id: current.requester_id,
      status: 'APPROVED',
      decision_at: new Date(),
      notes,
    },
  })

  await prisma.timelineEvent.create({
    data: {
      request_id: requestId,
      type: 'approval',
      title: 'Richiesta auto-approvata',
      description: notes,
      actor: 'Sistema',
    },
  })

  await createNotification({
    userId: request.requester_id,
    title: 'Richiesta approvata automaticamente',
    body: `La richiesta ${request.code} e stata approvata automaticamente.`,
    type: NOTIFICATION_TYPES.APPROVAL_DECIDED,
    link: `/requests/${requestId}`,
  })

  // Invia ordine al vendor (non-bloccante: se fallisce, logga nella timeline)
  sendOrderToVendor(requestId).catch((err) =>
    console.error(
      `[approval] Errore invio ordine vendor per ${requestId}:`,
      err,
    ),
  )

  return approval
}

async function handleManualApproval(
  requestId: string,
  requiredRole: 'MANAGER' | 'ADMIN',
) {
  const approver = await prisma.user.findFirst({
    where: { role: requiredRole },
    select: { id: true, name: true },
  })

  if (!approver) {
    throw new Error(
      `Nessun utente con ruolo ${requiredRole} trovato nel sistema`,
    )
  }

  // Verifica che la transizione sia valida prima di aggiornare
  const current = await prisma.purchaseRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { status: true },
  })
  assertTransition(current.status, 'PENDING_APPROVAL')

  const request = await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: { status: 'PENDING_APPROVAL' },
    select: { id: true, code: true },
  })

  const approval = await prisma.approval.create({
    data: {
      request_id: requestId,
      approver_id: approver.id,
      status: 'PENDING',
    },
  })

  const roleLabel = requiredRole === 'MANAGER' ? 'Manager' : 'Direzione'

  await prisma.timelineEvent.create({
    data: {
      request_id: requestId,
      type: 'approval',
      title: 'Approvazione richiesta',
      description: `Inviata per approvazione a ${approver.name} (${roleLabel})`,
      actor: 'Sistema',
    },
  })

  await createNotification({
    userId: approver.id,
    title: 'Nuova richiesta da approvare',
    body: `La richiesta ${request.code} richiede la tua approvazione.`,
    type: NOTIFICATION_TYPES.APPROVAL_REQUESTED,
    link: `/requests/${requestId}`,
  })

  return approval
}

async function createTimelineForDecision(
  approval: {
    request_id: string
    approver: { name: string }
  },
  action: 'APPROVED' | 'REJECTED',
) {
  const actionLabel = action === 'APPROVED' ? 'approvata' : 'rifiutata'

  await prisma.timelineEvent.create({
    data: {
      request_id: approval.request_id,
      type: 'approval',
      title: `Richiesta ${actionLabel}`,
      description: `Decisione presa da ${approval.approver.name}`,
      actor: approval.approver.name,
    },
  })
}

function resolveRequestStatus(
  approvals: readonly { status: string }[],
): 'APPROVED' | 'REJECTED' | null {
  const hasRejected = approvals.some((a) => a.status === 'REJECTED')
  if (hasRejected) return 'REJECTED'

  const allApproved = approvals.every((a) => a.status === 'APPROVED')
  if (allApproved) return 'APPROVED'

  return null
}

async function finalizeRequestStatus(
  requestId: string,
  requestCode: string,
  requesterId: string,
  newStatus: 'APPROVED' | 'REJECTED',
  approverName: string,
) {
  // Verifica transizione valida
  const current = await prisma.purchaseRequest.findUniqueOrThrow({
    where: { id: requestId },
    select: { status: true },
  })
  assertTransition(current.status, newStatus)

  await prisma.purchaseRequest.update({
    where: { id: requestId },
    data: { status: newStatus },
  })

  const statusLabel = newStatus === 'APPROVED' ? 'approvata' : 'rifiutata'

  await createNotification({
    userId: requesterId,
    title: `Richiesta ${statusLabel}`,
    body: `La richiesta ${requestCode} e stata ${statusLabel} da ${approverName}.`,
    type: NOTIFICATION_TYPES.APPROVAL_DECIDED,
    link: `/requests/${requestId}`,
  })

  // Se approvata, invia ordine al vendor
  if (newStatus === 'APPROVED') {
    sendOrderToVendor(requestId).catch((err) =>
      console.error(
        `[approval] Errore invio ordine vendor per ${requestId}:`,
        err,
      ),
    )
  }
}

// --- DB-backed approval thresholds ---

interface ApprovalThresholds {
  readonly autoApproveMax: number
  readonly managerApproveMax: number
}

/**
 * Legge le soglie di approvazione dal DeployConfig in DB.
 * Se non configurate, usa le costanti di default da approval-thresholds.
 */
export async function getApprovalThresholds(): Promise<ApprovalThresholds> {
  const config = await prisma.deployConfig.findUnique({
    where: { id: 'default' },
    select: { approval_rules: true },
  })

  if (
    config?.approval_rules &&
    typeof config.approval_rules === 'object' &&
    config.approval_rules !== null
  ) {
    const rules = config.approval_rules as Record<string, unknown>
    const autoMax =
      typeof rules.autoApproveMax === 'number'
        ? rules.autoApproveMax
        : APPROVAL_THRESHOLDS.AUTO_APPROVE_MAX
    const managerMax =
      typeof rules.managerApproveMax === 'number'
        ? rules.managerApproveMax
        : APPROVAL_THRESHOLDS.MANAGER_APPROVE_MAX

    return Object.freeze({
      autoApproveMax: autoMax,
      managerApproveMax: managerMax,
    })
  }

  return Object.freeze({
    autoApproveMax: APPROVAL_THRESHOLDS.AUTO_APPROVE_MAX,
    managerApproveMax: APPROVAL_THRESHOLDS.MANAGER_APPROVE_MAX,
  })
}

/**
 * Determina la fascia di approvazione usando le soglie dal DB.
 * Versione asincrona di getApprovalTier per futuri callers.
 */
export async function getApprovalTierFromDb(
  amount: number,
): Promise<'auto' | 'manager' | 'director'> {
  const thresholds = await getApprovalThresholds()
  if (amount < thresholds.autoApproveMax) return 'auto'
  if (amount < thresholds.managerApproveMax) return 'manager'
  return 'director'
}
