import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { successResponse, errorResponse } from '@/lib/api-response'
import { verifyWebhookAuth } from '@/lib/webhook-auth'
import { sdiInvoiceWebhookSchema } from '@/lib/validations/sdi-invoice'
import { SDI_CONFIG, MATCHING_THRESHOLDS } from '@/lib/constants/sdi'
import { prisma } from '@/lib/db'
import {
  parseFatturaPA,
  FatturaParseError,
} from '@/server/services/fatturapa-parser.service'
import { matchInvoiceToOrder } from '@/server/services/invoice-matching.service'
import { performThreeWayMatch } from '@/server/services/three-way-matching.service'
import { canTransition } from '@/lib/state-machine'
import {
  createNotification,
  createBulkNotifications,
  NOTIFICATION_TYPES,
} from '@/server/services/notification.service'
import {
  checkWebhookProcessed,
  recordWebhookProcessed,
} from '@/server/services/webhook-idempotency.service'
import type { RequestStatus } from '@prisma/client'

// ---------------------------------------------------------------------------
// POST /api/webhooks/sdi-invoice
//
// Riceve fatture passive via SDI (tramite n8n o provider API).
// Flusso: autenticazione → timestamp → idempotency → dedup → parsing XML → matching → three-way → notifiche
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // --- Autenticazione + Timestamp ---
    const secret = SDI_CONFIG.webhook_secret
    const isAuthed = verifyWebhookAuth(
      rawBody,
      req.headers.get('x-webhook-signature'),
      req.headers.get('authorization'),
      secret,
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
        console.log(`[sdi-invoice] Idempotency hit: webhook_id=${webhookId}`)
        return NextResponse.json(existing.response)
      }
    } else {
      console.warn(
        '[sdi-invoice] Webhook ricevuto senza x-webhook-id — idempotency disattivata',
      )
    }

    // --- Parsing JSON ---
    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return errorResponse('INVALID_PAYLOAD', 'JSON non valido', 400)
    }

    // --- Validazione ---
    const parsed = sdiInvoiceWebhookSchema.safeParse(body)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }))
      return errorResponse(
        'VALIDATION_ERROR',
        'Payload non valido',
        400,
        issues,
      )
    }

    const payload = parsed.data

    // --- Gestione eventi non-fattura ---
    if (payload.event_type !== 'invoice_received') {
      console.log(`[sdi-invoice] Evento non-fattura: ${payload.event_type}`)
      return successResponse({
        event_type: payload.event_type,
        processed: false,
      })
    }

    // --- Deduplicazione per sdi_id ---
    if (payload.sdi_id) {
      const existing = await prisma.invoice.findUnique({
        where: { sdi_id: payload.sdi_id },
        select: { id: true, invoice_number: true },
      })
      if (existing) {
        console.log(
          `[sdi-invoice] Dedup: sdi_id ${payload.sdi_id} già processato`,
        )
        return successResponse({
          invoice_id: existing.id,
          invoice_number: existing.invoice_number,
          deduplicated: true,
        })
      }
    }

    // --- Parsing XML (se fornito) ---
    let parsedXml: ReturnType<typeof parseFatturaPA> | null = null
    let xmlRaw: string | null = null

    if (payload.invoice_xml) {
      // Decodifica base64 se necessario
      const xmlContent = isBase64(payload.invoice_xml)
        ? Buffer.from(payload.invoice_xml, 'base64').toString('utf-8')
        : payload.invoice_xml

      xmlRaw = xmlContent

      try {
        parsedXml = parseFatturaPA(xmlContent)
      } catch (err) {
        if (err instanceof FatturaParseError) {
          console.error(`[sdi-invoice] Errore parsing XML: ${err.message}`)
        } else {
          console.error('[sdi-invoice] Errore parsing XML:', err)
        }
        // Non bloccare — salva comunque la fattura con i dati dal payload
      }
    }

    // --- Risolvi dati (XML parsed ha priorità su payload pre-estratto) ---
    const supplierVatId =
      parsedXml?.supplier.vat_id ?? payload.sender_vat_id ?? ''
    const supplierName =
      parsedXml?.supplier.name ?? payload.sender_name ?? 'Sconosciuto'
    const invoiceNumber =
      parsedXml?.invoice_number ?? payload.invoice_number ?? ''
    const invoiceDate = parsedXml?.invoice_date
      ? parsedXml.invoice_date
      : payload.invoice_date
        ? new Date(payload.invoice_date)
        : new Date()
    const totalTaxable = parsedXml?.total_taxable ?? payload.total_taxable ?? 0
    const totalTax = parsedXml?.total_tax ?? payload.total_tax ?? 0
    const totalAmount = parsedXml?.total_amount ?? payload.total_amount ?? 0
    const causale = parsedXml?.causale ?? payload.causale
    const prCodeExtracted = parsedXml?.pr_code_extracted
    const documentType =
      parsedXml?.document_type ?? payload.document_type ?? 'TD01'

    // --- Risolvi vendor per P.IVA ---
    let vendorId: string | null = null
    if (supplierVatId) {
      const vendor = await prisma.vendor.findFirst({
        where: { vat_id: supplierVatId },
        select: { id: true },
      })
      if (vendor) {
        vendorId = vendor.id
      } else {
        // Auto-crea vendor con PENDING_REVIEW
        const code = `SDI-${supplierVatId.slice(-6)}-${Date.now().toString(36).slice(-4)}`
        const created = await prisma.vendor.create({
          data: {
            code,
            name: supplierName,
            vat_id: supplierVatId,
            status: 'PENDING_REVIEW',
            notes:
              'Fornitore creato automaticamente da fattura SDI. Verificare.',
          },
          select: { id: true },
        })
        vendorId = created.id
        console.log(
          `[sdi-invoice] Auto-created vendor: ${code} (${supplierName})`,
        )
      }
    }

    // --- Prepara righe fattura ---
    const lineItemsSource = parsedXml?.line_items ?? payload.line_items
    const lineItemsData = lineItemsSource.map((item, idx) => ({
      line_number: 'line_number' in item ? item.line_number : idx + 1,
      description: item.description,
      quantity: new Prisma.Decimal(item.quantity),
      unit_of_measure: item.unit_of_measure ?? null,
      unit_price: new Prisma.Decimal(item.unit_price),
      total_price: new Prisma.Decimal(item.total_price),
      vat_rate: new Prisma.Decimal(item.vat_rate),
      vat_amount: null,
      vat_nature: ('vat_nature' in item ? item.vat_nature : null) ?? null,
      matched_item_id: null,
    }))

    // --- Crea record Invoice ---
    const invoice = await prisma.invoice.create({
      data: {
        sdi_id: payload.sdi_id ?? null,
        sdi_filename: payload.sdi_filename ?? null,
        sdi_status: payload.sdi_status ?? 'RECEIVED',
        xml_raw: xmlRaw,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        document_type: documentType,
        total_taxable: new Prisma.Decimal(totalTaxable),
        total_tax: new Prisma.Decimal(totalTax),
        total_amount: new Prisma.Decimal(totalAmount),
        currency: payload.currency,
        supplier_vat_id: supplierVatId,
        supplier_tax_code: parsedXml?.supplier.tax_code ?? null,
        supplier_name: supplierName,
        customer_vat_id: parsedXml?.customer.vat_id ?? '',
        causale: causale ?? null,
        external_ref: parsedXml?.order_references[0]?.id_documento ?? null,
        pr_code_extracted: prCodeExtracted ?? null,
        payment_method:
          parsedXml?.payment?.method ?? payload.payment_method ?? null,
        payment_terms: parsedXml?.payment?.terms ?? null,
        iban: parsedXml?.payment?.iban ?? payload.payment_iban ?? null,
        due_date: parsedXml?.payment?.due_date
          ? parsedXml.payment.due_date
          : payload.payment_due_date
            ? new Date(payload.payment_due_date)
            : null,
        vendor_id: vendorId,
        match_status: 'UNMATCHED',
        reconciliation_status: 'PENDING',
        tenant_id: 'default',
        line_items:
          lineItemsData.length > 0 ? { create: lineItemsData } : undefined,
      },
      select: { id: true, invoice_number: true },
    })

    console.log(
      `[sdi-invoice] Fattura creata: ${invoice.invoice_number} (id: ${invoice.id})`,
    )

    // --- Matching automatico ---
    const matchResult = await matchInvoiceToOrder(invoice.id)

    let reconciliationResult = null

    if (
      matchResult.status === 'AUTO_MATCHED' &&
      matchResult.matched_request_id
    ) {
      // Collega fattura → ordine
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          purchase_request_id: matchResult.matched_request_id,
          match_status: 'AUTO_MATCHED',
          match_confidence: matchResult.confidence,
          matched_at: new Date(),
          matched_by: 'sistema',
        },
      })

      // Transizione stato ordine: → INVOICED (soft)
      const request = await prisma.purchaseRequest.findUnique({
        where: { id: matchResult.matched_request_id },
        select: { id: true, status: true, requester_id: true, code: true },
      })

      if (request) {
        const currentStatus = request.status as RequestStatus
        if (canTransition(currentStatus, 'INVOICED')) {
          await prisma.purchaseRequest.update({
            where: { id: request.id },
            data: {
              status: 'INVOICED',
              invoiced_amount: new Prisma.Decimal(totalAmount),
            },
          })
        } else {
          console.warn(
            `[sdi-invoice] Transizione ${currentStatus} → INVOICED non valida per ${request.code}, skip`,
          )
          // Aggiorna solo invoiced_amount senza cambiare stato
          await prisma.purchaseRequest.update({
            where: { id: request.id },
            data: {
              invoiced_amount: new Prisma.Decimal(totalAmount),
            },
          })
        }

        // Timeline sulla richiesta
        await prisma.timelineEvent.create({
          data: {
            request_id: request.id,
            invoice_id: invoice.id,
            type: 'invoice_received',
            title: `Fattura ${invoiceNumber} ricevuta e associata`,
            description: `Fattura da ${supplierName} — importo: €${totalAmount.toFixed(2)}. Match automatico (confidenza: ${Math.round(matchResult.confidence * 100)}%).`,
            actor: 'SDI',
            metadata: {
              sdi_id: payload.sdi_id,
              match_status: matchResult.status,
              match_confidence: matchResult.confidence,
              match_reason: matchResult.match_reason,
            },
          },
        })

        // Three-way matching
        reconciliationResult = await performThreeWayMatch(
          invoice.id,
          request.id,
        )

        // Notifica richiedente
        await createNotification({
          userId: request.requester_id,
          title: `Fattura associata: ${request.code}`,
          body: `Fattura ${invoiceNumber} da ${supplierName} (€${totalAmount.toFixed(2)}) associata automaticamente. ${reconciliationResult.auto_approve ? 'Riconciliazione automatica completata.' : `Discrepanza ${reconciliationResult.discrepancy_percentage.toFixed(1)}% — verifica richiesta.`}`,
          type: reconciliationResult.auto_approve
            ? NOTIFICATION_TYPES.INVOICE_RECONCILED
            : NOTIFICATION_TYPES.INVOICE_DISCREPANCY,
          link: `/invoices/${invoice.id}`,
        })
      }
    } else if (matchResult.status === 'SUGGESTED') {
      // Salva candidati
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          match_status: 'SUGGESTED',
          match_confidence: matchResult.confidence,
          match_candidates: matchResult.candidate_request_ids as string[],
        },
      })

      // Notifica operatori
      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'MANAGER'] } },
        select: { id: true },
      })

      await createBulkNotifications(
        admins.map((a) => ({
          userId: a.id,
          title: `Fattura da associare: ${invoiceNumber}`,
          body: `Fattura da ${supplierName} (€${totalAmount.toFixed(2)}) — match suggerito, conferma richiesta.`,
          type: NOTIFICATION_TYPES.INVOICE_MATCH_FAILED,
          link: `/invoices/${invoice.id}`,
        })),
      )
    } else {
      // UNMATCHED — notifica admin
      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'MANAGER'] } },
        select: { id: true },
      })

      await createBulkNotifications(
        admins.map((a) => ({
          userId: a.id,
          title: `Fattura senza ordine: ${invoiceNumber}`,
          body: `Fattura da ${supplierName} (€${totalAmount.toFixed(2)}) ricevuta senza ordine associato.`,
          type: NOTIFICATION_TYPES.INVOICE_MATCH_FAILED,
          link: `/invoices/${invoice.id}`,
        })),
      )
    }

    // Timeline sulla fattura
    await prisma.timelineEvent.create({
      data: {
        invoice_id: invoice.id,
        type: 'invoice_received',
        title: `Fattura ${invoiceNumber} ricevuta via SDI`,
        description: `Fornitore: ${supplierName} — Importo: €${totalAmount.toFixed(2)} — Match: ${matchResult.status}`,
        actor: 'SDI',
        metadata: {
          sdi_id: payload.sdi_id,
          match_status: matchResult.status,
          match_confidence: matchResult.confidence,
        },
      },
    })

    const responseData = {
      success: true,
      data: {
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        match_status: matchResult.status,
        match_confidence: matchResult.confidence,
        matched_request_id: matchResult.matched_request_id ?? null,
        reconciliation: reconciliationResult
          ? {
              status: reconciliationResult.status,
              auto_approved: reconciliationResult.auto_approve,
              discrepancy_percent: reconciliationResult.discrepancy_percentage,
            }
          : null,
        deduplicated: false,
      },
    }

    // Registra idempotency
    if (webhookId) {
      await recordWebhookProcessed(webhookId, 'sdi-invoice', 200, responseData)
    }

    return successResponse(responseData.data)
  } catch (error) {
    console.error('POST /api/webhooks/sdi-invoice error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}

function isBase64(str: string): boolean {
  if (str.length < 20) return false
  if (str.startsWith('<?xml') || str.startsWith('<')) return false
  return /^[A-Za-z0-9+/=]+$/.test(str.slice(0, 100))
}
