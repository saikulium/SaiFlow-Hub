import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import {
  InvoiceExtractionSchema,
  type InvoiceExtraction,
} from '@/lib/ai/schemas/invoice-extraction.schema'
import type { ParsedInvoice, ParsedLineItem } from '@/types/fatturapa'
import { DOCUMENT_TYPES, PAYMENT_METHODS } from '@/types/fatturapa'

// ---------------------------------------------------------------------------
// Invoice AI Parser — Estrae dati fattura da PDF/immagini via Claude Vision
//
// Usa Claude Sonnet per analizzare documenti non strutturati (PDF, foto,
// scansioni) e restituire un JSON allineato a ParsedInvoice.
// Fallback: per XML FatturaPA, usare il parser deterministico.
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = MODELS.SONNET

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const SUPPORTED_DOCUMENT_TYPES = new Set(['application/pdf'])

export type AiMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'

export interface AiParseResult {
  readonly invoice: ParsedInvoice
  readonly ai_confidence: number
  readonly ai_model: string
}

/** Errore specifico per AI parsing */
export class AiParseError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'AiParseError'
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// Extraction System Prompt
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM_PROMPT = `Sei un esperto di fatturazione italiana. Analizza questo documento (fattura, nota di credito, o documento commerciale italiano) ed estrai tutti i dati strutturati.

ISTRUZIONI:
- Estrai TUTTI i dati visibili nel documento
- Per i numeri, usa il formato numerico (es: 1234.56, non "1.234,56")
- Per le date, usa il formato ISO "YYYY-MM-DD"
- Se un campo non è leggibile o assente, usa null
- Se trovi un codice PR-YYYY-NNNNN (riferimento ordine di acquisto), estrailo in pr_code_extracted
- Valuta la tua confidence (0.0-1.0) sulla qualità dell'estrazione
- Per document_type usa codici SDI: TD01=Fattura, TD04=Nota di credito, TD06=Parcella
- Per payment.method usa codici SDI (MP01-MP23) se identificabili`

// ---------------------------------------------------------------------------
// Funzione principale
// ---------------------------------------------------------------------------

/**
 * Analizza un file fattura (PDF o immagine) usando Claude Vision.
 * Usa messages.parse() con structured output per garantire risposta tipizzata.
 * Ritorna i dati estratti nel formato ParsedInvoice.
 *
 * @throws AiParseError se l'API key mancante, timeout, o risposta non parsabile
 */
export async function parseInvoiceWithAI(
  fileBuffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<AiParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new AiParseError(
      'AI_NOT_CONFIGURED',
      'ANTHROPIC_API_KEY non configurata. Il parsing AI non è disponibile.',
    )
  }

  if (
    !SUPPORTED_IMAGE_TYPES.has(mimeType) &&
    !SUPPORTED_DOCUMENT_TYPES.has(mimeType)
  ) {
    throw new AiParseError(
      'UNSUPPORTED_FORMAT',
      `Formato non supportato: ${mimeType}. Formati accettati: PDF, JPEG, PNG, WebP.`,
    )
  }

  const model = process.env.AI_INVOICE_MODEL ?? DEFAULT_MODEL
  const client = getClaudeClient()

  const base64Data = fileBuffer.toString('base64')

  // Costruisci il content block in base al tipo di file
  const fileContent = SUPPORTED_DOCUMENT_TYPES.has(mimeType)
    ? {
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf' as const,
          data: base64Data,
        },
      }
    : {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mimeType as AiMediaType,
          data: base64Data,
        },
      }

  let parsed: InvoiceExtraction
  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text: 'Estrai tutti i dati da questo documento fattura.',
            },
          ],
        },
      ],
      output_config: {
        format: zodOutputFormat(InvoiceExtractionSchema),
      },
    })

    if (!response.parsed_output) {
      throw new AiParseError(
        'AI_NO_RESPONSE',
        'Claude non ha restituito un output strutturato',
      )
    }
    parsed = response.parsed_output
  } catch (err) {
    if (err instanceof AiParseError) throw err
    if (err instanceof Anthropic.APIError) {
      if (err.status === 408 || err.status === 529) {
        throw new AiParseError(
          'AI_TIMEOUT',
          'Timeout nella chiamata a Claude API',
        )
      }
      throw new AiParseError(
        'AI_API_ERROR',
        `Errore Claude API: ${err.message}`,
      )
    }
    throw new AiParseError(
      'AI_UNKNOWN_ERROR',
      `Errore imprevisto: ${String(err)}`,
    )
  }

  const invoice = mapParsedToInvoice(parsed, filename)

  return {
    invoice,
    ai_confidence: parsed.ai_confidence,
    ai_model: model,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mappa l'output strutturato (già validato da Zod) al formato ParsedInvoice.
 */
function mapParsedToInvoice(
  parsed: InvoiceExtraction,
  filename: string,
): ParsedInvoice {
  const lineItems: readonly ParsedLineItem[] = parsed.line_items.map(
    (item) => ({
      line_number: item.line_number,
      description: item.description,
      quantity: item.quantity,
      unit_of_measure: item.unit_of_measure ?? undefined,
      unit_price: item.unit_price,
      total_price: item.total_price,
      vat_rate: item.vat_rate,
    }),
  )

  const paymentMethod = parsed.payment?.method ?? ''

  return {
    format: 'FPR12',
    transmission_id: '',
    supplier: {
      vat_country: parsed.supplier.vat_country,
      vat_id: parsed.supplier.vat_id,
      tax_code: parsed.supplier.tax_code ?? undefined,
      name: parsed.supplier.name || filename,
    },
    customer: {
      vat_id: parsed.customer.vat_id,
      tax_code: parsed.customer.tax_code ?? undefined,
    },
    document_type: parsed.document_type,
    document_type_label:
      DOCUMENT_TYPES[parsed.document_type] ?? parsed.document_type,
    invoice_number: parsed.invoice_number,
    invoice_date: new Date(parsed.invoice_date),
    total_amount: parsed.total_amount,
    causale: parsed.causale ?? undefined,
    order_references: [],
    pr_code_extracted: parsed.pr_code_extracted ?? undefined,
    line_items: lineItems,
    tax_summary: [
      {
        vat_rate: lineItems[0]?.vat_rate ?? 22,
        taxable_amount: parsed.total_taxable,
        tax_amount: parsed.total_tax,
      },
    ],
    total_taxable: parsed.total_taxable,
    total_tax: parsed.total_tax,
    payment: parsed.payment
      ? {
          method: paymentMethod,
          method_label: PAYMENT_METHODS[paymentMethod] ?? paymentMethod,
          due_date: parsed.payment.due_date
            ? new Date(parsed.payment.due_date)
            : undefined,
          amount: parsed.total_amount,
          iban: parsed.payment.iban ?? undefined,
          terms: parsed.payment.terms ?? undefined,
        }
      : undefined,
  }
}

// ---------------------------------------------------------------------------
// Backward-compatible mapper (used by existing tests)
// ---------------------------------------------------------------------------

interface AiRawResponse {
  invoice_number: string | null
  invoice_date: string | null
  document_type: string | null
  total_amount: number | null
  total_taxable: number | null
  total_tax: number | null
  currency: string | null
  supplier: {
    name: string | null
    vat_id: string | null
    tax_code: string | null
    vat_country: string | null
  } | null
  customer: {
    vat_id: string | null
    tax_code: string | null
  } | null
  causale: string | null
  pr_code_extracted: string | null
  line_items: Array<{
    line_number: number | null
    description: string | null
    quantity: number | null
    unit_of_measure: string | null
    unit_price: number | null
    total_price: number | null
    vat_rate: number | null
  }> | null
  payment: {
    method: string | null
    due_date: string | null
    iban: string | null
    terms: string | null
  } | null
  ai_confidence: number | null
}

/**
 * @deprecated Use mapParsedToInvoice instead. Kept for backward compatibility with tests.
 */
export function mapAiResponseToInvoice(
  raw: AiRawResponse,
  filename: string,
): ParsedInvoice {
  const docType = raw.document_type ?? 'TD01'

  const lineItems: readonly ParsedLineItem[] = (raw.line_items ?? []).map(
    (item, idx) => ({
      line_number: item.line_number ?? idx + 1,
      description: item.description ?? '',
      quantity: item.quantity ?? 1,
      unit_of_measure: item.unit_of_measure ?? undefined,
      unit_price: item.unit_price ?? 0,
      total_price: item.total_price ?? 0,
      vat_rate: item.vat_rate ?? 0,
    }),
  )

  const totalTaxable =
    raw.total_taxable ?? lineItems.reduce((sum, li) => sum + li.total_price, 0)
  const totalTax = raw.total_tax ?? 0
  const totalAmount = raw.total_amount ?? totalTaxable + totalTax

  const paymentMethod = raw.payment?.method ?? ''

  return {
    format: 'FPR12',
    transmission_id: '',
    supplier: {
      vat_country: raw.supplier?.vat_country ?? 'IT',
      vat_id: raw.supplier?.vat_id ?? '',
      tax_code: raw.supplier?.tax_code ?? undefined,
      name: raw.supplier?.name ?? filename,
    },
    customer: {
      vat_id: raw.customer?.vat_id ?? '',
      tax_code: raw.customer?.tax_code ?? undefined,
    },
    document_type: docType,
    document_type_label: DOCUMENT_TYPES[docType] ?? docType,
    invoice_number: raw.invoice_number ?? '',
    invoice_date: raw.invoice_date ? new Date(raw.invoice_date) : new Date(),
    total_amount: totalAmount,
    causale: raw.causale ?? undefined,
    order_references: [],
    pr_code_extracted: raw.pr_code_extracted ?? undefined,
    line_items: lineItems,
    tax_summary: [
      {
        vat_rate: lineItems[0]?.vat_rate ?? 22,
        taxable_amount: totalTaxable,
        tax_amount: totalTax,
      },
    ],
    total_taxable: totalTaxable,
    total_tax: totalTax,
    payment: raw.payment
      ? {
          method: paymentMethod,
          method_label: PAYMENT_METHODS[paymentMethod] ?? paymentMethod,
          due_date: raw.payment.due_date
            ? new Date(raw.payment.due_date)
            : undefined,
          amount: totalAmount,
          iban: raw.payment.iban ?? undefined,
          terms: raw.payment.terms ?? undefined,
        }
      : undefined,
  }
}
