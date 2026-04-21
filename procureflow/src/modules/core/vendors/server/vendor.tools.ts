import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'

// ---------------------------------------------------------------------------
// Vendor Tools — auto-create vendors cited in emails/PDFs
// ---------------------------------------------------------------------------

/**
 * Normalize a VAT ID: strip spaces, uppercase, remove "IT" prefix if present
 */
function normalizeVatId(vatId: string): string {
  return vatId.replace(/\s+/g, '').replace(/^IT/i, '').toUpperCase()
}

/**
 * Normalize a vendor name for fuzzy matching:
 * lowercase, remove common suffixes (SRL, SPA, SAS, SNC, SRLS, SL), trim.
 */
function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(s\.?r\.?l\.?s?|s\.?p\.?a\.?|s\.?a\.?s\.?|s\.?n\.?c\.?|s\.?l\.?)\b/gi,
      '',
    )
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const findOrCreateVendorTool = betaZodTool({
  name: 'find_or_create_vendor',
  description:
    'Cerca un fornitore per P.IVA o nome. Se non esiste, lo crea in stato PENDING_REVIEW con tag auto-created. Usa questo quando incontri un fornitore citato in email/PDF che potrebbe non essere ancora in anagrafica.',
  inputSchema: z.object({
    name: z.string().describe('Ragione sociale del fornitore'),
    vat_id: z
      .string()
      .optional()
      .describe('Partita IVA (11 cifre, senza prefisso IT)'),
    email: z.string().optional().describe('Email di contatto'),
    phone: z.string().optional().describe('Telefono'),
    category: z
      .array(z.string())
      .optional()
      .describe('Categorie merceologiche (es: ["Elettronica", "Componenti"])'),
    notes: z.string().optional().describe('Note sul fornitore'),
  }),
  run: async (input) => {
    // 1. Search by VAT ID (most reliable)
    if (input.vat_id) {
      const normalizedVat = normalizeVatId(input.vat_id)
      const byVat = await prisma.vendor.findFirst({
        where: { vat_id: normalizedVat },
        select: { id: true, code: true, name: true, status: true },
      })
      if (byVat) {
        return JSON.stringify({
          found: true,
          vendor_id: byVat.id,
          vendor_code: byVat.code,
          vendor_name: byVat.name,
          status: byVat.status,
          matched_by: 'vat_id',
        })
      }
    }

    // 2. Search by normalized name (handles "TTI Italy SRL" vs "TTI ITALY S.R.L.")
    const normalizedInput = normalizeVendorName(input.name)
    if (normalizedInput.length >= 3) {
      const candidates = await prisma.vendor.findMany({
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
        (v) => normalizeVendorName(v.name) === normalizedInput,
      )
      if (fuzzyMatch) {
        return JSON.stringify({
          found: true,
          vendor_id: fuzzyMatch.id,
          vendor_code: fuzzyMatch.code,
          vendor_name: fuzzyMatch.name,
          status: fuzzyMatch.status,
          matched_by: 'name_normalized',
        })
      }
    }

    // 3. Not found — create in PENDING_REVIEW state
    const vendorCode = await generateNextCodeAtomic('VND', 'vendors')
    const normalizedVat = input.vat_id
      ? normalizeVatId(input.vat_id)
      : undefined

    const vendor = await prisma.vendor.create({
      data: {
        code: vendorCode,
        name: input.name,
        email: input.email,
        phone: input.phone,
        vat_id: normalizedVat,
        category: input.category ?? [],
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
      vendor_id: vendor.id,
      vendor_code: vendor.code,
      vendor_name: vendor.name,
      status: vendor.status,
      note: 'Fornitore creato in stato PENDING_REVIEW — richiede verifica manuale.',
    })
  },
})

export const updateVendorTool = betaZodTool({
  name: 'update_vendor',
  description:
    'Aggiorna i dati di un fornitore esistente (status, rating, note, termini pagamento, categorie). Almeno un campo opzionale obbligatorio.',
  inputSchema: z.object({
    vendor_id: z.string().describe('ID del fornitore da aggiornare'),
    status: z
      .enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED', 'PENDING_REVIEW'])
      .optional(),
    rating: z.number().min(0).max(5).optional().describe('Rating 0-5'),
    notes: z.string().optional(),
    payment_terms: z.string().optional().describe('Es. "30gg DFFM"'),
    category: z.array(z.string()).optional(),
  }),
  run: async () =>
    JSON.stringify({ error: 'Write tools require confirmation' }),
})

export const VENDOR_TOOLS = [findOrCreateVendorTool, updateVendorTool]
