'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Search,
  Package,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { useArticles, useUpdateArticle } from '../hooks/use-articles'
import { useUnverifiedArticlesCount } from '../hooks/use-unverified-articles-count'
import { ArticleCreateDialog } from './article-create-dialog'
import { ArticleImportDialog } from './article-import-dialog'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

const DEFAULT_PAGE_SIZE = 20

function SkeletonRow() {
  return (
    <tr className="border-b border-pf-border">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton-shimmer h-4 w-full rounded" />
        </td>
      ))}
    </tr>
  )
}

export function ArticlesPageContent() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState<
    'all' | 'unverified' | 'verified'
  >('all')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: unverifiedCountData } = useUnverifiedArticlesCount()
  const unverifiedCount = unverifiedCountData ?? 0

  const { data: response, isLoading } = useArticles({
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    search: search || undefined,
    category: category || undefined,
    ...(verifiedFilter === 'unverified' && { verified: false }),
    ...(verifiedFilter === 'verified' && { verified: true }),
  })

  const articles = response?.data ?? []
  const meta = response?.meta
  const total = meta?.total ?? 0
  const totalPages = meta ? Math.ceil(meta.total / meta.pageSize) : 1

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value)
    setPage(1)
  }, [])

  const handleVerifiedFilterChange = useCallback(
    (filter: 'all' | 'unverified' | 'verified') => {
      setVerifiedFilter(filter)
      setPage(1)
    },
    [],
  )

  const handleVerify = useCallback(
    async (e: React.MouseEvent, articleId: string) => {
      e.stopPropagation()
      try {
        const res = await fetch(`/api/articles/${articleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verified: true }),
        })
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ['articles'] })
          queryClient.invalidateQueries({
            queryKey: ['articles-unverified-count'],
          })
        }
      } catch {
        // Silently fail — user can retry
      }
    },
    [queryClient],
  )

  const handlePrevPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1))
  }, [])

  const handleNextPage = useCallback(() => {
    setPage((prev) => Math.min(totalPages, prev + 1))
  }, [totalPages])

  const handleDownloadTemplate = useCallback(() => {
    const headers =
      'codice_interno,nome,categoria,um,produttore,codice_produttore,tipo_alias,codice_alias,entita,note_alias'
    const example1 =
      'ART-001,Vite M8x40 zincata,Ferramenta,pz,Fischer,FIS-M8-40,vendor,FISC-M840,Fischer Italia Srl,Alias fornitore principale'
    const example2 =
      'ART-001,Vite M8x40 zincata,Ferramenta,pz,,,client,VIT-8-40,Rossi Costruzioni,Codice usato dal cliente'
    const example3 =
      'ART-002,Tubo rame 22mm,Idraulica,m,Frap,FR-T22,vendor,FRAP-22,Frap SpA,'
    const csv = [headers, example1, example2, example3].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'template_articoli.csv'
    link.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleRowClick = useCallback(
    (id: string) => {
      router.push(`/articles/${id}`)
    },
    [router],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            Anagrafica Articoli
          </h1>
          <p className="mt-1 text-sm text-pf-text-secondary">
            {isLoading ? 'Caricamento...' : `${total} articoli totali`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:border-pf-border-hover hover:text-pf-text-primary"
          >
            <Download className="h-4 w-4" />
            Download Template
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:border-pf-border-hover hover:text-pf-text-primary"
          >
            <Upload className="h-4 w-4" />
            Importa CSV
          </button>
          <button
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Nuovo Articolo
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Cerca per codice, nome, alias..."
            className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary py-2 pl-9 pr-3 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
          />
        </div>
        <input
          type="text"
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          placeholder="Filtra per categoria"
          className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent sm:w-48"
        />
      </div>

      {/* Verification filter tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleVerifiedFilterChange('all')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-button px-3 py-1.5 text-sm font-medium transition-colors',
            verifiedFilter === 'all'
              ? 'bg-pf-bg-tertiary text-pf-text-primary'
              : 'text-pf-text-secondary hover:text-pf-text-primary',
          )}
        >
          Tutti
        </button>
        <button
          onClick={() => handleVerifiedFilterChange('unverified')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-button px-3 py-1.5 text-sm font-medium transition-colors',
            verifiedFilter === 'unverified'
              ? 'bg-amber-400/10 text-amber-400'
              : 'text-pf-text-secondary hover:text-pf-text-primary',
          )}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          Da Verificare
          {unverifiedCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400/20 px-1.5 text-[11px] font-semibold text-amber-400">
              {unverifiedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => handleVerifiedFilterChange('verified')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-button px-3 py-1.5 text-sm font-medium transition-colors',
            verifiedFilter === 'verified'
              ? 'bg-emerald-400/10 text-emerald-400'
              : 'text-pf-text-secondary hover:text-pf-text-primary',
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Verificati
        </button>
      </div>

      {/* Table */}
      <div className="bg-pf-bg-secondary/60 overflow-x-auto rounded-card border border-pf-border backdrop-blur-xl">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[120px]" />
            <col />
            <col className="hidden w-[120px] md:table-column" />
            <col className="hidden w-[60px] sm:table-column" />
            <col className="w-[80px]" />
            <col className="w-[80px]" />
            <col className="w-[180px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-pf-border">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Codice
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Nome
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
                Categoria
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary sm:table-cell">
                UM
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Alias
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Prezzi
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
                Stato
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {!isLoading && articles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <BookOpen className="mx-auto mb-3 h-10 w-10 text-pf-text-muted" />
                  <p className="text-sm font-medium text-pf-text-secondary">
                    Nessun articolo trovato
                  </p>
                  <p className="mt-1 text-xs text-pf-text-muted">
                    Crea il primo articolo per iniziare.
                  </p>
                </td>
              </tr>
            )}

            {!isLoading &&
              articles.map((article) => (
                <tr
                  key={article.id}
                  onClick={() => handleRowClick(article.id)}
                  className="cursor-pointer border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-pf-text-secondary">
                      {article.code}
                    </span>
                  </td>
                  <td className="overflow-hidden px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="block truncate text-sm font-medium text-pf-text-primary">
                        {article.name}
                      </span>
                      {article._count.materials > 0 && (
                        <span title="Gestito a magazzino">
                          <Package className="h-3.5 w-3.5 shrink-0 text-pf-accent" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                    {article.category ?? '-'}
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-pf-text-secondary sm:table-cell">
                    {article.unit_of_measure}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-pf-bg-tertiary px-2 py-0.5 text-xs font-medium text-pf-text-secondary">
                      {article._count.aliases}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-pf-bg-tertiary px-2 py-0.5 text-xs font-medium text-pf-text-secondary">
                      {article._count.prices}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {!article.verified && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-400"
                          title="Da verificare"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Da verificare
                        </span>
                      )}
                      {article.verified && (
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
                      )}
                      {!article.verified && (
                        <button
                          onClick={(e) => handleVerify(e, article.id)}
                          className="bg-pf-accent/10 hover:bg-pf-accent/20 inline-flex items-center gap-1 rounded-button px-2 py-0.5 text-[11px] font-medium text-pf-accent transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Verifica
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="bg-pf-bg-secondary/60 flex items-center justify-between rounded-card border border-pf-border px-4 py-3 backdrop-blur-xl">
          <p className="text-sm text-pf-text-secondary">
            Pagina{' '}
            <span className="font-medium text-pf-text-primary">{page}</span> di{' '}
            <span className="font-medium text-pf-text-primary">
              {totalPages}
            </span>{' '}
            &middot;{' '}
            <span className="font-medium text-pf-text-primary">{total}</span>{' '}
            risultati
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={page <= 1}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-button border border-pf-border px-3 py-1.5 text-sm font-medium transition-colors',
                page <= 1
                  ? 'text-pf-text-secondary/40 cursor-not-allowed'
                  : 'hover:border-pf-text-secondary/40 text-pf-text-secondary hover:text-pf-text-primary',
              )}
            >
              <ChevronLeft className="h-4 w-4" />
              Precedente
            </button>
            <button
              onClick={handleNextPage}
              disabled={page >= totalPages}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-button border border-pf-border px-3 py-1.5 text-sm font-medium transition-colors',
                page >= totalPages
                  ? 'text-pf-text-secondary/40 cursor-not-allowed'
                  : 'hover:border-pf-text-secondary/40 text-pf-text-secondary hover:text-pf-text-primary',
              )}
            >
              Successiva
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ArticleCreateDialog open={formOpen} onOpenChange={setFormOpen} />
      <ArticleImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
