import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { canTransition } from '@/lib/state-machine'

// ---------------------------------------------------------------------------
// Servizio per l'invio dell'ordine al vendor dopo approvazione.
//
// Quando una richiesta viene approvata, questo servizio:
// 1. Recupera i dettagli della richiesta + vendor + items
// 2. Costruisce un'email con [PR-CODE] nell'oggetto
// 3. Invia tramite webhook a n8n (che manda via SMTP/Gmail)
// 4. Aggiorna lo stato a ORDERED e crea timeline event
//
// Il codice [PR-CODE] nell'oggetto permette al sistema di matchare
// la risposta del vendor con la richiesta corretta.
// ---------------------------------------------------------------------------

interface OrderEmailPayload {
  readonly to: string
  readonly subject: string
  readonly body: string
  readonly request_code: string
  readonly request_id: string
  readonly vendor_name: string
}

interface SendOrderResult {
  readonly success: boolean
  readonly request_code: string
  readonly vendor_email: string | null
  readonly error?: string
}

/**
 * Invia l'ordine al vendor dopo l'approvazione.
 * Chiama n8n via webhook per l'invio effettivo dell'email.
 */
export async function sendOrderToVendor(
  requestId: string,
): Promise<SendOrderResult> {
  const request = await prisma.purchaseRequest.findUnique({
    where: { id: requestId },
    include: {
      vendor: { select: { id: true, name: true, email: true, code: true } },
      requester: { select: { name: true, email: true, department: true } },
      items: true,
    },
  })

  if (!request) {
    return {
      success: false,
      request_code: '',
      vendor_email: null,
      error: 'Richiesta non trovata',
    }
  }

  if (!request.vendor) {
    // Nessun vendor associato — non possiamo inviare, logghiamo nella timeline
    await prisma.timelineEvent.create({
      data: {
        request_id: requestId,
        type: 'order_warning',
        title: 'Ordine non inviato: nessun fornitore associato',
        description:
          'La richiesta è stata approvata ma non ha un fornitore associato. Assegnare un fornitore e inviare manualmente.',
        actor: 'Sistema',
      },
    })
    return {
      success: false,
      request_code: request.code,
      vendor_email: null,
      error: 'Nessun fornitore associato',
    }
  }

  if (!request.vendor.email) {
    await prisma.timelineEvent.create({
      data: {
        request_id: requestId,
        type: 'order_warning',
        title: 'Ordine non inviato: email fornitore mancante',
        description: `Il fornitore ${request.vendor.name} non ha un indirizzo email configurato. Aggiornare l'anagrafica fornitore.`,
        actor: 'Sistema',
      },
    })
    return {
      success: false,
      request_code: request.code,
      vendor_email: null,
      error: 'Email fornitore mancante',
    }
  }

  // vendor e vendor.email sono garantiti non-null a questo punto
  const vendor = { ...request.vendor, email: request.vendor.email }

  const emailPayload = buildOrderEmail({
    ...request,
    vendor,
  })

  // Invia a n8n tramite webhook
  const sent = await sendViaN8n(emailPayload)

  if (sent) {
    // Aggiorna stato a ORDERED solo se la transizione è valida
    if (!canTransition(request.status, 'ORDERED')) {
      console.warn(
        `[vendor-order] Transizione ${request.status} → ORDERED non valida per ${request.code}, skip update status`,
      )
    } else {
      await prisma.purchaseRequest.update({
        where: { id: requestId },
        data: { status: 'ORDERED', ordered_at: new Date() },
      })
    }

    await prisma.timelineEvent.create({
      data: {
        request_id: requestId,
        type: 'order_sent',
        title: `Ordine inviato a ${request.vendor.name}`,
        description: `Email di ordine inviata a ${request.vendor.email} con riferimento [${request.code}]`,
        actor: 'Sistema',
        metadata: {
          vendor_email: request.vendor.email,
          vendor_name: request.vendor.name,
          subject: emailPayload.subject,
        } satisfies Prisma.InputJsonValue,
      },
    })
  }

  return {
    success: sent,
    request_code: request.code,
    vendor_email: request.vendor.email,
    error: sent ? undefined : 'Errore invio email tramite n8n',
  }
}

// ---------------------------------------------------------------------------
// Costruisce il payload dell'email d'ordine
// ---------------------------------------------------------------------------

function buildOrderEmail(request: {
  code: string
  id: string
  title: string
  description: string | null
  estimated_amount: Prisma.Decimal | null
  currency: string
  needed_by: Date | null
  vendor: { name: string; email: string; code: string }
  requester: { name: string; email: string; department: string | null }
  items: Array<{
    name: string
    description: string | null
    quantity: number
    unit: string | null
    unit_price: Prisma.Decimal | null
    total_price: Prisma.Decimal | null
  }>
}): OrderEmailPayload {
  // L'oggetto contiene [PR-CODE] — fondamentale per il matching delle risposte
  const subject = `[${request.code}] Ordine: ${request.title}`

  const lines: string[] = [
    `Gentile ${request.vendor.name},`,
    '',
    `con la presente vi inviamo ordine per quanto segue:`,
    '',
    `Riferimento richiesta: ${request.code}`,
  ]

  if (request.needed_by) {
    lines.push(
      `Data necessità: ${request.needed_by.toLocaleDateString('it-IT')}`,
    )
  }

  lines.push('')

  // Tabella articoli
  if (request.items.length > 0) {
    lines.push('ARTICOLI RICHIESTI:')
    lines.push('─'.repeat(60))

    for (const item of request.items) {
      const unitPrice = item.unit_price
        ? `${Number(item.unit_price).toFixed(2)}€`
        : 'da quotare'
      const totalPrice = item.total_price
        ? `${Number(item.total_price).toFixed(2)}€`
        : ''
      const unit = item.unit ?? 'pz'

      lines.push(
        `- ${item.name} x${item.quantity} ${unit} @ ${unitPrice}${totalPrice ? ` = ${totalPrice}` : ''}`,
      )
      if (item.description) {
        lines.push(`  ${item.description}`)
      }
    }

    lines.push('─'.repeat(60))
  }

  if (request.estimated_amount) {
    lines.push(
      `Importo stimato totale: ${Number(request.estimated_amount).toFixed(2)} ${request.currency}`,
    )
  }

  lines.push('')
  lines.push(
    "Vi preghiamo di confermare la ricezione dell'ordine e comunicarci:",
  )
  lines.push("- Conferma d'ordine con riferimento")
  lines.push('- Tempi di consegna previsti')
  lines.push('- Eventuale numero di tracking spedizione')
  lines.push('')
  lines.push(
    `IMPORTANTE: nelle vostre risposte, mantenete il riferimento [${request.code}] nell'oggetto dell'email per consentire il tracciamento automatico.`,
  )
  lines.push('')
  lines.push('Cordiali saluti,')
  lines.push(request.requester.name)
  if (request.requester.department) {
    lines.push(`${request.requester.department}`)
  }

  return {
    to: request.vendor.email,
    subject,
    body: lines.join('\n'),
    request_code: request.code,
    request_id: request.id,
    vendor_name: request.vendor.name,
  }
}

// ---------------------------------------------------------------------------
// Invia email tramite n8n webhook
// ---------------------------------------------------------------------------

async function sendViaN8n(payload: OrderEmailPayload): Promise<boolean> {
  const webhookUrl = process.env.N8N_WEBHOOK_BASE_URL
  if (!webhookUrl) {
    console.warn(
      '[vendor-order] N8N_WEBHOOK_BASE_URL non configurato, skip invio email',
    )
    return false
  }

  const url = `${webhookUrl}/send-order-email`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WEBHOOK_SECRET ?? process.env.N8N_WEBHOOK_SECRET ?? ''}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(
        `[vendor-order] n8n webhook error: ${response.status} ${response.statusText}`,
      )
      return false
    }

    console.log(
      `[vendor-order] Email ordine inviata: ${payload.request_code} → ${payload.to}`,
    )
    return true
  } catch (error) {
    console.error('[vendor-order] Errore invio a n8n:', error)
    return false
  }
}
