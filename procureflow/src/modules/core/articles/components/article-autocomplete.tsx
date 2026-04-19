'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { useArticleSearch } from '../hooks/use-article-search'
import { cn } from '@/lib/utils'
import type { ArticleSearchResult } from '@/types'

interface ArticleAutocompleteProps {
  readonly onSelect: (article: ArticleSearchResult) => void
  readonly placeholder?: string
  readonly className?: string
}

function matchLabel(matchedVia: string): string {
  switch (matchedVia) {
    case 'code':
      return 'tramite codice'
    case 'name':
      return 'tramite nome'
    case 'alias':
      return 'tramite alias'
    case 'manufacturer_code':
      return 'tramite cod. produttore'
    default:
      return ''
  }
}

function SkeletonRow() {
  return (
    <div className="flex flex-col gap-1 px-3 py-2">
      <div className="skeleton-shimmer h-4 w-3/4 rounded" />
      <div className="skeleton-shimmer h-3 w-1/2 rounded" />
    </div>
  )
}

export function ArticleAutocomplete({
  onSelect,
  placeholder = 'Cerca articolo...',
  className,
}: ArticleAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const { data: results = [], isLoading } = useArticleSearch(query)

  const handleSelect = useCallback(
    (article: ArticleSearchResult) => {
      onSelect(article)
      setQuery('')
      setOpen(false)
      setActiveIndex(-1)
    },
    [onSelect],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || results.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((prev) => Math.min(prev + 1, results.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (activeIndex >= 0 && activeIndex < results.length) {
            const selected = results[activeIndex]
            if (selected) handleSelect(selected)
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          setActiveIndex(-1)
          break
      }
    },
    [open, results, activeIndex, handleSelect],
  )

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as
        | HTMLElement
        | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const showDropdown = open && query.length >= 1

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => {
            if (query.length >= 1) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary py-2 pl-9 pr-3 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-pf-text-muted" />
        )}
      </div>

      {showDropdown && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-card border border-pf-border bg-pf-bg-secondary shadow-lg"
        >
          {isLoading && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {!isLoading && results.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-pf-text-muted">
              Nessun articolo trovato
            </div>
          )}

          {!isLoading &&
            results.map((article, index) => (
              <button
                key={article.id}
                type="button"
                onClick={() => handleSelect(article)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors',
                  index === activeIndex
                    ? 'bg-pf-bg-hover'
                    : 'hover:bg-pf-bg-hover',
                )}
              >
                <span className="text-sm text-pf-text-primary">
                  <span className="font-mono text-xs text-pf-text-secondary">
                    [{article.code}]
                  </span>{' '}
                  {article.name}
                </span>
                {article.matched_via && (
                  <span className="text-xs text-pf-text-muted">
                    {matchLabel(article.matched_via)}
                    {article.matched_value ? `: ${article.matched_value}` : ''}
                  </span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
