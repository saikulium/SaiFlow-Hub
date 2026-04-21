'use client'

import { useState, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useAddPrice } from '../hooks/use-articles'
import { PRICE_SOURCE_CONFIG } from '../constants'
import type { PriceSourceKey } from '../constants'

interface ArticlePriceDialogProps {
  readonly articleId: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

const SOURCE_KEYS = Object.keys(PRICE_SOURCE_CONFIG) as PriceSourceKey[]

export function ArticlePriceDialog({
  articleId,
  open,
  onOpenChange,
}: ArticlePriceDialogProps) {
  const [vendorId, setVendorId] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [minQuantity, setMinQuantity] = useState('1')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [source, setSource] = useState<PriceSourceKey>('manual')
  const [notes, setNotes] = useState('')

  const addPriceMutation = useAddPrice(articleId)

  const resetForm = useCallback(() => {
    setVendorId('')
    setUnitPrice('')
    setCurrency('EUR')
    setMinQuantity('1')
    setValidFrom('')
    setValidUntil('')
    setSource('manual')
    setNotes('')
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onOpenChange(false)
  }, [resetForm, onOpenChange])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      try {
        await addPriceMutation.mutateAsync({
          vendor_id: vendorId,
          unit_price: parseFloat(unitPrice),
          currency,
          min_quantity: parseInt(minQuantity, 10),
          valid_from: validFrom || undefined,
          valid_until: validUntil || undefined,
          source,
          notes: notes || undefined,
        })
        resetForm()
        onOpenChange(false)
      } catch {
        // Error handled by mutation state
      }
    },
    [
      vendorId,
      unitPrice,
      currency,
      minQuantity,
      validFrom,
      validUntil,
      source,
      notes,
      addPriceMutation,
      resetForm,
      onOpenChange,
    ],
  )

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
            Nuovo Prezzo
          </h2>
          <button
            onClick={handleClose}
            className="rounded-button p-1 text-pf-text-muted transition-colors hover:text-pf-text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fornitore */}
          <div>
            <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
              ID Fornitore *
            </label>
            <input
              type="text"
              required
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              placeholder="ID del fornitore"
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            />
          </div>

          {/* Prezzo + Valuta */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
                Prezzo unitario *
              </label>
              <input
                type="number"
                required
                step="0.01"
                min="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
                Valuta
              </label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              />
            </div>
          </div>

          {/* Quantità minima */}
          <div>
            <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
              Quantità minima
            </label>
            <input
              type="number"
              min="1"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            />
          </div>

          {/* Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
                Valido dal
              </label>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
                Valido fino al
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              />
            </div>
          </div>

          {/* Fonte */}
          <div>
            <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
              Fonte
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as PriceSourceKey)}
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            >
              {SOURCE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {PRICE_SOURCE_CONFIG[key].label}
                </option>
              ))}
            </select>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1 block text-sm font-medium text-pf-text-secondary">
              Note
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Note aggiuntive"
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            />
          </div>

          {/* Error */}
          {addPriceMutation.isError && (
            <p className="text-sm text-red-400">
              {addPriceMutation.error?.message ??
                'Errore durante il salvataggio'}
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
              disabled={addPriceMutation.isPending}
              className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
            >
              {addPriceMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Salva Prezzo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
