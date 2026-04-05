'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Edit2,
  Info,
  Warehouse,
  Layers,
  ArrowLeftRight,
  Lock,
  BarChart3,
} from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import { StockLevelBadge } from '@/components/inventory/stock-level-badge'
import { MaterialFormDialog } from '@/components/inventory/material-form-dialog'
import { ForecastPanel } from '@/components/inventory/forecast-panel'
import { useMaterial } from '@/hooks/use-materials'
import {
  MOVEMENT_TYPE_CONFIG,
  LOT_STATUS_CONFIG,
  RESERVATION_STATUS_CONFIG,
  MOVEMENT_REASON_LABELS,
} from '@/lib/constants/inventory'
import type { StockStatusKey } from '@/lib/constants/inventory'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type {
  MaterialDetail,
  StockByWarehouse,
  LotSummary,
  ReservationSummary,
  MovementListItem,
} from '@/types'
import { useMovements } from '@/hooks/use-stock'

interface MaterialDetailContentProps {
  id: string
}

type TabKey =
  | 'generale'
  | 'giacenze'
  | 'lotti'
  | 'movimenti'
  | 'riserve'
  | 'forecast'

const quantityFormatter = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 3,
})

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
        {label}
      </dt>
      <dd className="text-sm text-pf-text-primary">
        {value != null && value !== '' ? String(value) : '-'}
      </dd>
    </div>
  )
}

function DetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="skeleton-shimmer h-8 w-32 rounded" />
        <div className="skeleton-shimmer h-6 w-20 rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton-shimmer h-3 w-20 rounded" />
            <div className="skeleton-shimmer h-5 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---- Tab: Generale ---- */
function GeneraleTab({ material }: { material: MaterialDetail }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <DetailField label="Codice" value={material.code} />
        <DetailField label="Nome" value={material.name} />
        <DetailField label="Categoria" value={material.category} />
        <DetailField label="Sottocategoria" value={material.subcategory} />
        <DetailField label="UM Primaria" value={material.unitPrimary} />
        <DetailField label="UM Secondaria" value={material.unitSecondary} />
        <DetailField
          label="Fattore Conversione"
          value={material.conversionFactor}
        />
        <DetailField
          label="Costo Medio"
          value={formatCurrency(material.unitCost)}
        />
        <DetailField
          label="Scorta Minima"
          value={
            material.minStockLevel != null
              ? quantityFormatter.format(material.minStockLevel)
              : null
          }
        />
        <DetailField
          label="Scorta Massima"
          value={
            material.maxStockLevel != null
              ? quantityFormatter.format(material.maxStockLevel)
              : null
          }
        />
        <DetailField label="Codice a Barre" value={material.barcode} />
        <DetailField label="QR Code" value={material.qrCode} />
        <DetailField
          label="Fornitore Preferito"
          value={material.preferredVendor}
        />
        <DetailField label="Attivo" value={material.isActive ? 'Si' : 'No'} />
      </div>

      {material.tags.length > 0 && (
        <div className="space-y-1">
          <dt className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
            Tag
          </dt>
          <dd className="flex flex-wrap gap-1.5">
            {material.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-badge bg-pf-bg-tertiary px-2 py-0.5 text-xs text-pf-text-secondary"
              >
                {tag}
              </span>
            ))}
          </dd>
        </div>
      )}

      {material.notes && <DetailField label="Note" value={material.notes} />}

      <DetailField
        label="Data Creazione"
        value={formatDate(material.createdAt)}
      />
    </div>
  )
}

/* ---- Tab: Giacenze ---- */
function GiacenzeTab({ data }: { data: StockByWarehouse[] }) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center">
        <Warehouse className="mx-auto mb-2 h-8 w-8 text-pf-text-muted" />
        <p className="text-sm text-pf-text-secondary">
          Nessuna giacenza registrata
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-pf-border">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Magazzino
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Fisica
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Disponibile
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Riservata
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((wh) => (
            <tr
              key={wh.warehouseId}
              className="border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
            >
              <td className="px-4 py-3 text-sm font-medium text-pf-text-primary">
                {wh.warehouseName}
                {wh.zones.length > 0 && (
                  <span className="ml-2 text-xs text-pf-text-muted">
                    ({wh.zones.map((z) => z.zoneName).join(', ')})
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-sm text-pf-text-primary">
                {quantityFormatter.format(wh.physical)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-pf-text-primary">
                {quantityFormatter.format(wh.available)}
              </td>
              <td className="px-4 py-3 text-right text-sm text-pf-text-primary">
                {quantityFormatter.format(wh.reserved)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---- Tab: Lotti ---- */
function LottiTab({ lots }: { lots: LotSummary[] }) {
  if (lots.length === 0) {
    return (
      <div className="py-8 text-center">
        <Layers className="mx-auto mb-2 h-8 w-8 text-pf-text-muted" />
        <p className="text-sm text-pf-text-secondary">Nessun lotto attivo</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-pf-border">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              N. Lotto
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Magazzino
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Quantita
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Costo
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
              Scadenza
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Stato
            </th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => {
            const statusCfg = LOT_STATUS_CONFIG[lot.status]
            const StatusIcon = statusCfg?.icon
            return (
              <tr
                key={lot.id}
                className="border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
              >
                <td className="px-4 py-3 font-mono text-xs text-pf-text-secondary">
                  {lot.lotNumber}
                </td>
                <td className="px-4 py-3 text-sm text-pf-text-primary">
                  {lot.warehouseName}
                  {lot.zoneName && (
                    <span className="ml-1 text-xs text-pf-text-muted">
                      / {lot.zoneName}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm text-pf-text-primary">
                  {quantityFormatter.format(lot.currentQuantity)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-pf-text-primary">
                  {formatCurrency(lot.unitCost)}
                </td>
                <td className="hidden px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                  {lot.expiryDate ? formatDate(lot.expiryDate) : '-'}
                </td>
                <td className="px-4 py-3">
                  {statusCfg ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-badge px-2 py-0.5 text-xs font-medium',
                        statusCfg.bgColor,
                        statusCfg.color,
                      )}
                    >
                      {StatusIcon && <StatusIcon className="h-3 w-3" />}
                      {statusCfg.label}
                    </span>
                  ) : (
                    <span className="text-xs text-pf-text-muted">
                      {lot.status}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ---- Tab: Movimenti ---- */
function MovimentiTab({ materialId }: { materialId: string }) {
  const { data: response, isLoading } = useMovements({
    material_id: materialId,
    pageSize: 20,
  })
  const movements = response?.data ?? []

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton-shimmer h-12 w-full rounded" />
        ))}
      </div>
    )
  }

  if (movements.length === 0) {
    return (
      <div className="py-8 text-center">
        <ArrowLeftRight className="mx-auto mb-2 h-8 w-8 text-pf-text-muted" />
        <p className="text-sm text-pf-text-secondary">
          Nessun movimento recente
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-pf-border">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Codice
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Tipo
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Causale
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Quantita
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
              Data
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary lg:table-cell">
              Operatore
            </th>
          </tr>
        </thead>
        <tbody>
          {movements.map((mv) => {
            const typeCfg = MOVEMENT_TYPE_CONFIG[mv.movementType]
            const TypeIcon = typeCfg?.icon
            return (
              <tr
                key={mv.id}
                className="border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
              >
                <td className="px-4 py-3 font-mono text-xs text-pf-text-secondary">
                  {mv.code}
                </td>
                <td className="px-4 py-3">
                  {typeCfg ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-badge px-2 py-0.5 text-xs font-medium',
                        typeCfg.bgColor,
                        typeCfg.color,
                      )}
                    >
                      {TypeIcon && <TypeIcon className="h-3 w-3" />}
                      {typeCfg.label}
                    </span>
                  ) : (
                    <span className="text-xs text-pf-text-muted">
                      {mv.movementType}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-pf-text-secondary">
                  {MOVEMENT_REASON_LABELS[mv.reason] ?? mv.reason}
                </td>
                <td className="px-4 py-3 text-right text-sm text-pf-text-primary">
                  {quantityFormatter.format(mv.quantity)}
                </td>
                <td className="hidden px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                  {formatDate(mv.createdAt)}
                </td>
                <td className="hidden px-4 py-3 text-sm text-pf-text-secondary lg:table-cell">
                  {mv.actor ?? '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ---- Tab: Riserve ---- */
function RiserveTab({ reservations }: { reservations: ReservationSummary[] }) {
  if (reservations.length === 0) {
    return (
      <div className="py-8 text-center">
        <Lock className="mx-auto mb-2 h-8 w-8 text-pf-text-muted" />
        <p className="text-sm text-pf-text-secondary">Nessuna riserva attiva</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-pf-border">
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Quantita
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Gara / PR
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Stato
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
              Riservato il
            </th>
            <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-pf-text-secondary md:table-cell">
              Scadenza
            </th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((res) => {
            const statusCfg = RESERVATION_STATUS_CONFIG[res.status]
            const StatusIcon = statusCfg?.icon
            return (
              <tr
                key={res.id}
                className="border-b border-pf-border transition-colors hover:bg-pf-bg-hover"
              >
                <td className="px-4 py-3 text-right text-sm text-pf-text-primary">
                  {quantityFormatter.format(res.reservedQuantity)}
                </td>
                <td className="px-4 py-3 text-sm text-pf-text-primary">
                  {res.tenderCode ?? res.prCode ?? '-'}
                </td>
                <td className="px-4 py-3">
                  {statusCfg ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-badge px-2 py-0.5 text-xs font-medium',
                        statusCfg.bgColor,
                        statusCfg.color,
                      )}
                    >
                      {StatusIcon && <StatusIcon className="h-3 w-3" />}
                      {statusCfg.label}
                    </span>
                  ) : (
                    <span className="text-xs text-pf-text-muted">
                      {res.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-pf-text-secondary">
                  {formatDate(res.reservedAt)}
                </td>
                <td className="hidden px-4 py-3 text-sm text-pf-text-secondary md:table-cell">
                  {res.expiresAt ? formatDate(res.expiresAt) : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ==================================================================== */
/*  Main Component                                                      */
/* ==================================================================== */

export function MaterialDetailContent({ id }: MaterialDetailContentProps) {
  const router = useRouter()
  const { data: material, isLoading } = useMaterial(id)

  const [activeTab, setActiveTab] = useState<TabKey>('generale')
  const [editOpen, setEditOpen] = useState(false)

  const tabs: Array<{
    key: TabKey
    label: string
    icon: typeof Info
    count?: number
  }> = [
    { key: 'generale', label: 'Generale', icon: Info },
    {
      key: 'giacenze',
      label: 'Giacenze',
      icon: Warehouse,
      count: material?.stockByWarehouse.length,
    },
    {
      key: 'lotti',
      label: 'Lotti',
      icon: Layers,
      count: material?.activeLots.length,
    },
    { key: 'movimenti', label: 'Movimenti', icon: ArrowLeftRight },
    {
      key: 'riserve',
      label: 'Riserve',
      icon: Lock,
      count: material?.activeReservations.length,
    },
    { key: 'forecast', label: 'Forecast AI', icon: BarChart3 },
  ]

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/inventory')}
              className="rounded-button p-1.5 text-pf-text-secondary transition-colors hover:text-pf-text-primary"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            {isLoading ? (
              <div className="skeleton-shimmer h-8 w-64 rounded" />
            ) : material ? (
              <div className="flex items-center gap-3">
                <h1 className="font-display text-xl font-bold text-pf-text-primary sm:text-2xl">
                  <span className="font-mono text-pf-text-secondary">
                    {material.code}
                  </span>{' '}
                  {material.name}
                </h1>
                <StockLevelBadge
                  status={material.stockStatus as StockStatusKey}
                />
              </div>
            ) : (
              <h1 className="text-xl font-bold text-pf-text-primary">
                Materiale non trovato
              </h1>
            )}
          </div>

          {material && (
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-button border border-pf-border px-3 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
            >
              <Edit2 className="h-4 w-4" />
              Modifica
            </button>
          )}
        </div>

        {/* Tabs */}
        {material && (
          <div className="flex gap-1 border-b border-pf-border">
            {tabs.map((tab) => {
              const TabIcon = tab.icon
              const isActive = activeTab === tab.key

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-pf-accent text-pf-text-primary'
                      : 'border-transparent text-pf-text-secondary hover:text-pf-text-primary',
                  )}
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className="rounded-badge bg-pf-bg-tertiary px-1.5 py-0.5 text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Tab content */}
        <div className="bg-pf-bg-secondary/60 rounded-card border border-pf-border p-6 backdrop-blur-xl">
          {isLoading && <DetailsSkeleton />}

          {!isLoading && !material && (
            <p className="py-8 text-center text-sm text-pf-text-secondary">
              Materiale non trovato o errore nel caricamento.
            </p>
          )}

          {!isLoading && material && activeTab === 'generale' && (
            <GeneraleTab material={material} />
          )}

          {!isLoading && material && activeTab === 'giacenze' && (
            <GiacenzeTab data={material.stockByWarehouse} />
          )}

          {!isLoading && material && activeTab === 'lotti' && (
            <LottiTab lots={material.activeLots} />
          )}

          {!isLoading && material && activeTab === 'movimenti' && (
            <MovimentiTab materialId={material.id} />
          )}

          {!isLoading && material && activeTab === 'riserve' && (
            <RiserveTab reservations={material.activeReservations} />
          )}

          {!isLoading && material && activeTab === 'forecast' && (
            <ForecastPanel materialId={material.id} />
          )}
        </div>

        {/* Edit Dialog */}
        {material && (
          <MaterialFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            initialData={material}
          />
        )}
      </div>
    </PageTransition>
  )
}
