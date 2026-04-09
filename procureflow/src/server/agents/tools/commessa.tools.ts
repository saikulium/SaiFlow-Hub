import { z } from 'zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'
import type { ZodTool } from '@/server/agents/tools/procurement.tools'

// ---------------------------------------------------------------------------
// Commessa Tools — used by the email intelligence agent
// ---------------------------------------------------------------------------

const commessaStatusEnum = z.enum([
  'DRAFT',
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
])

const commessaItemSchema = z.object({
  description: z.string().describe('Descrizione articolo'),
  quantity: z.number().optional().describe('Quantita'),
  unit: z.string().optional().describe('Unita di misura (pz, kg, m, etc.)'),
})

export const searchCommesseTool = betaZodTool({
  name: 'search_commesse',
  description:
    'Cerca commesse per codice, stato o cliente. Usa per verificare se esiste gia una commessa per un ordine cliente.',
  inputSchema: z.object({
    search: z
      .string()
      .optional()
      .describe('Ricerca testo libero su codice o titolo'),
    status: commessaStatusEnum
      .optional()
      .describe('Filtra per stato commessa'),
    pageSize: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe('Numero massimo di risultati (default 10, max 20)'),
  }),
  run: async (input) => {
    const pageSize = Math.min(input.pageSize ?? 10, 20)
    const where: Record<string, unknown> = {}

    if (input.status) {
      where.status = input.status
    }

    if (input.search) {
      where.OR = [
        { code: { contains: input.search, mode: 'insensitive' } },
        { title: { contains: input.search, mode: 'insensitive' } },
        {
          client: {
            name: { contains: input.search, mode: 'insensitive' },
          },
        },
      ]
    }

    const [commesse, total] = await prisma.$transaction([
      prisma.commessa.findMany({
        where,
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          client_value: true,
          currency: true,
          deadline: true,
          priority: true,
          created_at: true,
          client: { select: { name: true, code: true } },
          _count: { select: { requests: true } },
        },
        orderBy: { created_at: 'desc' },
        take: pageSize,
      }),
      prisma.commessa.count({ where }),
    ])

    return JSON.stringify({ total, results: commesse })
  },
})

export const createCommessaTool = betaZodTool({
  name: 'create_commessa',
  description:
    "Crea una nuova commessa da un ordine cliente. Crea anche il cliente se non esiste. Usa quando l'email contiene un ordine da evadere.",
  inputSchema: z.object({
    client_name: z.string().describe('Nome del cliente'),
    client_code: z
      .string()
      .optional()
      .describe('Codice cliente (se noto)'),
    client_value: z
      .number()
      .optional()
      .describe('Valore totale ordine in EUR'),
    deadline: z
      .string()
      .optional()
      .describe('Data consegna richiesta (formato ISO YYYY-MM-DD)'),
    items: z
      .array(commessaItemSchema)
      .optional()
      .describe('Articoli ordinati dal cliente'),
    source_email_subject: z
      .string()
      .optional()
      .describe("Oggetto dell'email originale (usato come titolo commessa)"),
  }),
  run: async (input) => {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create client
      const clientCode =
        input.client_code ??
        `AUTO-${input.client_name.substring(0, 8).toUpperCase().replace(/\s+/g, '')}-${Date.now().toString(36).slice(-4)}`

      let client = await tx.client.findUnique({
        where: { code: clientCode },
        select: { id: true },
      })

      if (!client) {
        client = await tx.client.findFirst({
          where: {
            name: { contains: input.client_name, mode: 'insensitive' },
          },
          select: { id: true },
        })
      }

      if (!client) {
        client = await tx.client.create({
          data: {
            code: clientCode,
            name: input.client_name,
            status: 'PENDING_REVIEW',
            notes:
              'Cliente creato automaticamente da AI Email Agent. Verificare i dati.',
          },
          select: { id: true },
        })
      }

      // 2. Generate commessa code
      const comCode = await generateNextCodeAtomic('COM', 'commesse', tx)

      // 3. Build description from items
      const itemsSummary =
        input.items && input.items.length > 0
          ? input.items
              .map(
                (item, idx) =>
                  `${idx + 1}. ${item.description}${item.quantity ? ` (${item.quantity}${item.unit ? ` ${item.unit}` : ''})` : ''}`,
              )
              .join('\n')
          : undefined

      const description = itemsSummary
        ? `Articoli ordinati:\n${itemsSummary}`
        : undefined

      // 4. Create commessa
      const commessa = await tx.commessa.create({
        data: {
          code: comCode,
          title:
            input.source_email_subject ??
            `Ordine ${input.client_name}`,
          description,
          status: 'PLANNING',
          client_id: client.id,
          client_value: input.client_value
            ? new Prisma.Decimal(input.client_value)
            : null,
          deadline: input.deadline ? new Date(input.deadline) : null,
          priority: 'MEDIUM',
          tags: ['ai-created'],
        },
        select: { id: true, code: true },
      })

      return { id: commessa.id, code: commessa.code }
    })

    return JSON.stringify({
      success: true,
      code: result.code,
      id: result.id,
    })
  },
})

// ---------------------------------------------------------------------------
// Exported collection
// ---------------------------------------------------------------------------

export const COMMESSA_TOOLS: readonly ZodTool[] = [
  searchCommesseTool,
  createCommessaTool,
] as readonly ZodTool[]
