import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import type { ZodTool } from '@/server/agents/tools/procurement.tools'

// ---------------------------------------------------------------------------
// Invoice Reconciliation Tools — used by the invoice reconciliation agent
// ---------------------------------------------------------------------------

const DEFAULT_TENANT = 'default'
const MAX_HISTORY_RESULTS = 20

// ---------------------------------------------------------------------------
// 1. get_invoice_detail — Full invoice with line items and matched request
// ---------------------------------------------------------------------------

export const getInvoiceDetailTool = betaZodTool({
  name: 'get_invoice_detail',
  description:
    'Ottieni dettaglio completo di una fattura con righe e ordine correlato. Usa per leggere importi, fornitore, righe fattura.',
  inputSchema: z.object({
    invoice_id: z.string().describe('ID della fattura'),
  }),
  run: async (input) => {
    const invoice = await prisma.invoice.findFirst({
      where: { id: input.invoice_id, tenant_id: DEFAULT_TENANT },
      select: {
        id: true,
        invoice_number: true,
        invoice_date: true,
        supplier_name: true,
        supplier_vat_id: true,
        total_amount: true,
        currency: true,
        match_status: true,
        reconciliation_status: true,
        reconciliation_notes: true,
        pr_code_extracted: true,
        received_at: true,
        line_items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unit_price: true,
            total_price: true,
            vat_rate: true,
          },
        },
        purchase_request: {
          select: { code: true, title: true },
        },
      },
    })

    if (!invoice) {
      return JSON.stringify({
        error: `Fattura con ID ${input.invoice_id} non trovata`,
      })
    }

    return JSON.stringify(invoice)
  },
})

// ---------------------------------------------------------------------------
// 2. get_order_for_invoice — Find the related purchase order
// ---------------------------------------------------------------------------

export const getOrderForInvoiceTool = betaZodTool({
  name: 'get_order_for_invoice',
  description:
    "Trova l'ordine di acquisto correlato a una fattura. Cerca per codice PR oppure per nome/P.IVA fornitore tra gli ordini ORDERED/SHIPPED/DELIVERED.",
  inputSchema: z.object({
    pr_code: z
      .string()
      .optional()
      .describe('Codice PR estratto dalla fattura (formato PR-YYYY-NNNNN)'),
    supplier_name: z
      .string()
      .optional()
      .describe('Nome del fornitore dalla fattura'),
    supplier_vat_id: z
      .string()
      .optional()
      .describe('Partita IVA del fornitore'),
  }),
  run: async (input) => {
    // Strategy 1: search by PR code
    if (input.pr_code) {
      const request = await prisma.purchaseRequest.findUnique({
        where: { code: input.pr_code },
        include: {
          items: true,
          vendor: { select: { name: true, code: true } },
        },
      })

      if (request) {
        return JSON.stringify(request)
      }

      return JSON.stringify({
        error: `Ordine con codice ${input.pr_code} non trovato`,
      })
    }

    // Strategy 2: find vendor first, then find their orders
    const validStatuses = [
      'ORDERED',
      'SHIPPED',
      'DELIVERED',
      'INVOICED',
    ] as const

    if (input.supplier_vat_id) {
      const invoicesWithVendor = await prisma.invoice.findMany({
        where: {
          tenant_id: DEFAULT_TENANT,
          supplier_vat_id: input.supplier_vat_id,
          purchase_request_id: { not: null },
        },
        select: { vendor_id: true },
        take: 1,
      })

      const vendorId = invoicesWithVendor[0]?.vendor_id
      if (vendorId) {
        const requests = await prisma.purchaseRequest.findMany({
          where: {
            vendor_id: vendorId,
            status: { in: [...validStatuses] },
          },
          include: {
            items: true,
            vendor: { select: { name: true, code: true } },
          },
          orderBy: { created_at: 'desc' },
          take: 5,
        })

        if (requests.length > 0) {
          return JSON.stringify({ results: requests, total: requests.length })
        }
      }
    }

    if (input.supplier_name) {
      const vendor = await prisma.vendor.findFirst({
        where: {
          name: { contains: input.supplier_name, mode: 'insensitive' },
        },
        select: { id: true, name: true },
      })

      if (!vendor) {
        return JSON.stringify({
          error: `Fornitore "${input.supplier_name}" non trovato`,
        })
      }

      const requests = await prisma.purchaseRequest.findMany({
        where: {
          vendor_id: vendor.id,
          status: { in: [...validStatuses] },
        },
        include: {
          items: true,
          vendor: { select: { name: true, code: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 5,
      })

      if (requests.length === 0) {
        return JSON.stringify({
          error: `Nessun ordine trovato per il fornitore "${vendor.name}" con stato ORDERED/SHIPPED/DELIVERED`,
        })
      }

      return JSON.stringify({ results: requests, total: requests.length })
    }

    return JSON.stringify({
      error:
        'Specificare almeno uno tra pr_code, supplier_name o supplier_vat_id',
    })
  },
})

// ---------------------------------------------------------------------------
// 3. get_vendor_price_history — Price history for an item from a vendor
// ---------------------------------------------------------------------------

export const getVendorPriceHistoryTool = betaZodTool({
  name: 'get_vendor_price_history',
  description:
    'Storico prezzi di un articolo da un fornitore. Cerca tra gli ordini consegnati per confrontare prezzi passati con la fattura.',
  inputSchema: z.object({
    vendor_name: z.string().describe('Nome del fornitore'),
    item_description: z
      .string()
      .describe("Descrizione o nome dell'articolo da cercare"),
  }),
  run: async (input) => {
    const vendor = await prisma.vendor.findFirst({
      where: {
        name: { contains: input.vendor_name, mode: 'insensitive' },
      },
      select: { id: true, name: true },
    })

    if (!vendor) {
      return JSON.stringify({
        error: `Fornitore "${input.vendor_name}" non trovato`,
      })
    }

    const deliveredRequests = await prisma.purchaseRequest.findMany({
      where: {
        vendor_id: vendor.id,
        status: { in: ['DELIVERED', 'RECONCILED', 'CLOSED'] },
      },
      select: {
        id: true,
        code: true,
        delivered_at: true,
        created_at: true,
        items: {
          where: {
            name: { contains: input.item_description, mode: 'insensitive' },
          },
          select: {
            name: true,
            quantity: true,
            unit: true,
            unit_price: true,
            total_price: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: MAX_HISTORY_RESULTS,
    })

    // Filter out requests with no matching items
    const withItems = deliveredRequests
      .filter((r) => r.items.length > 0)
      .map((r) => ({
        pr_code: r.code,
        delivered_at: r.delivered_at ?? r.created_at,
        items: r.items,
      }))

    if (withItems.length === 0) {
      return JSON.stringify({
        error: `Nessuno storico prezzi trovato per "${input.item_description}" dal fornitore "${vendor.name}"`,
        vendor: vendor.name,
      })
    }

    return JSON.stringify({
      vendor: vendor.name,
      history: withItems,
      total: withItems.length,
    })
  },
})

// ---------------------------------------------------------------------------
// 4. update_reconciliation_status — Update invoice reconciliation status
// ---------------------------------------------------------------------------

const reconciliationStatusEnum = z.enum(['APPROVED', 'DISPUTED', 'PENDING'])

export const updateReconciliationStatusTool = betaZodTool({
  name: 'update_reconciliation_status',
  description:
    "Aggiorna lo stato di riconciliazione di una fattura. Usa dopo aver completato l'analisi per impostare APPROVED, DISPUTED o PENDING.",
  inputSchema: z.object({
    invoice_id: z.string().describe('ID della fattura'),
    status: reconciliationStatusEnum.describe(
      'Nuovo stato: APPROVED, DISPUTED o PENDING',
    ),
    notes: z
      .string()
      .optional()
      .describe('Note di riconciliazione (motivo approvazione/contestazione)'),
  }),
  run: async (input) => {
    const existing = await prisma.invoice.findUnique({
      where: { id: input.invoice_id },
      select: { id: true, reconciliation_status: true },
    })

    if (!existing) {
      return JSON.stringify({
        error: `Fattura con ID ${input.invoice_id} non trovata`,
      })
    }

    const updated = await prisma.invoice.update({
      where: { id: input.invoice_id },
      data: {
        reconciliation_status: input.status,
        reconciliation_notes: input.notes ?? null,
        reconciled_at: input.status !== 'PENDING' ? new Date() : null,
      },
      select: {
        id: true,
        invoice_number: true,
        reconciliation_status: true,
        reconciliation_notes: true,
        reconciled_at: true,
      },
    })

    return JSON.stringify({
      success: true,
      invoice: updated,
    })
  },
})

// ---------------------------------------------------------------------------
// Exported collection
// ---------------------------------------------------------------------------

export const INVOICE_TOOLS: readonly ZodTool[] = [
  getInvoiceDetailTool,
  getOrderForInvoiceTool,
  getVendorPriceHistoryTool,
  updateReconciliationStatusTool,
] as readonly ZodTool[]
