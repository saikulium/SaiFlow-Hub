import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import { INVOICE_TOOLS } from '@/server/agents/tools/invoice.tools'
import { NOTIFICATION_TOOLS } from '@/server/agents/tools/notification.tools'
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool'

// ---------------------------------------------------------------------------
// Invoice Reconciliation Agent
//
// Reconciles a single invoice against its purchase order by:
// 1. Reading invoice details (lines, amounts, supplier)
// 2. Finding the related purchase order
// 3. Comparing line-by-line: description, quantity, unit price, total
// 4. Comparing totals: ordered vs invoiced
// 5. Producing a structured Italian report with recommendation
// ---------------------------------------------------------------------------

const AGENT_MODEL = MODELS.SONNET
const MAX_ITERATIONS = 12
const MAX_TOKENS = 4096

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const RECONCILIATION_SYSTEM_PROMPT = `Sei un esperto contabile per PMI italiane. Devi riconciliare fatture passive con gli ordini di acquisto.

PROCEDURA:
1. Leggi il dettaglio della fattura (righe, importi, fornitore)
2. Cerca l'ordine correlato (tramite codice PR o nome fornitore)
3. Confronta RIGA PER RIGA: descrizione, quantita, prezzo unitario, totale
4. Confronta il TOTALE: importo ordinato vs importo fatturato
5. Produci un report in italiano comprensibile

CRITERI:
- Discrepanza < 2%: DISCREPANZA MINORE, raccomanda APPROVA
- Discrepanza 2-5%: valuta con storico prezzi
- Discrepanza > 5%: DISCREPANZA GRAVE, raccomanda CONTESTA
- Controlla anche articoli fatturati ma non ordinati

OUTPUT: Concludi con un JSON nel seguente formato:
{
  "status": "CONFORME | DISCREPANZA_MINORE | DISCREPANZA_GRAVE",
  "recommendation": "APPROVA | CONTESTA | ATTESA",
  "report": "Report testuale dettagliato in italiano",
  "email_draft": "Bozza email al fornitore (solo se CONTESTA, altrimenti null)",
  "discrepancies": [
    {
      "field": "nome campo",
      "ordered": "valore ordinato",
      "invoiced": "valore fatturato",
      "difference": "differenza"
    }
  ]
}`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReconciliationDiscrepancy {
  readonly field: string
  readonly ordered: string
  readonly invoiced: string
  readonly difference: string
}

export interface ReconciliationResult {
  readonly status: 'CONFORME' | 'DISCREPANZA_MINORE' | 'DISCREPANZA_GRAVE'
  readonly recommendation: 'APPROVA' | 'CONTESTA' | 'ATTESA'
  readonly report: string
  readonly email_draft: string | null
  readonly discrepancies: readonly ReconciliationDiscrepancy[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Combine invoice tools and notification tools for the agent.
 */
function getReconciliationTools(): readonly BetaRunnableTool<any>[] {
  return [...INVOICE_TOOLS, ...NOTIFICATION_TOOLS] as readonly BetaRunnableTool<any>[]
}

/**
 * Parse the final JSON result from the agent's text response.
 */
function parseAgentResult(text: string): ReconciliationResult {
  const jsonMatch = text.match(/\{[\s\S]*"status"[\s\S]*"recommendation"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      return {
        status: isValidStatus(parsed.status) ? parsed.status : 'DISCREPANZA_GRAVE',
        recommendation: isValidRecommendation(parsed.recommendation)
          ? parsed.recommendation
          : 'ATTESA',
        report:
          typeof parsed.report === 'string'
            ? parsed.report
            : 'Report non disponibile',
        email_draft:
          typeof parsed.email_draft === 'string' ? parsed.email_draft : null,
        discrepancies: Array.isArray(parsed.discrepancies)
          ? parsed.discrepancies.map(parseDiscrepancy)
          : [],
      }
    } catch {
      // Fall through to default
    }
  }

  return {
    status: 'DISCREPANZA_GRAVE',
    recommendation: 'ATTESA',
    report: text.slice(0, 1000) || 'Analisi non completata',
    email_draft: null,
    discrepancies: [],
  }
}

function isValidStatus(
  value: unknown,
): value is 'CONFORME' | 'DISCREPANZA_MINORE' | 'DISCREPANZA_GRAVE' {
  return (
    value === 'CONFORME' ||
    value === 'DISCREPANZA_MINORE' ||
    value === 'DISCREPANZA_GRAVE'
  )
}

function isValidRecommendation(
  value: unknown,
): value is 'APPROVA' | 'CONTESTA' | 'ATTESA' {
  return value === 'APPROVA' || value === 'CONTESTA' || value === 'ATTESA'
}

function parseDiscrepancy(raw: unknown): ReconciliationDiscrepancy {
  const obj = raw as Record<string, unknown>
  return {
    field: typeof obj.field === 'string' ? obj.field : 'sconosciuto',
    ordered: String(obj.ordered ?? ''),
    invoiced: String(obj.invoiced ?? ''),
    difference: String(obj.difference ?? ''),
  }
}

// ---------------------------------------------------------------------------
// Main function — reconcileInvoice
// ---------------------------------------------------------------------------

/**
 * Runs the invoice reconciliation agent for a single invoice.
 *
 * The agent:
 * 1. Reads the full invoice detail (lines, amounts, supplier)
 * 2. Finds the related purchase order
 * 3. Compares line-by-line and totals
 * 4. Checks price history when discrepancy is in the 2-5% range
 * 5. Updates reconciliation status
 * 6. Optionally notifies a user with the result
 * 7. Returns a structured result
 */
export async function reconcileInvoice(
  invoiceId: string,
  notifyUserId?: string,
): Promise<ReconciliationResult> {
  const tools = getReconciliationTools()
  const client = getClaudeClient()

  const notifyInstruction = notifyUserId
    ? ` Al termine, invia una notifica all'utente con user_id "${notifyUserId}" con il risultato della riconciliazione.`
    : ''

  const userPrompt =
    `Riconcilia la fattura con ID "${invoiceId}".${notifyInstruction} Concludi con il riepilogo JSON.`

  try {
    const runner = client.beta.messages.toolRunner({
      model: AGENT_MODEL,
      system: RECONCILIATION_SYSTEM_PROMPT,
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
      status: 'DISCREPANZA_GRAVE',
      recommendation: 'ATTESA',
      report: `Errore nella chiamata AI: ${String(err)}`,
      email_draft: null,
      discrepancies: [],
    }
  }
}
