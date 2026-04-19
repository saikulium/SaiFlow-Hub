import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import type Anthropic from '@anthropic-ai/sdk'
import type { ActionPreview } from '@/types/ai'
import { assertTransition } from '@/lib/state-machine'
import {
  initiateApprovalWorkflow,
  decideApproval,
} from '@/server/services/approval.service'
import { createNotification } from '@/server/services/notification.service'
import { REQUEST_STATUS_TOOLS } from './request-status.tools'
import { APPROVAL_TOOLS } from './approval.tools'
import { updateVendorTool } from '@/modules/core/vendors'
import {
  updateCommessaStatusTool,
  updateCommessaStatus,
} from '@/modules/core/commesse'
import {
  getTenderDetailTool,
  updateTenderStatusTool,
  decideTenderGoNogoTool,
  validateStatusTransition,
} from '@/modules/core/tenders'
import { disputeInvoiceTool } from '@/modules/core/invoicing'
import { COMMENT_TOOLS } from './comment.tools'
import { ATTACHMENT_TOOLS } from './attachment.tools'
import { getRequestTimelineTool } from './notification.tools'
import { BUDGET_TOOLS } from '@/modules/core/budgets'
import { STOCK_TOOLS } from '@/modules/core/inventory'
import {
  ARTICLE_TOOLS,
  findOrCreateArticleTool,
  linkArticleToRequestItemTool,
} from '@/modules/core/articles'
import {
  PRICE_VARIANCE_TOOLS,
  listPriceVarianceReviewsTool,
  decidePriceVarianceTool,
} from './price-variance.tools'
import { createComment } from '@/server/services/comment.service'
import { createAttachmentRecord } from '@/server/services/attachment.service'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'

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
  cancel_request: { permissionLevel: 'WRITE', minRole: 'REQUESTER' },
  submit_for_approval: { permissionLevel: 'WRITE', minRole: 'REQUESTER' },
  reject_request: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
  put_request_on_hold: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
  resume_request: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
  mark_ordered: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
  mark_delivered: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
  list_pending_approvals: { permissionLevel: 'READ', minRole: 'VIEWER' },
  get_approval_detail: { permissionLevel: 'READ', minRole: 'VIEWER' },
  decide_approval: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
  update_commessa_status: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
  update_vendor: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
  get_tender_detail: { permissionLevel: 'READ', minRole: 'VIEWER' },
  update_tender_status: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
  decide_tender_go_nogo: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
  dispute_invoice: { permissionLevel: 'WRITE', minRole: 'MANAGER' },
  add_comment: { permissionLevel: 'WRITE', minRole: 'REQUESTER' },
  list_comments: { permissionLevel: 'READ', minRole: 'VIEWER' },
  add_attachment: { permissionLevel: 'WRITE', minRole: 'REQUESTER' },
  list_attachments: { permissionLevel: 'READ', minRole: 'VIEWER' },
  get_request_timeline: { permissionLevel: 'READ', minRole: 'VIEWER' },
  list_budgets: { permissionLevel: 'READ', minRole: 'VIEWER' },
  get_stock_for_article: { permissionLevel: 'READ', minRole: 'VIEWER' },
  get_pending_orders_for_material: {
    permissionLevel: 'READ',
    minRole: 'VIEWER',
  },
  list_price_variance_reviews: {
    permissionLevel: 'READ',
    minRole: 'VIEWER',
  },
  decide_price_variance: {
    permissionLevel: 'WRITE',
    minRole: 'MANAGER',
  },
  find_or_create_article: {
    permissionLevel: 'WRITE',
    minRole: 'REQUESTER',
  },
  link_article_to_request_item: {
    permissionLevel: 'WRITE',
    minRole: 'REQUESTER',
  },
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
    // Note: purchase_requests has no tenant_id column — filter removed
    const where: Record<string, unknown> = {}
    if (input.status) where.status = input.status
    if (input.priority) where.priority = input.priority
    if (input.search) {
      where.OR = [
        { code: { contains: input.search, mode: 'insensitive' } },
        { title: { contains: input.search, mode: 'insensitive' } },
        { external_ref: { contains: input.search, mode: 'insensitive' } },
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
          external_ref: true,
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
  article_id: z
    .string()
    .optional()
    .describe(
      "ID articolo dal catalogo (ottenuto da find_or_create_article). Collega la riga RDA all'articolo nel catalogo.",
    ),
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
  commessa_id: z
    .string()
    .optional()
    .describe('ID della commessa a cui associare la richiesta'),
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
  ...REQUEST_STATUS_TOOLS,
  ...APPROVAL_TOOLS,
  updateCommessaStatusTool,
  updateVendorTool,
  getTenderDetailTool,
  updateTenderStatusTool,
  decideTenderGoNogoTool,
  disputeInvoiceTool,
  ...COMMENT_TOOLS,
  ...ATTACHMENT_TOOLS,
  getRequestTimelineTool,
  ...BUDGET_TOOLS,
  ...STOCK_TOOLS,
  ...PRICE_VARIANCE_TOOLS,
  ...ARTICLE_TOOLS,
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
    case 'cancel_request':
      return {
        label: 'Annulla richiesta',
        fields: [
          {
            key: 'Richiesta',
            value: String(params.code ?? params.request_id ?? ''),
          },
          ...(params.reason
            ? [{ key: 'Motivo', value: String(params.reason) }]
            : []),
        ],
      }
    case 'submit_for_approval':
      return {
        label: 'Invia per approvazione',
        fields: [
          {
            key: 'Richiesta',
            value: String(params.code ?? params.request_id ?? ''),
          },
        ],
      }
    case 'reject_request':
      return {
        label: 'Rifiuta richiesta',
        fields: [
          {
            key: 'Riferimento',
            value: String(params.approval_id ?? params.request_id ?? ''),
          },
          ...(params.notes
            ? [{ key: 'Note', value: String(params.notes) }]
            : []),
        ],
      }
    case 'put_request_on_hold':
      return {
        label: 'Metti in attesa',
        fields: [
          {
            key: 'Richiesta',
            value: String(params.code ?? params.request_id ?? ''),
          },
          ...(params.reason
            ? [{ key: 'Motivo', value: String(params.reason) }]
            : []),
        ],
      }
    case 'resume_request':
      return {
        label: 'Riprendi richiesta',
        fields: [
          {
            key: 'Richiesta',
            value: String(params.code ?? params.request_id ?? ''),
          },
          {
            key: 'Nuovo stato',
            value: String(params.target_status ?? ''),
          },
        ],
      }
    case 'mark_ordered':
      return {
        label: 'Marca come ordinata',
        fields: [
          {
            key: 'Richiesta',
            value: String(params.code ?? params.request_id ?? ''),
          },
          ...(params.external_ref
            ? [{ key: 'Ref fornitore', value: String(params.external_ref) }]
            : []),
          ...(params.tracking_number
            ? [{ key: 'Tracking', value: String(params.tracking_number) }]
            : []),
        ],
      }
    case 'decide_approval':
      return {
        label: 'Decidi approvazione',
        fields: [
          { key: 'Approvazione', value: String(params.approval_id ?? '') },
          { key: 'Decisione', value: String(params.decision ?? '') },
          ...(params.notes
            ? [{ key: 'Note', value: String(params.notes) }]
            : []),
        ],
      }
    case 'update_commessa_status':
      return {
        label: 'Aggiorna stato commessa',
        fields: [
          { key: 'Commessa', value: String(params.code ?? '') },
          { key: 'Nuovo stato', value: String(params.new_status ?? '') },
        ],
      }
    case 'update_vendor':
      return {
        label: 'Aggiorna fornitore',
        fields: [
          { key: 'Fornitore ID', value: String(params.vendor_id ?? '') },
          ...(params.status
            ? [{ key: 'Stato', value: String(params.status) }]
            : []),
          ...(params.rating !== undefined
            ? [{ key: 'Rating', value: String(params.rating) }]
            : []),
          ...(params.notes
            ? [{ key: 'Note', value: String(params.notes) }]
            : []),
        ],
      }
    case 'mark_delivered':
      return {
        label: 'Marca come consegnata',
        fields: [
          {
            key: 'Richiesta',
            value: String(params.code ?? params.request_id ?? ''),
          },
          ...(params.actual_amount !== undefined
            ? [
                {
                  key: 'Importo effettivo',
                  value: String(params.actual_amount),
                },
              ]
            : []),
          ...(params.notes
            ? [{ key: 'Note', value: String(params.notes) }]
            : []),
        ],
      }
    case 'update_tender_status':
      return {
        label: 'Aggiorna stato gara',
        fields: [
          { key: 'Gara ID', value: String(params.tender_id ?? '') },
          { key: 'Nuovo stato', value: String(params.new_status ?? '') },
          ...(params.notes
            ? [{ key: 'Note', value: String(params.notes) }]
            : []),
        ],
      }
    case 'decide_tender_go_nogo':
      return {
        label: 'Decisione Go/No-Go gara',
        fields: [
          { key: 'Gara ID', value: String(params.tender_id ?? '') },
          { key: 'Decisione', value: String(params.decision ?? '') },
          ...(params.score !== undefined
            ? [{ key: 'Score', value: `${params.score}/100` }]
            : []),
        ],
      }
    case 'dispute_invoice':
      return {
        label: 'Contesta fattura',
        fields: [
          { key: 'Fattura', value: String(params.invoice_id ?? '') },
          { key: 'Tipo', value: String(params.discrepancy_type ?? '') },
          {
            key: 'Delta EUR',
            value: `${Number(params.amount_discrepancy ?? 0).toFixed(2)}`,
          },
        ],
      }
    case 'add_comment':
      return {
        label: 'Aggiungi commento',
        fields: [
          { key: 'Richiesta', value: String(params.request_id ?? '') },
          {
            key: 'Contenuto',
            value: String(params.content ?? '').slice(0, 80),
          },
          ...(params.is_internal ? [{ key: 'Interno', value: 'Sì' }] : []),
        ],
      }
    case 'add_attachment':
      return {
        label: 'Aggiungi allegato',
        fields: [
          { key: 'Richiesta', value: String(params.request_id ?? '') },
          { key: 'File', value: String(params.filename ?? '') },
        ],
      }
    case 'decide_price_variance':
      return {
        label: 'Decisione variazione prezzo',
        fields: [
          { key: 'Review', value: String(params.review_id ?? '') },
          { key: 'Decisione', value: String(params.status ?? '') },
          ...(params.notes
            ? [{ key: 'Note', value: String(params.notes) }]
            : []),
        ],
      }
    case 'find_or_create_article':
      return {
        label: 'Cerca/crea articolo',
        fields: [
          { key: 'Nome', value: String(params.name ?? '') },
          ...(params.code
            ? [{ key: 'Codice', value: String(params.code) }]
            : []),
          ...(params.manufacturer
            ? [{ key: 'Produttore', value: String(params.manufacturer) }]
            : []),
        ],
      }
    case 'link_article_to_request_item':
      return {
        label: 'Collega articolo a riga RDA',
        fields: [
          { key: 'RDA', value: String(params.request_code ?? '') },
          { key: 'Articolo', value: String(params.item_name ?? '') },
        ],
      }
    default:
      return { label: toolName, fields: [] }
  }
}

// ---------------------------------------------------------------------------
// Write Tool Executors (called after user confirmation)
// ---------------------------------------------------------------------------

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

  const code = await generateNextCodeAtomic()

  return prisma.purchaseRequest.create({
    data: {
      code,
      title: params.title,
      description: params.description,
      status: 'DRAFT',
      priority: params.priority ?? 'MEDIUM',
      requester_id: userId,
      vendor_id: params.vendor_id,
      commessa_id: params.commessa_id,
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
                  article_id: item.article_id,
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

// ---------------------------------------------------------------------------
// Shared helpers for status-change executors
// ---------------------------------------------------------------------------

interface ResolvedRequest {
  readonly id: string
  readonly code: string
  readonly status: import('@prisma/client').RequestStatus
  readonly requester_id: string
  readonly estimated_amount: unknown
  readonly vendor_id: string | null
  readonly commessa_id: string | null
}

async function resolveRequest(input: {
  request_id?: string
  code?: string
}): Promise<ResolvedRequest> {
  if (!input.request_id && !input.code) {
    throw new Error('request_id o code obbligatorio')
  }
  const request = input.request_id
    ? await prisma.purchaseRequest.findUnique({
        where: { id: input.request_id },
        select: {
          id: true,
          code: true,
          status: true,
          requester_id: true,
          estimated_amount: true,
          vendor_id: true,
          commessa_id: true,
        },
      })
    : await prisma.purchaseRequest.findUnique({
        where: { code: input.code! },
        select: {
          id: true,
          code: true,
          status: true,
          requester_id: true,
          estimated_amount: true,
          vendor_id: true,
          commessa_id: true,
        },
      })
  if (!request) {
    throw new Error('Richiesta non trovata')
  }
  return request as ResolvedRequest
}

interface StatusChangeParams {
  request_id?: string
  code?: string
  reason?: string
  notes?: string
  target_status?: 'PENDING_APPROVAL' | 'ORDERED' | 'SHIPPED' | 'INVOICED'
  external_ref?: string
  tracking_number?: string
  actual_amount?: number
  approval_id?: string
}

async function executeCancelRequest(
  params: StatusChangeParams,
  _userId: string,
): Promise<unknown> {
  const request = await resolveRequest(params)
  assertTransition(request.status, 'CANCELLED')
  await prisma.$transaction([
    prisma.purchaseRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED' },
    }),
    prisma.timelineEvent.create({
      data: {
        request_id: request.id,
        type: 'status_change',
        title: `Stato: ${request.status} → CANCELLED`,
        description: params.reason ?? null,
        actor: 'User',
      },
    }),
  ])
  await createNotification({
    userId: request.requester_id,
    title: 'Richiesta annullata',
    body: `La richiesta ${request.code} è stata annullata.${
      params.reason ? ' Motivo: ' + params.reason : ''
    }`,
    type: 'status_changed',
    link: `/requests/${request.id}`,
  })
  return {
    success: true,
    code: request.code,
    from: request.status,
    to: 'CANCELLED',
  }
}

async function executeSubmitForApproval(
  params: StatusChangeParams,
  _userId: string,
): Promise<unknown> {
  const request = await resolveRequest(params)
  const user = await prisma.user.findUnique({
    where: { id: request.requester_id },
    select: { role: true },
  })
  const approval = await initiateApprovalWorkflow(
    request.id,
    Number(request.estimated_amount ?? 0),
    user?.role,
  )
  return { success: true, code: request.code, approval_id: approval.id }
}

async function executeRejectRequest(
  params: StatusChangeParams,
  _userId: string,
): Promise<unknown> {
  let approvalId = params.approval_id
  if (!approvalId && params.request_id) {
    const approval = await prisma.approval.findFirst({
      where: { request_id: params.request_id, status: 'PENDING' },
      select: { id: true },
      orderBy: { created_at: 'desc' },
    })
    if (!approval) {
      throw new Error(
        'Nessuna approvazione pending trovata per questa richiesta',
      )
    }
    approvalId = approval.id
  }
  if (!approvalId) {
    throw new Error('approval_id o request_id richiesto')
  }
  return decideApproval(approvalId, 'REJECTED', params.notes)
}

async function executePutRequestOnHold(
  params: StatusChangeParams,
  _userId: string,
): Promise<unknown> {
  const request = await resolveRequest(params)
  assertTransition(request.status, 'ON_HOLD')
  await prisma.$transaction([
    prisma.purchaseRequest.update({
      where: { id: request.id },
      data: { status: 'ON_HOLD' },
    }),
    prisma.timelineEvent.create({
      data: {
        request_id: request.id,
        type: 'status_change',
        title: `Stato: ${request.status} → ON_HOLD`,
        description: params.reason ?? null,
        metadata: { previous_status: request.status },
        actor: 'User',
      },
    }),
  ])
  await createNotification({
    userId: request.requester_id,
    title: 'Richiesta sospesa',
    body: `La richiesta ${request.code} è stata messa in attesa.${
      params.reason ? ' Motivo: ' + params.reason : ''
    }`,
    type: 'status_changed',
    link: `/requests/${request.id}`,
  })
  return {
    success: true,
    code: request.code,
    previous_status: request.status,
  }
}

async function executeResumeRequest(
  params: StatusChangeParams,
  _userId: string,
): Promise<unknown> {
  const request = await resolveRequest(params)
  if (request.status !== 'ON_HOLD') {
    throw new Error(
      `resume_request richiede che la richiesta sia in ON_HOLD, stato corrente: ${request.status}`,
    )
  }
  if (!params.target_status) {
    throw new Error('target_status obbligatorio')
  }
  assertTransition('ON_HOLD', params.target_status)
  await prisma.$transaction([
    prisma.purchaseRequest.update({
      where: { id: request.id },
      data: { status: params.target_status },
    }),
    prisma.timelineEvent.create({
      data: {
        request_id: request.id,
        type: 'status_change',
        title: `Stato: ON_HOLD → ${params.target_status}`,
        actor: 'User',
      },
    }),
  ])
  return {
    success: true,
    code: request.code,
    new_status: params.target_status,
  }
}

async function executeMarkOrdered(
  params: StatusChangeParams,
  _userId: string,
): Promise<unknown> {
  const request = await resolveRequest(params)
  assertTransition(request.status, 'ORDERED')
  const updateData: Record<string, unknown> = {
    status: 'ORDERED',
    ordered_at: new Date(),
  }
  if (params.external_ref) updateData.external_ref = params.external_ref
  if (params.tracking_number) {
    updateData.tracking_number = params.tracking_number
  }
  await prisma.$transaction([
    prisma.purchaseRequest.update({
      where: { id: request.id },
      data: updateData,
    }),
    prisma.timelineEvent.create({
      data: {
        request_id: request.id,
        type: 'status_change',
        title: `Ordine inviato al fornitore`,
        description: params.external_ref ? `Ref: ${params.external_ref}` : null,
        actor: 'User',
      },
    }),
  ])
  return { success: true, code: request.code, ordered_at: new Date() }
}

async function executeMarkDelivered(
  params: StatusChangeParams,
  _userId: string,
): Promise<unknown> {
  const request = await resolveRequest(params)
  assertTransition(request.status, 'DELIVERED')
  const updateData: Record<string, unknown> = {
    status: 'DELIVERED',
    delivered_at: new Date(),
  }
  if (params.actual_amount !== undefined) {
    updateData.actual_amount = params.actual_amount
  }
  await prisma.$transaction([
    prisma.purchaseRequest.update({
      where: { id: request.id },
      data: updateData,
    }),
    prisma.timelineEvent.create({
      data: {
        request_id: request.id,
        type: 'status_change',
        title: 'Consegna confermata',
        description: params.notes ?? null,
        actor: 'User',
      },
    }),
  ])
  await createNotification({
    userId: request.requester_id,
    title: 'Ordine consegnato',
    body: `L'ordine ${request.code} è stato consegnato.`,
    type: 'status_changed',
    link: `/requests/${request.id}`,
  })
  return { success: true, code: request.code, delivered_at: new Date() }
}

interface DecideApprovalParams {
  approval_id: string
  decision: 'APPROVED' | 'REJECTED'
  notes?: string
}

async function executeDecideApproval(
  params: DecideApprovalParams,
  userId: string,
): Promise<unknown> {
  if (params.decision === 'APPROVED') {
    const approval = await prisma.approval.findUnique({
      where: { id: params.approval_id },
      select: { request: { select: { requester_id: true } } },
    })
    if (!approval) throw new Error('Approvazione non trovata')
    if (approval.request.requester_id === userId) {
      throw new Error('Non è possibile approvare le proprie richieste')
    }
  }
  return decideApproval(params.approval_id, params.decision, params.notes)
}

interface UpdateCommessaStatusParams {
  code: string
  new_status:
    | 'DRAFT'
    | 'PLANNING'
    | 'ACTIVE'
    | 'ON_HOLD'
    | 'COMPLETED'
    | 'CANCELLED'
}

async function executeUpdateCommessaStatus(
  params: UpdateCommessaStatusParams,
  _userId: string,
): Promise<unknown> {
  await updateCommessaStatus(params.code, params.new_status)
  return { success: true, code: params.code, new_status: params.new_status }
}

interface UpdateVendorParams {
  vendor_id: string
  status?: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED' | 'PENDING_REVIEW'
  rating?: number
  notes?: string
  payment_terms?: string
  category?: string[]
}

async function executeUpdateVendor(
  params: UpdateVendorParams,
  _userId: string,
): Promise<unknown> {
  const data: Record<string, unknown> = {}
  if (params.status !== undefined) data.status = params.status
  if (params.rating !== undefined) data.rating = params.rating
  if (params.notes !== undefined) data.notes = params.notes
  if (params.payment_terms !== undefined) {
    data.payment_terms = params.payment_terms
  }
  if (params.category !== undefined) data.category = params.category

  if (Object.keys(data).length === 0) {
    throw new Error('Almeno un campo da aggiornare richiesto')
  }

  const vendor = await prisma.vendor.update({
    where: { id: params.vendor_id },
    data,
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      rating: true,
    },
  })
  return {
    success: true,
    vendor: {
      id: vendor.id,
      code: vendor.code,
      name: vendor.name,
      status: vendor.status,
      rating: vendor.rating,
    },
  }
}

interface UpdateTenderStatusParams {
  tender_id: string
  new_status: string
  notes?: string
}

async function executeUpdateTenderStatus(
  params: UpdateTenderStatusParams,
  _userId: string,
): Promise<unknown> {
  const tender = await prisma.tender.findUnique({
    where: { id: params.tender_id },
    select: { id: true, code: true, status: true },
  })
  if (!tender) throw new Error('Gara non trovata')

  const v = validateStatusTransition(tender.status, params.new_status)
  if (!v.valid) throw new Error(v.reason ?? 'Transizione non valida')

  await prisma.$transaction([
    prisma.tender.update({
      where: { id: params.tender_id },
      data: { status: params.new_status as never },
    }),
    prisma.tenderTimeline.create({
      data: {
        tender_id: params.tender_id,
        type: 'status_change',
        title: `Stato: ${tender.status} → ${params.new_status}`,
        description: params.notes,
        metadata: { from: tender.status, to: params.new_status },
        actor: 'User',
      },
    }),
  ])

  return {
    success: true,
    code: tender.code,
    from: tender.status,
    to: params.new_status,
  }
}

interface DecideTenderGoNogoParams {
  tender_id: string
  decision: 'GO' | 'NO_GO'
  score?: number
  notes?: string
}

async function executeDecideTenderGoNogo(
  params: DecideTenderGoNogoParams,
  userId: string,
): Promise<unknown> {
  const tender = await prisma.tender.findUnique({
    where: { id: params.tender_id },
    select: { id: true, code: true },
  })
  if (!tender) throw new Error('Gara non trovata')

  await prisma.$transaction([
    prisma.tender.update({
      where: { id: params.tender_id },
      data: {
        go_no_go: params.decision,
        go_no_go_score: params.score,
        go_no_go_notes: params.notes,
        go_no_go_decided_by: userId,
        go_no_go_decided_at: new Date(),
      },
    }),
    prisma.tenderTimeline.create({
      data: {
        tender_id: params.tender_id,
        type: 'go_no_go_decision',
        title: `Decisione Go/No-Go: ${params.decision}${params.score !== undefined ? ` (${params.score}/100)` : ''}`,
        description: params.notes,
        actor: 'User',
      },
    }),
  ])

  return { success: true, code: tender.code, decision: params.decision }
}

// ---------------------------------------------------------------------------
// Invoice dispute executor
// ---------------------------------------------------------------------------

interface DisputeInvoiceParams {
  invoice_id: string
  amount_discrepancy: number
  discrepancy_type:
    | 'AMOUNT_MISMATCH'
    | 'QUANTITY_MISMATCH'
    | 'ITEM_MISMATCH'
    | 'PRICE_MISMATCH'
  notes: string
  notify_user_id?: string
}

async function executeDisputeInvoice(
  params: DisputeInvoiceParams,
  _userId: string,
): Promise<unknown> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.invoice_id },
    select: {
      id: true,
      invoice_number: true,
      purchase_request_id: true,
      purchase_request: {
        select: { id: true, code: true, requester_id: true },
      },
    },
  })
  if (!invoice) throw new Error('Fattura non trovata')

  await prisma.invoice.update({
    where: { id: params.invoice_id },
    data: {
      reconciliation_status: 'DISPUTED',
      amount_discrepancy: params.amount_discrepancy,
      discrepancy_type: params.discrepancy_type,
      reconciliation_notes: params.notes,
      reconciled_at: new Date(),
    },
  })

  if (invoice.purchase_request) {
    await prisma.timelineEvent.create({
      data: {
        request_id: invoice.purchase_request.id,
        invoice_id: invoice.id,
        type: 'invoice_disputed',
        title: `Fattura ${invoice.invoice_number} contestata`,
        description: params.notes.slice(0, 500),
        metadata: {
          amount_discrepancy: params.amount_discrepancy,
          discrepancy_type: params.discrepancy_type,
        },
        actor: 'User',
      },
    })
  }

  const notifyId =
    params.notify_user_id ?? invoice.purchase_request?.requester_id
  if (notifyId) {
    await createNotification({
      userId: notifyId,
      title: 'Fattura contestata',
      body: `La fattura ${invoice.invoice_number} è stata contestata (${params.discrepancy_type}, delta €${params.amount_discrepancy.toFixed(2)}).`,
      type: 'status_changed',
      link: invoice.purchase_request
        ? `/requests/${invoice.purchase_request.id}`
        : `/invoices/${invoice.id}`,
    })
  }

  return {
    success: true,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    amount_discrepancy: params.amount_discrepancy,
    discrepancy_type: params.discrepancy_type,
  }
}

// ---------------------------------------------------------------------------
// Comment / Attachment executors
// ---------------------------------------------------------------------------

interface AddCommentParams {
  request_id: string
  content: string
  is_internal?: boolean
}

async function executeAddComment(
  params: AddCommentParams,
  userId: string,
): Promise<unknown> {
  const comment = await createComment({
    requestId: params.request_id,
    authorId: userId,
    content: params.content,
    isInternal: params.is_internal ?? false,
  })
  return { success: true, comment_id: comment.id }
}

interface AddAttachmentParams {
  request_id: string
  filename: string
  file_url: string
  file_size?: number
  mime_type?: string
}

async function executeAddAttachment(
  params: AddAttachmentParams,
  _userId: string,
): Promise<unknown> {
  const attachment = await createAttachmentRecord({
    requestId: params.request_id,
    filename: params.filename,
    fileUrl: params.file_url,
    fileSize: params.file_size,
    mimeType: params.mime_type,
  })
  return { success: true, attachment_id: attachment.id }
}

// ---------------------------------------------------------------------------
// Price Variance executor
// ---------------------------------------------------------------------------

interface DecidePriceVarianceParams {
  review_id: string
  status: 'ACCEPTED' | 'REJECTED' | 'NEGOTIATING'
  notes?: string
}

async function executeDecidePriceVariance(
  params: DecidePriceVarianceParams,
  userId: string,
): Promise<unknown> {
  const review = await prisma.priceVarianceReview.findUnique({
    where: { id: params.review_id },
    select: {
      id: true,
      status: true,
      request_id: true,
      max_delta_percent: true,
      total_delta: true,
      request: { select: { code: true, requester_id: true } },
    },
  })
  if (!review) throw new Error('Price variance review non trovata')
  if (review.status !== 'PENDING') {
    throw new Error(
      `Review non in stato PENDING (stato attuale: ${review.status})`,
    )
  }

  await prisma.$transaction([
    prisma.priceVarianceReview.update({
      where: { id: params.review_id },
      data: {
        status: params.status,
        decided_by: userId,
        decided_at: new Date(),
        decision_notes: params.notes ?? null,
      },
    }),
    prisma.timelineEvent.create({
      data: {
        request_id: review.request_id,
        type: 'price_variance_decision',
        title: `Variazione prezzo: ${params.status}`,
        description:
          params.notes ??
          `Delta ${Number(review.total_delta) >= 0 ? '+' : ''}${Number(review.total_delta).toFixed(2)} EUR (${review.max_delta_percent.toFixed(1)}%)`,
        metadata: {
          review_id: review.id,
          decision: params.status,
          max_delta_percent: review.max_delta_percent,
          total_delta: Number(review.total_delta),
        },
        actor: 'User',
      },
    }),
  ])

  await createNotification({
    userId: review.request.requester_id,
    title: `Variazione prezzo ${params.status === 'ACCEPTED' ? 'accettata' : params.status === 'REJECTED' ? 'rifiutata' : 'in negoziazione'}`,
    body: `La variazione prezzo sulla richiesta ${review.request.code} è stata ${params.status === 'ACCEPTED' ? 'accettata' : params.status === 'REJECTED' ? 'rifiutata' : 'messa in negoziazione'}.`,
    type: 'status_changed',
    link: `/requests/${review.request_id}`,
  })

  return {
    success: true,
    review_id: review.id,
    request_code: review.request.code,
    decision: params.status,
  }
}

const WRITE_EXECUTORS: Record<
  string,
  (params: Record<string, unknown>, userId: string) => Promise<unknown>
> = {
  create_request: (params, userId) =>
    executeCreateRequest(params as CreateRequestInput, userId),
  approve_request: (params, userId) =>
    executeApproveRequest(params as ApproveRequestInput, userId),
  cancel_request: (params, userId) =>
    executeCancelRequest(params as StatusChangeParams, userId),
  submit_for_approval: (params, userId) =>
    executeSubmitForApproval(params as StatusChangeParams, userId),
  reject_request: (params, userId) =>
    executeRejectRequest(params as StatusChangeParams, userId),
  put_request_on_hold: (params, userId) =>
    executePutRequestOnHold(params as StatusChangeParams, userId),
  resume_request: (params, userId) =>
    executeResumeRequest(params as StatusChangeParams, userId),
  mark_ordered: (params, userId) =>
    executeMarkOrdered(params as StatusChangeParams, userId),
  mark_delivered: (params, userId) =>
    executeMarkDelivered(params as StatusChangeParams, userId),
  decide_approval: (params, userId) =>
    executeDecideApproval(params as unknown as DecideApprovalParams, userId),
  update_commessa_status: (params, userId) =>
    executeUpdateCommessaStatus(
      params as unknown as UpdateCommessaStatusParams,
      userId,
    ),
  update_vendor: (params, userId) =>
    executeUpdateVendor(params as unknown as UpdateVendorParams, userId),
  update_tender_status: (params, userId) =>
    executeUpdateTenderStatus(
      params as unknown as UpdateTenderStatusParams,
      userId,
    ),
  decide_tender_go_nogo: (params, userId) =>
    executeDecideTenderGoNogo(
      params as unknown as DecideTenderGoNogoParams,
      userId,
    ),
  dispute_invoice: (params, userId) =>
    executeDisputeInvoice(params as unknown as DisputeInvoiceParams, userId),
  add_comment: (params, userId) =>
    executeAddComment(params as unknown as AddCommentParams, userId),
  add_attachment: (params, userId) =>
    executeAddAttachment(params as unknown as AddAttachmentParams, userId),
  decide_price_variance: (params, userId) =>
    executeDecidePriceVariance(
      params as unknown as DecidePriceVarianceParams,
      userId,
    ),
  find_or_create_article: async (params) => {
    const result = await findOrCreateArticleTool.run(
      params as Parameters<typeof findOrCreateArticleTool.run>[0],
    )
    return JSON.parse(result as string)
  },
  link_article_to_request_item: async (params) => {
    const result = await linkArticleToRequestItemTool.run(
      params as Parameters<typeof linkArticleToRequestItemTool.run>[0],
    )
    return JSON.parse(result as string)
  },
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
