import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import {
  searchRequestsTool,
  getRequestDetailTool,
  searchVendorsTool,
  getBudgetOverviewTool,
  createRequestInputSchema,
  executeWriteTool,
} from '@/server/agents/tools/procurement.tools'
import { NOTIFICATION_TOOLS } from '@/server/agents/tools/notification.tools'
import { COMMESSA_TOOLS } from '@/server/agents/tools/commessa.tools'
import { ARTICLE_TOOLS } from '@/server/agents/tools/article.tools'
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

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const EMAIL_AGENT_SYSTEM_PROMPT = `Sei un agente di procurement per PMI italiane. Ricevi email commerciali e devi analizzarle ed eseguire TUTTE le azioni necessarie.

PROCEDURA:
1. CLASSIFICA l'intent dell'email
2. CERCA nel database se esistono risorse correlate (PR, fornitori, commesse)
3. AGISCI in base all'intent — esegui TUTTE le azioni, non solo la prima:

AZIONI PER INTENT:

CONFERMA_ORDINE:
  1. Cerca la PR correlata (search_requests o get_request_detail)
  2. Crea un evento timeline sulla PR (create_timeline_event)
  3. Crea una notifica per il richiedente (create_notification)

RITARDO_CONSEGNA:
  1. Cerca la PR correlata
  2. Crea un evento timeline con la nuova data
  3. Notifica il richiedente con urgenza

VARIAZIONE_PREZZO:
  1. Cerca la PR correlata
  2. Crea un evento timeline con vecchio/nuovo prezzo
  3. Notifica il manager con la differenza in EUR e percentuale

ORDINE_CLIENTE (il piu importante — fai TUTTI gli step in ordine):
  1. Crea la commessa con create_commessa (client_name, client_value, deadline, items).
     SALVA l'ID della commessa restituito (campo "id" nella risposta).
  2. Per OGNI articolo nell'ordine:
     a. Cerca o crea l'articolo nel catalogo con find_or_create_article
        (passa code/manufacturer_code, name, unit_of_measure).
        SALVA l'article_id restituito.
     b. Crea una richiesta d'acquisto con create_request:
        - title: "[codice articolo] per commessa [cliente]"
        - description: "Quantita richiesta dal cliente: [qty] [unit]. VERIFICARE disponibilita a magazzino prima di ordinare."
        - commessa_id: l'ID della commessa creata allo step 1
        - items: [{name: descrizione, quantity: quantita, unit: unita}]
        - priority: "HIGH" se la scadenza e entro 30 giorni, altrimenti "MEDIUM"
        - needed_by: la deadline dell'ordine cliente in formato ISO
  3. Cerca i fornitori che potrebbero avere gli articoli (search_vendors)
  4. Crea una notifica di riepilogo con create_notification che includa:
     - Lista delle RDA create con i codici PR
     - Link alle RDA: /requests/[codice-pr] per ogni RDA
     - La frase: "Le quantita sono quelle richieste dal cliente. Verificare le disponibilita a magazzino e modificare le quantita prima di inviare per approvazione."

FATTURA_ALLEGATA:
  1. Notifica il reparto contabilita

RICHIESTA_INFO:
  1. Cerca la PR correlata se presente
  2. Notifica il richiedente

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
  "needs_review": true/false,
  "summary": "Riepilogo in italiano di cosa e stato fatto"
}`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailProcessingResult {
  readonly intent: string
  readonly actions_taken: readonly string[]
  readonly needs_review: boolean
  readonly summary: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a create_request tool that executes writes directly for the given userId.
 */
function buildCreateRequestTool(userId: string): BetaRunnableTool<any> {
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
  }) as BetaRunnableTool<any>
}

/**
 * Combine all tools available to the email agent.
 * Includes READ tools, notification, commessa, budget, and create_request (WRITE).
 */
function getEmailAgentTools(userId: string): readonly BetaRunnableTool<any>[] {
  return [
    searchRequestsTool,
    getRequestDetailTool,
    searchVendorsTool,
    getBudgetOverviewTool,
    buildCreateRequestTool(userId),
    ...NOTIFICATION_TOOLS,
    ...COMMESSA_TOOLS,
    ...ARTICLE_TOOLS,
  ] as readonly BetaRunnableTool<any>[]
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
function parseAgentResult(text: string): EmailProcessingResult {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*"intent"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      return {
        intent: typeof parsed.intent === 'string' ? parsed.intent : 'ALTRO',
        actions_taken: Array.isArray(parsed.actions_taken)
          ? (parsed.actions_taken as string[])
          : [],
        needs_review:
          typeof parsed.needs_review === 'boolean' ? parsed.needs_review : true,
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
    needs_review: true,
    summary: text.slice(0, 500) || 'Nessun riepilogo disponibile',
  }
}

// ---------------------------------------------------------------------------
// Main function — processEmail
// ---------------------------------------------------------------------------

/**
 * Processes an incoming email through the AI agent loop.
 *
 * The agent:
 * 1. Reads the email content
 * 2. Uses tools to search for related PRs, vendors, commesse
 * 3. Takes appropriate actions (notifications, timeline events, commessa creation)
 * 4. Returns a structured result with intent and actions taken
 */
export async function processEmail(
  email: RawEmailData,
  userId?: string,
): Promise<EmailProcessingResult> {
  const tools = getEmailAgentTools(userId ?? 'system')
  const client = getClaudeClient()

  const emailContent = formatEmailContent(email)
  const toolCalls: string[] = []

  try {
    const runner = client.beta.messages.toolRunner({
      model: AGENT_MODEL,
      system: EMAIL_AGENT_SYSTEM_PROMPT,
      max_tokens: MAX_TOKENS,
      max_iterations: MAX_ITERATIONS,
      tools: [...tools],
      messages: [
        {
          role: 'user' as const,
          content: `Analizza e processa questa email commerciale:\n\n--- EMAIL ---\n${emailContent}\n--- FINE EMAIL ---\n\nEsegui tutte le azioni necessarie usando i tool disponibili, poi concludi con il riepilogo JSON.`,
        },
      ],
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
    return {
      ...parsed,
      actions_taken: [...toolCalls, ...parsed.actions_taken],
    }
  } catch (err) {
    return {
      intent: 'ALTRO',
      actions_taken: toolCalls,
      needs_review: true,
      summary: `Errore nella chiamata AI: ${String(err)}`,
    }
  }
}
