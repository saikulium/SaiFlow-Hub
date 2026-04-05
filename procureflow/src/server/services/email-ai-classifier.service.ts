import Anthropic from '@anthropic-ai/sdk'
import { getClaudeClient } from '@/lib/ai/claude-client'
import type { EmailIngestionPayload } from '@/lib/validations/email-ingestion'

// ---------------------------------------------------------------------------
// Email AI Classifier — Classifica l'intent delle email con Claude
//
// Riceve email grezze (from, subject, body) e restituisce:
//   - intent (CONFERMA_ORDINE, RITARDO_CONSEGNA, etc.)
//   - confidence (0.0–1.0)
//   - extracted_data (codice PR, fornitore, importi, date, riepilogo)
//
// Usato dall'endpoint /api/webhooks/email-ingestion/classify
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawEmailData {
  readonly email_from: string
  readonly email_to?: string
  readonly email_subject: string
  readonly email_body: string
  readonly email_date?: string
  readonly email_message_id?: string
  readonly attachments?: ReadonlyArray<{
    readonly filename: string
    readonly url: string
    readonly mime_type?: string
  }>
}

export type EmailIntent =
  | 'CONFERMA_ORDINE'
  | 'RITARDO_CONSEGNA'
  | 'VARIAZIONE_PREZZO'
  | 'RICHIESTA_INFO'
  | 'FATTURA_ALLEGATA'
  | 'ALTRO'

export interface ClassificationResult {
  readonly intent: EmailIntent
  readonly confidence: number
  readonly extracted_data: {
    readonly matched_request_code?: string
    readonly vendor_name?: string
    readonly external_ref?: string
    readonly new_amount?: number
    readonly new_delivery_date?: string
    readonly tracking_number?: string
    readonly summary: string
  }
}

export class EmailClassificationError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'EmailClassificationError'
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// AI Raw Response interface
// ---------------------------------------------------------------------------

interface AiClassificationResponse {
  intent: EmailIntent | null
  confidence: number | null
  matched_request_code: string | null
  vendor_name: string | null
  external_ref: string | null
  new_amount: number | null
  new_delivery_date: string | null
  tracking_number: string | null
  summary: string | null
}

// ---------------------------------------------------------------------------
// Classification Prompt
// ---------------------------------------------------------------------------

const CLASSIFICATION_PROMPT = `Sei un agente di procurement per PMI italiane. Analizza l'email commerciale seguente e classifica il suo intento.

ISTRUZIONI:
- Classifica l'intent dell'email tra le categorie sotto
- Estrai tutti i dati rilevanti (codice PR, fornitore, importi, date)
- Il codice PR ha formato PR-YYYY-NNNNN (es: PR-2025-00042)
- Valuta la tua confidence (0.0-1.0) sulla classificazione
- Per le date, usa formato ISO YYYY-MM-DD
- Per gli importi, usa formato numerico (es: 1234.56)

CATEGORIE DI INTENT:
- CONFERMA_ORDINE: Il fornitore conferma la ricezione/presa in carico di un ordine
- RITARDO_CONSEGNA: Il fornitore comunica un ritardo nella consegna
- VARIAZIONE_PREZZO: Il fornitore comunica una variazione di prezzo rispetto all'ordine
- RICHIESTA_INFO: Il fornitore chiede informazioni o chiarimenti
- FATTURA_ALLEGATA: L'email contiene o fa riferimento a una fattura allegata
- ALTRO: Nessuna delle categorie precedenti

SCHEMA JSON RICHIESTO (rispondi SOLO con il JSON, nient'altro):
{
  "intent": "string — una delle categorie sopra",
  "confidence": "number — 0.0-1.0",
  "matched_request_code": "string|null — codice PR-YYYY-NNNNN se presente",
  "vendor_name": "string|null — nome del fornitore se identificabile",
  "external_ref": "string|null — riferimento ordine fornitore (es: PO-12345, OrdF-789)",
  "new_amount": "number|null — nuovo importo se VARIAZIONE_PREZZO",
  "new_delivery_date": "string|null — nuova data consegna YYYY-MM-DD se RITARDO_CONSEGNA",
  "tracking_number": "string|null — numero tracking se presente",
  "summary": "string — riepilogo leggibile dell'email in 1-2 frasi in italiano"
}`

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Classifica l'intent di un'email commerciale usando Claude.
 *
 * @throws EmailClassificationError se API key mancante, timeout, o risposta non parsabile
 */
export async function classifyEmailIntent(
  email: RawEmailData,
): Promise<ClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new EmailClassificationError(
      'AI_NOT_CONFIGURED',
      'ANTHROPIC_API_KEY non configurata. La classificazione AI non è disponibile.',
    )
  }

  const model = process.env.AI_EMAIL_MODEL ?? DEFAULT_MODEL
  const client = getClaudeClient()

  const emailContent = formatEmailForClassification(email)

  let rawText: string
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: CLASSIFICATION_PROMPT },
            {
              type: 'text',
              text: `\n\n--- EMAIL DA CLASSIFICARE ---\n${emailContent}`,
            },
          ],
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new EmailClassificationError(
        'AI_NO_RESPONSE',
        'Claude non ha restituito testo',
      )
    }
    rawText = textBlock.text
  } catch (err) {
    if (err instanceof EmailClassificationError) throw err
    if (err instanceof Anthropic.APIError) {
      if (err.status === 408 || err.status === 529) {
        throw new EmailClassificationError(
          'AI_TIMEOUT',
          'Timeout nella chiamata a Claude API',
        )
      }
      throw new EmailClassificationError(
        'AI_API_ERROR',
        `Errore Claude API: ${err.message}`,
      )
    }
    throw new EmailClassificationError(
      'AI_UNKNOWN_ERROR',
      `Errore imprevisto: ${String(err)}`,
    )
  }

  const aiData = parseClassificationJson(rawText)
  return mapAiResponseToClassification(aiData)
}

// ---------------------------------------------------------------------------
// Mapping: ClassificationResult → EmailIngestionPayload
// ---------------------------------------------------------------------------

const INTENT_TO_ACTION: Record<
  EmailIntent,
  'new_request' | 'update_existing' | 'info_only'
> = {
  CONFERMA_ORDINE: 'update_existing',
  RITARDO_CONSEGNA: 'update_existing',
  VARIAZIONE_PREZZO: 'update_existing',
  RICHIESTA_INFO: 'info_only',
  FATTURA_ALLEGATA: 'info_only',
  ALTRO: 'info_only',
}

const INTENT_TO_STATUS: Partial<Record<EmailIntent, string>> = {
  CONFERMA_ORDINE: 'ORDERED',
}

/**
 * Converte il risultato della classificazione AI nel formato
 * EmailIngestionPayload atteso da processEmailIngestion().
 */
export function mapClassificationToPayload(
  raw: RawEmailData,
  classification: ClassificationResult,
): EmailIngestionPayload {
  const action = INTENT_TO_ACTION[classification.intent]
  const statusUpdate = INTENT_TO_STATUS[classification.intent]

  return {
    // Email raw data
    email_from: raw.email_from,
    email_to: raw.email_to,
    email_subject: raw.email_subject,
    email_body: raw.email_body,
    email_date: raw.email_date,
    email_message_id: raw.email_message_id,

    // AI classification
    action,
    ai_matched_request_code: classification.extracted_data.matched_request_code,
    ai_matched_external_ref: classification.extracted_data.external_ref,
    ai_vendor_code: undefined,
    ai_vendor_name: classification.extracted_data.vendor_name,
    ai_title: undefined,
    ai_description: undefined,
    ai_priority: undefined,
    ai_category: undefined,
    ai_department: undefined,
    ai_needed_by: undefined,
    ai_estimated_amount: undefined,
    ai_actual_amount: classification.extracted_data.new_amount,
    ai_currency: 'EUR',
    ai_status_update: statusUpdate as EmailIngestionPayload['ai_status_update'],
    ai_tracking_number: classification.extracted_data.tracking_number,
    ai_external_ref: classification.extracted_data.external_ref,
    ai_external_url: undefined,
    ai_expected_delivery: classification.extracted_data.new_delivery_date,
    ai_items: [],
    ai_summary: classification.extracted_data.summary,
    ai_confidence: classification.confidence,
    ai_tags: [`ai-intent:${classification.intent}`],
    attachments: [],
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEmailForClassification(email: RawEmailData): string {
  const parts: string[] = [
    `Da: ${email.email_from}`,
    `Oggetto: ${email.email_subject}`,
  ]

  if (email.email_date) {
    parts.push(`Data: ${email.email_date}`)
  }

  parts.push('', email.email_body)

  if (email.attachments && email.attachments.length > 0) {
    parts.push(
      '',
      `Allegati: ${email.attachments.map((a) => a.filename).join(', ')}`,
    )
  }

  return parts.join('\n')
}

function parseClassificationJson(text: string): AiClassificationResponse {
  let jsonStr = text.trim()

  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1]!.trim()
  }

  try {
    return JSON.parse(jsonStr) as AiClassificationResponse
  } catch {
    throw new EmailClassificationError(
      'AI_INVALID_JSON',
      'Claude ha restituito una risposta non parsabile come JSON',
    )
  }
}

const VALID_INTENTS = new Set<string>([
  'CONFERMA_ORDINE',
  'RITARDO_CONSEGNA',
  'VARIAZIONE_PREZZO',
  'RICHIESTA_INFO',
  'FATTURA_ALLEGATA',
  'ALTRO',
])

export function mapAiResponseToClassification(
  raw: AiClassificationResponse,
): ClassificationResult {
  const intent: EmailIntent = VALID_INTENTS.has(raw.intent ?? '')
    ? (raw.intent as EmailIntent)
    : 'ALTRO'

  return {
    intent,
    confidence: Math.max(0, Math.min(1, raw.confidence ?? 0.5)),
    extracted_data: {
      matched_request_code: raw.matched_request_code ?? undefined,
      vendor_name: raw.vendor_name ?? undefined,
      external_ref: raw.external_ref ?? undefined,
      new_amount: raw.new_amount ?? undefined,
      new_delivery_date: raw.new_delivery_date ?? undefined,
      tracking_number: raw.tracking_number ?? undefined,
      summary: raw.summary ?? 'Nessun riepilogo disponibile',
    },
  }
}
