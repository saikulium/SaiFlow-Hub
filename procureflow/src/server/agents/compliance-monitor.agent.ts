import type Anthropic from '@anthropic-ai/sdk'
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import { prisma } from '@/lib/db'
import {
  searchRequestsTool,
  getRequestDetailTool,
  getBudgetOverviewTool,
  searchInvoicesTool,
} from '@/server/agents/tools/procurement.tools'
import type { ZodTool } from '@/server/agents/tools/procurement.tools'
import { NOTIFICATION_TOOLS } from '@/server/agents/tools/notification.tools'
import type { ComplianceAlert } from '@/lib/ai/schemas/compliance-check.schema'

// ---------------------------------------------------------------------------
// Compliance Monitor Agent — Daily compliance checks
//
// Scans the procurement system for:
// 1. Overdue orders (ORDERED/SHIPPED past expected_delivery)
// 2. Budget overruns (cost centers > 90% or over-budget)
// 3. Unreconciled invoices (PENDING reconciliation > 30 days)
// 4. Stale approvals (PENDING_APPROVAL > 7 days)
//
// Creates notifications for responsible users and returns a summary.
// ---------------------------------------------------------------------------

const AGENT_MODEL = MODELS.SONNET
const MAX_TOOL_ROUNDS = 12
const MAX_TOKENS = 4096

const DEFAULT_TENANT = 'default'
const STALE_APPROVAL_DAYS = 7
const UNRECONCILED_INVOICE_DAYS = 30

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const COMPLIANCE_SYSTEM_PROMPT = `Sei un agente di compliance per PMI italiane. Controlli quotidianamente:

1. ORDINI SCADUTI: richieste in stato ORDERED/SHIPPED con expected_delivery passata
2. BUDGET: centri di costo con utilizzo > 90% o in sforamento
3. FATTURE: fatture non riconciliate da piu di 30 giorni
4. APPROVAZIONI: richieste in PENDING_APPROVAL da piu di 7 giorni

Per ogni problema:
- Classifica severita: CRITICAL (scadenza <7gg, budget sforato, overdue >14gg), WARNING (scadenza <30gg, budget >90%, overdue <14gg), INFO (rest)
- Scrivi titolo e descrizione in italiano chiaro
- Crea notifica per l'utente responsabile con create_notification

Alla fine riassumi i problemi trovati con un riepilogo JSON:
{
  "alerts_found": <numero>,
  "notifications_sent": <numero>,
  "summary": "Riepilogo in italiano di cosa e stato fatto"
}

DATI PRE-CARICATI:
Ti forniro i dati gia estratti dal database come contesto iniziale. Usa i tool
solo se hai bisogno di ulteriori dettagli su specifiche richieste, budget o fatture.

REGOLE:
- Notifica il requester per ordini scaduti
- Notifica il requester per approvazioni stale (cosi puo sollecitare)
- Notifica l'admin per budget in sforamento
- Notifica l'admin per fatture non riconciliate
- Rispondi SEMPRE in italiano
- Per le date usa formato italiano (gg/mm/aaaa) nelle notifiche`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComplianceCheckResult {
  readonly alerts_found: number
  readonly notifications_sent: number
  readonly summary: string
  readonly alerts: readonly ComplianceAlert[]
}

// ---------------------------------------------------------------------------
// Pre-fetch helpers
// ---------------------------------------------------------------------------

interface OverdueOrder {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly status: string
  readonly expected_delivery: Date
  readonly requester_id: string
  readonly requester_name: string
  readonly vendor_name: string | null
}

interface StaleApproval {
  readonly request_id: string
  readonly request_code: string
  readonly request_title: string
  readonly requester_id: string
  readonly requester_name: string
  readonly created_at: Date
  readonly approver_id: string
  readonly approver_name: string
}

interface UnreconciledInvoice {
  readonly id: string
  readonly invoice_number: string
  readonly supplier_name: string
  readonly total_amount: number
  readonly received_at: Date
  readonly reconciliation_status: string
}

async function fetchOverdueOrders(): Promise<readonly OverdueOrder[]> {
  const now = new Date()
  const orders = await prisma.purchaseRequest.findMany({
    where: {
      status: { in: ['ORDERED', 'SHIPPED'] },
      expected_delivery: { lt: now },
    },
    include: {
      requester: { select: { name: true } },
      vendor: { select: { name: true } },
    },
    orderBy: { expected_delivery: 'asc' },
    take: 50,
  })

  return orders.map((o) => ({
    id: o.id,
    code: o.code,
    title: o.title,
    status: o.status,
    expected_delivery: o.expected_delivery!,
    requester_id: o.requester_id,
    requester_name: o.requester.name,
    vendor_name: o.vendor?.name ?? null,
  }))
}

async function fetchStaleApprovals(): Promise<readonly StaleApproval[]> {
  const cutoff = new Date(
    Date.now() - STALE_APPROVAL_DAYS * 24 * 60 * 60 * 1000,
  )
  const approvals = await prisma.approval.findMany({
    where: {
      status: 'PENDING',
      created_at: { lt: cutoff },
    },
    select: {
      request_id: true,
      created_at: true,
      approver_id: true,
      approver: { select: { name: true } },
      request: {
        select: {
          code: true,
          title: true,
          requester_id: true,
          requester: { select: { name: true } },
        },
      },
    },
    orderBy: { created_at: 'asc' },
    take: 50,
  })

  return approvals.map((a) => ({
    request_id: a.request_id,
    request_code: a.request.code,
    request_title: a.request.title,
    requester_id: a.request.requester_id,
    requester_name: a.request.requester.name,
    created_at: a.created_at,
    approver_id: a.approver_id,
    approver_name: a.approver.name,
  }))
}

async function fetchUnreconciledInvoices(): Promise<
  readonly UnreconciledInvoice[]
> {
  const cutoff = new Date(
    Date.now() - UNRECONCILED_INVOICE_DAYS * 24 * 60 * 60 * 1000,
  )
  const invoices = await prisma.invoice.findMany({
    where: {
      tenant_id: DEFAULT_TENANT,
      reconciliation_status: 'PENDING',
      received_at: { lt: cutoff },
    },
    select: {
      id: true,
      invoice_number: true,
      supplier_name: true,
      total_amount: true,
      received_at: true,
      reconciliation_status: true,
    },
    orderBy: { received_at: 'asc' },
    take: 50,
  })

  return invoices.map((inv) => ({
    id: inv.id,
    invoice_number: inv.invoice_number,
    supplier_name: inv.supplier_name,
    total_amount: Number(inv.total_amount),
    received_at: inv.received_at,
    reconciliation_status: inv.reconciliation_status,
  }))
}

// ---------------------------------------------------------------------------
// Tool Helpers
// ---------------------------------------------------------------------------

function getComplianceAgentTools(): readonly ZodTool[] {
  return [
    searchRequestsTool,
    getRequestDetailTool,
    getBudgetOverviewTool,
    searchInvoicesTool,
    ...NOTIFICATION_TOOLS,
  ] as readonly ZodTool[]
}

function toBetaTools(tools: readonly ZodTool[]): Anthropic.Beta.BetaTool[] {
  return tools.map((t) => ({
    type: 'custom' as const,
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))
}

async function executeTool(
  tools: readonly ZodTool[],
  toolName: string,
  rawInput: unknown,
): Promise<string> {
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

// ---------------------------------------------------------------------------
// Result Parser
// ---------------------------------------------------------------------------

function parseAgentResult(
  text: string,
  notificationCount: number,
): ComplianceCheckResult {
  const jsonMatch = text.match(/\{[\s\S]*"alerts_found"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      return {
        alerts_found:
          typeof parsed.alerts_found === 'number' ? parsed.alerts_found : 0,
        notifications_sent:
          typeof parsed.notifications_sent === 'number'
            ? parsed.notifications_sent
            : notificationCount,
        summary:
          typeof parsed.summary === 'string'
            ? parsed.summary
            : 'Controllo compliance completato',
        alerts: [],
      }
    } catch {
      // Fall through to default
    }
  }

  return {
    alerts_found: 0,
    notifications_sent: notificationCount,
    summary: text.slice(0, 500) || 'Nessun riepilogo disponibile',
    alerts: [],
  }
}

// ---------------------------------------------------------------------------
// Context Builder
// ---------------------------------------------------------------------------

function buildContextMessage(
  overdueOrders: readonly OverdueOrder[],
  staleApprovals: readonly StaleApproval[],
  unreconciledInvoices: readonly UnreconciledInvoice[],
  adminUserId: string,
): string {
  const sections: string[] = [
    `Data corrente: ${new Date().toISOString()}`,
    `Admin user_id (per notifiche budget/fatture): ${adminUserId}`,
    '',
  ]

  // Overdue orders
  sections.push(`--- ORDINI SCADUTI (${overdueOrders.length}) ---`)
  if (overdueOrders.length === 0) {
    sections.push('Nessun ordine scaduto trovato.')
  } else {
    for (const order of overdueOrders) {
      const daysOverdue = Math.floor(
        (Date.now() - order.expected_delivery.getTime()) /
          (24 * 60 * 60 * 1000),
      )
      sections.push(
        `- ${order.code}: "${order.title}" | Stato: ${order.status} | ` +
          `Scaduto da ${daysOverdue} giorni (${order.expected_delivery.toISOString().slice(0, 10)}) | ` +
          `Richiedente: ${order.requester_name} (user_id: ${order.requester_id}) | ` +
          `Fornitore: ${order.vendor_name ?? 'N/D'}`,
      )
    }
  }

  sections.push('')

  // Stale approvals
  sections.push(
    `--- APPROVAZIONI IN ATTESA > ${STALE_APPROVAL_DAYS} GIORNI (${staleApprovals.length}) ---`,
  )
  if (staleApprovals.length === 0) {
    sections.push('Nessuna approvazione stale trovata.')
  } else {
    for (const approval of staleApprovals) {
      const daysWaiting = Math.floor(
        (Date.now() - approval.created_at.getTime()) / (24 * 60 * 60 * 1000),
      )
      sections.push(
        `- ${approval.request_code}: "${approval.request_title}" | ` +
          `In attesa da ${daysWaiting} giorni | ` +
          `Richiedente: ${approval.requester_name} (user_id: ${approval.requester_id}) | ` +
          `Approvatore: ${approval.approver_name} (user_id: ${approval.approver_id})`,
      )
    }
  }

  sections.push('')

  // Unreconciled invoices
  sections.push(
    `--- FATTURE NON RICONCILIATE > ${UNRECONCILED_INVOICE_DAYS} GIORNI (${unreconciledInvoices.length}) ---`,
  )
  if (unreconciledInvoices.length === 0) {
    sections.push('Nessuna fattura non riconciliata trovata.')
  } else {
    for (const inv of unreconciledInvoices) {
      const daysUnreconciled = Math.floor(
        (Date.now() - inv.received_at.getTime()) / (24 * 60 * 60 * 1000),
      )
      sections.push(
        `- Fattura ${inv.invoice_number}: ${inv.supplier_name} | ` +
          `Importo: EUR ${inv.total_amount.toFixed(2)} | ` +
          `Ricevuta ${daysUnreconciled} giorni fa (${inv.received_at.toISOString().slice(0, 10)})`,
      )
    }
  }

  sections.push('')
  sections.push(
    'NOTA: Per i dati BUDGET, usa il tool get_budget_overview per ottenere lo stato aggiornato.',
  )
  sections.push('')
  sections.push(
    'Analizza tutti i problemi trovati, crea le notifiche necessarie, e concludi con il riepilogo JSON.',
  )

  return sections.join('\n')
}

// ---------------------------------------------------------------------------
// Main function — runComplianceCheck
// ---------------------------------------------------------------------------

/**
 * Runs the compliance monitor agent.
 *
 * The agent:
 * 1. Pre-fetches overdue orders, stale approvals, unreconciled invoices
 * 2. Injects pre-fetched data as context in the first message
 * 3. Uses tools (budget overview, notifications) in a manual tool loop
 * 4. Returns alerts_found, notifications_sent, and summary
 */
export async function runComplianceCheck(
  adminUserId: string,
): Promise<ComplianceCheckResult> {
  // Pre-fetch data concurrently
  const [overdueOrders, staleApprovals, unreconciledInvoices] =
    await Promise.all([
      fetchOverdueOrders(),
      fetchStaleApprovals(),
      fetchUnreconciledInvoices(),
    ])

  const tools = getComplianceAgentTools()
  const betaTools = toBetaTools(tools)
  const client = getClaudeClient()

  let notificationCount = 0

  const contextMessage = buildContextMessage(
    overdueOrders,
    staleApprovals,
    unreconciledInvoices,
    adminUserId,
  )

  let conversationMessages: Anthropic.Beta.BetaMessageParam[] = [
    { role: 'user' as const, content: contextMessage },
  ]

  let lastTextContent = ''

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: Anthropic.Beta.BetaMessage

    try {
      response = await client.beta.messages.create({
        model: AGENT_MODEL,
        system: COMPLIANCE_SYSTEM_PROMPT,
        messages: conversationMessages,
        max_tokens: MAX_TOKENS,
        tools: betaTools,
      })
    } catch (err) {
      return {
        alerts_found: 0,
        notifications_sent: notificationCount,
        summary: `Errore nella chiamata AI: ${String(err)}`,
        alerts: [],
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

        const toolResult = await executeTool(tools, toolName, toolInput)

        if (toolName === 'create_notification') {
          notificationCount += 1
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: toolResult,
        })
      }
    }

    // No tool calls means the model finished its response
    if (!hasToolUse) {
      return parseAgentResult(lastTextContent, notificationCount)
    }

    // Feed tool results back for the next round
    conversationMessages = [
      ...conversationMessages,
      { role: 'assistant' as const, content: response.content },
      { role: 'user' as const, content: toolResults },
    ]
  }

  // Max rounds reached
  const parsed = parseAgentResult(lastTextContent, notificationCount)
  return {
    ...parsed,
    summary: `${parsed.summary} (limite iterazioni raggiunto)`,
  }
}
