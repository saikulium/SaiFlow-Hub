// Export pubblico del modulo articles.
// Chi vuole usare il modulo importa DA QUI, non dai file interni.

// Services
export {
  parseCsvRows,
  importArticles,
} from './server/article-import.service'

// Tools AI
export {
  findOrCreateArticleTool,
  linkArticleToRequestItemTool,
  ARTICLE_TOOLS,
} from './server/article.tools'

// Constants
export {
  ALIAS_TYPE_CONFIG,
  PRICE_SOURCE_CONFIG,
  DEFAULT_ARTICLE_CONFIG,
  type AliasTypeKey,
  type AliasTypeConfig,
  type PriceSourceKey,
  type ArticleConfig,
} from './constants'

// Validations
export {
  createArticleSchema,
  updateArticleSchema,
  articleQuerySchema,
  createAliasSchema,
  createPriceSchema,
  articleSearchSchema,
  csvRowSchema,
  type CreateArticleInput,
  type UpdateArticleInput,
  type ArticleQuery,
  type CreateAliasInput,
  type CreatePriceInput,
  type ArticleSearchQuery,
  type CsvRow,
} from './validations/article'

// Hooks
export {
  useArticles,
  useArticle,
  useCreateArticle,
  useUpdateArticle,
  useDeleteArticle,
  useAddAlias,
  useDeleteAlias,
  useAddPrice,
  useImportArticles,
  useArticleStock,
  useStockMovement,
} from './hooks/use-articles'

export { useArticleSearch } from './hooks/use-article-search'
export { useUnverifiedArticlesCount } from './hooks/use-unverified-articles-count'

// Components
export { ArticlesPageContent } from './components/articles-page-content'
export { ArticleDetailView } from './components/article-detail'
export { ArticleCreateDialog } from './components/article-create-dialog'
export { ArticleImportDialog } from './components/article-import-dialog'
export { ArticleAutocomplete } from './components/article-autocomplete'
export { ArticleAliasForm } from './components/article-alias-form'
export { ArticlePriceDialog } from './components/article-price-dialog'
export { ArticleStockPanel } from './components/article-stock-panel'
