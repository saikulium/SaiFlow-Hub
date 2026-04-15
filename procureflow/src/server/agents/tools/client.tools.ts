import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'

// ---------------------------------------------------------------------------
// Client Tools — search existing clients, auto-create from emails
// ---------------------------------------------------------------------------

/**
 * Normalize a tax/vat ID: strip spaces, uppercase, remove "IT" prefix if present.
 */
function normalizeTaxId(taxId: string): string {
  return taxId
    .replace(/\s+/g, '')
    .replace(/^IT/i, '')
    .toUpperCase()
}

/**
 * Normalize a client name: lowercase, strip suffixes, collapse whitespace.
 */
function normalizeClientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(s\.?r\.?l\.?s?|s\.?p\.?a\.?|s\.?a\.?s\.?|s\.?n\.?c\.?|s\.?l\.?)\b/gi, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const searchClientsTool = betaZodTool({
  name: 'search_clients',
  description:
    'Cerca clienti nel database per nome, codice o P.IVA. Usa quando ricevi un ordine cliente o quando un cliente finale e citato in una conferma ordine da un fornitore.',
  inputSchema: z.object({
    search: z
      .string()
      .optional()
      .describe('Ricerca testo libero su nome, codice o tax_id'),
    status: z
      .enum(['ACTIVE', 'INACTIVE', 'PENDING_REVIEW'])
      .optional()
      .describe('Filtra per stato'),
    pageSize: z.number().min(1).max(20).default(10),
  }),
  run: async (input) => {
    const where: Record<string, unknown> = {}
    if (input.status) where.status = input.status
    if (input.search) {
      where.OR = [
        { name: { contains: input.search, mode: 'insensitive' } },
        { code: { contains: input.search, mode: 'insensitive' } },
        { tax_id: { contains: input.search, mode: 'insensitive' } },
      ]
    }
    const [clients, total] = await prisma.$transaction([
      prisma.client.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          tax_id: true,
          email: true,
          status: true,
          _count: { select: { commesse: true } },
        },
        orderBy: { name: 'asc' },
        take: input.pageSize,
      }),
      prisma.client.count({ where }),
    ])
    return JSON.stringify({ total, results: clients })
  },
})

export const findOrCreateClientTool = betaZodTool({
  name: 'find_or_create_client',
  description:
    'Cerca un cliente per P.IVA o nome. Se non esiste, lo crea in stato PENDING_REVIEW con tag auto-created. Ritorna client_id da usare nella creazione commessa.',
  inputSchema: z.object({
    name: z.string().describe('Ragione sociale del cliente'),
    tax_id: z
      .string()
      .optional()
      .describe('Partita IVA o codice fiscale (senza prefisso IT)'),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
  }),
  run: async (input) => {
    // 1. Search by tax_id
    if (input.tax_id) {
      const normalized = normalizeTaxId(input.tax_id)
      const byTax = await prisma.client.findFirst({
        where: { tax_id: normalized },
        select: { id: true, code: true, name: true, status: true },
      })
      if (byTax) {
        return JSON.stringify({
          found: true,
          client_id: byTax.id,
          client_code: byTax.code,
          client_name: byTax.name,
          status: byTax.status,
          matched_by: 'tax_id',
        })
      }
    }

    // 2. Search by normalized name
    const normalizedInput = normalizeClientName(input.name)
    if (normalizedInput.length >= 3) {
      const candidates = await prisma.client.findMany({
        where: {
          name: {
            contains: normalizedInput.split(' ')[0] ?? '',
            mode: 'insensitive',
          },
        },
        select: { id: true, code: true, name: true, status: true },
        take: 20,
      })
      const fuzzyMatch = candidates.find(
        (c) => normalizeClientName(c.name) === normalizedInput,
      )
      if (fuzzyMatch) {
        return JSON.stringify({
          found: true,
          client_id: fuzzyMatch.id,
          client_code: fuzzyMatch.code,
          client_name: fuzzyMatch.name,
          status: fuzzyMatch.status,
          matched_by: 'name_normalized',
        })
      }
    }

    // 3. Not found — create in PENDING_REVIEW
    const clientCode = await generateNextCodeAtomic('CLI', 'clients')
    const normalizedTax = input.tax_id
      ? normalizeTaxId(input.tax_id)
      : undefined

    const client = await prisma.client.create({
      data: {
        code: clientCode,
        name: input.name,
        tax_id: normalizedTax,
        email: input.email,
        phone: input.phone,
        address: input.address,
        status: 'PENDING_REVIEW',
        notes: [
          input.notes,
          'Auto-creato da email agent — verificare e censire completamente.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
      select: { id: true, code: true, name: true, status: true },
    })

    return JSON.stringify({
      found: false,
      created: true,
      client_id: client.id,
      client_code: client.code,
      client_name: client.name,
      status: client.status,
      note: 'Cliente creato in stato PENDING_REVIEW — richiede verifica manuale.',
    })
  },
})

export const CLIENT_TOOLS = [searchClientsTool, findOrCreateClientTool]
