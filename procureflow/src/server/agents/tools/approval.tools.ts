import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import type { ZodTool } from './procurement.tools'

// ---------------------------------------------------------------------------
// Approval Tools
//
// list_pending_approvals + get_approval_detail: READ (eseguiti direttamente)
// decide_approval: WRITE-intercepted (placeholder run, esecuzione in
// WRITE_EXECUTORS dentro procurement.tools.ts dopo conferma utente).
// ---------------------------------------------------------------------------

export const listPendingApprovalsTool = betaZodTool({
  name: 'list_pending_approvals',
  description:
    'Elenca le approvazioni in stato PENDING. Filtra opzionalmente per approver.',
  inputSchema: z.object({
    approver_id: z.string().optional(),
    pageSize: z.number().int().min(1).max(20).optional(),
  }),
  run: async (input) => {
    const where: Record<string, unknown> = { status: 'PENDING' }
    if (input.approver_id) where.approver_id = input.approver_id
    const [approvals, total] = await prisma.$transaction([
      prisma.approval.findMany({
        where,
        include: {
          request: {
            select: {
              code: true,
              title: true,
              estimated_amount: true,
              requester: { select: { name: true } },
            },
          },
          approver: { select: { name: true, email: true } },
        },
        orderBy: { created_at: 'desc' },
        take: input.pageSize ?? 10,
      }),
      prisma.approval.count({ where }),
    ])
    return JSON.stringify({ total, results: approvals })
  },
})

export const getApprovalDetailTool = betaZodTool({
  name: 'get_approval_detail',
  description:
    'Dettaglio di una singola approvazione con contesto richiesta.',
  inputSchema: z.object({
    approval_id: z.string(),
  }),
  run: async (input) => {
    const approval = await prisma.approval.findUnique({
      where: { id: input.approval_id },
      include: {
        request: {
          include: {
            items: true,
            vendor: { select: { name: true, code: true } },
          },
        },
        approver: { select: { name: true, email: true } },
      },
    })
    if (!approval) {
      return JSON.stringify({ error: 'Approvazione non trovata' })
    }
    return JSON.stringify(approval)
  },
})

export const decideApprovalTool = betaZodTool({
  name: 'decide_approval',
  description:
    "Decidi un'approvazione (APPROVED o REJECTED). Wrapper di decideApproval che valida self-approval e crea timeline + notifica automatiche.",
  inputSchema: z.object({
    approval_id: z.string(),
    decision: z.enum(['APPROVED', 'REJECTED']),
    notes: z.string().optional(),
  }),
  run: async () =>
    JSON.stringify({ error: 'Write tools require confirmation' }),
})

export const APPROVAL_TOOLS = [
  listPendingApprovalsTool,
  getApprovalDetailTool,
  decideApprovalTool,
] as readonly ZodTool[]
