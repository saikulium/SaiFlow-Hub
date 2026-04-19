'use client'

import { useState, useCallback } from 'react'
import { Loader2, X } from 'lucide-react'
import { useAddAlias } from '../hooks/use-articles'
import { ALIAS_TYPE_CONFIG } from '../constants'
import type { AliasTypeKey } from '../constants'

interface ArticleAliasFormProps {
  readonly articleId: string
  readonly onClose: () => void
}

const ALIAS_TYPES = Object.keys(ALIAS_TYPE_CONFIG) as AliasTypeKey[]

export function ArticleAliasForm({
  articleId,
  onClose,
}: ArticleAliasFormProps) {
  const [aliasType, setAliasType] = useState<AliasTypeKey>('VENDOR')
  const [aliasCode, setAliasCode] = useState('')
  const [aliasLabel, setAliasLabel] = useState('')
  const [entityId, setEntityId] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)

  const addAliasMutation = useAddAlias(articleId)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        await addAliasMutation.mutateAsync({
          alias_type: aliasType,
          alias_code: aliasCode,
          alias_label: aliasLabel || undefined,
          entity_id: entityId || undefined,
          is_primary: isPrimary,
        })
        onClose()
      } catch {
        // Error handled by mutation state
      }
    },
    [
      aliasType,
      aliasCode,
      aliasLabel,
      entityId,
      isPrimary,
      addAliasMutation,
      onClose,
    ],
  )

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-pf-border bg-pf-bg-secondary p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-pf-text-primary">Nuovo Alias</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-button p-1 text-pf-text-muted transition-colors hover:text-pf-text-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {/* Tipo */}
        <div>
          <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
            Tipo
          </label>
          <select
            value={aliasType}
            onChange={(e) => setAliasType(e.target.value as AliasTypeKey)}
            className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
          >
            {ALIAS_TYPES.map((type) => (
              <option key={type} value={type}>
                {ALIAS_TYPE_CONFIG[type].label}
              </option>
            ))}
          </select>
        </div>

        {/* Codice */}
        <div>
          <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
            Codice *
          </label>
          <input
            type="text"
            required
            value={aliasCode}
            onChange={(e) => setAliasCode(e.target.value)}
            placeholder="Codice alias"
            className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
          />
        </div>

        {/* Etichetta */}
        <div>
          <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
            Etichetta
          </label>
          <input
            type="text"
            value={aliasLabel}
            onChange={(e) => setAliasLabel(e.target.value)}
            placeholder="Descrizione"
            className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
          />
        </div>

        {/* Entità */}
        <div>
          <label className="mb-1 block text-xs font-medium text-pf-text-secondary">
            Entità
          </label>
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="ID fornitore/cliente"
            className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
          />
        </div>

        {/* Primary + Submit */}
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 pb-2 text-sm text-pf-text-secondary">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="rounded border-pf-border bg-pf-bg-tertiary"
            />
            Primario
          </label>
          <button
            type="submit"
            disabled={addAliasMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-button bg-pf-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
          >
            {addAliasMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            Salva
          </button>
        </div>
      </div>

      {addAliasMutation.isError && (
        <p className="mt-2 text-sm text-red-400">
          {addAliasMutation.error?.message ?? 'Errore durante il salvataggio'}
        </p>
      )}
    </form>
  )
}
