import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import type { ZodTool } from '@/server/agents/tools/procurement.tools'

// ---------------------------------------------------------------------------
// Comment Tools
//
// add_comment: WRITE-intercepted (placeholder run)
// list_comments: READ (executed directly)
// ---------------------------------------------------------------------------

export const addCommentTool = betaZodTool({
  name: 'add_comment',
  description:
    "Aggiunge un commento a una richiesta d'acquisto. Gestisce @menzioni e crea notifiche automatiche al proprietario + menzionati.",
  inputSchema: z.object({
    request_id: z.string(),
    content: z.string().min(1),
    is_internal: z
      .boolean()
      .optional()
      .describe(
        'Default false — se true il commento non è visibile al vendor',
      ),
  }),
  run: async () =>
    JSON.stringify({ error: 'Write tools require confirmation' }),
})

export const listCommentsTool = betaZodTool({
  name: 'list_comments',
  description: 'Lista commenti di una richiesta, ordinati dal più recente.',
  inputSchema: z.object({
    request_id: z.string(),
    include_internal: z
      .boolean()
      .optional()
      .describe('Default true — se false filtra solo commenti pubblici'),
  }),
  run: async (input) => {
    const where: Record<string, unknown> = { request_id: input.request_id }
    if (input.include_internal === false) where.is_internal = false
    const comments = await prisma.comment.findMany({
      where,
      include: { author: { select: { name: true, role: true } } },
      orderBy: { created_at: 'desc' },
      take: 50,
    })
    return JSON.stringify({ total: comments.length, results: comments })
  },
})

export const COMMENT_TOOLS = [
  addCommentTool,
  listCommentsTool,
] as readonly ZodTool[]
