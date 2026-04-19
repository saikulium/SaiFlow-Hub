import { toFile } from '@anthropic-ai/sdk'
import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import {
  searchRequestsTool,
  getRequestDetailTool,
  searchVendorsTool,
  getBudgetOverviewTool,
  searchInvoicesTool,
  createRequestInputSchema,
  executeWriteTool,
} from '@/server/agents/tools/procurement.tools'
import { NOTIFICATION_TOOLS } from '@/server/agents/tools/notification.tools'
import { COMMESSA_TOOLS } from '@/modules/core/commesse'
import { ARTICLE_TOOLS } from '@/modules/core/articles'
import { VENDOR_TOOLS } from '@/modules/core/vendors'
import { CLIENT_TOOLS } from '@/modules/core/clients'
import { listCommentsTool } from '@/server/agents/tools/comment.tools'
import { listAttachmentsTool } from '@/server/agents/tools/attachment.tools'
import {
  getInvoiceDetailTool,
  getOrderForInvoiceTool,
  getVendorPriceHistoryTool,
  performThreeWayMatchTool,
} from '@/server/agents/tools/invoice.tools'
import { STOCK_TOOLS } from '@/modules/core/inventory'
import {
  listPendingApprovalsTool,
  getApprovalDetailTool,
} from '@/server/agents/tools/approval.tools'
import { createPriceVarianceReviewTool } from '@/server/agents/tools/price-variance.tools'
import { createEmailLog } from '@/server/services/email-log.service'
import type { RawEmailData } from '@/server/services/email-ai-classifier.service'
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool'

// ---------------------------------------------------------------------------
// Email Intelligence Agent — Multi-step email processing with tools
//
// Riceve email grezze e usa tool-calling per:
// 1. Classificare l'intent
// 2. Cercare PR/commesse correlate nel database
// 3. Agire: creare timeline events, notifiche, commesse
// ---------------------------------------------------------------------------

const AGENT_MODEL = MODELS.SONNET
const MAX_ITERATIONS = 10
const MAX_TOKENS = 4096
const FILES_API_BETA = 'files-api-2025-04-14' as const

/**
 * Represents a file attachment to be uploaded via Files API.
 */
export interface EmailAttachmentFile {
  readonly filename: string
  readonly content: Buffer
  readonly mimeType: string
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const EMAIL_AGENT_SYSTEM_PROMPT = `Sei un agente di procurement per PMI italiane. Ricevi email commerciali e devi analizzarle ed eseguire TUTTE le azioni necessarie.

PROCEDURA:
1. CLASSIFICA l'intent dell'email
2. CERCA nel database se esistono risorse correlate (PR, fornitori, clienti, commesse)
3. SE mancano fornitori/clienti citati, usa find_or_create_vendor / find_or_create_client
   per censirli in stato PENDING_REVIEW (non serve chiedere conferma)
4. AGISCI in base all'intent — esegui TUTTE le azioni, non solo la prima

REGOLE ANAGRAFICHE (importanti):
- Se una email menziona un fornitore NUOVO non in anagrafica → find_or_create_vendor
- Se una email menziona un cliente finale NUOVO non in anagrafica → find_or_create_client
- Se un ordine cliente cita un cliente esistente → usa search_clients prima per trovarlo
- Gli auto-create vanno in stato PENDING_REVIEW: servono verifica manuale ma non bloccano il flusso

AZIONI PER INTENT:

CONFERMA_ORDINE:
  1. search_requests per external_ref o codice ordine menzionato nell'email
  2. Se il fornitore citato non e in anagrafica → find_or_create_vendor
  3. Se PR trovata in stato APPROVED → mark_ordered (con external_ref del fornitore)
  4. Se PR trovata in stato ORDERED → create_timeline_event ("Conferma ricevuta da fornitore")
  5. Se allegati PDF presenti → add_attachment per collegare alla PR
  6. add_comment con riepilogo email ("Conferma ordine ricevuta da [vendor]: ref [ref], data consegna prevista [data]")
  7. create_notification al requester

RITARDO_CONSEGNA:
  1. search_requests per codice ordine / external_ref
  2. get_request_detail per verificare expected_delivery attuale
  3. create_timeline_event tipo 'delivery_delay' con:
     - data originale vs nuova data
     - motivo del ritardo (se indicato)
  4. Se PR collegata a commessa: get_request_detail per verificare commessa.deadline
     - Se ritardo impatta deadline commessa: requires_human_decision=true con decision_reason specifico
  5. add_comment con dettaglio ritardo ("Ritardo comunicato da [vendor]: consegna spostata da [data_old] a [data_new]. Motivo: [motivo]")
  6. create_notification URGENTE al requester

VARIAZIONE_PREZZO:
  1. search_requests per codice ordine
  2. get_request_detail per avere i prezzi originali (RequestItem.unit_price)
  3. Calcola delta EUR e percentuale per OGNI riga
  4. create_timeline_event tipo 'price_variance' con metadata {old_price, new_price, delta_pct, per_item: [...]}
  5. Se variazione > 2% su qualsiasi riga:
     - requires_human_decision=true
     - decision_reason con dettaglio per riga
     - Chiama create_price_variance_review con i dati per-item:
       request_id, items (array con item_name, old_price, new_price, delta_pct, quantity),
       total_old_amount, total_new_amount
  6. add_comment con tabella comparativa (vecchio vs nuovo vs delta)
  7. create_notification al MANAGER (non solo requester)
  8. Se allegati (conferma ordine con nuovi prezzi) → add_attachment

ORDINE_CLIENTE (il piu importante — fai TUTTI gli step in ordine):
  1. Cerca il cliente con search_clients; se non esiste, find_or_create_client.
     SALVA il client_id.
  2. Crea la commessa con create_commessa passando client_name, client_value, deadline, items.
     SALVA l'ID della commessa restituito.
  3. Per OGNI articolo nell'ordine:
     a. Cerca o crea l'articolo nel catalogo con find_or_create_article.
        SALVA l'article_id restituito.
     b. PRIMA di creare la RDA, verifica disponibilita:
        - get_stock_for_article per verificare stock disponibile
        - Se article ha material_id, get_pending_orders_for_material per verificare ordini in arrivo
        - Calcola quantita da ordinare: max(0, quantita_richiesta - stock_disponibile - pending_in_arrivo)
     c. Se quantita_da_ordinare > 0: crea RDA con create_request:
        - title: "[codice articolo] per commessa [cliente]"
        - description: "Richiesto dal cliente: [qty_originale] [unit]. Stock disponibile: [stock]. Pending in arrivo: [pending]. Da ordinare: [qty_calcolata]. VERIFICARE disponibilita a magazzino prima di ordinare."
        - commessa_id: l'ID della commessa creata allo step 2
        - items: [{name: descrizione, quantity: quantita_da_ordinare, unit: unita, article_id: l'article_id ottenuto dallo step 3a}]
          IMPORTANTE: DEVI SEMPRE passare article_id negli items per collegare la riga RDA all'articolo nel catalogo!
        - priority: "HIGH" se la scadenza e entro 30 giorni, altrimenti "MEDIUM"
        - needed_by: la deadline dell'ordine cliente in formato ISO
     d. Se quantita_da_ordinare == 0: nota nel summary "Articolo [X] coperto da stock/ordini pending"
  4. Cerca i fornitori che potrebbero avere gli articoli (search_vendors)
  5. Crea una notifica di riepilogo con create_notification che includa:
     - Lista delle RDA create con i codici PR
     - Link alle RDA: /requests/[codice-pr] per ogni RDA
     - Per ogni articolo: quantita richiesta, stock, pending, quantita RDA
     - Se qualche articolo e coperto da stock: segnalarlo esplicitamente

FATTURA_ALLEGATA:
  1. Se allegato PDF presente: leggi il contenuto per estrarre numero fattura, fornitore, importo totale, data, righe
  2. search_invoices per verificare se fattura gia importata (per numero fattura o fornitore)
  3. search_requests per cercare ordine correlato (per codice PR o external_ref menzionato)
  4. Se ordine trovato:
     - create_timeline_event sulla PR ("Fattura ricevuta: [numero], importo [importo] EUR")
     - add_attachment per collegare PDF alla PR
  5. Se dati sufficienti per confronto fattura vs ordine: nota nel summary se i numeri corrispondono (match preliminare)
  6. create_notification al reparto contabilita con dettaglio importi

RICHIESTA_INFO:
  1. search_requests per cercare PR correlata
  2. Se PR trovata:
     - get_request_detail per contesto
     - get_request_timeline per vedere lo storico
     - add_comment con la domanda del fornitore (tag: @requester)
     - create_notification al requester con link alla PR
  3. Se PR non trovata:
     - create_notification generica all'admin

REGOLE:
- Esegui TUTTE le azioni elencate per l'intent, non fermarti dopo la prima.
- Se non trovi una PR correlata, NON inventare un codice — segnala "da verificare".
- Se un codice articolo e sconosciuto, includilo comunque nella RDA con una nota.
- Rispondi SEMPRE in italiano.
- Per le date usa formato italiano (gg/mm/aaaa) nelle notifiche, ISO nei tool.

FORMATO RISPOSTA FINALE:
Dopo aver eseguito tutte le azioni necessarie, concludi con un riepilogo JSON:
{
  "intent": "CONFERMA_ORDINE|RITARDO_CONSEGNA|VARIAZIONE_PREZZO|RICHIESTA_INFO|FATTURA_ALLEGATA|ORDINE_CLIENTE|ALTRO",
  "actions_taken": ["descrizione azione 1", "descrizione azione 2"],
  "confidence": 0.0-1.0,
  "requires_human_decision": true/false,
  "decision_reason": "descrizione breve del perche serve decisione umana (solo se requires_human_decision=true)",
  "summary": "Riepilogo in italiano di cosa e stato fatto"
}

COME SETTARE confidence E requires_human_decision:

confidence (0.0-1.0):
- 0.9-1.0: classificazione intent chiarissima, tutte le info estratte senza ambiguita
- 0.7-0.9: classificazione certa, qualche dato mancante ma non critico
- 0.5-0.7: ambiguita significative (intent incerto, dati contraddittori, codici non riconosciuti)
- 0.0-0.5: email poco chiara o in formato inatteso, molti dati mancanti

requires_human_decision (true SOLO quando):
- Variazione prezzo oltre soglia contrattuale (tipicamente >2%) — il buyer deve decidere se accettare
- Ritardo consegna che impatta un cliente finale — serve decisione su mitigation
- Fattura con discrepanze importanti — dispute manuale
- Ordine cliente con articoli non in catalogo — serve verifica
- Fornitore non in anagrafica citato in una conferma — serve censimento manuale

requires_human_decision=false quando l'agente ha completato tutto e non serve decisione:
- Conferma ordine standard senza discrepanze
- Ritardo breve senza impatto
- Semplice notifica informativa

IMPORTANTE: confidence e requires_human_decision sono INDIPENDENTI.
Un'analisi puo avere confidence=0.95 E requires_human_decision=true
(l'agente ha capito tutto, ma serve decisione umana sui prezzi).`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailProcessingResult {
  readonly intent: string
  readonly actions_taken: readonly string[]
  readonly confidence: number
  readonly requires_human_decision: boolean
  readonly decision_reason: string | null
  readonly summary: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a create_request tool that executes writes directly for the given userId.
 */
function buildCreateRequestTool(userId: string): BetaRunnableTool<unknown> {
  return betaZodTool({
    name: 'create_request',
    description:
      "Crea una nuova richiesta d'acquisto in stato DRAFT. Usa per ogni articolo da ordinare.",
    inputSchema: createRequestInputSchema,
    run: async (input) => {
      try {
        const result = await executeWriteTool(
          'create_request',
          { ...input, _userId: userId } as Record<string, unknown>,
          userId,
        )
        return typeof result === 'string' ? result : JSON.stringify(result)
      } catch (err) {
        return JSON.stringify({
          error: `Errore nella creazione della richiesta: ${String(err)}`,
        })
      }
    },
  }) as BetaRunnableTool<unknown>
}

// ---------------------------------------------------------------------------
// WRITE tool builders — wrap intercepted tools for autonomous execution
// ---------------------------------------------------------------------------

/**
 * Generic helper to build a WRITE tool that executes directly via executeWriteTool.
 * Used for tools whose normal `run` is a placeholder requiring user confirmation.
 */
function buildWriteTool(
  toolName: string,
  description: string,
  inputSchema: z.ZodTypeAny,
  userId: string,
): BetaRunnableTool<unknown> {
  return betaZodTool({
    name: toolName,
    description,
    inputSchema,
    run: async (input) => {
      try {
        const params = {
          ...(input as Record<string, unknown>),
          _userId: userId,
        }
        const result = await executeWriteTool(toolName, params, userId)
        return typeof result === 'string' ? result : JSON.stringify(result)
      } catch (err) {
        return JSON.stringify({ error: `Errore ${toolName}: ${String(err)}` })
      }
    },
  }) as BetaRunnableTool<unknown>
}

function buildMarkOrderedTool(userId: string): BetaRunnableTool<unknown> {
  return buildWriteTool(
    'mark_ordered',
    'Marca una richiesta APPROVED come ordinata (ORDERED). Usa quando un fornitore conferma un ordine.',
    z
      .object({
        request_id: z.string().optional().describe('ID della richiesta'),
        code: z
          .string()
          .optional()
          .describe('Codice richiesta (es: PR-2025-00001)'),
        external_ref: z
          .string()
          .optional()
          .describe('Riferimento ordine fornitore'),
        tracking_number: z.string().optional().describe('Numero tracking'),
      })
      .refine((d) => Boolean(d.request_id || d.code), {
        message: 'request_id o code obbligatorio',
      }),
    userId,
  )
}

function buildMarkDeliveredTool(userId: string): BetaRunnableTool<unknown> {
  return buildWriteTool(
    'mark_delivered',
    'Marca un ordine come consegnato (DELIVERED). Usa quando il fornitore conferma la consegna.',
    z
      .object({
        request_id: z.string().optional().describe('ID della richiesta'),
        code: z
          .string()
          .optional()
          .describe('Codice richiesta (es: PR-2025-00001)'),
        actual_amount: z
          .number()
          .optional()
          .describe('Importo effettivo consegnato'),
        notes: z.string().optional().describe('Note consegna'),
      })
      .refine((d) => Boolean(d.request_id || d.code), {
        message: 'request_id o code obbligatorio',
      }),
    userId,
  )
}

function buildCancelRequestTool(userId: string): BetaRunnableTool<unknown> {
  return buildWriteTool(
    'cancel_request',
    "Annulla una richiesta d'acquisto. Usa quando il fornitore o il cliente annulla un ordine.",
    z
      .object({
        request_id: z.string().optional().describe('ID della richiesta'),
        code: z
          .string()
          .optional()
          .describe('Codice richiesta (es: PR-2025-00001)'),
        reason: z.string().optional().describe("Motivo dell'annullamento"),
      })
      .refine((d) => Boolean(d.request_id || d.code), {
        message: 'request_id o code obbligatorio',
      }),
    userId,
  )
}

function buildAddCommentTool(userId: string): BetaRunnableTool<unknown> {
  return buildWriteTool(
    'add_comment',
    "Aggiunge un commento a una richiesta d'acquisto. Usa per salvare il contenuto di un'email come nota sulla PR.",
    z.object({
      request_id: z.string(),
      content: z.string().min(1),
      is_internal: z
        .boolean()
        .optional()
        .describe(
          'Default false — se true il commento non e visibile al vendor',
        ),
    }),
    userId,
  )
}

function buildAddAttachmentTool(userId: string): BetaRunnableTool<unknown> {
  return buildWriteTool(
    'add_attachment',
    "Registra un allegato su una richiesta d'acquisto. Usa per collegare PDF fattura/conferma alla PR.",
    z.object({
      request_id: z.string(),
      filename: z.string(),
      file_url: z.string().url(),
      file_size: z.number().int().optional(),
      mime_type: z.string().optional(),
    }),
    userId,
  )
}

function buildDisputeInvoiceTool(userId: string): BetaRunnableTool<unknown> {
  return buildWriteTool(
    'dispute_invoice',
    'Contesta una fattura con discrepanze. Aggiorna lo stato a DISPUTED e crea timeline + notifica.',
    z.object({
      invoice_id: z.string(),
      amount_discrepancy: z
        .number()
        .describe('Differenza in EUR (positiva o negativa)'),
      discrepancy_type: z.enum([
        'AMOUNT_MISMATCH',
        'QUANTITY_MISMATCH',
        'ITEM_MISMATCH',
        'PRICE_MISMATCH',
      ]),
      notes: z.string().describe('Motivazione dettagliata della contestazione'),
      notify_user_id: z
        .string()
        .optional()
        .describe('Utente da notificare (default: owner del PR correlato)'),
    }),
    userId,
  )
}

/**
 * Combine all tools available to the email agent.
 *
 * READ tools are imported directly — they have real `run` implementations.
 * WRITE tools are wrapped via builder functions that call `executeWriteTool`
 * directly, bypassing the user-confirmation flow used in the chat assistant.
 */
function getEmailAgentTools(
  userId: string,
): readonly BetaRunnableTool<unknown>[] {
  return [
    // --- READ: core procurement ---
    searchRequestsTool,
    getRequestDetailTool,
    searchVendorsTool,
    getBudgetOverviewTool,
    searchInvoicesTool,

    // --- READ: comments & attachments ---
    listCommentsTool,
    listAttachmentsTool,

    // --- READ: invoices ---
    getInvoiceDetailTool,
    getOrderForInvoiceTool,
    getVendorPriceHistoryTool,
    performThreeWayMatchTool,

    // --- READ: stock ---
    ...STOCK_TOOLS,

    // --- READ: approvals ---
    listPendingApprovalsTool,
    getApprovalDetailTool,

    // --- READ/WRITE: notifications & timeline (have real run) ---
    ...NOTIFICATION_TOOLS,

    // --- READ/WRITE: commessa, article, vendor, client (have real run) ---
    ...COMMESSA_TOOLS,
    ...ARTICLE_TOOLS,
    ...VENDOR_TOOLS,
    ...CLIENT_TOOLS,

    // --- WRITE: price variance review (direct execution) ---
    createPriceVarianceReviewTool,

    // --- WRITE: autonomous execution via executeWriteTool ---
    buildCreateRequestTool(userId),
    buildMarkOrderedTool(userId),
    buildMarkDeliveredTool(userId),
    buildCancelRequestTool(userId),
    buildAddCommentTool(userId),
    buildAddAttachmentTool(userId),
    buildDisputeInvoiceTool(userId),
  ] as readonly BetaRunnableTool<unknown>[]
}

/**
 * Format the email data into a readable prompt for the agent.
 */
function formatEmailContent(email: RawEmailData): string {
  const parts: string[] = [
    `Da: ${email.email_from}`,
    `Oggetto: ${email.email_subject}`,
  ]

  if (email.email_to) {
    parts.push(`A: ${email.email_to}`)
  }

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

/**
 * Parse the final JSON result from the agent's text response.
 */
function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.5
  return Math.max(0, Math.min(1, value))
}

function parseAgentResult(text: string): EmailProcessingResult {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*"intent"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      // Backwards compat: if only needs_review present, map it
      const legacyNeedsReview =
        typeof parsed.needs_review === 'boolean' ? parsed.needs_review : null
      const requiresDecision =
        typeof parsed.requires_human_decision === 'boolean'
          ? parsed.requires_human_decision
          : (legacyNeedsReview ?? false)
      const confidence = clampConfidence(parsed.confidence)

      return {
        intent: typeof parsed.intent === 'string' ? parsed.intent : 'ALTRO',
        actions_taken: Array.isArray(parsed.actions_taken)
          ? (parsed.actions_taken as string[])
          : [],
        confidence,
        requires_human_decision: requiresDecision,
        decision_reason:
          typeof parsed.decision_reason === 'string'
            ? parsed.decision_reason
            : null,
        summary:
          typeof parsed.summary === 'string'
            ? parsed.summary
            : 'Elaborazione completata',
      }
    } catch {
      // Fall through to default
    }
  }

  return {
    intent: 'ALTRO',
    actions_taken: [],
    confidence: 0.3,
    requires_human_decision: true,
    decision_reason: 'Agent output non strutturato — verificare manualmente',
    summary: text.slice(0, 500) || 'Nessun riepilogo disponibile',
  }
}

// ---------------------------------------------------------------------------
// Files API helpers (for PDF attachments)
// ---------------------------------------------------------------------------

/**
 * Upload a PDF to the Anthropic Files API. Returns the file_id.
 * Non-PDF attachments are filtered out before calling this.
 */
async function uploadAttachment(
  client: Anthropic,
  attachment: EmailAttachmentFile,
): Promise<string> {
  const file = await toFile(attachment.content, attachment.filename, {
    type: attachment.mimeType,
  })
  const uploaded = await client.beta.files.upload({
    file,
    betas: [FILES_API_BETA],
  })
  return uploaded.id
}

/**
 * Best-effort delete of an uploaded file. Logs errors but does not throw.
 */
async function deleteUploadedFile(
  client: Anthropic,
  fileId: string,
): Promise<void> {
  try {
    await client.beta.files.delete(fileId, { betas: [FILES_API_BETA] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[email-agent] Failed to delete file ${fileId}: ${msg}`)
  }
}

/**
 * Build the message content blocks for the email agent.
 * Includes a document block per uploaded PDF followed by the email text.
 */
function buildEmailMessageContent(
  emailContent: string,
  attachmentFileIds: readonly { fileId: string; filename: string }[],
): Anthropic.Beta.Messages.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.Messages.BetaContentBlockParam[] = []

  for (const { fileId, filename } of attachmentFileIds) {
    blocks.push({
      type: 'document',
      source: { type: 'file', file_id: fileId },
      title: filename,
    } as Anthropic.Beta.Messages.BetaRequestDocumentBlock)
  }

  blocks.push({
    type: 'text',
    text: `Analizza e processa questa email commerciale:\n\n--- EMAIL ---\n${emailContent}\n--- FINE EMAIL ---\n\n${attachmentFileIds.length > 0 ? `Gli allegati PDF sono qui sopra. Leggili per estrarre i dettagli degli articoli, quantita, prezzi e codici.\n\n` : ''}Esegui tutte le azioni necessarie usando i tool disponibili, poi concludi con il riepilogo JSON.`,
  })

  return blocks
}

// ---------------------------------------------------------------------------
// Main function — processEmail
// ---------------------------------------------------------------------------

/**
 * Processes an incoming email through the AI agent loop.
 *
 * The agent:
 * 1. Reads the email content + any uploaded PDF attachments (via Files API)
 * 2. Uses tools to search for related PRs, vendors, commesse
 * 3. Takes appropriate actions (notifications, timeline events, commessa creation)
 * 4. Returns a structured result with intent and actions taken
 *
 * When `attachmentFiles` contains PDFs, they are uploaded via the Files API
 * and referenced as document blocks so the model can read the full content.
 */
export async function processEmail(
  email: RawEmailData,
  userId?: string,
  attachmentFiles?: readonly EmailAttachmentFile[],
): Promise<EmailProcessingResult> {
  const startTime = Date.now()
  const tools = getEmailAgentTools(userId ?? 'system')
  const client = getClaudeClient()

  const emailContent = formatEmailContent(email)
  const toolCalls: string[] = []

  // Upload PDF attachments via Files API (filter to supported types)
  const pdfAttachments = (attachmentFiles ?? []).filter(
    (a) => a.mimeType === 'application/pdf',
  )
  const uploadedFiles: { fileId: string; filename: string }[] = []

  try {
    for (const attachment of pdfAttachments) {
      try {
        const fileId = await uploadAttachment(client, attachment)
        uploadedFiles.push({ fileId, filename: attachment.filename })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(
          `[email-agent] Failed to upload ${attachment.filename}: ${msg}`,
        )
      }
    }

    const messageContent = buildEmailMessageContent(emailContent, uploadedFiles)

    const runner = client.beta.messages.toolRunner({
      model: AGENT_MODEL,
      system: EMAIL_AGENT_SYSTEM_PROMPT,
      max_tokens: MAX_TOKENS,
      max_iterations: MAX_ITERATIONS,
      tools: [...tools],
      messages: [{ role: 'user' as const, content: messageContent }],
      betas: uploadedFiles.length > 0 ? [FILES_API_BETA] : undefined,
    })

    let lastTextContent = ''

    for await (const message of runner) {
      for (const block of message.content) {
        if (block.type === 'text') {
          lastTextContent = block.text
        } else if (block.type === 'tool_use') {
          toolCalls.push(`${block.name}: completato`)
        }
      }
    }

    const parsed = parseAgentResult(lastTextContent)
    const processingTimeMs = Date.now() - startTime
    const result: EmailProcessingResult = {
      ...parsed,
      actions_taken: [...toolCalls, ...parsed.actions_taken],
    }

    // Persist email log (non-blocking, errors don't fail the response)
    try {
      await createEmailLog({
        email_from: email.email_from,
        email_to: email.email_to,
        email_subject: email.email_subject,
        email_body: email.email_body,
        email_date: email.email_date,
        email_message_id: email.email_message_id,
        intent: result.intent,
        confidence: result.confidence,
        requires_human_decision: result.requires_human_decision,
        decision_reason: result.decision_reason,
        actions_taken: result.actions_taken,
        summary: result.summary,
        attachments_count: attachmentFiles?.length ?? 0,
        processed_by_user_id: userId ?? undefined,
        ai_model: AGENT_MODEL,
        processing_time_ms: processingTimeMs,
      })
    } catch (logErr) {
      console.warn('[email-agent] Failed to save EmailLog:', logErr)
    }

    return result
  } catch (err) {
    return {
      intent: 'ALTRO',
      actions_taken: toolCalls,
      confidence: 0,
      requires_human_decision: true,
      decision_reason: 'Errore AI — verificare manualmente',
      summary: `Errore nella chiamata AI: ${String(err)}`,
    }
  } finally {
    // Cleanup uploaded files (best-effort, runs even on error)
    for (const { fileId } of uploadedFiles) {
      await deleteUploadedFile(client, fileId)
    }
  }
}
