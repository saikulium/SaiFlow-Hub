import Anthropic from '@anthropic-ai/sdk'
import { getClaudeClient } from '@/lib/ai/claude-client'
import type { ParsedInvoice, ParsedLineItem } from '@/types/fatturapa'
import { DOCUMENT_TYPES, PAYMENT_METHODS } from '@/types/fatturapa'

// ---------------------------------------------------------------------------
// Invoice AI Parser — Estrae dati fattura da PDF/immagini via Claude Vision
//
// Usa Claude Sonnet per analizzare documenti non strutturati (PDF, foto,
// scansioni) e restituire un JSON allineato a ParsedInvoice.
// Fallback: per XML FatturaPA, usare il parser deterministico.
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'

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
// Prompt di estrazione
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `Sei un esperto di fatturazione italiana. Analizza questo documento (fattura, nota di credito, o documento commerciale italiano) ed estrai tutti i dati in formato JSON strutturato.

ISTRUZIONI:
- Estrai TUTTI i dati visibili nel documento
- Per i numeri, usa il formato numerico (es: 1234.56, non "1.234,56")
- Per le date, usa il formato ISO "YYYY-MM-DD"
- Se un campo non è leggibile o assente, usa null
- Se trovi un codice PR-YYYY-NNNNN (riferimento ordine di acquisto), estrailo in pr_code_extracted
- Valuta la tua confidence (0.0-1.0) sulla qualità dell'estrazione

SCHEMA JSON RICHIESTO (rispondi SOLO con il JSON, nient'altro):
{
  "invoice_number": "string — numero fattura",
  "invoice_date": "string — data fattura in formato YYYY-MM-DD",
  "document_type": "string — codice tipo documento SDI (TD01=Fattura, TD04=Nota di credito, TD06=Parcella). Default: TD01",
  "total_amount": "number — importo totale lordo (IVA inclusa)",
  "total_taxable": "number — imponibile (senza IVA)",
  "total_tax": "number — totale IVA",
  "currency": "string — valuta, default EUR",
  "supplier": {
    "name": "string — ragione sociale fornitore",
    "vat_id": "string — partita IVA fornitore (solo cifre, senza IT)",
    "tax_code": "string|null — codice fiscale fornitore",
    "vat_country": "string — paese IVA, default IT"
  },
  "customer": {
    "vat_id": "string — partita IVA cliente",
    "tax_code": "string|null — codice fiscale cliente"
  },
  "causale": "string|null — causale/descrizione/riferimento",
  "pr_code_extracted": "string|null — codice PR-YYYY-NNNNN se presente",
  "line_items": [
    {
      "line_number": "number",
      "description": "string",
      "quantity": "number",
      "unit_of_measure": "string|null — unità di misura (pz, kg, m, ore, etc.)",
      "unit_price": "number",
      "total_price": "number",
      "vat_rate": "number — aliquota IVA in percentuale (es: 22, 10, 4)"
    }
  ],
  "payment": {
    "method": "string|null — codice metodo pagamento SDI (MP01-MP23) o descrizione",
    "due_date": "string|null — data scadenza pagamento YYYY-MM-DD",
    "iban": "string|null — IBAN per bonifico",
    "terms": "string|null — condizioni di pagamento"
  },
  "ai_confidence": "number — 0.0-1.0, quanto sei sicuro dell'estrazione"
}`

// ---------------------------------------------------------------------------
// Interfaccia per la risposta AI (prima del mapping a ParsedInvoice)
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

// ---------------------------------------------------------------------------
// Funzione principale
// ---------------------------------------------------------------------------

/**
 * Analizza un file fattura (PDF o immagine) usando Claude Vision.
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

  // Chiama Claude Vision
  let rawText: string
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [fileContent, { type: 'text', text: EXTRACTION_PROMPT }],
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new AiParseError('AI_NO_RESPONSE', 'Claude non ha restituito testo')
    }
    rawText = textBlock.text
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

  // Parsa il JSON dalla risposta
  const aiData = parseAiJsonResponse(rawText)

  // Mappa a ParsedInvoice
  const invoice = mapAiResponseToInvoice(aiData, filename)

  return {
    invoice,
    ai_confidence: aiData.ai_confidence ?? 0.5,
    ai_model: model,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Estrae il JSON dalla risposta di Claude.
 * Gestisce risposte con e senza code fences.
 */
function parseAiJsonResponse(text: string): AiRawResponse {
  // Rimuovi eventuali code fences markdown
  let jsonStr = text.trim()

  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1]!.trim()
  }

  try {
    return JSON.parse(jsonStr) as AiRawResponse
  } catch {
    throw new AiParseError(
      'AI_INVALID_JSON',
      'Claude ha restituito una risposta non parsabile come JSON',
    )
  }
}

/**
 * Mappa la risposta grezza dell'AI al formato ParsedInvoice.
 * Gestisce gracefully campi mancanti con valori di default.
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
