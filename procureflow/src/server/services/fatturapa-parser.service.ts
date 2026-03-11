import { XMLParser } from 'fast-xml-parser'
import {
  DOCUMENT_TYPES,
  PAYMENT_METHODS,
  type ParsedInvoice,
  type ParsedLineItem,
  type OrderReference,
  type TaxSummaryItem,
  type PaymentInfo,
} from '@/types/fatturapa'

// ---------------------------------------------------------------------------
// Parser XML FatturaPA — Estrae dati strutturati dall'XML SDI
//
// Supporta FPR12 (B2B) e FPA12 (verso PA).
// Gestisce fatture multi-body e normalizza array/singoli elementi.
// ---------------------------------------------------------------------------

const PR_CODE_REGEX = /PR-\d{4}-\d{5}/g

/** Errore specifico per parsing fattura non valida */
export class FatturaParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FatturaParseError'
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // IMPORTANTE: disabilitato per preservare gli zeri iniziali su P.IVA, CAP, etc.
  // I campi numerici vengono convertiti esplicitamente tramite extractNumber().
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true,
  isArray: (name) => {
    // Campi che possono essere array anche con un solo elemento
    const arrayTags = [
      'DettaglioLinee',
      'DatiRiepilogo',
      'DatiOrdineAcquisto',
      'DatiContratto',
      'DatiDDT',
      'DettaglioPagamento',
      'FatturaElettronicaBody',
      'Causale',
    ]
    return arrayTags.includes(name)
  },
})

/**
 * Parsa un XML FatturaPA e restituisce i dati strutturati.
 * Funzione pura — nessun side effect.
 */
export function parseFatturaPA(xmlContent: string): ParsedInvoice {
  let parsed: Record<string, unknown>
  try {
    parsed = parser.parse(xmlContent) as Record<string, unknown>
  } catch (err) {
    throw new FatturaParseError(
      `XML non valido: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const root = (parsed as Record<string, unknown>)['FatturaElettronica'] as
    | Record<string, unknown>
    | undefined
  if (!root) {
    throw new FatturaParseError('Elemento root FatturaElettronica non trovato')
  }

  const format = (root['@_versione'] as string) ?? 'FPR12'

  // --- Header ---
  const header = root['FatturaElettronicaHeader'] as Record<string, unknown>
  if (!header) {
    throw new FatturaParseError('FatturaElettronicaHeader mancante')
  }

  const transmission = header['DatiTrasmissione'] as Record<string, unknown>
  const transmissionId = extractText(transmission, 'ProgressivoInvio') ?? ''

  // Fornitore (CedentePrestatore)
  const cedente = header['CedentePrestatore'] as Record<string, unknown>
  const supplier = parseSupplier(cedente)

  // Cliente (CessionarioCommittente)
  const cessionario = header['CessionarioCommittente'] as Record<
    string,
    unknown
  >
  const customer = parseCustomer(cessionario)

  // --- Body (può essere multiplo, prendiamo il primo) ---
  const bodies = ensureArray(root['FatturaElettronicaBody'])
  if (bodies.length === 0) {
    throw new FatturaParseError('FatturaElettronicaBody mancante')
  }

  const body = bodies[0] as Record<string, unknown>
  const datiGenerali = body['DatiGenerali'] as Record<string, unknown>
  const datiDoc = datiGenerali?.['DatiGeneraliDocumento'] as Record<
    string,
    unknown
  >

  if (!datiDoc) {
    throw new FatturaParseError('DatiGeneraliDocumento mancante')
  }

  const documentType = extractText(datiDoc, 'TipoDocumento') ?? 'TD01'
  const invoiceNumber = extractText(datiDoc, 'Numero') ?? ''
  const invoiceDateStr = extractText(datiDoc, 'Data') ?? ''
  const totalAmount = extractNumber(datiDoc, 'ImportoTotaleDocumento') ?? 0

  // Causale (può essere array)
  const causaleArr = ensureArray(datiDoc['Causale'])
  const causale =
    causaleArr.length > 0 ? causaleArr.map(String).join(' ') : undefined

  // --- Riferimenti ordine ---
  const orderRefs = parseOrderReferences(datiGenerali)

  // Estrai PR code da causale e riferimenti
  const prCode = extractPrCode(causale, orderRefs)

  // --- Righe ---
  const datiBeniServizi = body['DatiBeniServizi'] as Record<string, unknown>
  const lineItems = parseLineItems(datiBeniServizi)
  const taxSummary = parseTaxSummary(datiBeniServizi)

  const totalTaxable = taxSummary.reduce((sum, t) => sum + t.taxable_amount, 0)
  const totalTax = taxSummary.reduce((sum, t) => sum + t.tax_amount, 0)

  // --- Pagamento ---
  const payment = parsePayment(body['DatiPagamento'])

  return {
    format: format as 'FPR12' | 'FPA12',
    transmission_id: transmissionId,
    supplier,
    customer,
    document_type: documentType,
    document_type_label: DOCUMENT_TYPES[documentType] ?? documentType,
    invoice_number: invoiceNumber,
    invoice_date: new Date(invoiceDateStr),
    total_amount: totalAmount,
    causale,
    order_references: orderRefs,
    pr_code_extracted: prCode,
    line_items: lineItems,
    tax_summary: taxSummary,
    total_taxable: totalTaxable,
    total_tax: totalTax,
    payment,
  }
}

// ---------------------------------------------------------------------------
// Helpers di parsing
// ---------------------------------------------------------------------------

function parseSupplier(
  cedente: Record<string, unknown> | undefined,
): ParsedInvoice['supplier'] {
  const anagrafici = (cedente?.['DatiAnagrafici'] ?? {}) as Record<
    string,
    unknown
  >
  const idFiscale = (anagrafici['IdFiscaleIVA'] ?? {}) as Record<
    string,
    unknown
  >
  const anagrafica = (anagrafici['Anagrafica'] ?? {}) as Record<string, unknown>

  const sede = (cedente?.['Sede'] ?? {}) as Record<string, unknown>

  return {
    vat_country: extractText(idFiscale, 'IdPaese') ?? 'IT',
    vat_id: extractText(idFiscale, 'IdCodice') ?? '',
    tax_code: extractText(anagrafici, 'CodiceFiscale'),
    name:
      extractText(anagrafica, 'Denominazione') ??
      [extractText(anagrafica, 'Nome'), extractText(anagrafica, 'Cognome')]
        .filter(Boolean)
        .join(' ') ??
      '',
    address: sede['Indirizzo']
      ? {
          street: extractText(sede, 'Indirizzo') ?? '',
          city: extractText(sede, 'Comune') ?? '',
          zip: extractText(sede, 'CAP') ?? '',
          province: extractText(sede, 'Provincia') ?? '',
        }
      : undefined,
  }
}

function parseCustomer(
  cessionario: Record<string, unknown> | undefined,
): ParsedInvoice['customer'] {
  const anagrafici = (cessionario?.['DatiAnagrafici'] ?? {}) as Record<
    string,
    unknown
  >
  const idFiscale = (anagrafici['IdFiscaleIVA'] ?? {}) as Record<
    string,
    unknown
  >

  return {
    vat_id: extractText(idFiscale, 'IdCodice') ?? '',
    tax_code: extractText(anagrafici, 'CodiceFiscale'),
  }
}

function parseOrderReferences(
  datiGenerali: Record<string, unknown> | undefined,
): readonly OrderReference[] {
  if (!datiGenerali) return []

  const refs = ensureArray(datiGenerali['DatiOrdineAcquisto'])
  return refs.map((ref) => {
    const r = ref as Record<string, unknown>
    return {
      id_documento: extractText(r, 'IdDocumento'),
      data: r['Data'] ? new Date(String(r['Data'])) : undefined,
      num_item: extractText(r, 'NumItem'),
      codice_commessa: extractText(r, 'CodiceCommessaConvenzione'),
      codice_cup: extractText(r, 'CodiceCUP') ?? extractText(r, 'CUP'),
      codice_cig: extractText(r, 'CodiceCIG') ?? extractText(r, 'CIG'),
    }
  })
}

function parseLineItems(
  datiBeni: Record<string, unknown> | undefined,
): readonly ParsedLineItem[] {
  if (!datiBeni) return []

  const lines = ensureArray(datiBeni['DettaglioLinee'])
  return lines.map((line) => {
    const l = line as Record<string, unknown>
    return {
      line_number: extractNumber(l, 'NumeroLinea') ?? 0,
      description: extractText(l, 'Descrizione') ?? '',
      quantity: extractNumber(l, 'Quantita') ?? 1,
      unit_of_measure: extractText(l, 'UnitaMisura'),
      unit_price: extractNumber(l, 'PrezzoUnitario') ?? 0,
      total_price: extractNumber(l, 'PrezzoTotale') ?? 0,
      vat_rate: extractNumber(l, 'AliquotaIVA') ?? 0,
      vat_nature: extractText(l, 'Natura'),
    }
  })
}

function parseTaxSummary(
  datiBeni: Record<string, unknown> | undefined,
): readonly TaxSummaryItem[] {
  if (!datiBeni) return []

  const summaries = ensureArray(datiBeni['DatiRiepilogo'])
  return summaries.map((s) => {
    const item = s as Record<string, unknown>
    return {
      vat_rate: extractNumber(item, 'AliquotaIVA') ?? 0,
      taxable_amount: extractNumber(item, 'ImponibileImporto') ?? 0,
      tax_amount: extractNumber(item, 'Imposta') ?? 0,
      nature: extractText(item, 'Natura'),
    }
  })
}

function parsePayment(datiPagamento: unknown): PaymentInfo | undefined {
  if (!datiPagamento) return undefined

  const pagamenti = ensureArray(datiPagamento)
  if (pagamenti.length === 0) return undefined

  const pagamento = pagamenti[0] as Record<string, unknown>
  const dettagli = ensureArray(pagamento['DettaglioPagamento'])
  if (dettagli.length === 0) return undefined

  const det = dettagli[0] as Record<string, unknown>
  const method = extractText(det, 'ModalitaPagamento') ?? ''

  return {
    method,
    method_label: PAYMENT_METHODS[method] ?? method,
    due_date: det['DataScadenzaPagamento']
      ? new Date(String(det['DataScadenzaPagamento']))
      : undefined,
    amount: extractNumber(det, 'ImportoPagamento') ?? 0,
    iban: extractText(det, 'IBAN'),
    terms: extractText(pagamento, 'CondizioniPagamento'),
  }
}

function extractPrCode(
  causale: string | undefined,
  orderRefs: readonly OrderReference[],
): string | undefined {
  // Cerca in IdDocumento dei riferimenti ordine
  for (const ref of orderRefs) {
    if (ref.id_documento) {
      const match = ref.id_documento.match(PR_CODE_REGEX)
      if (match) return match[0]
    }
  }

  // Cerca nella causale
  if (causale) {
    const match = causale.match(PR_CODE_REGEX)
    if (match) return match[0]
  }

  return undefined
}

// ---------------------------------------------------------------------------
// Utilità generiche
// ---------------------------------------------------------------------------

function ensureArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function extractText(
  obj: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!obj) return undefined
  const val = obj[key]
  if (val === undefined || val === null) return undefined
  return String(val)
}

function extractNumber(
  obj: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  if (!obj) return undefined
  const val = obj[key]
  if (val === undefined || val === null) return undefined
  const num = Number(val)
  return isNaN(num) ? undefined : num
}
