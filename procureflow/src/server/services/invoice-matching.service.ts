import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { InvoiceMatchStatus } from '@prisma/client'
import { MATCHING_THRESHOLDS } from '@/lib/constants/sdi'

// ---------------------------------------------------------------------------
// Servizio di matching fattura ↔ ordine (PurchaseRequest)
//
// Algoritmo a 5 livelli di priorità decrescente:
//   1. Match esatto per codice PR in DatiOrdineAcquisto (conf. 0.95)
//   2. Match per codice PR in Causale (conf. 0.85)
//   3. Match per P.IVA fornitore + importo (conf. 0.60)
//   4. Match per P.IVA fornitore + periodo (conf. 0.40)
//   5. Nessun match (conf. 0)
// ---------------------------------------------------------------------------

export interface MatchResult {
  readonly status: InvoiceMatchStatus
  readonly confidence: number
  readonly matched_request_id?: string
  readonly candidate_request_ids?: readonly string[]
  readonly match_reason: string
}

/** Stati in cui un ordine può ricevere una fattura */
const MATCHABLE_STATUSES = [
  'ORDERED',
  'SHIPPED',
  'DELIVERED',
  'INVOICED',
] as const

/**
 * Prova ad associare una fattura a un ordine esistente.
 * Esegue i livelli in ordine e si ferma al primo match.
 */
export async function matchInvoiceToOrder(
  invoiceId: string,
): Promise<MatchResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      pr_code_extracted: true,
      causale: true,
      external_ref: true,
      supplier_vat_id: true,
      total_amount: true,
      invoice_date: true,
    },
  })

  if (!invoice) {
    return {
      status: 'UNMATCHED',
      confidence: 0,
      match_reason: 'Fattura non trovata',
    }
  }

  // --- Livello 1: Match per codice PR estratto ---
  if (invoice.pr_code_extracted) {
    const result = await matchByPrCode(invoice.pr_code_extracted)
    if (result) return result
  }

  // --- Livello 2: Match per codice PR in causale (regex) ---
  if (invoice.causale) {
    const result = await matchByCausale(invoice.causale)
    if (result) return result
  }

  // --- Livello 3: Match per P.IVA + importo ---
  const vendorMatch = await matchByVatAndAmount(
    invoice.supplier_vat_id,
    Number(invoice.total_amount),
  )
  if (vendorMatch) return vendorMatch

  // --- Livello 4: Match per P.IVA + periodo ---
  const dateMatch = await matchByVatAndDate(
    invoice.supplier_vat_id,
    invoice.invoice_date,
  )
  if (dateMatch) return dateMatch

  // --- Livello 5: Nessun match ---
  return {
    status: 'UNMATCHED',
    confidence: 0,
    match_reason: 'Nessun ordine corrispondente trovato',
  }
}

// ---------------------------------------------------------------------------
// Livelli di matching
// ---------------------------------------------------------------------------

async function matchByPrCode(prCode: string): Promise<MatchResult | null> {
  const request = await prisma.purchaseRequest.findUnique({
    where: { code: prCode },
    select: { id: true, status: true },
  })

  if (!request) return null
  if (
    !MATCHABLE_STATUSES.includes(
      request.status as (typeof MATCHABLE_STATUSES)[number],
    )
  ) {
    return null
  }

  return {
    status: 'AUTO_MATCHED',
    confidence: 0.95,
    matched_request_id: request.id,
    match_reason: `Match esatto per codice PR: ${prCode}`,
  }
}

async function matchByCausale(causale: string): Promise<MatchResult | null> {
  const prMatches = causale.match(/PR-\d{4}-\d{5}/g)
  if (!prMatches || prMatches.length === 0) return null

  const uniqueCodes = Array.from(new Set(prMatches))

  const requests = await prisma.purchaseRequest.findMany({
    where: {
      code: { in: uniqueCodes },
      status: { in: [...MATCHABLE_STATUSES] },
    },
    select: { id: true, code: true },
  })

  if (requests.length === 0) return null

  if (requests.length === 1) {
    return {
      status: 'AUTO_MATCHED',
      confidence: 0.85,
      matched_request_id: requests[0]!.id,
      match_reason: `Match per codice PR in causale: ${requests[0]!.code}`,
    }
  }

  // Match multiplo → SUGGESTED
  return {
    status: 'SUGGESTED',
    confidence: 0.7,
    candidate_request_ids: requests.map((r) => r.id),
    match_reason: `Codici PR multipli trovati in causale: ${requests.map((r) => r.code).join(', ')}`,
  }
}

async function matchByVatAndAmount(
  supplierVatId: string,
  invoiceAmount: number,
): Promise<MatchResult | null> {
  // Trova vendor per P.IVA
  const vendor = await prisma.vendor.findFirst({
    where: { vat_id: supplierVatId },
    select: { id: true },
  })

  if (!vendor) return null

  const tolerancePercent = MATCHING_THRESHOLDS.AMOUNT_TOLERANCE_PERCENT / 100
  const minAmount = invoiceAmount * (1 - tolerancePercent)
  const maxAmount = invoiceAmount * (1 + tolerancePercent)

  const requests = await prisma.purchaseRequest.findMany({
    where: {
      vendor_id: vendor.id,
      status: { in: [...MATCHABLE_STATUSES] },
      estimated_amount: {
        gte: new Prisma.Decimal(minAmount),
        lte: new Prisma.Decimal(maxAmount),
      },
    },
    select: { id: true, code: true, estimated_amount: true },
    orderBy: { created_at: 'desc' },
  })

  if (requests.length === 0) return null

  if (requests.length === 1) {
    return {
      status: 'SUGGESTED',
      confidence: 0.6,
      matched_request_id: requests[0]!.id,
      match_reason: `Match per P.IVA fornitore + importo simile (${requests[0]!.code})`,
    }
  }

  // Ordina per vicinanza importo
  const sorted = [...requests].sort((a, b) => {
    const diffA = Math.abs(Number(a.estimated_amount ?? 0) - invoiceAmount)
    const diffB = Math.abs(Number(b.estimated_amount ?? 0) - invoiceAmount)
    return diffA - diffB
  })

  return {
    status: 'SUGGESTED',
    confidence: 0.5,
    candidate_request_ids: sorted.map((r) => r.id),
    match_reason: `Match multiplo per P.IVA + importo: ${sorted.map((r) => r.code).join(', ')}`,
  }
}

async function matchByVatAndDate(
  supplierVatId: string,
  invoiceDate: Date,
): Promise<MatchResult | null> {
  const vendor = await prisma.vendor.findFirst({
    where: { vat_id: supplierVatId },
    select: { id: true },
  })

  if (!vendor) return null

  const windowDays = MATCHING_THRESHOLDS.SEARCH_WINDOW_DAYS
  const dateFrom = new Date(invoiceDate)
  dateFrom.setDate(dateFrom.getDate() - windowDays)

  const requests = await prisma.purchaseRequest.findMany({
    where: {
      vendor_id: vendor.id,
      status: { in: [...MATCHABLE_STATUSES] },
      ordered_at: { gte: dateFrom },
    },
    select: { id: true, code: true },
    orderBy: { ordered_at: 'desc' },
    take: 10,
  })

  if (requests.length === 0) return null

  return {
    status: 'SUGGESTED',
    confidence: 0.4,
    candidate_request_ids: requests.map((r) => r.id),
    match_reason: `Match per P.IVA + periodo (ultimi ${windowDays}gg): ${requests.map((r) => r.code).join(', ')}`,
  }
}
