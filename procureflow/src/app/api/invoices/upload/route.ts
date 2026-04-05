import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { successResponse, errorResponse } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import {
  parseFatturaPA,
  FatturaParseError,
} from '@/server/services/fatturapa-parser.service'
import {
  parseInvoiceWithAI,
  AiParseError,
} from '@/server/services/invoice-ai-parser.service'
import { matchInvoiceToOrder } from '@/server/services/invoice-matching.service'
import { performThreeWayMatch } from '@/server/services/three-way-matching.service'
import { canTransition } from '@/lib/state-machine'
import type { RequestStatus } from '@prisma/client'
import type { ParsedInvoice } from '@/types/fatturapa'
import { requireModule } from '@/lib/modules/require-module'

// ---------------------------------------------------------------------------
// POST /api/invoices/upload — Upload fatture (XML, PDF, immagini)
//
// Routing:
//   - XML/P7M → parser deterministico FatturaPA (più affidabile)
//   - PDF/JPG/PNG/WEBP → AI Vision parser (Claude Sonnet)
// ---------------------------------------------------------------------------

const XML_EXTENSIONS = new Set(['xml', 'p7m'])
const XML_MIME_TYPES = new Set([
  'text/xml',
  'application/xml',
  'application/pkcs7-mime',
])

const AI_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp'])
const AI_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

function isXmlFile(filename: string, mimeType: string): boolean {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  return XML_EXTENSIONS.has(ext) || XML_MIME_TYPES.has(mimeType)
}

function isAiSupportedFile(filename: string, mimeType: string): boolean {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  return AI_EXTENSIONS.has(ext) || AI_MIME_TYPES.has(mimeType)
}

export async function POST(req: Request) {
  const blocked = await requireModule('/api/invoices')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER', 'REQUESTER')
    if (authResult instanceof NextResponse) return authResult

    const formData = await req.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return errorResponse('MISSING_FILE', 'File non fornito', 400)
    }

    if (file.size > 10 * 1024 * 1024) {
      return errorResponse(
        'FILE_TOO_LARGE',
        'File troppo grande (max 10MB)',
        400,
      )
    }

    const filename = file.name
    const mimeType = file.type

    // --- Routing: XML deterministico vs AI Vision ---
    let parsedData: ParsedInvoice
    let sdiStatus: string
    let xmlRaw: string | null = null
    let aiMetadata: {
      ai_parsed: boolean
      ai_confidence: number
      ai_model: string
    } | null = null

    if (isXmlFile(filename, mimeType)) {
      // Parser deterministico FatturaPA
      const xmlContent = await file.text()
      xmlRaw = xmlContent
      try {
        parsedData = parseFatturaPA(xmlContent)
      } catch (err) {
        if (err instanceof FatturaParseError) {
          return errorResponse('PARSE_ERROR', err.message, 400)
        }
        return errorResponse(
          'PARSE_ERROR',
          'Errore nel parsing del file XML',
          400,
        )
      }
      sdiStatus = 'MANUAL_UPLOAD'
    } else if (isAiSupportedFile(filename, mimeType)) {
      // AI Vision parser
      const buffer = Buffer.from(await file.arrayBuffer())
      try {
        const result = await parseInvoiceWithAI(buffer, mimeType, filename)
        parsedData = result.invoice
        aiMetadata = {
          ai_parsed: true,
          ai_confidence: result.ai_confidence,
          ai_model: result.ai_model,
        }
      } catch (err) {
        if (err instanceof AiParseError) {
          const statusCode =
            err.code === 'AI_NOT_CONFIGURED'
              ? 503
              : err.code === 'AI_TIMEOUT'
                ? 504
                : err.code === 'AI_INVALID_JSON'
                  ? 422
                  : 500
          return errorResponse(err.code, err.message, statusCode)
        }
        return errorResponse(
          'AI_ERROR',
          'Errore nel parsing AI della fattura',
          500,
        )
      }
      sdiStatus = 'AI_PARSED'
    } else {
      return errorResponse(
        'UNSUPPORTED_FORMAT',
        'Formato file non supportato. Formati accettati: XML, PDF, JPEG, PNG, WebP.',
        400,
      )
    }

    // --- Da qui il flusso è identico per XML e AI ---

    // Deduplicazione per numero fattura + P.IVA
    if (parsedData.invoice_number && parsedData.supplier.vat_id) {
      const existing = await prisma.invoice.findFirst({
        where: {
          invoice_number: parsedData.invoice_number,
          supplier_vat_id: parsedData.supplier.vat_id,
        },
        select: { id: true, invoice_number: true },
      })

      if (existing) {
        return errorResponse(
          'DUPLICATE',
          `Fattura ${existing.invoice_number} già presente nel sistema`,
          409,
        )
      }
    }

    // Risolvi vendor per P.IVA
    let vendorId: string | null = null
    if (parsedData.supplier.vat_id) {
      const vendor = await prisma.vendor.findFirst({
        where: { vat_id: parsedData.supplier.vat_id },
        select: { id: true },
      })
      if (vendor) {
        vendorId = vendor.id
      } else {
        const code = `SDI-${parsedData.supplier.vat_id.slice(-6)}-${Date.now().toString(36).slice(-4)}`
        const created = await prisma.vendor.create({
          data: {
            code,
            name: parsedData.supplier.name,
            vat_id: parsedData.supplier.vat_id,
            status: 'PENDING_REVIEW',
            notes:
              sdiStatus === 'AI_PARSED'
                ? 'Fornitore creato automaticamente da fattura analizzata con AI. Verificare.'
                : 'Fornitore creato automaticamente da upload manuale fattura.',
          },
          select: { id: true },
        })
        vendorId = created.id
      }
    }

    // Prepara righe
    const lineItemsData = parsedData.line_items.map((item) => ({
      line_number: item.line_number,
      description: item.description,
      quantity: new Prisma.Decimal(item.quantity),
      unit_of_measure: item.unit_of_measure ?? null,
      unit_price: new Prisma.Decimal(item.unit_price),
      total_price: new Prisma.Decimal(item.total_price),
      vat_rate: new Prisma.Decimal(item.vat_rate),
      vat_amount: null,
      vat_nature: item.vat_nature ?? null,
      matched_item_id: null,
    }))

    // Crea Invoice
    const invoice = await prisma.invoice.create({
      data: {
        sdi_filename: filename,
        sdi_status: sdiStatus,
        xml_raw: xmlRaw,
        invoice_number: parsedData.invoice_number,
        invoice_date: parsedData.invoice_date,
        document_type: parsedData.document_type,
        total_taxable: new Prisma.Decimal(parsedData.total_taxable),
        total_tax: new Prisma.Decimal(parsedData.total_tax),
        total_amount: new Prisma.Decimal(parsedData.total_amount),
        currency: 'EUR',
        supplier_vat_id: parsedData.supplier.vat_id,
        supplier_tax_code: parsedData.supplier.tax_code ?? null,
        supplier_name: parsedData.supplier.name,
        customer_vat_id: parsedData.customer.vat_id ?? '',
        causale: parsedData.causale ?? null,
        external_ref: parsedData.order_references[0]?.id_documento ?? null,
        pr_code_extracted: parsedData.pr_code_extracted ?? null,
        payment_method: parsedData.payment?.method ?? null,
        payment_terms: parsedData.payment?.terms ?? null,
        iban: parsedData.payment?.iban ?? null,
        due_date: parsedData.payment?.due_date ?? null,
        vendor_id: vendorId,
        match_status: 'UNMATCHED',
        reconciliation_status: 'PENDING',
        tenant_id: 'default',
        line_items:
          lineItemsData.length > 0 ? { create: lineItemsData } : undefined,
      },
      select: { id: true, invoice_number: true },
    })

    // Matching automatico
    const matchResult = await matchInvoiceToOrder(invoice.id)

    if (
      matchResult.status === 'AUTO_MATCHED' &&
      matchResult.matched_request_id
    ) {
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

      const request = await prisma.purchaseRequest.findUnique({
        where: { id: matchResult.matched_request_id },
        select: { id: true, status: true },
      })

      if (request) {
        const currentStatus = request.status as RequestStatus
        if (canTransition(currentStatus, 'INVOICED')) {
          await prisma.purchaseRequest.update({
            where: { id: request.id },
            data: {
              status: 'INVOICED',
              invoiced_amount: new Prisma.Decimal(parsedData.total_amount),
            },
          })
        }

        await performThreeWayMatch(invoice.id, request.id)
      }
    } else if (matchResult.status === 'SUGGESTED') {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          match_status: 'SUGGESTED',
          match_confidence: matchResult.confidence,
          match_candidates: matchResult.candidate_request_ids as string[],
        },
      })
    }

    // Timeline
    const parseMethod = sdiStatus === 'AI_PARSED' ? 'AI Vision' : 'XML parser'
    await prisma.timelineEvent.create({
      data: {
        invoice_id: invoice.id,
        type: 'import',
        title: `Fattura ${invoice.invoice_number} caricata manualmente`,
        description: `File: ${filename} — Parsing: ${parseMethod} — Match: ${matchResult.status}${aiMetadata ? ` — AI confidence: ${Math.round(aiMetadata.ai_confidence * 100)}%` : ''}`,
        actor: 'Utente',
        metadata: aiMetadata
          ? {
              ai_parsed: true,
              ai_confidence: aiMetadata.ai_confidence,
              ai_model: aiMetadata.ai_model,
            }
          : undefined,
      },
    })

    return successResponse({
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      match_status: matchResult.status,
      match_confidence: matchResult.confidence,
      ...(aiMetadata ?? {}),
    })
  } catch (error) {
    console.error('POST /api/invoices/upload error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
