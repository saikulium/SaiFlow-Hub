import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'

// ---------------------------------------------------------------------------
// Article Tools — search and auto-create articles from agent context
// ---------------------------------------------------------------------------

export const findOrCreateArticleTool = betaZodTool({
  name: 'find_or_create_article',
  description:
    'Cerca un articolo nel catalogo per codice, nome o alias. Se non esiste, lo crea automaticamente. Ritorna l\'ID articolo da usare nelle RDA.',
  inputSchema: z.object({
    code: z
      .string()
      .optional()
      .describe('Codice articolo (es: MS3106A-18-1S, RG-316/U)'),
    name: z.string().describe('Nome/descrizione articolo'),
    unit_of_measure: z
      .string()
      .default('pz')
      .describe('Unita di misura: pz, mt, kg, etc.'),
    category: z.string().optional().describe('Categoria merceologica'),
    manufacturer: z.string().optional().describe('Produttore'),
    manufacturer_code: z
      .string()
      .optional()
      .describe('Codice produttore (part number)'),
  }),
  run: async (input) => {
    // 1. Search by manufacturer_code or code in aliases
    const searchCode = input.manufacturer_code ?? input.code
    if (searchCode) {
      // Check aliases first (vendor codes, client codes, standards)
      const alias = await prisma.articleAlias.findFirst({
        where: { alias_code: searchCode.toUpperCase() },
        include: { article: { select: { id: true, code: true, name: true } } },
      })
      if (alias) {
        return JSON.stringify({
          found: true,
          article_id: alias.article.id,
          article_code: alias.article.code,
          article_name: alias.article.name,
          matched_by: 'alias',
        })
      }

      // Check article manufacturer_code directly
      const byMfgCode = await prisma.article.findFirst({
        where: { manufacturer_code: searchCode },
        select: { id: true, code: true, name: true },
      })
      if (byMfgCode) {
        return JSON.stringify({
          found: true,
          article_id: byMfgCode.id,
          article_code: byMfgCode.code,
          article_name: byMfgCode.name,
          matched_by: 'manufacturer_code',
        })
      }
    }

    // 2. Search by name (fuzzy)
    const byName = await prisma.article.findFirst({
      where: { name: { contains: input.name, mode: 'insensitive' } },
      select: { id: true, code: true, name: true },
    })
    if (byName) {
      return JSON.stringify({
        found: true,
        article_id: byName.id,
        article_code: byName.code,
        article_name: byName.name,
        matched_by: 'name',
      })
    }

    // 3. Not found — create the article
    const articleCode = await generateNextCodeAtomic('ART', 'articles')
    const article = await prisma.article.create({
      data: {
        code: articleCode,
        name: input.name,
        unit_of_measure: input.unit_of_measure,
        category: input.category,
        manufacturer: input.manufacturer,
        manufacturer_code: input.manufacturer_code ?? input.code,
        tags: ['auto-created', 'from-email'],
      },
    })

    // 4. If we have a code/manufacturer_code, create an alias for future lookups
    if (searchCode) {
      await prisma.articleAlias.create({
        data: {
          article_id: article.id,
          alias_type: 'STANDARD',
          alias_code: searchCode.toUpperCase(),
          alias_label: input.name,
          is_primary: true,
        },
      })
    }

    return JSON.stringify({
      found: false,
      created: true,
      article_id: article.id,
      article_code: article.code,
      article_name: article.name,
    })
  },
})

export const ARTICLE_TOOLS = [findOrCreateArticleTool]
