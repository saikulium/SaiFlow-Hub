'use client'

// ---------------------------------------------------------------------------
// ShipmentForm — form inline/dialog per creare una nuova spedizione su un
// RequestItem della PR. Seleziona l'articolo, inserisce quantità, tracking,
// data prevista/effettiva.
//
// Validazione client minimale: quantità > 0 e <= item.quantity (il cap con
// tolleranza è verificato lato server).
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { Loader2, Truck, X } from 'lucide-react'
import type { RequestItem } from '../hooks/use-request'
import {
  useCreateShipment,
  type ShipmentStatus,
} from '../hooks/use-shipments'

// --- Props -------------------------------------------------------------------

interface ShipmentFormProps {
  readonly requestId: string
  readonly items: readonly RequestItem[]
  readonly onClose: () => void
}

// --- Component ---------------------------------------------------------------

export function ShipmentForm({
  requestId,
  items,
  onClose,
}: ShipmentFormProps) {
  const [requestItemId, setRequestItemId] = useState<string>(
    items[0]?.id ?? '',
  )
  const [shippedQuantity, setShippedQuantity] = useState<string>('')
  const [status, setStatus] = useState<ShipmentStatus>('SHIPPED')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [actualShipDate, setActualShipDate] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const createMutation = useCreateShipment(requestId)
  const busy = createMutation.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!requestItemId) {
      setError('Seleziona un articolo')
      return
    }
    const qtyNum = Number(shippedQuantity)
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError('Quantità non valida')
      return
    }

    try {
      await createMutation.mutateAsync({
        requestId,
        requestItemId,
        shippedQuantity: shippedQuantity,
        status,
        trackingNumber: trackingNumber.trim() || undefined,
        carrier: carrier.trim() || undefined,
        trackingUrl: trackingUrl.trim() || undefined,
        actualShipDate:
          status !== 'PENDING' && actualShipDate
            ? new Date(actualShipDate).toISOString()
            : undefined,
        expectedDeliveryDate: expectedDeliveryDate
          ? new Date(expectedDeliveryDate).toISOString()
          : undefined,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-card border border-pf-border bg-pf-bg-secondary p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-pf-text-primary">
          <Truck className="h-4 w-4 text-pf-accent" />
          Nuova spedizione
        </h3>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-button p-1 text-pf-text-secondary hover:bg-pf-bg-tertiary hover:text-pf-text-primary disabled:opacity-50"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Article */}
      <div className="space-y-1">
        <label
          htmlFor="shipment-item"
          className="text-xs font-medium text-pf-text-secondary"
        >
          Articolo
        </label>
        <select
          id="shipment-item"
          value={requestItemId}
          onChange={(e) => setRequestItemId(e.target.value)}
          disabled={busy || items.length === 0}
          className="h-9 w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-2 text-sm text-pf-text-primary outline-none focus:border-pf-accent"
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · qty {item.quantity}
              {item.unit ? ` ${item.unit}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Quantity */}
        <div className="space-y-1">
          <label
            htmlFor="shipment-qty"
            className="text-xs font-medium text-pf-text-secondary"
          >
            Quantità spedita
          </label>
          <input
            id="shipment-qty"
            type="number"
            min="0"
            step="0.01"
            value={shippedQuantity}
            onChange={(e) => setShippedQuantity(e.target.value)}
            disabled={busy}
            required
            className="h-9 w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 text-sm text-pf-text-primary outline-none focus:border-pf-accent"
          />
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label
            htmlFor="shipment-status"
            className="text-xs font-medium text-pf-text-secondary"
          >
            Stato iniziale
          </label>
          <select
            id="shipment-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
            disabled={busy}
            className="h-9 w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-2 text-sm text-pf-text-primary outline-none focus:border-pf-accent"
          >
            <option value="PENDING">PENDING</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="DELIVERED">DELIVERED</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Tracking number */}
        <div className="space-y-1">
          <label
            htmlFor="shipment-tracking"
            className="text-xs font-medium text-pf-text-secondary"
          >
            Numero tracking
          </label>
          <input
            id="shipment-tracking"
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            disabled={busy}
            maxLength={200}
            placeholder="Es. TRK123456789"
            className="h-9 w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 text-sm text-pf-text-primary outline-none focus:border-pf-accent"
          />
        </div>

        {/* Carrier */}
        <div className="space-y-1">
          <label
            htmlFor="shipment-carrier"
            className="text-xs font-medium text-pf-text-secondary"
          >
            Corriere
          </label>
          <input
            id="shipment-carrier"
            type="text"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            disabled={busy}
            maxLength={100}
            placeholder="DHL, GLS, BRT..."
            className="h-9 w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 text-sm text-pf-text-primary outline-none focus:border-pf-accent"
          />
        </div>
      </div>

      {/* Tracking URL */}
      <div className="space-y-1">
        <label
          htmlFor="shipment-url"
          className="text-xs font-medium text-pf-text-secondary"
        >
          URL tracking (opzionale)
        </label>
        <input
          id="shipment-url"
          type="url"
          value={trackingUrl}
          onChange={(e) => setTrackingUrl(e.target.value)}
          disabled={busy}
          maxLength={500}
          placeholder="https://..."
          className="h-9 w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 text-sm text-pf-text-primary outline-none focus:border-pf-accent"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Ship date */}
        <div className="space-y-1">
          <label
            htmlFor="shipment-ship-date"
            className="text-xs font-medium text-pf-text-secondary"
          >
            Data spedizione
          </label>
          <input
            id="shipment-ship-date"
            type="date"
            value={actualShipDate}
            onChange={(e) => setActualShipDate(e.target.value)}
            disabled={busy || status === 'PENDING'}
            className="h-9 w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 text-sm text-pf-text-primary outline-none focus:border-pf-accent"
          />
        </div>

        {/* Expected delivery date */}
        <div className="space-y-1">
          <label
            htmlFor="shipment-delivery-date"
            className="text-xs font-medium text-pf-text-secondary"
          >
            Consegna prevista
          </label>
          <input
            id="shipment-delivery-date"
            type="date"
            value={expectedDeliveryDate}
            onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            disabled={busy}
            className="h-9 w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 text-sm text-pf-text-primary outline-none focus:border-pf-accent"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label
          htmlFor="shipment-notes"
          className="text-xs font-medium text-pf-text-secondary"
        >
          Note (opzionale)
        </label>
        <textarea
          id="shipment-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={busy}
          rows={2}
          maxLength={2000}
          className="w-full resize-none rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary outline-none focus:border-pf-accent"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy || !requestItemId || !shippedQuantity}
          className="inline-flex h-9 items-center gap-1.5 rounded-button bg-pf-accent px-3 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Truck className="h-4 w-4" />
          )}
          Crea spedizione
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="inline-flex h-9 items-center rounded-button border border-pf-border px-3 text-sm font-medium text-pf-text-secondary hover:bg-pf-bg-tertiary disabled:opacity-50"
        >
          Annulla
        </button>
      </div>
    </form>
  )
}
