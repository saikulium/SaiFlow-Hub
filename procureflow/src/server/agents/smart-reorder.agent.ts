import type Anthropic from '@anthropic-ai/sdk'
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import {
  searchRequestsTool,
  getRequestDetailTool,
  searchVendorsTool,
  getBudgetOverviewTool,
  createRequestTool,
  executeWriteTool,
} from '@/server/agents/tools/procurement.tools'
import type { ZodTool } from '@/server/agents/tools/procurement.tools'
import { NOTIFICATION_TOOLS } from '@/server/agents/tools/notification.tools'
import { INVENTORY_TOOLS } from '@/server/agents/tools/inventory.tools'

// ---------------------------------------------------------------------------
// Smart Reorder Agent — Automated inventory replenishment
//
// Scans active material alerts, evaluates forecasts & budgets, and creates
// DRAFT purchase requests for materials that need reordering.
// ---------------------------------------------------------------------------

const AGENT_MODEL = MODELS.SONNET
const MAX_TOOL_ROUNDS = 15
const MAX_TOKENS = 4096

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const REORDER_SYSTEM_PROMPT = `Sei un agente di riordino automatico per PMI italiane.

PROCEDURA:
1. Controlla gli alert attivi (materiali sotto scorta) con get_active_alerts
2. Per ogni materiale con alert:
   a. Ottieni la previsione di consumo con get_material_forecast
   b. Controlla il budget disponibile con get_budget_overview
   c. Cerca lo storico prezzi con get_material_price_history
   d. Cerca il fornitore preferito con search_vendors
3. Per ogni materiale dove il riordino e giustificato:
   a. Calcola quantita ottimale (copertura 2 mesi + scorta sicurezza)
   b. Crea una richiesta d'acquisto DRAFT con create_request:
      - Titolo: "Riordino automatico: [nome materiale]"
      - Items con quantita e prezzo storico
4. Alla fine notifica il manager con riepilogo

REGOLE:
- NON riordinare se budget insufficiente — segnala il problema
- Quantita minima: almeno min_stock_level del materiale
- Prezzi in EUR con 2 decimali
- Rispondi SEMPRE in italiano

FORMATO RISPOSTA FINALE:
Dopo aver eseguito tutte le azioni, concludi con un riepilogo JSON:
{
  "drafts_created": <numero>,
  "alerts_processed": <numero>,
  "skipped_budget": <numero materiali saltati per budget>,
  "summary": "Riepilogo in italiano di cosa e stato fatto"
}`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReorderResult {
  readonly drafts_created: number
  readonly alerts_processed: number
  readonly skipped_budget: number
  readonly summary: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Combine all tools available to the reorder agent.
 * Includes inventory tools, procurement READ + WRITE tools, and notification tools.
 */
function getReorderAgentTools(): readonly ZodTool[] {
  return [
    ...INVENTORY_TOOLS,
    searchRequestsTool,
    getRequestDetailTool,
    searchVendorsTool,
    getBudgetOverviewTool,
    createRequestTool,
    ...NOTIFICATION_TOOLS,
  ] as readonly ZodTool[]
}

/**
 * Convert ZodTool[] to the Anthropic beta tool format for the API.
 */
function toBetaTools(tools: readonly ZodTool[]): Anthropic.Beta.BetaTool[] {
  return tools.map((t) => ({
    type: 'custom' as const,
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))
}

/**
 * Execute a tool with Zod-validated input.
 * For write tools (create_request), delegates to executeWriteTool with userId.
 */
async function executeTool(
  tools: readonly ZodTool[],
  toolName: string,
  rawInput: unknown,
  userId: string,
): Promise<string> {
  // Write tools: execute directly via the procurement executor
  if (toolName === 'create_request') {
    try {
      const result = await executeWriteTool(
        toolName,
        rawInput as Record<string, unknown>,
        userId,
      )
      return typeof result === 'string' ? result : JSON.stringify(result)
    } catch (err) {
      return JSON.stringify({
        error: `Errore nell'esecuzione di ${toolName}: ${String(err)}`,
      })
    }
  }

  // Read tools: find and execute with Zod validation
  const tool = tools.find((t) => t.name === toolName)
  if (!tool) {
    return JSON.stringify({ error: `Tool sconosciuto: ${toolName}` })
  }
  try {
    const parsed = tool.parse(rawInput)
    const result = await tool.run(parsed)
    return typeof result === 'string' ? result : JSON.stringify(result)
  } catch (err) {
    return JSON.stringify({
      error: `Errore nell'esecuzione del tool: ${String(err)}`,
    })
  }
}

/**
 * Parse the final JSON result from the agent's text response.
 */
function parseAgentResult(text: string): ReorderResult {
  const jsonMatch = text.match(/\{[\s\S]*"drafts_created"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      return {
        drafts_created:
          typeof parsed.drafts_created === 'number'
            ? parsed.drafts_created
            : 0,
        alerts_processed:
          typeof parsed.alerts_processed === 'number'
            ? parsed.alerts_processed
            : 0,
        skipped_budget:
          typeof parsed.skipped_budget === 'number'
            ? parsed.skipped_budget
            : 0,
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
    drafts_created: 0,
    alerts_processed: 0,
    skipped_budget: 0,
    summary: text.slice(0, 500) || 'Nessun riepilogo disponibile',
  }
}

// ---------------------------------------------------------------------------
// Main function — runReorderAgent
// ---------------------------------------------------------------------------

/**
 * Runs the smart reorder agent.
 *
 * The agent:
 * 1. Checks active material alerts
 * 2. For each alert: evaluates forecast, budget, price history
 * 3. Creates DRAFT purchase requests where justified
 * 4. Notifies the manager (if notifyManagerId is provided)
 * 5. Returns a structured result
 */
export async function runReorderAgent(
  userId: string,
  notifyManagerId?: string,
): Promise<ReorderResult> {
  const tools = getReorderAgentTools()
  const betaTools = toBetaTools(tools)
  const client = getClaudeClient()

  const actionsLog: string[] = []

  const userPrompt = notifyManagerId
    ? `Esegui il processo di riordino automatico. Al termine, invia una notifica di riepilogo all'utente con user_id "${notifyManagerId}". Concludi con il riepilogo JSON.`
    : 'Esegui il processo di riordino automatico. Concludi con il riepilogo JSON.'

  let conversationMessages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user' as const, content: userPrompt },
  ]

  let lastTextContent = ''

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: Anthropic.Beta.BetaMessage

    try {
      response = await client.beta.messages.create({
        model: AGENT_MODEL,
        system: REORDER_SYSTEM_PROMPT,
        messages: conversationMessages,
        max_tokens: MAX_TOKENS,
        tools: betaTools,
      })
    } catch (err) {
      return {
        drafts_created: 0,
        alerts_processed: 0,
        skipped_budget: 0,
        summary: `Errore nella chiamata AI: ${String(err)}`,
      }
    }

    const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = []
    let hasToolUse = false

    for (const block of response.content) {
      if (block.type === 'text') {
        lastTextContent = block.text
      } else if (block.type === 'tool_use') {
        hasToolUse = true
        const toolName = block.name
        const toolInput = block.input

        const toolResult = await executeTool(tools, toolName, toolInput, userId)
        actionsLog.push(`${toolName}: completato`)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: toolResult,
        })
      }
    }

    // No tool calls means the model finished its response
    if (!hasToolUse) {
      return parseAgentResult(lastTextContent)
    }

    // Feed tool results back for the next round
    conversationMessages = [
      ...conversationMessages,
      { role: 'assistant' as const, content: response.content },
      { role: 'user' as const, content: toolResults },
    ]
  }

  // Max rounds reached — return what we have
  const parsed = parseAgentResult(lastTextContent)
  return {
    ...parsed,
    summary: `${parsed.summary} (limite iterazioni raggiunto)`,
  }
}
