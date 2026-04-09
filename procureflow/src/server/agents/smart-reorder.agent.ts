import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import {
  searchRequestsTool,
  getRequestDetailTool,
  searchVendorsTool,
  getBudgetOverviewTool,
  createRequestInputSchema,
  executeWriteTool,
} from '@/server/agents/tools/procurement.tools'
import { NOTIFICATION_TOOLS } from '@/server/agents/tools/notification.tools'
import { INVENTORY_TOOLS } from '@/server/agents/tools/inventory.tools'
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool'

// ---------------------------------------------------------------------------
// Smart Reorder Agent — Automated inventory replenishment
//
// Scans active material alerts, evaluates forecasts & budgets, and creates
// DRAFT purchase requests for materials that need reordering.
// ---------------------------------------------------------------------------

const AGENT_MODEL = MODELS.SONNET
const MAX_ITERATIONS = 15
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
 * Build a create_request tool that executes writes directly for the given userId.
 * Unlike the placeholder in procurement.tools, this tool actually creates the request.
 */
function buildCreateRequestTool(userId: string): BetaRunnableTool<any> {
  return betaZodTool({
    name: 'create_request',
    description: "Crea una nuova richiesta d'acquisto.",
    inputSchema: createRequestInputSchema,
    run: async (input) => {
      try {
        const result = await executeWriteTool(
          'create_request',
          input as Record<string, unknown>,
          userId,
        )
        return typeof result === 'string' ? result : JSON.stringify(result)
      } catch (err) {
        return JSON.stringify({
          error: `Errore nell'esecuzione di create_request: ${String(err)}`,
        })
      }
    },
  }) as BetaRunnableTool<any>
}

/**
 * Combine all tools available to the reorder agent.
 * Includes inventory tools, procurement READ tools, a write-enabled
 * create_request tool, and notification tools.
 */
function getReorderAgentTools(userId: string): readonly BetaRunnableTool<any>[] {
  return [
    ...INVENTORY_TOOLS,
    searchRequestsTool,
    getRequestDetailTool,
    searchVendorsTool,
    getBudgetOverviewTool,
    buildCreateRequestTool(userId),
    ...NOTIFICATION_TOOLS,
  ] as readonly BetaRunnableTool<any>[]
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
  const tools = getReorderAgentTools(userId)
  const client = getClaudeClient()

  const userPrompt = notifyManagerId
    ? `Esegui il processo di riordino automatico. Al termine, invia una notifica di riepilogo all'utente con user_id "${notifyManagerId}". Concludi con il riepilogo JSON.`
    : 'Esegui il processo di riordino automatico. Concludi con il riepilogo JSON.'

  try {
    const runner = client.beta.messages.toolRunner({
      model: AGENT_MODEL,
      system: REORDER_SYSTEM_PROMPT,
      max_tokens: MAX_TOKENS,
      max_iterations: MAX_ITERATIONS,
      tools: [...tools],
      messages: [
        { role: 'user' as const, content: userPrompt },
      ],
    })

    let lastTextContent = ''

    for await (const message of runner) {
      for (const block of message.content) {
        if (block.type === 'text') {
          lastTextContent = block.text
        }
      }
    }

    return parseAgentResult(lastTextContent)
  } catch (err) {
    return {
      drafts_created: 0,
      alerts_processed: 0,
      skipped_budget: 0,
      summary: `Errore nella chiamata AI: ${String(err)}`,
    }
  }
}
