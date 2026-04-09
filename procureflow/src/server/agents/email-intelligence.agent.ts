import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import {
  searchRequestsTool,
  getRequestDetailTool,
  searchVendorsTool,
} from '@/server/agents/tools/procurement.tools'
import { NOTIFICATION_TOOLS } from '@/server/agents/tools/notification.tools'
import { COMMESSA_TOOLS } from '@/server/agents/tools/commessa.tools'
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

const EMAIL_AGENT_SYSTEM_PROMPT = `Sei un agente di procurement per PMI italiane. Ricevi email commerciali e devi:

1. CLASSIFICARE l'intent (conferma ordine, ritardo, variazione prezzo, ordine cliente, fattura, etc.)
2. CERCARE nel database se esiste una richiesta d'acquisto correlata
3. AGIRE in base all'intent:
   - CONFERMA_ORDINE: cerca la PR correlata con search_requests o get_request_detail, crea un timeline event
   - RITARDO_CONSEGNA: cerca la PR, notifica il richiedente con la nuova data
   - VARIAZIONE_PREZZO: cerca la PR, notifica il manager con la differenza
   - ORDINE_CLIENTE: crea una nuova commessa con gli articoli estratti
   - FATTURA_ALLEGATA: segnala con notifica per il reparto contabilita
   - RICHIESTA_INFO: notifica il richiedente della PR correlata

REGOLE:
- Se non trovi una PR correlata, NON inventare un codice. Metti un flag "da verificare".
- Se un codice articolo e sconosciuto, includi una nota "codice non trovato nel catalogo".
- Se un importo e ambiguo, segnalalo nella notifica.
- Rispondi SEMPRE in italiano.
- Per le date usa formato italiano (gg/mm/aaaa) nelle notifiche, ISO nelle operazioni.

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
 * Combine all tools available to the email agent.
 * READ tools from procurement + notification tools + commessa tools.
 */
function getEmailAgentTools(): readonly BetaRunnableTool<any>[] {
  return [
    searchRequestsTool,
    getRequestDetailTool,
    searchVendorsTool,
    ...NOTIFICATION_TOOLS,
    ...COMMESSA_TOOLS,
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
          typeof parsed.needs_review === 'boolean'
            ? parsed.needs_review
            : true,
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
): Promise<EmailProcessingResult> {
  const tools = getEmailAgentTools()
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
      actions_taken: [
        ...toolCalls,
        ...parsed.actions_taken,
      ],
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
