import { prisma } from '@/lib/db'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'
import type { CsvRow } from '@/lib/validations/article'
import type { ArticleImportResult, ArticleImportError } from '@/types'

interface ArticleGroup {
  readonly codice_interno: string
  readonly nome: string
  readonly categoria?: string
  readonly um: string
  readonly produttore?: string
  readonly codice_produttore?: string
  readonly aliases: ReadonlyArray<{
    readonly tipo_alias: 'vendor' | 'client' | 'standard'
    readonly codice_alias: string
    readonly entita?: string
    readonly note_alias?: string
  }>
}

/** Group CSV rows by codice_interno, collecting aliases per article */
export function parseCsvRows(rows: readonly CsvRow[]): ArticleGroup[] {
  const map = new Map<string, ArticleGroup & { aliases: Array<ArticleGroup['aliases'][number]> }>()

  for (const row of rows) {
    if (!map.has(row.codice_interno)) {
      map.set(row.codice_interno, {
        codice_interno: row.codice_interno,
        nome: row.nome,
        categoria: row.categoria,
        um: row.um,
        produttore: row.produttore,
        codice_produttore: row.codice_produttore,
        aliases: [],
      })
    }

    const group = map.get(row.codice_interno)!
    if (row.tipo_alias && row.codice_alias) {
      group.aliases.push({
        tipo_alias: row.tipo_alias,
        codice_alias: row.codice_alias,
        entita: row.entita,
        note_alias: row.note_alias,
      })
    }
  }

  return Array.from(map.values())
}

/** Resolve entity name to vendor/client ID */
async function resolveEntityId(
  name: string | undefined,
  type: 'vendor' | 'client' | 'standard',
): Promise<string | null> {
  if (!name || type === 'standard') return null

  if (type === 'vendor') {
    const vendor = await prisma.vendor.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })
    return vendor?.id ?? null
  }

  if (type === 'client') {
    const client = await prisma.client.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })
    return client?.id ?? null
  }

  return null
}

/** Create aliases for an existing article */
async function createAliasesForArticle(
  articleId: string,
  aliases: ArticleGroup['aliases'],
): Promise<{ created: number; skipped: number; errors: ArticleImportError[] }> {
  let created = 0
  let skipped = 0
  const errors: ArticleImportError[] = []

  for (const alias of aliases) {
    try {
      const aliasType = alias.tipo_alias.toUpperCase() as 'VENDOR' | 'CLIENT' | 'STANDARD'
      const entityId = await resolveEntityId(alias.entita, alias.tipo_alias)
      await prisma.articleAlias.create({
        data: {
          article_id: articleId,
          alias_type: aliasType,
          alias_code: alias.codice_alias.toUpperCase(),
          alias_label: alias.note_alias || null,
          entity_id: entityId,
        },
      })
      created++
    } catch (e) {
      if (e instanceof Error && e.message.includes('Unique constraint')) {
        skipped++
      } else {
        errors.push({
          row: 0,
          field: 'alias',
          message: `Errore alias ${alias.codice_alias}: ${e instanceof Error ? e.message : 'Errore sconosciuto'}`,
        })
      }
    }
  }

  return { created, skipped, errors }
}

/** Import grouped articles into database */
export async function importArticles(
  groups: readonly ArticleGroup[],
): Promise<ArticleImportResult> {
  let articles_created = 0
  let aliases_created = 0
  let skipped = 0
  const errors: ArticleImportError[] = []

  for (const group of groups) {
    try {
      const existing = group.codice_produttore
        ? await prisma.article.findFirst({
            where: { manufacturer_code: group.codice_produttore },
          })
        : null

      if (existing) {
        const aliasResults = await createAliasesForArticle(existing.id, group.aliases)
        aliases_created += aliasResults.created
        skipped += aliasResults.skipped + 1
        errors.push(...aliasResults.errors)
      } else {
        const result = await prisma.$transaction(async (tx) => {
          const code = await generateNextCodeAtomic('ART', 'articles', tx)
          const article = await tx.article.create({
            data: {
              code,
              name: group.nome,
              category: group.categoria || null,
              unit_of_measure: group.um,
              manufacturer: group.produttore || null,
              manufacturer_code: group.codice_produttore || null,
            },
          })

          let aliasCount = 0
          let aliasSkipped = 0
          for (const alias of group.aliases) {
            const aliasType = alias.tipo_alias.toUpperCase() as 'VENDOR' | 'CLIENT' | 'STANDARD'
            const entityId = await resolveEntityId(alias.entita, alias.tipo_alias)

            try {
              await tx.articleAlias.create({
                data: {
                  article_id: article.id,
                  alias_type: aliasType,
                  alias_code: alias.codice_alias.toUpperCase(),
                  alias_label: alias.note_alias || null,
                  entity_id: entityId,
                },
              })
              aliasCount++
            } catch (e) {
              if (e instanceof Error && e.message.includes('Unique constraint')) {
                aliasSkipped++
              } else {
                throw e
              }
            }
          }

          return { aliasCount, aliasSkipped }
        }, { timeout: 10000 })

        articles_created++
        aliases_created += result.aliasCount
        skipped += result.aliasSkipped
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: 'article',
        message: `Errore articolo ${group.codice_interno}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
      })
    }
  }

  return { articles_created, aliases_created, skipped, errors }
}
