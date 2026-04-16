import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { prisma } from '@/lib/db'
import type { ZodTool } from '@/server/agents/tools/procurement.tools'

// ---------------------------------------------------------------------------
// Attachment Tools
//
// add_attachment: WRITE-intercepted (placeholder run)
// list_attachments: READ (executed directly)
// ---------------------------------------------------------------------------

export const addAttachmentTool = betaZodTool({
  name: 'add_attachment',
  description:
    "Registra un allegato su una richiesta d'acquisto. Richiede file_url già caricato (il tool non gestisce upload fisico).",
  inputSchema: z.object({
    request_id: z.string(),
    filename: z.string(),
    file_url: z.string().url(),
    file_size: z.number().int().optional(),
    mime_type: z.string().optional(),
  }),
  run: async () =>
    JSON.stringify({ error: 'Write tools require confirmation' }),
})

export const listAttachmentsTool = betaZodTool({
  name: 'list_attachments',
  description: "Lista allegati di una richiesta d'acquisto.",
  inputSchema: z.object({
    request_id: z.string(),
  }),
  run: async (input) => {
    const attachments = await prisma.attachment.findMany({
      where: { request_id: input.request_id },
      orderBy: { created_at: 'desc' },
    })
    return JSON.stringify({
      total: attachments.length,
      results: attachments,
    })
  },
})

export const ATTACHMENT_TOOLS = [
  addAttachmentTool,
  listAttachmentsTool,
] as readonly ZodTool[]
