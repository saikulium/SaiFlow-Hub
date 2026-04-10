import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'

// ---------------------------------------------------------------------------
// Article Tools — search and auto-create articles from agent context
// ---------------------------------------------------------------------------

/**
 * Normalize an article code by stripping hyphens, spaces, slashes, dots
 * and converting to uppercase. Enables fuzzy matching across formats like
 * "MS3106A-18-1S" vs "MS3106A181S".
 */
function normalizeCode(code: string): string {
  return code.replace(/[-\s/.]/g, '').toUpperCase()
}

/** Build a found-response payload */
function foundResult(
  article: { id: string; code: string; name: string },
  matchedBy: string,
) {
  return JSON.stringify({
    found: true,
    article_id: article.id,
    article_code: article.code,
    article_name: article.name,
    matched_by: matchedBy,
  })
}

export const findOrCreateArticleTool = betaZodTool({
  name: 'find_or_create_article',
  description:
    "Cerca un articolo nel catalogo per codice, nome o alias. Se non esiste, lo crea automaticamente. Ritorna l'ID articolo da usare nelle RDA.",
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
    const searchCode = input.manufacturer_code ?? input.code

    if (searchCode) {
      // (a) Exact alias_code match
      const exactAlias = await prisma.articleAlias.findFirst({
        where: { alias_code: searchCode.toUpperCase() },
        include: { article: { select: { id: true, code: true, name: true } } },
      })
      if (exactAlias) {
        return foundResult(exactAlias.article, 'alias')
      }

      // (b) Normalized alias_code match — fetch candidates by prefix, compare normalized
      const normalizedSearch = normalizeCode(searchCode)
      const prefix = normalizedSearch.slice(0, 3)
      if (prefix.length >= 2) {
        const candidateAliases = await prisma.articleAlias.findMany({
          where: {
            alias_code: { startsWith: prefix, mode: 'insensitive' },
          },
          include: {
            article: { select: { id: true, code: true, name: true } },
          },
          take: 20,
        })
        const fuzzyAliasMatch = candidateAliases.find(
          (a) => normalizeCode(a.alias_code) === normalizedSearch,
        )
        if (fuzzyAliasMatch) {
          return foundResult(fuzzyAliasMatch.article, 'alias_normalized')
        }
      }

      // (c) Exact manufacturer_code match
      const byMfgCode = await prisma.article.findFirst({
        where: { manufacturer_code: searchCode },
        select: { id: true, code: true, name: true },
      })
      if (byMfgCode) {
        return foundResult(byMfgCode, 'manufacturer_code')
      }

      // (d) Normalized manufacturer_code match
      const candidateArticles = await prisma.article.findMany({
        where: {
          manufacturer_code: { not: null },
        },
        select: { id: true, code: true, name: true, manufacturer_code: true },
        take: 200,
      })
      const normalizedMfgMatch = candidateArticles.find(
        (a) =>
          a.manufacturer_code !== null &&
          normalizeCode(a.manufacturer_code) === normalizedSearch,
      )
      if (normalizedMfgMatch) {
        return foundResult(normalizedMfgMatch, 'manufacturer_code_normalized')
      }
    }

    // (e) Search by name (fuzzy)
    const byName = await prisma.article.findFirst({
      where: { name: { contains: input.name, mode: 'insensitive' } },
      select: { id: true, code: true, name: true },
    })
    if (byName) {
      return foundResult(byName, 'name')
    }

    // Not found — create the article (unverified)
    const normalizedAlias = searchCode ? normalizeCode(searchCode) : null
    const articleCode = await generateNextCodeAtomic('ART', 'articles')
    const article = await prisma.article.create({
      data: {
        code: articleCode,
        name: input.name,
        unit_of_measure: input.unit_of_measure,
        category: input.category,
        manufacturer: input.manufacturer,
        manufacturer_code: input.manufacturer_code ?? input.code,
        verified: false,
        tags: ['auto-created', 'from-email'],
      },
    })

    // Create alias with normalized code for future lookups
    if (normalizedAlias) {
      await prisma.articleAlias.create({
        data: {
          article_id: article.id,
          alias_type: 'STANDARD',
          alias_code: normalizedAlias,
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
