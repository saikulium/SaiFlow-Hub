import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import type Anthropic from '@anthropic-ai/sdk'
import type { ActionPreview } from '@/types/ai'

// ---------------------------------------------------------------------------
// Custom type for betaZodTool return value (BetaTool + run + parse)
// ---------------------------------------------------------------------------

/**
 * A tool created by betaZodTool: has `name`, `description`, `input_schema`,
 * `run`, and `parse`. We model this as a plain object type instead of trying
 * to match the complex BetaRunnableTool union.
 */
export type ZodTool = {
  name: string
  description?: string
  input_schema: Anthropic.Beta.BetaTool.InputSchema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: (args: any) => any
  parse: (content: unknown) => unknown
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RESULTS = 20
const DEFAULT_TENANT = 'default'

// ---------------------------------------------------------------------------
// Shared Zod fragments
// ---------------------------------------------------------------------------

const pageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_RESULTS)
  .optional()
  .describe('Numero massimo di risultati (default 10, max 20)')

const requestStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'ORDERED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'ON_HOLD',
  'INVOICED',
  'RECONCILED',
  'CLOSED',
])

const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])

const vendorStatusEnum = z.enum([
  'ACTIVE',
  'INACTIVE',
  'BLACKLISTED',
  'PENDING_REVIEW',
])

const matchStatusEnum = z.enum([
  'UNMATCHED',
  'AUTO_MATCHED',
  'MANUAL_MATCHED',
  'SUGGESTED',
])

const reconciliationStatusEnum = z.enum([
  'PENDING',
  'APPROVED',
  'DISPUTED',
  'REJECTED',
])

// ---------------------------------------------------------------------------
// Tool metadata (permission + min role)
// ---------------------------------------------------------------------------

export type ToolPermissionLevel = 'READ' | 'WRITE'
export type UserRole = 'VIEWER' | 'REQUESTER' | 'MANAGER' | 'ADMIN'

interface ToolMeta {
  readonly permissionLevel: ToolPermissionLevel
  readonly minRole: UserRole
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  VIEWER: 0,
  REQUESTER: 1,
  MANAGER: 2,
  ADMIN: 3,
}

const TOOL_META: Record<string, ToolMeta> = {
  search_requests: { permissionLevel: 'READ', minRole: 'VIEWER' },
  get_request_detail: { permissionLevel: 'READ', minRole: 'VIEWER' },
  search_vendors: { permissionLevel: 'READ', minRole: 'VIEWER' },
  get_budget_overview: { permissionLevel: 'READ', minRole: 'VIEWER' },
  get_invoice_stats: { permissionLevel: 'READ', minRole: 'VIEWER' },
  search_invoices: { permissionLevel: 'READ', minRole: 'VIEWER' },
  get_inventory_stats: { permissionLevel: 'READ', minRole: 'VIEWER' },
  get_tender_stats: { permissionLevel: 'READ', minRole: 'VIEWER' },
  create_request: { permissionLevel: 'WRITE', minRole: 'REQUESTER' },
  approve_request: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
}

// ---------------------------------------------------------------------------
// READ Tools
// ---------------------------------------------------------------------------

export const searchRequestsTool = betaZodTool({
  name: 'search_requests',
  description:
    'Cerca richieste di acquisto (Purchase Requests). Usa per domande su richieste, ordini, stato ordini, spese.',
  inputSchema: z.object({
    status: requestStatusEnum.optional().describe('Filtra per stato'),
    priority: priorityEnum.optional().describe('Filtra per priorita'),
    search: z
      .string()
      .optional()
      .describe('Ricerca testo libero su codice o titolo'),
    pageSize: pageSizeSchema,
  }),
  run: async (input) => {
    const pageSize = Math.min(input.pageSize ?? 10, MAX_RESULTS)
    const where: Record<string, unknown> = { tenant_id: DEFAULT_TENANT }
    if (input.status) where.status = input.status
    if (input.priority) where.priority = input.priority
    if (input.search) {
      where.OR = [
        { code: { contains: input.search, mode: 'insensitive' } },
        { title: { contains: input.search, mode: 'insensitive' } },
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
  },
})

export const getRequestDetailTool = betaZodTool({
  name: 'get_request_detail',
  description:
    'Ottieni dettaglio completo di una singola richiesta per codice (es: PR-2025-00001). Include items, fornitore, timeline.',
  inputSchema: z.object({
    code: z.string().describe('Codice richiesta (formato PR-YYYY-NNNNN)'),
  }),
  run: async (input) => {
    const request = await prisma.purchaseRequest.findUnique({
      where: { code: input.code },
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
    if (!request) {
      return JSON.stringify({
        error: `Richiesta ${input.code} non trovata`,
      })
    }
    return JSON.stringify(request)
  },
})

export const searchVendorsTool = betaZodTool({
  name: 'search_vendors',
  description:
    'Cerca fornitori per nome, stato, o categoria. Usa per domande su fornitori, chi fornisce cosa.',
  inputSchema: z.object({
    search: z.string().optional().describe('Ricerca per nome fornitore'),
    status: vendorStatusEnum.optional().describe('Filtra per stato fornitore'),
    pageSize: pageSizeSchema,
  }),
  run: async (input) => {
    const pageSize = Math.min(input.pageSize ?? 10, MAX_RESULTS)
    const where: Record<string, unknown> = {}
    if (input.status) where.status = input.status
    if (input.search) {
      where.name = { contains: input.search, mode: 'insensitive' }
    }
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
  },
})

export const getBudgetOverviewTool = betaZodTool({
  name: 'get_budget_overview',
  description:
    'Ottieni panoramica budget per centro di costo o dipartimento. Mostra allocato, speso, impegnato, disponibile.',
  inputSchema: z.object({
    cost_center: z.string().optional().describe('Filtra per centro di costo'),
    department: z.string().optional().describe('Filtra per dipartimento'),
    is_active: z
      .boolean()
      .optional()
      .describe('Solo budget attivi (default true)'),
  }),
  run: async (input) => {
    const where: Record<string, unknown> = {}
    if (input.cost_center) {
      where.cost_center = { contains: input.cost_center, mode: 'insensitive' }
    }
    if (input.department) {
      where.department = { contains: input.department, mode: 'insensitive' }
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
  },
})

export const getInvoiceStatsTool = betaZodTool({
  name: 'get_invoice_stats',
  description:
    'Statistiche fatture: totali, non matchate, in riconciliazione, contestate, importi.',
  inputSchema: z.object({}),
  run: async () => {
    const [total, unmatched, pending, disputed, amounts] =
      await prisma.$transaction([
        prisma.invoice.count({ where: { tenant_id: DEFAULT_TENANT } }),
        prisma.invoice.count({
          where: { tenant_id: DEFAULT_TENANT, match_status: 'UNMATCHED' },
        }),
        prisma.invoice.count({
          where: {
            tenant_id: DEFAULT_TENANT,
            reconciliation_status: 'PENDING',
          },
        }),
        prisma.invoice.count({
          where: {
            tenant_id: DEFAULT_TENANT,
            reconciliation_status: 'DISPUTED',
          },
        }),
        prisma.invoice.aggregate({
          where: { tenant_id: DEFAULT_TENANT },
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
  },
})

export const searchInvoicesTool = betaZodTool({
  name: 'search_invoices',
  description:
    'Cerca fatture con filtri. Usa per domande su fatture specifiche, per fornitore, per stato.',
  inputSchema: z.object({
    search: z
      .string()
      .optional()
      .describe('Ricerca per numero fattura o fornitore'),
    match_status: matchStatusEnum
      .optional()
      .describe('Filtra per stato di matching'),
    reconciliation_status: reconciliationStatusEnum
      .optional()
      .describe('Filtra per stato riconciliazione'),
    pageSize: pageSizeSchema,
  }),
  run: async (input) => {
    const pageSize = Math.min(input.pageSize ?? 10, MAX_RESULTS)
    const where: Record<string, unknown> = { tenant_id: DEFAULT_TENANT }
    if (input.match_status) where.match_status = input.match_status
    if (input.reconciliation_status) {
      where.reconciliation_status = input.reconciliation_status
    }
    if (input.search) {
      where.OR = [
        {
          invoice_number: { contains: input.search, mode: 'insensitive' },
        },
        {
          supplier_name: { contains: input.search, mode: 'insensitive' },
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
  },
})

export const getInventoryStatsTool = betaZodTool({
  name: 'get_inventory_stats',
  description:
    'Statistiche magazzino: materiali totali, valore, scorte basse, movimenti recenti.',
  inputSchema: z.object({}),
  run: async () => {
    const [totalMaterials, activeMaterials, recentMovements, totalCostAgg] =
      await prisma.$transaction([
        prisma.material.count(),
        prisma.material.count({ where: { is_active: true } }),
        prisma.stockMovement.count({
          where: {
            created_at: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
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
  },
})

export const getTenderStatsTool = betaZodTool({
  name: 'get_tender_stats',
  description:
    'Statistiche gare: attive, valore pipeline, scadenze imminenti, tasso di vittoria.',
  inputSchema: z.object({}),
  run: async () => {
    const activeStatuses = [
      'EVALUATING',
      'GO',
      'PREPARING',
      'SUBMITTED',
      'UNDER_EVALUATION',
    ] as const
    const [active, totalValue, upcoming] = await prisma.$transaction([
      prisma.tender.count({
        where: { status: { in: [...activeStatuses] } },
      }),
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
  },
})

// ---------------------------------------------------------------------------
// WRITE Tool schemas (run logic is in agent, not auto-executed)
// ---------------------------------------------------------------------------

const requestItemSchema = z.object({
  name: z.string().describe('Nome articolo'),
  quantity: z.number().int().min(1).describe('Quantita'),
  unit: z.string().optional().describe('Unita di misura (pz, kg, m, etc.)'),
  unit_price: z.number().optional().describe('Prezzo unitario'),
})

export const createRequestInputSchema = z.object({
  title: z.string().describe('Titolo della richiesta'),
  description: z.string().optional().describe('Descrizione dettagliata'),
  vendor_id: z.string().optional().describe('ID del fornitore'),
  priority: priorityEnum.optional().describe('Priorita'),
  needed_by: z.string().optional().describe('Data necessita (ISO 8601)'),
  category: z.string().optional(),
  department: z.string().optional(),
  cost_center: z.string().optional(),
  budget_code: z.string().optional(),
  items: z.array(requestItemSchema).optional().describe('Articoli'),
})

export type CreateRequestInput = z.infer<typeof createRequestInputSchema>

export const approveRequestInputSchema = z.object({
  request_id: z.string().describe('ID della richiesta da approvare'),
  notes: z.string().optional().describe('Note di approvazione opzionali'),
})

export type ApproveRequestInput = z.infer<typeof approveRequestInputSchema>

// We build betaZodTool definitions for WRITE tools, but their `run` function
// is a placeholder: the agent loop intercepts write tools BEFORE execution.
// The real execution happens in `executeWriteTool` below.

export const createRequestTool = betaZodTool({
  name: 'create_request',
  description: "Crea una nuova richiesta d'acquisto.",
  inputSchema: createRequestInputSchema,
  run: async () => {
    // Placeholder: never called directly by toolRunner
    return JSON.stringify({ error: 'Write tools require confirmation' })
  },
})

export const approveRequestTool = betaZodTool({
  name: 'approve_request',
  description: 'Approva una richiesta in attesa di approvazione.',
  inputSchema: approveRequestInputSchema,
  run: async () => {
    // Placeholder: never called directly by toolRunner
    return JSON.stringify({ error: 'Write tools require confirmation' })
  },
})

// ---------------------------------------------------------------------------
// All tools collection
// ---------------------------------------------------------------------------

export const ALL_TOOLS = [
  searchRequestsTool,
  getRequestDetailTool,
  searchVendorsTool,
  getBudgetOverviewTool,
  getInvoiceStatsTool,
  searchInvoicesTool,
  getInventoryStatsTool,
  getTenderStatsTool,
  createRequestTool,
  approveRequestTool,
] as readonly ZodTool[]

// ---------------------------------------------------------------------------
// Role-based tool filtering
// ---------------------------------------------------------------------------

export function getToolsForRole(role: UserRole): readonly ZodTool[] {
  const roleLevel = ROLE_HIERARCHY[role]
  return ALL_TOOLS.filter((tool) => {
    const meta = TOOL_META[tool.name]
    if (!meta) return false
    return ROLE_HIERARCHY[meta.minRole] <= roleLevel
  })
}

export function isWriteTool(toolName: string): boolean {
  const meta = TOOL_META[toolName]
  return meta?.permissionLevel === 'WRITE'
}

// ---------------------------------------------------------------------------
// Action Preview Generation
// ---------------------------------------------------------------------------

export function generateActionPreview(
  toolName: string,
  params: Record<string, unknown>,
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
          { key: 'Priorita', value: String(params.priority ?? 'MEDIUM') },
          ...(Array.isArray(params.items)
            ? [{ key: 'Articoli', value: `${params.items.length} articoli` }]
            : []),
        ],
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
    default:
      return { label: toolName, fields: [] }
  }
}

// ---------------------------------------------------------------------------
// Write Tool Executors (called after user confirmation)
// ---------------------------------------------------------------------------

function generateRequestCode(): string {
  const year = new Date().getFullYear()
  const bytes = new Uint32Array(1)
  globalThis.crypto.getRandomValues(bytes)
  const seq = String((bytes[0]! % 99999) + 1).padStart(5, '0')
  return `PR-${year}-${seq}`
}

async function executeCreateRequest(
  params: CreateRequestInput,
  userId: string,
): Promise<unknown> {
  const items = params.items ?? []
  const estimatedAmount = items.reduce((sum, item) => {
    const qty = item.quantity
    const price = item.unit_price ?? 0
    return sum + qty * price
  }, 0)

  return prisma.purchaseRequest.create({
    data: {
      code: generateRequestCode(),
      title: params.title,
      description: params.description,
      status: 'DRAFT',
      priority: params.priority ?? 'MEDIUM',
      requester_id: userId,
      vendor_id: params.vendor_id,
      estimated_amount: estimatedAmount > 0 ? estimatedAmount : undefined,
      needed_by: params.needed_by ? new Date(params.needed_by) : undefined,
      category: params.category,
      department: params.department,
      cost_center: params.cost_center,
      budget_code: params.budget_code,
      items:
        items.length > 0
          ? {
              createMany: {
                data: items.map((item) => ({
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit,
                  unit_price: item.unit_price,
                  total_price: item.unit_price
                    ? item.quantity * item.unit_price
                    : undefined,
                })),
              },
            }
          : undefined,
    },
  })
}

async function executeApproveRequest(
  params: ApproveRequestInput,
  userId: string,
): Promise<unknown> {
  // Verify request exists and is in PENDING_APPROVAL status
  const request = await prisma.purchaseRequest.findUnique({
    where: { id: params.request_id },
    select: { id: true, status: true, requester_id: true },
  })

  if (!request) {
    throw new Error('Richiesta non trovata')
  }

  if (request.status !== 'PENDING_APPROVAL') {
    throw new Error(
      `Richiesta non in stato PENDING_APPROVAL (stato attuale: ${request.status})`,
    )
  }

  // Prevent self-approval
  if (request.requester_id === userId) {
    throw new Error('Non è possibile approvare le proprie richieste')
  }

  // Check for duplicate approval
  const existingApproval = await prisma.approval.findFirst({
    where: { request_id: params.request_id, approver_id: userId },
  })

  if (existingApproval) {
    throw new Error('Questa richiesta è già stata approvata da questo utente')
  }

  const [approval] = await prisma.$transaction([
    prisma.approval.create({
      data: {
        request_id: params.request_id,
        approver_id: userId,
        status: 'APPROVED',
        decision_at: new Date(),
        notes: params.notes,
      },
    }),
    prisma.purchaseRequest.update({
      where: { id: params.request_id },
      data: { status: 'APPROVED' },
    }),
  ])
  return approval
}

const WRITE_EXECUTORS: Record<
  string,
  (params: Record<string, unknown>, userId: string) => Promise<unknown>
> = {
  create_request: (params, userId) =>
    executeCreateRequest(params as CreateRequestInput, userId),
  approve_request: (params, userId) =>
    executeApproveRequest(params as ApproveRequestInput, userId),
}

export async function executeWriteTool(
  toolName: string,
  params: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const executor = WRITE_EXECUTORS[toolName]
  if (!executor) {
    throw new Error(`Write tool sconosciuto: ${toolName}`)
  }
  return executor(params, userId)
}
