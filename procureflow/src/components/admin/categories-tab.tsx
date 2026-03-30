'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Loader2, Save, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminConfig, useUpdateAdminConfig } from '@/hooks/use-admin-config'

function SkeletonBlock() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-9 w-full animate-pulse rounded-button bg-pf-border" />
      ))}
    </div>
  )
}

export function CategoriesTab() {
  const { data: config, isLoading } = useAdminConfig()
  const updateConfig = useUpdateAdminConfig()

  const [categories, setCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    if (config) {
      setCategories([...config.categories])
    }
  }, [config])

  const handleAdd = useCallback(() => {
    const trimmed = newCategory.trim()
    if (!trimmed) return
    if (categories.includes(trimmed)) {
      toast.error('Categoria gia presente')
      return
    }
    setCategories((prev) => [...prev, trimmed])
    setNewCategory('')
  }, [newCategory, categories])

  const handleRemove = useCallback((category: string) => {
    setCategories((prev) => prev.filter((c) => c !== category))
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAdd()
      }
    },
    [handleAdd],
  )

  const handleSave = () => {
    updateConfig.mutate(
      { categories },
      {
        onSuccess: () => toast.success('Categorie salvate'),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <SkeletonBlock />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <h2 className="mb-4 text-sm font-semibold text-pf-text-primary">
          Categorie Merceologiche
        </h2>
        <p className="mb-4 text-xs text-pf-text-secondary">
          Gestisci le categorie disponibili per richieste e fornitori.
        </p>

        {/* Add new category */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nuova categoria..."
            className="h-9 flex-1 rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-pf-accent"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newCategory.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-button bg-pf-accent px-3 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Aggiungi
          </button>
        </div>

        {/* Category list */}
        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {categories.map((category) => (
              <motion.div
                key={category}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-between rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-pf-text-muted" />
                  <span className="text-sm text-pf-text-primary">{category}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(category)}
                  className="flex h-6 w-6 items-center justify-center rounded-button text-pf-text-muted transition-colors hover:bg-red-400/10 hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {categories.length === 0 && (
            <p className="py-4 text-center text-sm text-pf-text-muted">
              Nessuna categoria configurata
            </p>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateConfig.isPending}
          className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updateConfig.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salva Categorie
        </button>
      </div>
    </div>
  )
}
