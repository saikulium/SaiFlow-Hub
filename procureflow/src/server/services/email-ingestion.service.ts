import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { canAutoApproveByRole } from '@/lib/constants/approval-thresholds'
import { initiateApprovalWorkflow } from './approval.service'
import { generateNextCodeAtomic } from './code-generator.service'
import { canTransition } from '@/lib/state-machine'
import type { RequestStatus } from '@prisma/client'
import { createNotification, NOTIFICATION_TYPES } from './notification.service'
import type {
  EmailIngestionPayload,
  ActionType,
} from '@/lib/validations/email-ingestion'

// ---------------------------------------------------------------------------
// Tipi di risultato
// ---------------------------------------------------------------------------

interface IngestionResult {
  readonly action: ActionType
  readonly request_id: string
  readonly request_code: string
  readonly items_created: number
  readonly status_updated: boolean
  readonly timeline_event_id: string
  readonly ai_confidence: number | null
  readonly deduplicated: boolean
}

// ---------------------------------------------------------------------------
// Entry point — processa il payload email AI-enriched
// ---------------------------------------------------------------------------

export async function processEmailIngestion(
  payload: EmailIngestionPayload,
): Promise<IngestionResult> {
  switch (payload.action) {
    case 'new_request':
      return handleNewRequest(payload)
    case 'update_existing':
      return handleUpdateExisting(payload)
    case 'info_only':
      return handleInfoOnly(payload)
  }
}

// ---------------------------------------------------------------------------
// Caso 1: Nuova richiesta d'acquisto
// ---------------------------------------------------------------------------

async function handleNewRequest(
  payload: EmailIngestionPayload,
): Promise<IngestionResult> {
  // Deduplicazione: se questa email è già stata processata, ritorna idempotente
  if (payload.email_message_id) {
    const existing = await prisma.purchaseRequest.findUnique({
      where: { email_message_id: payload.email_message_id },
      select: { id: true, code: true },
    })
    if (existing) {
      console.log(
        `[email-ingestion] Dedup: email ${payload.email_message_id} già processata → ${existing.code}`,
      )
      return {
        action: 'new_request',
        request_id: existing.id,
        request_code: existing.code,
        items_created: 0,
        status_updated: false,
        timeline_event_id: '',
        ai_confidence: payload.ai_confidence ?? null,
        deduplicated: true,
      }
    }
  }

  // Lookup richiedente per email — determina il ruolo per auto-approve
  const requester = await resolveRequester(payload.email_from)

  // Lookup vendor
  const vendorId = await resolveVendor(
    payload.ai_vendor_code,
    payload.ai_vendor_name,
  )

  // Genera codice progressivo (atomico — previene duplicati sotto concorrenza)
  const code = await generateNextCodeAtomic()

  // Calcola importo stimato dagli items se non fornito
  const estimatedAmount =
    payload.ai_estimated_amount ?? calculateTotalFromItems(payload.ai_items)

  // Prepara items
  const itemsData = payload.ai_items.map((item) => ({
    name: item.name,
    description: item.description ?? null,
    quantity: item.quantity,
    unit: item.unit ?? null,
    unit_price: item.unit_price ? new Prisma.Decimal(item.unit_price) : null,
    total_price: item.total_price
      ? new Prisma.Decimal(item.total_price)
      : item.unit_price
        ? new Prisma.Decimal(item.unit_price * item.quantity)
        : null,
    sku: item.sku ?? null,
  }))

  // Prepara allegati
  const attachmentsData = payload.attachments.map((a) => ({
    filename: a.filename,
    file_url: a.url,
    mime_type: a.mime_type ?? null,
    file_size: a.file_size ?? null,
  }))

  // Crea la richiesta con tutti i dati AI-enriched
  const request = await prisma.purchaseRequest.create({
    data: {
      code,
      email_message_id: payload.email_message_id ?? null,
      title: payload.ai_title ?? payload.email_subject,
      description: buildDescription(payload),
      status: 'DRAFT',
      priority: payload.ai_priority ?? 'MEDIUM',
      requester_id: requester.id,
      vendor_id: vendorId,
      estimated_amount: estimatedAmount
        ? new Prisma.Decimal(estimatedAmount)
        : null,
      currency: payload.ai_currency,
      category: payload.ai_category ?? null,
      department: payload.ai_department ?? null,
      needed_by: payload.ai_needed_by ? new Date(payload.ai_needed_by) : null,
      external_ref: payload.ai_external_ref ?? null,
      external_url: payload.ai_external_url || null,
      expected_delivery: payload.ai_expected_delivery
        ? new Date(payload.ai_expected_delivery)
        : null,
      tracking_number: payload.ai_tracking_number ?? null,
      tags: payload.ai_tags,
      items: itemsData.length > 0 ? { create: itemsData } : undefined,
      attachments:
        attachmentsData.length > 0 ? { create: attachmentsData } : undefined,
      timeline: {
        create: {
          type: 'email_ingestion',
          title: 'Richiesta creata da email',
          description:
            payload.ai_summary ??
            `Email da ${payload.email_from}: ${payload.email_subject}`,
          actor: payload.email_from,
          metadata: buildTimelineMetadata(payload),
          email_message_id: payload.email_message_id ?? null,
        },
      },
    },
    select: { id: true, code: true },
  })

  // Se il richiedente è MANAGER/ADMIN → auto-approve + invio ordine al vendor
  if (canAutoApproveByRole(requester.role)) {
    console.log(
      `[email-ingestion] Richiedente ${requester.role} (${payload.email_from}) → auto-approvazione per ${request.code}`,
    )
    await initiateApprovalWorkflow(
      request.id,
      estimatedAmount ?? 0,
      requester.role,
    )

    return {
      action: 'new_request',
      request_id: request.id,
      request_code: request.code,
      items_created: itemsData.length,
      status_updated: true,
      timeline_event_id: '',
      ai_confidence: payload.ai_confidence ?? null,
      deduplicated: false,
    }
  }

  // Utente base → resta in DRAFT, notifica admin
  await notifyNewRequestFromEmail(request.code, payload.email_from)

  return {
    action: 'new_request',
    request_id: request.id,
    request_code: request.code,
    items_created: itemsData.length,
    status_updated: false,
    timeline_event_id: '',
    ai_confidence: payload.ai_confidence ?? null,
    deduplicated: false,
  }
}

// ---------------------------------------------------------------------------
// Caso 2: Aggiornamento richiesta esistente
// ---------------------------------------------------------------------------

async function handleUpdateExisting(
  payload: EmailIngestionPayload,
): Promise<IngestionResult> {
  // Trova la richiesta esistente tramite codice o riferimento esterno
  const existingRequest = await findExistingRequest(
    payload.ai_matched_request_code,
    payload.ai_matched_external_ref,
    payload.email_subject,
  )

  if (!existingRequest) {
    // Fallback: crea come nuova richiesta se non trova match
    return handleNewRequest({
      ...payload,
      action: 'new_request',
      ai_tags: [...payload.ai_tags, 'match-non-trovato'],
    })
  }

  // Deduplicazione timeline: se questa email è già stata processata per questa request, skip
  if (payload.email_message_id) {
    const existingEvent = await prisma.timelineEvent.findFirst({
      where: {
        request_id: existingRequest.id,
        email_message_id: payload.email_message_id,
      },
      select: { id: true },
    })
    if (existingEvent) {
      console.log(
        `[email-ingestion] Dedup update: email ${payload.email_message_id} già processata per ${existingRequest.code}`,
      )
      return {
        action: 'update_existing',
        request_id: existingRequest.id,
        request_code: existingRequest.code,
        items_created: 0,
        status_updated: false,
        timeline_event_id: existingEvent.id,
        ai_confidence: payload.ai_confidence ?? null,
        deduplicated: true,
      }
    }
  }

  // Costruisci update data
  const updateData: Prisma.PurchaseRequestUpdateInput = {}
  let statusUpdated = false

  if (payload.ai_status_update) {
    const targetStatus = payload.ai_status_update as RequestStatus
    if (canTransition(existingRequest.status, targetStatus)) {
      updateData.status = targetStatus
      statusUpdated = true

      // Aggiorna date correlate allo status
      if (targetStatus === 'ORDERED') {
        updateData.ordered_at = new Date()
      }
      if (targetStatus === 'DELIVERED') {
        updateData.delivered_at = new Date()
      }
    } else {
      console.warn(
        `[email-ingestion] Transizione ${existingRequest.status} → ${targetStatus} non valida per ${existingRequest.code}, skip status update`,
      )
    }
  }

  if (payload.ai_tracking_number) {
    updateData.tracking_number = payload.ai_tracking_number
  }

  if (payload.ai_external_ref) {
    updateData.external_ref = payload.ai_external_ref
  }

  if (payload.ai_external_url) {
    updateData.external_url = payload.ai_external_url
  }

  if (payload.ai_expected_delivery) {
    updateData.expected_delivery = new Date(payload.ai_expected_delivery)
  }

  if (payload.ai_actual_amount !== undefined) {
    updateData.actual_amount = new Prisma.Decimal(payload.ai_actual_amount)
  }

  // Aggiorna la richiesta solo se ci sono campi da aggiornare
  if (Object.keys(updateData).length > 0) {
    await prisma.purchaseRequest.update({
      where: { id: existingRequest.id },
      data: updateData,
    })
  }

  // Aggiungi items se presenti e non duplicati
  let itemsCreated = 0
  if (payload.ai_items.length > 0) {
    const newItems = payload.ai_items.map((item) => ({
      request_id: existingRequest.id,
      name: item.name,
      description: item.description ?? null,
      quantity: item.quantity,
      unit: item.unit ?? null,
      unit_price: item.unit_price ? new Prisma.Decimal(item.unit_price) : null,
      total_price: item.total_price
        ? new Prisma.Decimal(item.total_price)
        : item.unit_price
          ? new Prisma.Decimal(item.unit_price * item.quantity)
          : null,
      sku: item.sku ?? null,
    }))

    const result = await prisma.requestItem.createMany({ data: newItems })
    itemsCreated = result.count
  }

  // Crea timeline event
  const timelineEvent = await prisma.timelineEvent.create({
    data: {
      request_id: existingRequest.id,
      type: 'email_update',
      title: buildUpdateTitle(payload),
      description:
        payload.ai_summary ??
        `Aggiornamento via email da ${payload.email_from}`,
      actor: payload.email_from,
      metadata: buildTimelineMetadata(payload),
      email_message_id: payload.email_message_id ?? null,
    },
  })

  // Notifica il requester dell'aggiornamento
  await notifyRequestUpdate(
    existingRequest.id,
    existingRequest.code,
    existingRequest.requester_id,
    payload,
  )

  return {
    action: 'update_existing',
    request_id: existingRequest.id,
    request_code: existingRequest.code,
    items_created: itemsCreated,
    status_updated: statusUpdated,
    timeline_event_id: timelineEvent.id,
    ai_confidence: payload.ai_confidence ?? null,
    deduplicated: false,
  }
}

// ---------------------------------------------------------------------------
// Caso 3: Solo informazione — logga nella timeline
// ---------------------------------------------------------------------------

async function handleInfoOnly(
  payload: EmailIngestionPayload,
): Promise<IngestionResult> {
  const existingRequest = await findExistingRequest(
    payload.ai_matched_request_code,
    payload.ai_matched_external_ref,
    payload.email_subject,
  )

  if (!existingRequest) {
    // Nessuna richiesta associabile — crea comunque come bozza
    return handleNewRequest({
      ...payload,
      action: 'new_request',
      ai_tags: [...payload.ai_tags, 'info-only', 'auto-creata'],
    })
  }

  const timelineEvent = await prisma.timelineEvent.create({
    data: {
      request_id: existingRequest.id,
      type: 'email_info',
      title: `Email informativa: ${payload.email_subject}`,
      description:
        payload.ai_summary ??
        `Email da ${payload.email_from}: ${payload.email_subject}`,
      actor: payload.email_from,
      metadata: buildTimelineMetadata(payload),
      email_message_id: payload.email_message_id ?? null,
    },
  })

  return {
    action: 'info_only',
    request_id: existingRequest.id,
    request_code: existingRequest.code,
    items_created: 0,
    status_updated: false,
    timeline_event_id: timelineEvent.id,
    ai_confidence: payload.ai_confidence ?? null,
    deduplicated: false,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveRequester(
  emailFrom: string,
): Promise<{ id: string; role: import('@prisma/client').UserRole }> {
  // Estrai indirizzo email pulito da formato "Nome <email@domain.com>"
  const emailMatch = emailFrom.match(/<([^>]+)>/)
  const email = emailMatch ? emailMatch[1] : emailFrom.trim()

  // Cerca utente per email
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, role: true },
  })

  if (user) return user

  // Sender sconosciuto → assegna al primo ADMIN come "quarantena"
  // La richiesta resterà in DRAFT (non auto-approvata) perché il ruolo è VIEWER
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true },
  })

  if (admin) {
    console.warn(
      `[email-ingestion] Sender sconosciuto (${email}): assegnato ad ADMIN come VIEWER per quarantena`,
    )
    return { id: admin.id, role: 'VIEWER' }
  }

  // Nessun ADMIN nel sistema — fallback al primo MANAGER
  const manager = await prisma.user.findFirst({
    where: { role: 'MANAGER' },
    select: { id: true },
  })

  if (manager) {
    console.warn(
      `[email-ingestion] Sender sconosciuto (${email}): assegnato a MANAGER come VIEWER`,
    )
    return { id: manager.id, role: 'VIEWER' }
  }

  throw new Error(
    `Nessun utente ADMIN o MANAGER nel sistema per gestire email da sender sconosciuto: ${email}`,
  )
}

async function resolveVendor(
  vendorCode?: string,
  vendorName?: string,
): Promise<string | null> {
  // Prima prova con codice esatto
  if (vendorCode) {
    const vendor = await prisma.vendor.findUnique({
      where: { code: vendorCode },
      select: { id: true },
    })
    if (vendor) return vendor.id
  }

  // Poi prova con nome (case-insensitive)
  if (vendorName) {
    const vendor = await prisma.vendor.findFirst({
      where: {
        name: { contains: vendorName, mode: 'insensitive' },
        status: 'ACTIVE',
      },
      select: { id: true },
    })
    if (vendor) return vendor.id
  }

  // Auto-crea fornitore se abbiamo almeno il nome dall'AI
  if (vendorName || vendorCode) {
    const code =
      vendorCode ??
      `AUTO-${vendorName!.substring(0, 8).toUpperCase().replace(/\s+/g, '')}-${Date.now().toString(36).slice(-4)}`
    const name = vendorName ?? vendorCode!

    const created = await prisma.vendor.create({
      data: {
        code,
        name,
        status: 'PENDING_REVIEW',
        notes:
          'Fornitore creato automaticamente da email ingestion. Verificare i dati.',
      },
      select: { id: true },
    })

    console.log(
      `[email-ingestion] Auto-created vendor: code=${code} name=${name} id=${created.id}`,
    )

    return created.id
  }

  return null
}

async function findExistingRequest(
  requestCode?: string,
  externalRef?: string,
  emailSubject?: string,
) {
  // 1. Prova con codice richiesta dall'AI
  if (requestCode) {
    const request = await prisma.purchaseRequest.findUnique({
      where: { code: requestCode },
      select: { id: true, code: true, requester_id: true, status: true },
    })
    if (request) return request
  }

  // 2. Estrai PR-CODE dall'oggetto email (es. "[PR-2026-00030] Conferma ordine...")
  if (emailSubject) {
    const prMatch = emailSubject.match(/\[?(PR-\d{4}-\d{4,6})\]?/)
    if (prMatch) {
      const extractedCode = prMatch[1]
      const request = await prisma.purchaseRequest.findUnique({
        where: { code: extractedCode },
        select: { id: true, code: true, requester_id: true, status: true },
      })
      if (request) {
        console.log(
          `[email-ingestion] Matched request via subject PR code: ${extractedCode}`,
        )
        return request
      }
    }
  }

  // 3. Prova con riferimento esterno
  if (externalRef) {
    const request = await prisma.purchaseRequest.findFirst({
      where: { external_ref: externalRef },
      select: { id: true, code: true, requester_id: true, status: true },
    })
    if (request) return request
  }

  return null
}

function calculateTotalFromItems(
  items: EmailIngestionPayload['ai_items'],
): number | undefined {
  if (items.length === 0) return undefined

  let total = 0
  let hasAnyPrice = false

  for (const item of items) {
    if (item.total_price) {
      total += item.total_price
      hasAnyPrice = true
    } else if (item.unit_price) {
      total += item.unit_price * item.quantity
      hasAnyPrice = true
    }
  }

  return hasAnyPrice ? total : undefined
}

function buildDescription(payload: EmailIngestionPayload): string {
  const parts: string[] = []

  if (payload.ai_description) {
    parts.push(payload.ai_description)
  }

  parts.push(`\n---\n**Email originale**\nDa: ${payload.email_from}`)
  parts.push(`Oggetto: ${payload.email_subject}`)

  if (payload.ai_confidence !== undefined) {
    const pct = Math.round(payload.ai_confidence * 100)
    parts.push(`\n_Confidenza AI: ${pct}%_`)
  }

  return parts.join('\n')
}

function buildUpdateTitle(payload: EmailIngestionPayload): string {
  const parts: string[] = []

  if (payload.ai_status_update) {
    parts.push(`Stato aggiornato a ${payload.ai_status_update}`)
  }
  if (payload.ai_tracking_number) {
    parts.push(`Tracking: ${payload.ai_tracking_number}`)
  }
  if (payload.ai_expected_delivery) {
    parts.push(
      `Consegna prevista: ${new Date(payload.ai_expected_delivery).toLocaleDateString('it-IT')}`,
    )
  }

  return parts.length > 0
    ? parts.join(' — ')
    : `Aggiornamento da ${payload.email_from}`
}

function buildTimelineMetadata(
  payload: EmailIngestionPayload,
): Prisma.InputJsonValue {
  return {
    email_from: payload.email_from,
    email_subject: payload.email_subject,
    email_message_id: payload.email_message_id ?? null,
    email_date: payload.email_date ?? null,
    ai_confidence: payload.ai_confidence ?? null,
    ai_action: payload.action,
    items_count: payload.ai_items.length,
    has_tracking: !!payload.ai_tracking_number,
    has_amount: !!(payload.ai_estimated_amount ?? payload.ai_actual_amount),
  }
}

// ---------------------------------------------------------------------------
// Notifiche
// ---------------------------------------------------------------------------

async function notifyNewRequestFromEmail(
  requestCode: string,
  emailFrom: string,
): Promise<void> {
  // Notifica tutti gli utenti con ruolo ADMIN o MANAGER
  const recipients = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] } },
    select: { id: true },
  })

  await Promise.all(
    recipients.map((r) =>
      createNotification({
        userId: r.id,
        title: `Nuova richiesta da email: ${requestCode}`,
        body: `L'AI ha creato automaticamente la richiesta ${requestCode} dall'email di ${emailFrom}. Verifica i dettagli.`,
        type: NOTIFICATION_TYPES.STATUS_CHANGED,
        link: `/requests/${requestCode}`,
      }),
    ),
  )
}

async function notifyRequestUpdate(
  requestId: string,
  requestCode: string,
  requesterId: string,
  payload: EmailIngestionPayload,
): Promise<void> {
  const parts: string[] = []

  if (payload.ai_status_update) {
    parts.push(`stato aggiornato a ${payload.ai_status_update}`)
  }
  if (payload.ai_tracking_number) {
    parts.push(`tracking: ${payload.ai_tracking_number}`)
  }
  if (payload.ai_expected_delivery) {
    parts.push(
      `consegna prevista: ${new Date(payload.ai_expected_delivery).toLocaleDateString('it-IT')}`,
    )
  }

  const body =
    parts.length > 0
      ? `Aggiornamento automatico per ${requestCode}: ${parts.join(', ')}.`
      : `Nuova informazione da email per la richiesta ${requestCode}.`

  await createNotification({
    userId: requesterId,
    title: `Aggiornamento: ${requestCode}`,
    body,
    type: NOTIFICATION_TYPES.STATUS_CHANGED,
    link: `/requests/${requestId}`,
  })
}
