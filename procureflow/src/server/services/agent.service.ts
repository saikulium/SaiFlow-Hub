import type Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { callClaude } from '@/lib/ai/claude-client'
import { AGENT_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { getToolsForRole, isWriteTool } from '@/lib/ai/tool-registry'
import type { UserRole } from '@/lib/ai/tool-registry'
import { storePendingAction } from '@/lib/ai/pending-actions'
import type {
  AgentStreamEvent,
  ActionPreview,
  ToolDefinition,
} from '@/types/ai'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOOL_ROUNDS = 3
const MAX_RESULTS = 20

type ToolInput = Record<string, unknown>

// ---------------------------------------------------------------------------
// READ Tool Handlers (identical Prisma queries to chat.service.ts)
// ---------------------------------------------------------------------------

async function toolSearchRequests(input: ToolInput): Promise<string> {
  const pageSize = Math.min(Number(input.pageSize) || 10, MAX_RESULTS)
  const where: Record<string, unknown> = { tenant_id: 'default' }
  if (input.status) where.status = input.status
  if (input.priority) where.priority = input.priority
  if (input.search) {
    where.OR = [
      { code: { contains: String(input.search), mode: 'insensitive' } },
      { title: { contains: String(input.search), mode: 'insensitive' } },
    ]
  }
  const [requests, total] = await prisma.$transaction([
    prisma.purchaseRequest.findMany({
      where,
      select: {
        code: true,
        title: true,
        status: true,
        priority: true,
        estimated_amount: true,
        actual_amount: true,
        currency: true,
        created_at: true,
        needed_by: true,
        vendor: { select: { name: true } },
        requester: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: pageSize,
    }),
    prisma.purchaseRequest.count({ where }),
  ])
  return JSON.stringify({ total, results: requests })
}

async function toolGetRequestDetail(input: ToolInput): Promise<string> {
  const code = String(input.code)
  const request = await prisma.purchaseRequest.findUnique({
    where: { code },
    select: {
      code: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      estimated_amount: true,
      actual_amount: true,
      currency: true,
      created_at: true,
      needed_by: true,
      ordered_at: true,
      expected_delivery: true,
      delivered_at: true,
      external_ref: true,
      tracking_number: true,
      category: true,
      department: true,
      vendor: { select: { name: true, code: true } },
      requester: { select: { name: true, department: true } },
      items: {
        select: {
          name: true,
          quantity: true,
          unit: true,
          unit_price: true,
          total_price: true,
        },
      },
      timeline: {
        select: { type: true, title: true, created_at: true },
        orderBy: { created_at: 'desc' },
        take: 5,
      },
    },
  })
  if (!request)
    return JSON.stringify({ error: `Richiesta ${code} non trovata` })
  return JSON.stringify(request)
}

async function toolSearchVendors(input: ToolInput): Promise<string> {
  const pageSize = Math.min(Number(input.pageSize) || 10, MAX_RESULTS)
  const where: Record<string, unknown> = {}
  if (input.status) where.status = input.status
  if (input.search)
    where.name = { contains: String(input.search), mode: 'insensitive' }
  const [vendors, total] = await prisma.$transaction([
    prisma.vendor.findMany({
      where,
      select: {
        name: true,
        code: true,
        status: true,
        email: true,
        category: true,
        payment_terms: true,
        rating: true,
        _count: { select: { requests: true } },
      },
      orderBy: { name: 'asc' },
      take: pageSize,
    }),
    prisma.vendor.count({ where }),
  ])
  return JSON.stringify({ total, results: vendors })
}

async function toolGetBudgetOverview(input: ToolInput): Promise<string> {
  const where: Record<string, unknown> = {}
  if (input.cost_center)
    where.cost_center = {
      contains: String(input.cost_center),
      mode: 'insensitive',
    }
  if (input.department)
    where.department = {
      contains: String(input.department),
      mode: 'insensitive',
    }
  if (input.is_active !== false) where.is_active = true
  const budgets = await prisma.budget.findMany({
    where,
    select: {
      id: true,
      cost_center: true,
      department: true,
      period_type: true,
      allocated_amount: true,
      alert_threshold_percent: true,
      is_active: true,
      period_start: true,
      period_end: true,
      snapshots: {
        select: { spent: true, committed: true, available: true },
        orderBy: { computed_at: 'desc' },
        take: 1,
      },
    },
    orderBy: { cost_center: 'asc' },
    take: MAX_RESULTS,
  })
  const enriched = budgets.map((b) => {
    const allocated = Number(b.allocated_amount)
    const snapshot = b.snapshots[0]
    const spent = snapshot ? Number(snapshot.spent) : 0
    const committed = snapshot ? Number(snapshot.committed) : 0
    const available = allocated - spent - committed
    const usagePercent =
      allocated > 0 ? Math.round(((spent + committed) / allocated) * 100) : 0
    return {
      cost_center: b.cost_center,
      department: b.department,
      period_type: b.period_type,
      allocated_amount: allocated,
      spent,
      committed,
      available,
      usagePercent,
      isOverBudget: available < 0,
      isWarning: usagePercent >= b.alert_threshold_percent,
    }
  })
  return JSON.stringify({ total: budgets.length, results: enriched })
}

async function toolGetInvoiceStats(): Promise<string> {
  const [total, unmatched, pending, disputed, amounts] =
    await prisma.$transaction([
      prisma.invoice.count({ where: { tenant_id: 'default' } }),
      prisma.invoice.count({
        where: { tenant_id: 'default', match_status: 'UNMATCHED' },
      }),
      prisma.invoice.count({
        where: { tenant_id: 'default', reconciliation_status: 'PENDING' },
      }),
      prisma.invoice.count({
        where: { tenant_id: 'default', reconciliation_status: 'DISPUTED' },
      }),
      prisma.invoice.aggregate({
        where: { tenant_id: 'default' },
        _sum: { total_amount: true },
      }),
    ])
  return JSON.stringify({
    totalInvoices: total,
    unmatchedInvoices: unmatched,
    pendingReconciliation: pending,
    disputedInvoices: disputed,
    totalInvoicedAmount: Number(amounts._sum.total_amount ?? 0),
  })
}

async function toolSearchInvoices(input: ToolInput): Promise<string> {
  const pageSize = Math.min(Number(input.pageSize) || 10, MAX_RESULTS)
  const where: Record<string, unknown> = { tenant_id: 'default' }
  if (input.match_status) where.match_status = input.match_status
  if (input.reconciliation_status)
    where.reconciliation_status = input.reconciliation_status
  if (input.search) {
    where.OR = [
      {
        invoice_number: { contains: String(input.search), mode: 'insensitive' },
      },
      {
        supplier_name: { contains: String(input.search), mode: 'insensitive' },
      },
    ]
  }
  const [invoices, total] = await prisma.$transaction([
    prisma.invoice.findMany({
      where,
      select: {
        invoice_number: true,
        invoice_date: true,
        supplier_name: true,
        total_amount: true,
        match_status: true,
        reconciliation_status: true,
        pr_code_extracted: true,
      },
      orderBy: { received_at: 'desc' },
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ])
  return JSON.stringify({ total, results: invoices })
}

async function toolGetInventoryStats(): Promise<string> {
  const [totalMaterials, activeMaterials, recentMovements, totalCostAgg] =
    await prisma.$transaction([
      prisma.material.count(),
      prisma.material.count({ where: { is_active: true } }),
      prisma.stockMovement.count({
        where: {
          created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.material.aggregate({
        where: { is_active: true },
        _sum: { unit_cost: true },
      }),
    ])
  return JSON.stringify({
    totalMaterials,
    activeMaterials,
    recentMovements7d: recentMovements,
    totalUnitCostSum: Number(totalCostAgg._sum?.unit_cost ?? 0),
  })
}

async function toolGetTenderStats(): Promise<string> {
  const activeStatuses = [
    'EVALUATING',
    'GO',
    'PREPARING',
    'SUBMITTED',
    'UNDER_EVALUATION',
  ] as const
  const [active, totalValue, upcoming] = await prisma.$transaction([
    prisma.tender.count({ where: { status: { in: [...activeStatuses] } } }),
    prisma.tender.aggregate({
      where: { status: { in: [...activeStatuses] } },
      _sum: { base_amount: true },
    }),
    prisma.tender.count({
      where: {
        status: { in: [...activeStatuses] },
        submission_deadline: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ])
  return JSON.stringify({
    activeTenders: active,
    pipelineValue: Number(totalValue._sum?.base_amount ?? 0),
    upcomingDeadlines7d: upcoming,
  })
}

// ---------------------------------------------------------------------------
// READ Tool executor map
// ---------------------------------------------------------------------------

const READ_TOOL_EXECUTORS: Record<
  string,
  (input: ToolInput) => Promise<string>
> = {
  search_requests: toolSearchRequests,
  get_request_detail: toolGetRequestDetail,
  search_vendors: toolSearchVendors,
  get_budget_overview: toolGetBudgetOverview,
  get_invoice_stats: toolGetInvoiceStats,
  search_invoices: toolSearchInvoices,
  get_inventory_stats: toolGetInventoryStats,
  get_tender_stats: toolGetTenderStats,
}

// ---------------------------------------------------------------------------
// WRITE Tool Handlers
// ---------------------------------------------------------------------------

function generateRequestCode(): string {
  const year = new Date().getFullYear()
  const seq = String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0')
  return `PR-${year}-${seq}`
}

async function writeCreateRequest(
  params: ToolInput,
  userId: string,
): Promise<unknown> {
  const items = Array.isArray(params.items) ? params.items : []
  const estimatedAmount = items.reduce(
    (sum: number, item: Record<string, unknown>) => {
      const qty = Number(item.quantity) || 0
      const price = Number(item.unit_price) || 0
      return sum + qty * price
    },
    0,
  )

  return prisma.purchaseRequest.create({
    data: {
      code: generateRequestCode(),
      title: String(params.title),
      description: params.description ? String(params.description) : undefined,
      status: 'DRAFT',
      priority: (params.priority ?? 'MEDIUM') as
        | 'LOW'
        | 'MEDIUM'
        | 'HIGH'
        | 'URGENT',
      requester_id: userId,
      vendor_id: params.vendor_id ? String(params.vendor_id) : undefined,
      estimated_amount: estimatedAmount > 0 ? estimatedAmount : undefined,
      needed_by: params.needed_by
        ? new Date(String(params.needed_by))
        : undefined,
      category: params.category ? String(params.category) : undefined,
      department: params.department ? String(params.department) : undefined,
      cost_center: params.cost_center ? String(params.cost_center) : undefined,
      budget_code: params.budget_code ? String(params.budget_code) : undefined,
      items:
        items.length > 0
          ? {
              createMany: {
                data: items.map((item: Record<string, unknown>) => ({
                  name: String(item.name),
                  quantity: Number(item.quantity) || 1,
                  unit: item.unit ? String(item.unit) : undefined,
                  unit_price: item.unit_price
                    ? Number(item.unit_price)
                    : undefined,
                  total_price: item.unit_price
                    ? (Number(item.quantity) || 1) * Number(item.unit_price)
                    : undefined,
                })),
              },
            }
          : undefined,
    },
  })
}

async function writeUpdateRequest(
  params: ToolInput,
  _userId: string,
): Promise<unknown> {
  const data: Record<string, unknown> = {}
  if (params.title !== undefined) data.title = String(params.title)
  if (params.description !== undefined)
    data.description = String(params.description)
  if (params.priority !== undefined) data.priority = params.priority
  if (params.needed_by !== undefined)
    data.needed_by = new Date(String(params.needed_by))
  if (params.vendor_id !== undefined) data.vendor_id = String(params.vendor_id)
  if (params.category !== undefined) data.category = String(params.category)

  return prisma.purchaseRequest.update({
    where: { id: String(params.request_id) },
    data,
  })
}

async function writeSubmitForApproval(params: ToolInput): Promise<unknown> {
  return prisma.purchaseRequest.update({
    where: { id: String(params.request_id) },
    data: { status: 'PENDING_APPROVAL' },
  })
}

async function writeApproveRequest(
  params: ToolInput,
  userId: string,
): Promise<unknown> {
  const requestId = String(params.request_id)
  const [approval] = await prisma.$transaction([
    prisma.approval.create({
      data: {
        request_id: requestId,
        approver_id: userId,
        status: 'APPROVED',
        decision_at: new Date(),
        notes: params.notes ? String(params.notes) : undefined,
      },
    }),
    prisma.purchaseRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED' },
    }),
  ])
  return approval
}

async function writeCreateVendor(params: ToolInput): Promise<unknown> {
  return prisma.vendor.create({
    data: {
      name: String(params.name),
      code: String(params.code),
      email: params.email ? String(params.email) : undefined,
      phone: params.phone ? String(params.phone) : undefined,
      category: Array.isArray(params.category)
        ? params.category.map(String)
        : [],
      payment_terms: params.payment_terms
        ? String(params.payment_terms)
        : undefined,
    },
  })
}

async function writeBulkUpdate(params: ToolInput): Promise<unknown> {
  const ids = Array.isArray(params.request_ids)
    ? params.request_ids.slice(0, 50).map(String)
    : []
  const data: Record<string, unknown> = {}
  if (params.priority !== undefined) data.priority = params.priority
  if (params.category !== undefined) data.category = String(params.category)
  if (params.department !== undefined)
    data.department = String(params.department)

  return prisma.purchaseRequest.updateMany({
    where: { id: { in: ids } },
    data,
  })
}

const WRITE_TOOL_EXECUTORS: Record<
  string,
  (params: ToolInput, userId: string) => Promise<unknown>
> = {
  create_request: writeCreateRequest,
  update_request: writeUpdateRequest,
  submit_for_approval: writeSubmitForApproval,
  approve_request: writeApproveRequest,
  create_vendor: writeCreateVendor,
  bulk_update: writeBulkUpdate,
}

// ---------------------------------------------------------------------------
// Action Preview Generation
// ---------------------------------------------------------------------------

function generateActionPreview(
  toolName: string,
  params: ToolInput,
): ActionPreview {
  switch (toolName) {
    case 'create_request':
      return {
        label: "Crea richiesta d'acquisto",
        fields: [
          { key: 'Titolo', value: String(params.title ?? '') },
          ...(params.vendor_id
            ? [{ key: 'Fornitore ID', value: String(params.vendor_id) }]
            : []),
          { key: 'Priorità', value: String(params.priority ?? 'MEDIUM') },
          ...(params.items && Array.isArray(params.items)
            ? [{ key: 'Articoli', value: `${params.items.length} articoli` }]
            : []),
        ],
      }
    case 'update_request':
      return {
        label: 'Aggiorna richiesta',
        fields: [
          { key: 'Richiesta', value: String(params.request_id ?? '') },
          ...Object.entries(params)
            .filter(([k]) => k !== 'request_id')
            .map(([k, v]) => ({ key: k, value: String(v) })),
        ],
      }
    case 'submit_for_approval':
      return {
        label: 'Invia per approvazione',
        fields: [{ key: 'Richiesta', value: String(params.request_id ?? '') }],
      }
    case 'approve_request':
      return {
        label: 'Approva richiesta',
        fields: [
          { key: 'Richiesta', value: String(params.request_id ?? '') },
          ...(params.notes
            ? [{ key: 'Note', value: String(params.notes) }]
            : []),
        ],
      }
    case 'create_vendor':
      return {
        label: 'Crea fornitore',
        fields: [
          { key: 'Nome', value: String(params.name ?? '') },
          { key: 'Codice', value: String(params.code ?? '') },
        ],
      }
    case 'bulk_update':
      return {
        label: 'Aggiornamento massivo',
        fields: [
          {
            key: 'Richieste',
            value: `${Array.isArray(params.request_ids) ? params.request_ids.length : 0} selezionate`,
          },
          ...Object.entries(params)
            .filter(([k]) => k !== 'request_ids')
            .map(([k, v]) => ({ key: k, value: String(v) })),
        ],
      }
    default:
      return { label: toolName, fields: [] }
  }
}

// ---------------------------------------------------------------------------
// Convert ToolDefinition[] to Anthropic Tool format
// ---------------------------------------------------------------------------

function toAnthropicTools(tools: readonly ToolDefinition[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }))
}

// ---------------------------------------------------------------------------
// Stream Agent Response (async generator)
// ---------------------------------------------------------------------------

export async function* streamAgentResponse(
  userId: string,
  role: UserRole,
  messages: readonly {
    readonly role: 'user' | 'assistant'
    readonly content: string
  }[],
): AsyncGenerator<AgentStreamEvent> {
  const tools = getToolsForRole(role)
  const anthropicTools = toAnthropicTools(tools)

  let conversationMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: Anthropic.Message

    try {
      response = await callClaude({
        system: AGENT_SYSTEM_PROMPT,
        messages: conversationMessages as ReadonlyArray<{
          readonly role: 'user' | 'assistant'
          readonly content: string
        }>,
        maxTokens: 2048,
        tools: anthropicTools,
        model: AGENT_MODEL,
      })
    } catch (err) {
      yield { type: 'error', message: `Errore AI: ${String(err)}` }
      return
    }

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
    let hasToolUse = false

    for (const block of response.content) {
      if (block.type === 'text') {
        yield { type: 'text', content: block.text }
      } else if (block.type === 'tool_use') {
        hasToolUse = true
        const toolName = block.name
        const toolParams = block.input as ToolInput

        yield { type: 'tool_start', name: toolName }

        // WRITE tool: generate preview, store pending action, yield and stop
        if (isWriteTool(toolName)) {
          const preview = generateActionPreview(toolName, toolParams)
          const actionId = storePendingAction({
            tool: toolName,
            params: toolParams,
            userId,
            preview,
          })
          yield {
            type: 'action_request',
            actionId,
            tool: toolName,
            params: toolParams,
            preview,
          }
          return
        }

        // READ tool: execute silently, feed result back
        const executor = READ_TOOL_EXECUTORS[toolName]
        let toolResult: string

        if (executor) {
          try {
            toolResult = await executor(toolParams)
          } catch (err) {
            toolResult = JSON.stringify({
              error: `Errore nell'esecuzione del tool: ${String(err)}`,
            })
          }
        } else {
          toolResult = JSON.stringify({
            error: `Tool sconosciuto: ${toolName}`,
          })
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: toolResult,
        })

        yield { type: 'tool_end', name: toolName }
      }
    }

    if (!hasToolUse) {
      yield { type: 'done' }
      return
    }

    // Feed tool results back for next round
    conversationMessages = [
      ...conversationMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ]
  }

  // Max rounds reached
  yield {
    type: 'text',
    content:
      '\n\n_Ho raggiunto il limite di iterazioni. Prova a riformulare la domanda in modo più specifico._',
  }
  yield { type: 'done' }
}

// ---------------------------------------------------------------------------
// Execute Write Tool (called by confirm endpoint)
// ---------------------------------------------------------------------------

export async function executeWriteTool(
  toolName: string,
  params: ToolInput,
  userId: string,
): Promise<unknown> {
  const executor = WRITE_TOOL_EXECUTORS[toolName]
  if (!executor) {
    throw new Error(`Write tool sconosciuto: ${toolName}`)
  }
  return executor(params, userId)
}
