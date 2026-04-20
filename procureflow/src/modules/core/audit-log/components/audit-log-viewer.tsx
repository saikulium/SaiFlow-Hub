'use client'

import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE'
type AuditActorType = 'USER' | 'SYSTEM' | 'AGENT'

interface AuditLogRow {
  id: string
  timestamp: string
  actor_id: string | null
  actor_type: AuditActorType
  actor_label: string | null
  action: AuditAction
  entity_type: string
  entity_id: string
  entity_label: string | null
  changes: Record<string, { old: unknown; new: unknown }> | null
  metadata: Record<string, unknown> | null
  correlation_id: string | null
  ip_address: string | null
  user_agent: string | null
}

interface Filters {
  actorId: string
  entityType: string
  action: string
  from: string
  to: string
}

const DEFAULT_FILTERS: Filters = {
  actorId: '',
  entityType: '',
  action: '',
  from: '',
  to: '',
}

function ActionBadge({ action }: { action: AuditAction }) {
  const style =
    action === 'CREATE'
      ? 'bg-pf-success/10 text-pf-success'
      : action === 'UPDATE'
        ? 'bg-pf-warning/10 text-pf-warning'
        : 'bg-pf-danger/10 text-pf-danger'
  return (
    <span className={cn('inline-flex rounded-badge px-2 py-0.5 text-xs font-medium', style)}>
      {action}
    </span>
  )
}

function ActorBadge({ type, label }: { type: AuditActorType; label: string | null }) {
  const style =
    type === 'USER'
      ? 'bg-pf-accent-subtle text-pf-accent'
      : type === 'SYSTEM'
        ? 'bg-pf-info/10 text-pf-info'
        : 'bg-pf-warning/10 text-pf-warning'
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('inline-flex w-fit rounded-badge px-2 py-0.5 text-xs font-medium', style)}>
        {type}
      </span>
      {label && <span className="text-xs text-pf-text-muted">{label}</span>}
    </div>
  )
}

function ChangesDetail({
  changes,
}: {
  changes: Record<string, { old: unknown; new: unknown }> | null
}) {
  if (!changes || Object.keys(changes).length === 0) {
    return <span className="text-xs text-pf-text-muted">—</span>
  }
  return (
    <details className="cursor-pointer">
      <summary className="text-xs text-pf-text-secondary">
        {Object.keys(changes).length} campo/i
      </summary>
      <div className="mt-2 space-y-1 text-xs">
        {Object.entries(changes).map(([field, { old, new: next }]) => (
          <div key={field} className="font-mono">
            <span className="font-semibold text-pf-text-primary">{field}</span>:{' '}
            <span className="text-pf-danger line-through">
              {old === null || old === undefined ? '∅' : JSON.stringify(old)}
            </span>{' '}
            →{' '}
            <span className="text-pf-success">
              {next === null || next === undefined ? '∅' : JSON.stringify(next)}
            </span>
          </div>
        ))}
      </div>
    </details>
  )
}

export function AuditLogViewer() {
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.actorId) params.set('actorId', filters.actorId)
    if (filters.entityType) params.set('entityType', filters.entityType)
    if (filters.action) params.set('action', filters.action)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    return params.toString()
  }, [filters])

  async function loadFirstPage() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/audit?${queryString}`)
      const json = await res.json()
      const data = json.data ?? json
      setRows(data.items ?? [])
      setCursor(data.nextCursor ?? null)
      setHasMore(Boolean(data.hasMore))
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (!cursor) return
    setLoading(true)
    try {
      const params = new URLSearchParams(queryString)
      params.set('cursor', cursor)
      const res = await fetch(`/api/admin/audit?${params.toString()}`)
      const json = await res.json()
      const data = json.data ?? json
      setRows((prev) => [...prev, ...(data.items ?? [])])
      setCursor(data.nextCursor ?? null)
      setHasMore(Boolean(data.hasMore))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFirstPage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input
          type="text"
          placeholder="Actor ID"
          value={filters.actorId}
          onChange={(e) => setFilters((f) => ({ ...f, actorId: e.target.value }))}
          className="rounded-button border border-pf-border bg-pf-bg-secondary px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Entity type (es. PurchaseRequest)"
          value={filters.entityType}
          onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
          className="rounded-button border border-pf-border bg-pf-bg-secondary px-3 py-2 text-sm"
        />
        <select
          value={filters.action}
          onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
          className="rounded-button border border-pf-border bg-pf-bg-secondary px-3 py-2 text-sm"
        >
          <option value="">Tutte le azioni</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="rounded-button border border-pf-border bg-pf-bg-secondary px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="rounded-button border border-pf-border bg-pf-bg-secondary px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setFilters(DEFAULT_FILTERS)}
          className="text-sm text-pf-text-secondary hover:text-pf-text-primary"
        >
          Reset filtri
        </button>
        <a
          href={`/api/admin/audit/export?${queryString}`}
          className="rounded-button bg-pf-accent-subtle px-3 py-1.5 text-sm font-medium text-pf-accent hover:bg-pf-accent/20"
        >
          Esporta CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-card border border-pf-border bg-pf-bg-secondary">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-pf-bg-tertiary/80 backdrop-blur">
            <tr className="text-left text-xs uppercase tracking-wide text-pf-text-muted">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pf-border">
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-pf-text-muted">
                  Nessun evento audit trovato.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-pf-bg-hover">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-pf-text-secondary">
                  {new Date(row.timestamp).toLocaleString('it-IT')}
                </td>
                <td className="px-4 py-3">
                  <ActorBadge type={row.actor_type} label={row.actor_label} />
                </td>
                <td className="px-4 py-3">
                  <ActionBadge action={row.action} />
                </td>
                <td className="px-4 py-3 text-pf-text-secondary">{row.entity_type}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {row.entity_label ?? row.entity_id}
                </td>
                <td className="px-4 py-3">
                  <ChangesDetail changes={row.changes} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        {hasMore && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white hover:bg-pf-accent-hover disabled:opacity-50"
          >
            {loading ? 'Caricamento…' : 'Carica altri'}
          </button>
        )}
      </div>
    </div>
  )
}
