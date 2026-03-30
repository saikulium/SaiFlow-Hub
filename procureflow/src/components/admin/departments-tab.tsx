'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminConfig, useUpdateAdminConfig } from '@/hooks/use-admin-config'

// --- Reusable ListEditor ---

function ListEditor({
  title,
  description,
  items,
  onItemsChange,
  placeholder,
}: {
  readonly title: string
  readonly description: string
  readonly items: readonly string[]
  readonly onItemsChange: (items: string[]) => void
  readonly placeholder: string
}) {
  const [newItem, setNewItem] = useState('')

  const handleAdd = useCallback(() => {
    const trimmed = newItem.trim()
    if (!trimmed) return
    if (items.includes(trimmed)) {
      toast.error(`"${trimmed}" gia presente`)
      return
    }
    onItemsChange([...items, trimmed])
    setNewItem('')
  }, [newItem, items, onItemsChange])

  const handleRemove = useCallback(
    (item: string) => {
      onItemsChange(items.filter((i) => i !== item))
    },
    [items, onItemsChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAdd()
      }
    },
    [handleAdd],
  )

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
      <h2 className="mb-1 text-sm font-semibold text-pf-text-primary">
        {title}
      </h2>
      <p className="mb-4 text-xs text-pf-text-secondary">{description}</p>

      {/* Add new item */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-9 flex-1 rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-pf-accent"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-button bg-pf-accent px-3 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Aggiungi
        </button>
      </div>

      {/* Items list */}
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              key={item}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-between rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2"
            >
              <span className="text-sm text-pf-text-primary">{item}</span>
              <button
                type="button"
                onClick={() => handleRemove(item)}
                className="flex h-6 w-6 items-center justify-center rounded-button text-pf-text-muted transition-colors hover:bg-red-400/10 hover:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <p className="py-4 text-center text-sm text-pf-text-muted">
            Nessun elemento configurato
          </p>
        )}
      </div>
    </div>
  )
}

// --- Main Tab ---

function SkeletonBlock() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="rounded-card border border-pf-border bg-pf-bg-secondary p-6"
        >
          <div className="h-5 w-40 animate-pulse rounded bg-pf-border" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                key={j}
                className="h-9 w-full animate-pulse rounded-button bg-pf-border"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function DepartmentsTab() {
  const { data: config, isLoading } = useAdminConfig()
  const updateConfig = useUpdateAdminConfig()

  const [departments, setDepartments] = useState<string[]>([])
  const [costCenters, setCostCenters] = useState<string[]>([])

  useEffect(() => {
    if (config) {
      setDepartments([...config.departments])
      setCostCenters([...config.cost_centers])
    }
  }, [config])

  const handleSave = () => {
    updateConfig.mutate(
      { departments, cost_centers: costCenters },
      {
        onSuccess: () => toast.success('Dipartimenti e centri costo salvati'),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  if (isLoading) {
    return <SkeletonBlock />
  }

  return (
    <div className="space-y-6">
      <ListEditor
        title="Dipartimenti"
        description="Definisci i dipartimenti della tua organizzazione."
        items={departments}
        onItemsChange={setDepartments}
        placeholder="es. IT, Marketing, Produzione..."
      />

      <ListEditor
        title="Centri di Costo"
        description="Definisci i centri di costo per la contabilita."
        items={costCenters}
        onItemsChange={setCostCenters}
        placeholder="es. CC-001, CC-ADMIN, CC-PROD..."
      />

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
          Salva Tutto
        </button>
      </div>
    </div>
  )
}
