'use client'

// ---------------------------------------------------------------------------
// SpedizioniTab — lista delle spedizioni per una PR, raggruppate per articolo.
// Per ogni shipment mostra stato corrente, quantità, tracking e permette
// agli utenti con ruolo MANAGER/ADMIN di avanzare lo stato (PENDING → SHIPPED
// → DELIVERED) tramite un menu inline.
//
// Viene mostrato un banner di delivery_status aggregato per ogni articolo
// (derivato da RequestItem.delivery_status).
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react'
import {
  Truck,
  Package,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  Ban,
  AlertTriangle,
  PackageCheck,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RequestItem } from '../../hooks/use-request'
import {
  useShipments,
  useUpdateShipmentStatus,
  type Shipment,
  type ShipmentStatus,
} from '../../hooks/use-shipments'
import { ShipmentForm } from '../shipment-form'
import { EmptyState } from './empty-state'

// --- Props -------------------------------------------------------------------

interface SpedizioniTabProps {
  readonly requestId: string
  readonly items: readonly RequestItem[]
  readonly canManage: boolean
}

// --- Helpers -----------------------------------------------------------------

function formatDate(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

const STATUS_STYLES: Record<ShipmentStatus, string> = {
  PENDING: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  SHIPPED: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  DELIVERED: 'border-green-500/30 bg-green-500/10 text-green-300',
  RETURNED: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  LOST: 'border-red-500/30 bg-red-500/10 text-red-300',
  CANCELLED: 'border-pf-border bg-pf-bg-tertiary text-pf-text-muted',
}

const STATUS_LABEL: Record<ShipmentStatus, string> = {
  PENDING: 'In preparazione',
  SHIPPED: 'Spedito',
  DELIVERED: 'Consegnato',
  RETURNED: 'Reso',
  LOST: 'Smarrito',
  CANCELLED: 'Annullato',
}

function ShipmentStatusBadge({ status }: { readonly status: ShipmentStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-badge border px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

const DELIVERY_LABEL: Record<
  NonNullable<RequestItem['delivery_status']>,
  { readonly label: string; readonly style: string; readonly Icon: React.ElementType }
> = {
  CONFIRMED: {
    label: 'Confermato',
    style: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    Icon: Clock,
  },
  PARTIAL: {
    label: 'Parziale',
    style: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    Icon: AlertTriangle,
  },
  BACKORDERED: {
    label: 'Back-order',
    style: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    Icon: AlertTriangle,
  },
  UNAVAILABLE: {
    label: 'Non disponibile',
    style: 'border-red-500/30 bg-red-500/10 text-red-300',
    Icon: Ban,
  },
  SHIPPED: {
    label: 'Spedito',
    style: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
    Icon: Truck,
  },
  DELIVERED: {
    label: 'Consegnato',
    style: 'border-green-500/30 bg-green-500/10 text-green-300',
    Icon: PackageCheck,
  },
  CANCELLED: {
    label: 'Annullato',
    style: 'border-pf-border bg-pf-bg-tertiary text-pf-text-muted',
    Icon: Ban,
  },
}

function DeliveryStatusBadge({
  status,
}: {
  readonly status: NonNullable<RequestItem['delivery_status']>
}) {
  const { label, style, Icon } = DELIVERY_LABEL[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-badge border px-2 py-0.5 text-xs font-medium',
        style,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// --- Shipment row ------------------------------------------------------------

interface ShipmentRowProps {
  readonly shipment: Shipment
  readonly requestId: string
  readonly canManage: boolean
}

function ShipmentRow({ shipment, requestId, canManage }: ShipmentRowProps) {
  const [editing, setEditing] = useState(false)
  const [nextStatus, setNextStatus] = useState<ShipmentStatus>(shipment.status)
  const [error, setError] = useState<string | null>(null)

  const updateMutation = useUpdateShipmentStatus(requestId)
  const busy = updateMutation.isPending

  async function handleSubmit() {
    setError(null)
    if (nextStatus === shipment.status) {
      setEditing(false)
      return
    }
    try {
      const nowIso = new Date().toISOString()
      await updateMutation.mutateAsync({
        shipmentId: shipment.id,
        status: nextStatus,
        actualShipDate:
          nextStatus === 'SHIPPED' && !shipment.actual_ship_date
            ? nowIso
            : undefined,
        actualDeliveryDate:
          nextStatus === 'DELIVERED' && !shipment.actual_delivery_date
            ? nowIso
            : undefined,
      })
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    }
  }

  return (
    <div className="space-y-2 rounded-card border border-pf-border bg-pf-bg-tertiary p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <ShipmentStatusBadge status={shipment.status} />
            <span className="text-sm font-medium text-pf-text-primary">
              {shipment.shipped_quantity} pz
            </span>
            {shipment.source !== 'MANUAL' && (
              <span className="rounded-badge border border-pf-border bg-pf-bg-secondary px-2 py-0.5 text-xs text-pf-text-secondary">
                {shipment.source}
              </span>
            )}
          </div>
          <p className="text-xs text-pf-text-secondary">
            {shipment.tracking_number ? (
              <>
                Tracking:{' '}
                <span className="font-mono text-pf-text-primary">
                  {shipment.tracking_number}
                </span>
                {shipment.carrier ? ` · ${shipment.carrier}` : ''}
              </>
            ) : (
              <>Nessun tracking</>
            )}
          </p>
          <p className="text-xs text-pf-text-secondary">
            Spedita: {formatDate(shipment.actual_ship_date)} · Consegna prev.:{' '}
            {formatDate(shipment.expected_delivery_date)}
            {shipment.actual_delivery_date
              ? ` · Consegnata: ${formatDate(shipment.actual_delivery_date)}`
              : ''}
          </p>
          {shipment.notes && (
            <p className="text-xs text-pf-text-muted italic">
              {shipment.notes}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          {shipment.tracking_url && (
            <a
              href={shipment.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-pf-accent hover:underline"
            >
              Traccia <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {canManage && !editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(true)
                setNextStatus(shipment.status)
              }}
              className="text-xs text-pf-text-secondary hover:text-pf-text-primary hover:underline"
            >
              Cambia stato
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex flex-wrap items-center gap-2 border-t border-pf-border pt-2">
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as ShipmentStatus)}
            disabled={busy}
            className="h-8 rounded-button border border-pf-border bg-pf-bg-secondary px-2 text-xs text-pf-text-primary outline-none focus:border-pf-accent"
          >
            <option value="PENDING">PENDING</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="RETURNED">RETURNED</option>
            <option value="LOST">LOST</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-button bg-pf-accent px-3 text-xs font-medium text-white hover:bg-pf-accent-hover disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Salva
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false)
              setError(null)
            }}
            disabled={busy}
            className="inline-flex h-8 items-center rounded-button border border-pf-border px-3 text-xs text-pf-text-secondary hover:bg-pf-bg-secondary disabled:opacity-50"
          >
            Annulla
          </button>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
      )}
    </div>
  )
}

// --- Item group --------------------------------------------------------------

interface ItemGroupProps {
  readonly item: RequestItem
  readonly shipments: readonly Shipment[]
  readonly requestId: string
  readonly canManage: boolean
}

function ItemGroup({ item, shipments, requestId, canManage }: ItemGroupProps) {
  const deliveryStatus = item.delivery_status ?? 'CONFIRMED'

  const totalShipped = shipments.reduce(
    (sum, s) => sum + Number(s.shipped_quantity || 0),
    0,
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-pf-accent" />
          <h3 className="text-sm font-medium text-pf-text-primary">
            {item.name}
          </h3>
          <span className="text-xs text-pf-text-secondary">
            · qty {item.quantity}
            {item.unit ? ` ${item.unit}` : ''}
          </span>
          <DeliveryStatusBadge status={deliveryStatus} />
        </div>
        <p className="text-xs text-pf-text-secondary">
          Spedite: {totalShipped} / {item.quantity}
        </p>
      </div>
      {shipments.length === 0 ? (
        <p className="rounded-card border border-dashed border-pf-border bg-pf-bg-secondary/50 px-3 py-2 text-xs text-pf-text-muted">
          Nessuna spedizione per questo articolo.
        </p>
      ) : (
        <div className="space-y-2">
          {shipments.map((s) => (
            <ShipmentRow
              key={s.id}
              shipment={s}
              requestId={requestId}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// --- Main tab ----------------------------------------------------------------

export function SpedizioniTab({
  requestId,
  items,
  canManage,
}: SpedizioniTabProps) {
  const { data: shipments, isLoading } = useShipments(requestId)
  const [formOpen, setFormOpen] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<string, Shipment[]>()
    for (const s of shipments ?? []) {
      const list = map.get(s.request_item_id) ?? []
      list.push(s)
      map.set(s.request_item_id, list)
    }
    return map
  }, [shipments])

  return (
    <div className="space-y-4">
      {/* Header actions */}
      {canManage && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-pf-text-secondary">
            {shipments?.length ?? 0} spedizioni totali
          </div>
          {!formOpen && items.length > 0 && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-button bg-pf-accent px-3 text-sm font-medium text-white hover:bg-pf-accent-hover"
            >
              <Plus className="h-4 w-4" />
              Nuova spedizione
            </button>
          )}
        </div>
      )}

      {formOpen && (
        <ShipmentForm
          requestId={requestId}
          items={items}
          onClose={() => setFormOpen(false)}
        />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-pf-text-muted" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!items || items.length === 0) && (
        <EmptyState
          icon={Package}
          title="Nessun articolo"
          description="Aggiungi articoli alla richiesta per gestire le spedizioni."
        />
      )}

      {/* Groups */}
      {!isLoading && items.length > 0 && (
        <div className="space-y-5">
          {items.map((item) => (
            <ItemGroup
              key={item.id}
              item={item}
              shipments={grouped.get(item.id) ?? []}
              requestId={requestId}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  )
}
