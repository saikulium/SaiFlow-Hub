import { z } from 'zod'

// --- Article ---

export const createArticleSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio').max(200, 'Max 200 caratteri'),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  unit_of_measure: z
    .string()
    .min(1, 'UM obbligatoria')
    .max(10, 'Max 10 caratteri'),
  manufacturer: z.string().max(200).optional(),
  manufacturer_code: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).default([]),
  aliases: z
    .array(
      z.object({
        alias_type: z.enum(['VENDOR', 'CLIENT', 'STANDARD']),
        alias_code: z
          .string()
          .min(1)
          .max(100)
          .transform((v) => v.toUpperCase()),
        alias_label: z.string().max(200).optional(),
        entity_id: z.string().optional(),
        is_primary: z.boolean().default(false),
      }),
    )
    .default([]),
  // Inventory toggle — auto-creates linked Material
  manage_inventory: z.boolean().default(false),
})

export const updateArticleSchema = createArticleSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const articleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  is_active: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  sort: z
    .enum(['created_at', 'name', 'code', 'category', 'updated_at'])
    .default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

// --- Alias ---

export const createAliasSchema = z.object({
  alias_type: z.enum(['VENDOR', 'CLIENT', 'STANDARD']),
  alias_code: z
    .string()
    .min(1, 'Codice obbligatorio')
    .max(100)
    .transform((v) => v.toUpperCase()),
  alias_label: z.string().max(200).optional(),
  entity_id: z.string().optional(),
  is_primary: z.boolean().default(false),
})

// --- Price ---

export const createPriceSchema = z.object({
  vendor_id: z.string().min(1, 'Fornitore obbligatorio'),
  unit_price: z.number().positive('Prezzo deve essere positivo'),
  currency: z.string().default('EUR'),
  min_quantity: z.number().int().min(1, 'Quantità minima 1').default(1),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  source: z.enum(['manual', 'invoice', 'quote']).default('manual'),
  notes: z.string().max(500).optional(),
})

// --- Search ---

export const articleSearchSchema = z.object({
  q: z.string().min(1, 'Query obbligatoria'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

// --- CSV Import ---

/** Transform empty strings to undefined so optional fields pass validation */
const emptyToUndefined = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().optional(),
)

export const csvRowSchema = z.object({
  codice_interno: z.string().min(1),
  nome: z.string().min(1),
  categoria: emptyToUndefined,
  um: z.string().min(1),
  produttore: emptyToUndefined,
  codice_produttore: emptyToUndefined,
  tipo_alias: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.enum(['vendor', 'client', 'standard']).optional(),
  ),
  codice_alias: emptyToUndefined,
  entita: emptyToUndefined,
  note_alias: emptyToUndefined,
})

// --- Type exports ---

export type CreateArticleInput = z.infer<typeof createArticleSchema>
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>
export type ArticleQuery = z.infer<typeof articleQuerySchema>
export type CreateAliasInput = z.infer<typeof createAliasSchema>
export type CreatePriceInput = z.infer<typeof createPriceSchema>
export type ArticleSearchQuery = z.infer<typeof articleSearchSchema>
export type CsvRow = z.infer<typeof csvRowSchema>
