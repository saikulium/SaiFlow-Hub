import { toFile } from '@anthropic-ai/sdk'
import {
  getClaudeClient,
  extractJsonFromAiResponse,
} from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import {
  TenderAnalysisSchema,
  type TenderAnalysis,
} from './tender-analysis.schema'
import { prisma } from '@/lib/db'
import type Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Tender Analysis Agent — Deep-reasoning Go/No-Go analysis
//
// Unlike tool-loop agents (reorder, reconciliation), this agent uses a
// SINGLE call to Opus with adaptive thinking for deep strategic reasoning.
// No tools — just structured JSON output from the model.
// ---------------------------------------------------------------------------

const MAX_TOKENS = 8192

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const TENDER_ANALYSIS_PROMPT = `Sei un consulente strategico per gare d'appalto di PMI italiane (settore difesa/aerospazio/elettronica).

Analizza i dati della gara forniti e produci un'analisi go/no-go strutturata.

CONSIDERA:
- Requisiti tecnici vs capacita aziendali tipiche di una PMI
- Importo base vs effort richiesto
- Scadenza vs tempo di preparazione
- Certificazioni tipicamente richieste
- Marginalita attesa
- Rischio di penali
- Complessita amministrativa

Rispondi SOLO con JSON valido che rispetta lo schema richiesto.
Sii onesto: se la PMI non e competitiva, dillo chiaramente nel reasoning.

SCHEMA JSON RICHIESTO:
{
  "fit_score": <numero 0-100>,
  "recommendation": "GO" | "NO_GO" | "CONDITIONAL_GO",
  "reasoning": "<spiegazione dettagliata>",
  "pros": ["<vantaggio 1>", ...],
  "cons": ["<svantaggio 1>", ...],
  "risks": [
    {
      "description": "<descrizione rischio>",
      "severity": "low" | "medium" | "high",
      "mitigation": "<azione di mitigazione>"
    }
  ],
  "estimated_participation_cost": <numero opzionale, costo stimato di partecipazione in EUR>,
  "key_requirements": ["<requisito chiave 1>", ...],
  "missing_capabilities": ["<capacita mancante 1>", ...]
}`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenderAnalysisResult {
  readonly analysis: TenderAnalysis
  readonly model_used: string
  readonly file_id?: string
}

const FILES_API_BETA = 'files-api-2025-04-14' as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a structured user message from tender data for the AI prompt.
 */
function buildTenderPrompt(tender: {
  readonly title: string
  readonly description: string | null
  readonly status: string
  readonly tender_type: string
  readonly cig: string | null
  readonly cup: string | null
  readonly base_amount: unknown
  readonly currency: string
  readonly submission_deadline: Date | null
  readonly publication_date: Date | null
  readonly award_criteria: string | null
  readonly technical_weight: number | null
  readonly economic_weight: number | null
  readonly category: string | null
  readonly department: string | null
  readonly notes: string | null
  readonly tags: readonly string[]
  readonly contracting_authority: { readonly name: string } | null
}): string {
  const deadlineStr = tender.submission_deadline
    ? tender.submission_deadline.toISOString().split('T')[0]
    : 'Non specificata'

  const publicationStr = tender.publication_date
    ? tender.publication_date.toISOString().split('T')[0]
    : 'Non specificata'

  const baseAmount = tender.base_amount
    ? `${Number(tender.base_amount).toLocaleString('it-IT')} ${tender.currency}`
    : 'Non specificato'

  const sections = [
    `TITOLO: ${tender.title}`,
    `TIPO: ${tender.tender_type}`,
    `STATO: ${tender.status}`,
    `ENTE APPALTANTE: ${tender.contracting_authority?.name ?? 'Non specificato'}`,
    `IMPORTO BASE: ${baseAmount}`,
    `DATA PUBBLICAZIONE: ${publicationStr}`,
    `SCADENZA PRESENTAZIONE: ${deadlineStr}`,
  ]

  if (tender.cig) sections.push(`CIG: ${tender.cig}`)
  if (tender.cup) sections.push(`CUP: ${tender.cup}`)

  if (tender.award_criteria) {
    sections.push(`CRITERIO DI AGGIUDICAZIONE: ${tender.award_criteria}`)
    if (tender.technical_weight != null) {
      sections.push(`PESO TECNICO: ${tender.technical_weight}%`)
    }
    if (tender.economic_weight != null) {
      sections.push(`PESO ECONOMICO: ${tender.economic_weight}%`)
    }
  }

  if (tender.category) sections.push(`CATEGORIA: ${tender.category}`)
  if (tender.department) sections.push(`DIPARTIMENTO: ${tender.department}`)
  if (tender.tags.length > 0) sections.push(`TAG: ${tender.tags.join(', ')}`)
  if (tender.description) sections.push(`\nDESCRIZIONE:\n${tender.description}`)
  if (tender.notes) sections.push(`\nNOTE:\n${tender.notes}`)

  return `Analizza la seguente gara d'appalto e produci l'analisi go/no-go in formato JSON:\n\n${sections.join('\n')}`
}

// ---------------------------------------------------------------------------
// Main function — analyzeTender
// ---------------------------------------------------------------------------

/**
 * Upload a PDF to the Anthropic Files API and return its file ID.
 * The caller is responsible for deleting the file after use.
 */
async function uploadPdf(
  client: Anthropic,
  pdfBuffer: Buffer,
  filename: string,
): Promise<string> {
  const file = await toFile(pdfBuffer, filename, {
    type: 'application/pdf',
  })
  const uploaded = await client.beta.files.upload({
    file,
    betas: [FILES_API_BETA],
  })
  return uploaded.id
}

/**
 * Safely delete an uploaded file from the Anthropic Files API.
 * Errors are logged but not re-thrown to avoid masking the primary result.
 */
async function deleteUploadedFile(
  client: Anthropic,
  fileId: string,
): Promise<void> {
  try {
    await client.beta.files.delete(fileId, { betas: [FILES_API_BETA] })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Non-critical — log and continue
    console.warn(
      `[tender-analysis] Failed to delete file ${fileId}: ${message}`,
    )
  }
}

/**
 * Build the message content blocks for the AI call.
 * When a PDF file_id is provided, adds a document block so the model
 * can read the full tender document.
 */
function buildMessageContent(
  userMessage: string,
  fileId?: string,
): Anthropic.Beta.Messages.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.Messages.BetaContentBlockParam[] = []

  if (fileId) {
    blocks.push({
      type: 'document',
      source: { type: 'file', file_id: fileId },
      title: 'Documento gara PDF',
    } as Anthropic.Beta.Messages.BetaRequestDocumentBlock)
  }

  blocks.push({ type: 'text', text: userMessage })

  return blocks
}

/**
 * Analyzes a tender using Opus with adaptive thinking for deep strategic
 * reasoning. Returns a structured go/no-go analysis.
 *
 * This is a single-call agent (no tool loop): the model receives all
 * tender data upfront and returns structured JSON.
 *
 * When `pdfBuffer` is provided, the PDF is uploaded via the Files API
 * so the model can read the full tender document alongside DB metadata.
 */
export async function analyzeTender(
  tenderId: string,
  pdfBuffer?: Buffer,
  pdfFilename?: string,
): Promise<TenderAnalysisResult> {
  // 1. Fetch tender from DB
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      tender_type: true,
      cig: true,
      cup: true,
      base_amount: true,
      currency: true,
      submission_deadline: true,
      publication_date: true,
      award_criteria: true,
      technical_weight: true,
      economic_weight: true,
      category: true,
      department: true,
      notes: true,
      tags: true,
      contracting_authority: { select: { name: true } },
    },
  })

  if (!tender) {
    throw new Error(`Gara con ID "${tenderId}" non trovata`)
  }

  // 2. Build the user message with all tender data
  const userMessage = buildTenderPrompt(tender)

  // 3. Upload PDF if provided
  const client = getClaudeClient()
  const model = MODELS.OPUS
  let uploadedFileId: string | undefined

  if (pdfBuffer && pdfFilename) {
    uploadedFileId = await uploadPdf(client, pdfBuffer, pdfFilename)
  }

  try {
    // 4. Call Opus with adaptive thinking (use beta messages for Files API)
    const content = buildMessageContent(userMessage, uploadedFileId)

    const response = await client.beta.messages.create({
      model,
      system: TENDER_ANALYSIS_PROMPT,
      messages: [{ role: 'user', content }],
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      betas: uploadedFileId ? [FILES_API_BETA] : [],
    })

    // 5. Extract text from response
    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Nessuna risposta testuale dal modello AI')
    }

    // 6. Parse JSON with schema validation
    const cleanedJson = extractJsonFromAiResponse(textBlock.text)

    let parsed: unknown
    try {
      parsed = JSON.parse(cleanedJson)
    } catch {
      throw new Error(
        `Risposta AI non contiene JSON valido: ${textBlock.text.slice(0, 200)}`,
      )
    }

    const analysis = TenderAnalysisSchema.parse(parsed)

    return {
      analysis,
      model_used: model,
      ...(uploadedFileId ? { file_id: uploadedFileId } : {}),
    }
  } finally {
    // 7. Clean up uploaded file regardless of success/failure
    if (uploadedFileId) {
      await deleteUploadedFile(client, uploadedFileId)
    }
  }
}
