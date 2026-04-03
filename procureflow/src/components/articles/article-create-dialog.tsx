'use client'

import { useState, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useCreateArticle } from '@/hooks/use-articles'
import type { CreateArticleInput } from '@/lib/validations/article'

interface ArticleCreateDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

const INITIAL_FORM: CreateArticleInput = {
  name: '',
  unit_of_measure: '',
  category: undefined,
  manufacturer: undefined,
  manufacturer_code: undefined,
  notes: undefined,
  tags: [],
  aliases: [],
}

export function ArticleCreateDialog({
  open,
  onOpenChange,
}: ArticleCreateDialogProps) {
  const [form, setForm] = useState<CreateArticleInput>({ ...INITIAL_FORM })
  const [tagsInput, setTagsInput] = useState('')
  const createMutation = useCreateArticle()

  const updateField = useCallback(
    <K extends keyof CreateArticleInput>(key: K, value: CreateArticleInput[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const data: CreateArticleInput = { ...form, tags }

      try {
        await createMutation.mutateAsync(data)
        setForm({ ...INITIAL_FORM })
        setTagsInput('')
        onOpenChange(false)
      } catch {
        // Error handled by mutation state
      }
    },
    [form, tagsInput, createMutation, onOpenChange],
  )

  const handleClose = useCallback(() => {
    setForm({ ...INITIAL_FORM })
    setTagsInput('')
    onOpenChange(false)
  }, [onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-pf-border bg-pf-bg-secondary p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-pf-text-primary">
            Nuovo Articolo
          </h2>
          <button
            onClick={handleClose}
            className="rounded-button p-1 text-pf-text-muted transition-colors hover:text-pf-text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
              Nome *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Nome articolo"
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            />
          </div>

          {/* UM */}
          <div>
            <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
              Unità di misura *
            </label>
            <input
              type="text"
              required
              value={form.unit_of_measure}
              onChange={(e) => updateField('unit_of_measure', e.target.value)}
              placeholder="pz, kg, m, lt..."
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            />
          </div>

          {/* Categoria + Produttore */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
                Categoria
              </label>
              <input
                type="text"
                value={form.category ?? ''}
                onChange={(e) =>
                  updateField('category', e.target.value || undefined)
                }
                placeholder="Es. Connettori"
                className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
                Produttore
              </label>
              <input
                type="text"
                value={form.manufacturer ?? ''}
                onChange={(e) =>
                  updateField('manufacturer', e.target.value || undefined)
                }
                placeholder="Es. Amphenol"
                className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              />
            </div>
          </div>

          {/* Codice produttore */}
          <div>
            <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
              Codice produttore
            </label>
            <input
              type="text"
              value={form.manufacturer_code ?? ''}
              onChange={(e) =>
                updateField('manufacturer_code', e.target.value || undefined)
              }
              placeholder="Part number produttore"
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            />
          </div>

          {/* Note */}
          <div>
            <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
              Note
            </label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) =>
                updateField('notes', e.target.value || undefined)
              }
              rows={2}
              placeholder="Note aggiuntive"
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
              Tag (separati da virgola)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="militare, connettore, MIL-SPEC"
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            />
          </div>

          {/* Error */}
          {createMutation.isError && (
            <p className="text-sm text-red-400">
              {createMutation.error?.message ?? 'Errore durante la creazione'}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Crea Articolo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
