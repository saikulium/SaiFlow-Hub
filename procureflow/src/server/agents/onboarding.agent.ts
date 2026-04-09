import { toFile } from '@anthropic-ai/sdk'
import type Anthropic from '@anthropic-ai/sdk'
import {
  getClaudeClient,
  extractJsonFromAiResponse,
} from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import {
  VendorBatchSchema,
  type VendorMapping,
} from '@/lib/ai/schemas/onboarding-import.schema'
import { prisma } from '@/lib/db'

// ---------------------------------------------------------------------------
// Onboarding Agent — Automatic vendor import from CSV/text files
//
// Single-call agent (like tender-analysis): the model receives the raw file
// content and returns a structured JSON array of normalised vendor records.
// No tools — just structured JSON output from the model.
//
// Uses the Anthropic Files API for large files to avoid context overflow.
// ---------------------------------------------------------------------------

const MAX_TOKENS = 8192
const MIN_CONFIDENCE = 0.5
const FILES_API_BETA = 'files-api-2025-04-14' as const

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const ONBOARDING_PROMPT = `Sei un agente di onboarding per SaiFlow, un software di procurement per PMI italiane.

Ricevi il contenuto di un file (CSV o testo estratto da Excel) con la lista fornitori del cliente. Il formato e SPORCO: ogni cliente usa colonne diverse, nomi diversi, formati diversi.

IL TUO COMPITO:
1. Analizza le righe e identifica le colonne
2. Mappa ogni colonna al campo SaiFlow corretto:
   - name (ragione sociale — OBBLIGATORIO)
   - code (codice fornitore — se manca, generalo dalle prime 3 lettere del nome + numero progressivo)
   - email
   - phone (telefono)
   - vat_id (partita IVA — solo 11 cifre senza prefisso IT)
   - category (categorie merceologiche — array di stringhe)
   - payment_terms (condizioni pagamento — es: "30gg DFFM")
3. Per ogni riga, normalizza:
   - Nomi: Title Case
   - P.IVA: solo cifre, 11 caratteri (segnala se invalida)
   - Telefono: formato +39 XXX XXXXXXX se italiano
   - Email: lowercase
4. Segnala problemi: duplicati, P.IVA invalide, campi obbligatori mancanti
5. Imposta confidence 0.0-1.0 per ogni riga

Rispondi SOLO con un array JSON di oggetti.`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingSessionResult {
  readonly vendors_parsed: number
  readonly vendors_imported: number
  readonly vendors_skipped: number
  readonly warnings: readonly string[]
  readonly vendors: readonly VendorMapping[]
}

// ---------------------------------------------------------------------------
// Helpers — Files API
// ---------------------------------------------------------------------------

/**
 * Upload a file to the Anthropic Files API and return its file ID.
 */
async function uploadFile(
  client: Anthropic,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const file = await toFile(fileBuffer, filename, { type: mimeType })
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
    console.warn(`[onboarding] Failed to delete file ${fileId}: ${message}`)
  }
}

// ---------------------------------------------------------------------------
// Helpers — Duplicate detection
// ---------------------------------------------------------------------------

/**
 * Check for an existing vendor by code or name (case-insensitive).
 * Returns the conflicting field if a duplicate is found, null otherwise.
 */
async function findDuplicateVendor(
  vendor: VendorMapping,
): Promise<string | null> {
  const byCode = await prisma.vendor.findUnique({
    where: { code: vendor.code },
    select: { id: true },
  })
  if (byCode) return 'code'

  const byName = await prisma.vendor.findFirst({
    where: { name: { equals: vendor.name, mode: 'insensitive' } },
    select: { id: true },
  })
  if (byName) return 'name'

  if (vendor.vat_id) {
    const byVat = await prisma.vendor.findUnique({
      where: { vat_id: vendor.vat_id },
      select: { id: true },
    })
    if (byVat) return 'vat_id'
  }

  return null
}

// ---------------------------------------------------------------------------
// Helpers — Import vendors to DB
// ---------------------------------------------------------------------------

/**
 * Import parsed vendors into the database, skipping low-confidence
 * and duplicate records. Returns import stats and warnings.
 */
async function importVendors(vendors: readonly VendorMapping[]): Promise<{
  readonly vendorsImported: number
  readonly vendorsSkipped: number
  readonly warnings: readonly string[]
}> {
  const warnings: string[] = []
  let vendorsImported = 0
  let vendorsSkipped = 0

  for (const vendor of vendors) {
    // Collect vendor-level warnings
    for (const w of vendor.warnings) {
      warnings.push(`[${vendor.name}] ${w}`)
    }

    if (vendor.confidence < MIN_CONFIDENCE) {
      vendorsSkipped += 1
      warnings.push(
        `[${vendor.name}] Confidence troppo bassa (${vendor.confidence}) — saltato`,
      )
      continue
    }

    // Check for duplicates
    const duplicateField = await findDuplicateVendor(vendor)
    if (duplicateField) {
      vendorsSkipped += 1
      warnings.push(
        `[${vendor.name}] Duplicato trovato per campo "${duplicateField}" — saltato`,
      )
      continue
    }

    // Create vendor
    try {
      await prisma.vendor.create({
        data: {
          name: vendor.name,
          code: vendor.code,
          email: vendor.email,
          phone: vendor.phone,
          vat_id: vendor.vat_id,
          category: vendor.category,
          payment_terms: vendor.payment_terms,
          status: 'ACTIVE',
        },
      })
      vendorsImported += 1
    } catch (err) {
      vendorsSkipped += 1
      const message = err instanceof Error ? err.message : String(err)
      warnings.push(`[${vendor.name}] Errore creazione: ${message}`)
    }
  }

  return { vendorsImported, vendorsSkipped, warnings }
}

// ---------------------------------------------------------------------------
// Main function — processVendorImport
// ---------------------------------------------------------------------------

/**
 * Processes a CSV/text file of vendors using Claude to normalise and map
 * columns, then imports valid records into the database.
 *
 * This is a single-call agent (no tool loop): the file is uploaded via the
 * Anthropic Files API as a document block, and the model returns structured
 * JSON. This avoids context overflow for large vendor lists (200+ rows).
 */
export async function processVendorImport(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<OnboardingSessionResult> {
  const client = getClaudeClient()

  // 1. Upload file via Files API
  const uploadedFileId = await uploadFile(
    client,
    fileBuffer,
    filename,
    mimeType,
  )

  try {
    // 2. Call Claude with the uploaded file as a document block
    const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
      {
        type: 'document',
        source: { type: 'file', file_id: uploadedFileId },
        title: filename,
      } as Anthropic.Beta.Messages.BetaRequestDocumentBlock,
      {
        type: 'text',
        text: 'Analizza questo file fornitori e mappa i dati. Rispondi SOLO con un array JSON.',
      },
    ]

    const response = await client.beta.messages.create({
      model: MODELS.SONNET,
      system: ONBOARDING_PROMPT,
      messages: [{ role: 'user', content }],
      max_tokens: MAX_TOKENS,
      betas: [FILES_API_BETA],
    })

    // 3. Extract text from response
    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Nessuna risposta testuale dal modello AI')
    }

    // 4. Parse JSON with schema validation
    const cleanedJson = extractJsonFromAiResponse(textBlock.text)

    let parsed: unknown
    try {
      parsed = JSON.parse(cleanedJson)
    } catch {
      throw new Error(
        `Risposta AI non contiene JSON valido: ${textBlock.text.slice(0, 200)}`,
      )
    }

    const vendors = VendorBatchSchema.parse(parsed)

    // 5. Import vendors with confidence >= threshold
    const { vendorsImported, vendorsSkipped, warnings } =
      await importVendors(vendors)

    return {
      vendors_parsed: vendors.length,
      vendors_imported: vendorsImported,
      vendors_skipped: vendorsSkipped,
      warnings,
      vendors,
    }
  } finally {
    // 6. Clean up uploaded file regardless of success/failure
    await deleteUploadedFile(client, uploadedFileId)
  }
}
