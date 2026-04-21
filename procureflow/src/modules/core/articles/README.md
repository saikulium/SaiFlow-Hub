# Articles Module

Gestisce anagrafica articoli (materiali, prodotti, componenti), con alias per
vendor/client, storico prezzi e stock movements. Gli articoli sono la base
condivisa di magazzino e procurement.

## Pack

`core` — sempre disponibile.

## Dependencies

- `@/lib/db` — Prisma client
- `@/server/services/code-generator.service` — generazione codici atomic
- `@/types` — shared types (ArticleListItem, ArticleDetail, ecc.)

## Public API

Import via `@/modules/core/articles`:

### Services
- `parseCsvRows`, `importArticles` — CSV → articles bulk import

### Tools AI
- `findOrCreateArticleTool`, `linkArticleToRequestItemTool`, `ARTICLE_TOOLS`

### Validations (Zod)
- `createArticleSchema`, `updateArticleSchema`, `articleQuerySchema`
- `createAliasSchema`, `createPriceSchema`, `articleSearchSchema`, `csvRowSchema`
- Types: `CreateArticleInput`, `UpdateArticleInput`, `ArticleQuery`,
  `CreateAliasInput`, `CreatePriceInput`, `ArticleSearchQuery`, `CsvRow`

### Constants
- `ALIAS_TYPE_CONFIG`, `PRICE_SOURCE_CONFIG`, `DEFAULT_ARTICLE_CONFIG`
- Types: `AliasTypeKey`, `AliasTypeConfig`, `PriceSourceKey`, `ArticleConfig`

### Hooks
- `useArticles`, `useArticle`, `useCreateArticle`, `useUpdateArticle`,
  `useDeleteArticle`
- `useAddAlias`, `useDeleteAlias`, `useAddPrice`, `useImportArticles`
- `useArticleStock`, `useStockMovement`
- `useArticleSearch`, `useUnverifiedArticlesCount`

### Components
- `ArticlesPageContent` — lista articoli
- `ArticleDetailView` — dettaglio con tab alias/prezzi/magazzino
- `ArticleCreateDialog`, `ArticleImportDialog`
- `ArticleAutocomplete` — autocomplete search
- `ArticleAliasForm`, `ArticlePriceDialog`, `ArticleStockPanel`

## Consumers

- `src/app/api/articles/**` — REST routes
- `src/app/(dashboard)/articles/**` — pagine dashboard
- `src/server/agents/tools/procurement.tools.ts` — aggregator tool AI
- `src/server/agents/email-intelligence.agent.ts` — email agent AI
- `src/components/layout/sidebar-nav-item.tsx` — sidebar badge count
