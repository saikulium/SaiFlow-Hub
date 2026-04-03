'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, X, Star } from 'lucide-react'
import { useArticle, useDeleteAlias } from '@/hooks/use-articles'
import { ArticleAliasForm } from '@/components/articles/article-alias-form'
import { ArticlePriceDialog } from '@/components/articles/article-price-dialog'
import { ALIAS_TYPE_CONFIG, PRICE_SOURCE_CONFIG } from '@/lib/constants/article'
import type { AliasTypeKey, PriceSourceKey } from '@/lib/constants/article'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

type TabKey = 'alias' | 'prezzi' | 'dove-usato' | 'dettagli'

const TABS: readonly { readonly key: TabKey; readonly label: string }[] = [
  { key: 'alias', label: 'Alias' },
  { key: 'prezzi', label: 'Prezzi' },
  { key: 'dove-usato', label: 'Dove Usato' },
  { key: 'dettagli', label: 'Dettagli' },
] as const

interface ArticleDetailViewProps {
  readonly articleId: string
}

export function ArticleDetailView({ articleId }: ArticleDetailViewProps) {
  const router = useRouter()
  const { data: article, isLoading, isError } = useArticle(articleId)
  const deleteAliasMutation = useDeleteAlias(articleId)

  const [activeTab, setActiveTab] = useState<TabKey>('alias')
  const [aliasFormOpen, setAliasFormOpen] = useState(false)
  const [priceDialogOpen, setPriceDialogOpen] = useState(false)

  const handleDeleteAlias = useCallback(
    (aliasId: string) => {
      deleteAliasMutation.mutate(aliasId)
    },
    [deleteAliasMutation],
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton-shimmer h-8 w-64 rounded-button" />
        <div className="skeleton-shimmer h-10 w-full rounded-button" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-14 rounded-card" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !article) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-pf-text-secondary">Articolo non trovato.</p>
      </div>
    )
  }

  // Find lowest price for star indicator
  const lowestPriceId =
    article.prices.length > 0
      ? article.prices.reduce((min, p) =>
          p.unit_price < min.unit_price ? p : min,
        ).id
      : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push('/articles')}
          className="mt-1 rounded-button p-1.5 text-pf-text-muted transition-colors hover:text-pf-text-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-pf-text-secondary">
              {article.code}
            </span>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                article.is_active
                  ? 'bg-emerald-400/10 text-emerald-400'
                  : 'bg-zinc-400/10 text-zinc-400',
              )}
            >
              {article.is_active ? 'Attivo' : 'Inattivo'}
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-pf-text-primary">
            {article.name}
          </h1>
          {article.category && (
            <p className="mt-0.5 text-sm text-pf-text-secondary">
              {article.category}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-pf-border">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'border-b-2 pb-3 pt-1 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-pf-accent text-pf-text-primary'
                  : 'border-transparent text-pf-text-muted hover:text-pf-text-secondary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'alias' && (
        <AliasTab
          articleId={articleId}
          aliases={article.aliases}
          aliasFormOpen={aliasFormOpen}
          onToggleForm={() => setAliasFormOpen((prev) => !prev)}
          onDeleteAlias={handleDeleteAlias}
          isDeleting={deleteAliasMutation.isPending}
        />
      )}

      {activeTab === 'prezzi' && (
        <PriceTab
          prices={article.prices}
          lowestPriceId={lowestPriceId}
          priceDialogOpen={priceDialogOpen}
          onToggleDialog={() => setPriceDialogOpen((prev) => !prev)}
          articleId={articleId}
        />
      )}

      {activeTab === 'dove-usato' && <UsageTab counts={article._count} />}

      {activeTab === 'dettagli' && <DetailsTab article={article} />}
    </div>
  )
}

/* --- Alias Tab --- */

function AliasTab({
  articleId,
  aliases,
  aliasFormOpen,
  onToggleForm,
  onDeleteAlias,
  isDeleting,
}: {
  readonly articleId: string
  readonly aliases: readonly {
    readonly id: string
    readonly alias_type: AliasTypeKey
    readonly alias_code: string
    readonly alias_label: string | null
    readonly entity_id: string | null
    readonly is_primary: boolean
    readonly created_at: string
  }[]
  readonly aliasFormOpen: boolean
  readonly onToggleForm: () => void
  readonly onDeleteAlias: (aliasId: string) => void
  readonly isDeleting: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-pf-text-secondary">
          {aliases.length} alias registrati
        </p>
        <button
          onClick={onToggleForm}
          className="inline-flex items-center gap-1.5 rounded-button bg-pf-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-pf-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          Aggiungi Alias
        </button>
      </div>

      {aliasFormOpen && (
        <ArticleAliasForm articleId={articleId} onClose={onToggleForm} />
      )}

      <div className="bg-pf-bg-secondary/60 overflow-x-auto rounded-card border border-pf-border backdrop-blur-xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-pf-border">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Codice
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Etichetta
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
                Entità
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Primario
              </th>
              <th className="w-[50px] px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {aliases.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-pf-text-muted"
                >
                  Nessun alias registrato
                </td>
              </tr>
            )}
            {aliases.map((alias) => {
              const config = ALIAS_TYPE_CONFIG[alias.alias_type]
              const Icon = config.icon
              return (
                <tr
                  key={alias.id}
                  className="border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
                >
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        config.bgColor,
                        config.color,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-pf-text-primary">
                    {alias.alias_code}
                  </td>
                  <td className="px-4 py-3 text-sm text-pf-text-secondary">
                    {alias.alias_label ?? '-'}
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                    {alias.entity_id ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {alias.is_primary && (
                      <Star className="mx-auto h-4 w-4 fill-amber-400 text-amber-400" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onDeleteAlias(alias.id)}
                      disabled={isDeleting}
                      className="rounded-button p-1 text-pf-text-muted transition-colors hover:text-red-400 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* --- Price Tab --- */

function PriceTab({
  prices,
  lowestPriceId,
  priceDialogOpen,
  onToggleDialog,
  articleId,
}: {
  readonly prices: readonly {
    readonly id: string
    readonly vendor: { readonly id: string; readonly name: string }
    readonly unit_price: number
    readonly currency: string
    readonly min_quantity: number
    readonly valid_from: string
    readonly valid_until: string | null
    readonly source: PriceSourceKey
    readonly notes: string | null
    readonly created_at: string
  }[]
  readonly lowestPriceId: string | null
  readonly priceDialogOpen: boolean
  readonly onToggleDialog: () => void
  readonly articleId: string
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-pf-text-secondary">
          {prices.length} listini registrati
        </p>
        <button
          onClick={onToggleDialog}
          className="inline-flex items-center gap-1.5 rounded-button bg-pf-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-pf-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          Aggiungi Prezzo
        </button>
      </div>

      <div className="bg-pf-bg-secondary/60 overflow-x-auto rounded-card border border-pf-border backdrop-blur-xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-pf-border">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Fornitore
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Prezzo
              </th>
              <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary sm:table-cell">
                Q.tà Min
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
                Da / A
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Fonte
              </th>
            </tr>
          </thead>
          <tbody>
            {prices.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-pf-text-muted"
                >
                  Nessun prezzo registrato
                </td>
              </tr>
            )}
            {prices.map((price) => {
              const sourceConfig = PRICE_SOURCE_CONFIG[price.source]
              const isLowest = price.id === lowestPriceId
              return (
                <tr
                  key={price.id}
                  className="border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isLowest && (
                        <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                      )}
                      <span className="text-sm font-medium text-pf-text-primary">
                        {price.vendor.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-pf-text-primary">
                    {formatCurrency(price.unit_price)}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-sm text-pf-text-secondary sm:table-cell">
                    {price.min_quantity}
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                    {formatDate(price.valid_from)}
                    {price.valid_until
                      ? ` — ${formatDate(price.valid_until)}`
                      : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        sourceConfig.bgColor,
                        sourceConfig.color,
                      )}
                    >
                      {sourceConfig.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ArticlePriceDialog
        articleId={articleId}
        open={priceDialogOpen}
        onOpenChange={onToggleDialog}
      />
    </div>
  )
}

/* --- Usage Tab --- */

function UsageTab({
  counts,
}: {
  readonly counts: {
    readonly request_items: number
    readonly invoice_items: number
    readonly materials: number
  }
}) {
  const cards = [
    { label: 'Righe RDA', value: counts.request_items },
    { label: 'Righe fattura', value: counts.invoice_items },
    { label: 'Materiali', value: counts.materials },
  ] as const

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-card border border-pf-border bg-pf-bg-secondary p-6"
        >
          <p className="text-sm text-pf-text-secondary">{card.label}</p>
          <p className="mt-2 font-display text-3xl font-bold text-pf-text-primary">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}

/* --- Details Tab --- */

function DetailsTab({
  article,
}: {
  readonly article: {
    readonly manufacturer: string | null
    readonly manufacturer_code: string | null
    readonly description: string | null
    readonly notes: string | null
    readonly tags: readonly string[]
    readonly unit_of_measure: string
    readonly created_at: string
    readonly updated_at: string
  }
}) {
  const fields = [
    { label: 'Unità di misura', value: article.unit_of_measure },
    { label: 'Produttore', value: article.manufacturer },
    { label: 'Codice produttore', value: article.manufacturer_code },
    { label: 'Descrizione', value: article.description },
    { label: 'Note', value: article.notes },
    { label: 'Creato il', value: formatDate(article.created_at) },
    { label: 'Aggiornato il', value: formatDate(article.updated_at) },
  ] as const

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs font-medium uppercase tracking-wider text-pf-text-muted">
                {field.label}
              </dt>
              <dd className="mt-1 text-sm text-pf-text-primary">
                {field.value ?? '-'}
              </dd>
            </div>
          ))}
        </dl>

        {article.tags.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-pf-text-muted">
              Tag
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-pf-bg-tertiary px-2.5 py-0.5 text-xs font-medium text-pf-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
