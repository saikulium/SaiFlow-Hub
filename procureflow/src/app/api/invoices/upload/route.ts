import { Prisma } from '@prisma/client'
import { successResponse, errorResponse } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import {
  parseFatturaPA,
  FatturaParseError,
} from '@/server/services/fatturapa-parser.service'
import { matchInvoiceToOrder } from '@/server/services/invoice-matching.service'
import { performThreeWayMatch } from '@/server/services/three-way-matching.service'
import { canTransition } from '@/lib/state-machine'
import type { RequestStatus } from '@prisma/client'
import { requireModule } from '@/lib/modules/require-module'

// ---------------------------------------------------------------------------
// POST /api/invoices/upload — Upload manuale XML FatturaPA
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const blocked = await requireModule('/api/invoices')
  if (blocked) return blocked
  try {
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

    const xmlContent = await file.text()

    // --- Parsing XML ---
    let parsedXml: ReturnType<typeof parseFatturaPA>
    try {
      parsedXml = parseFatturaPA(xmlContent)
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

    // --- Deduplicazione per numero fattura + P.IVA ---
    const existing = await prisma.invoice.findFirst({
      where: {
        invoice_number: parsedXml.invoice_number,
        supplier_vat_id: parsedXml.supplier.vat_id,
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

    // --- Risolvi vendor per P.IVA ---
    let vendorId: string | null = null
    if (parsedXml.supplier.vat_id) {
      const vendor = await prisma.vendor.findFirst({
        where: { vat_id: parsedXml.supplier.vat_id },
        select: { id: true },
      })
      if (vendor) {
        vendorId = vendor.id
      } else {
        const code = `SDI-${parsedXml.supplier.vat_id.slice(-6)}-${Date.now().toString(36).slice(-4)}`
        const created = await prisma.vendor.create({
          data: {
            code,
            name: parsedXml.supplier.name,
            vat_id: parsedXml.supplier.vat_id,
            status: 'PENDING_REVIEW',
            notes:
              'Fornitore creato automaticamente da upload manuale fattura.',
          },
          select: { id: true },
        })
        vendorId = created.id
      }
    }

    // --- Prepara righe ---
    const lineItemsData = parsedXml.line_items.map((item) => ({
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

    // --- Crea Invoice ---
    const invoice = await prisma.invoice.create({
      data: {
        sdi_filename: file.name,
        sdi_status: 'MANUAL_UPLOAD',
        xml_raw: xmlContent,
        invoice_number: parsedXml.invoice_number,
        invoice_date: parsedXml.invoice_date,
        document_type: parsedXml.document_type,
        total_taxable: new Prisma.Decimal(parsedXml.total_taxable),
        total_tax: new Prisma.Decimal(parsedXml.total_tax),
        total_amount: new Prisma.Decimal(parsedXml.total_amount),
        currency: 'EUR',
        supplier_vat_id: parsedXml.supplier.vat_id,
        supplier_tax_code: parsedXml.supplier.tax_code ?? null,
        supplier_name: parsedXml.supplier.name,
        customer_vat_id: parsedXml.customer.vat_id ?? '',
        causale: parsedXml.causale ?? null,
        external_ref: parsedXml.order_references[0]?.id_documento ?? null,
        pr_code_extracted: parsedXml.pr_code_extracted ?? null,
        payment_method: parsedXml.payment?.method ?? null,
        payment_terms: parsedXml.payment?.terms ?? null,
        iban: parsedXml.payment?.iban ?? null,
        due_date: parsedXml.payment?.due_date ?? null,
        vendor_id: vendorId,
        match_status: 'UNMATCHED',
        reconciliation_status: 'PENDING',
        tenant_id: 'default',
        line_items:
          lineItemsData.length > 0 ? { create: lineItemsData } : undefined,
      },
      select: { id: true, invoice_number: true },
    })

    // --- Matching automatico ---
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
              invoiced_amount: new Prisma.Decimal(parsedXml.total_amount),
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

    // --- Timeline ---
    await prisma.timelineEvent.create({
      data: {
        invoice_id: invoice.id,
        type: 'import',
        title: `Fattura ${invoice.invoice_number} caricata manualmente`,
        description: `File: ${file.name} — Match: ${matchResult.status}`,
        actor: 'Utente',
      },
    })

    return successResponse({
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      match_status: matchResult.status,
      match_confidence: matchResult.confidence,
    })
  } catch (error) {
    console.error('POST /api/invoices/upload error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
