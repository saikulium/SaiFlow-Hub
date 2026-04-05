'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, Building2, Mail, Phone, User, Briefcase } from 'lucide-react'
import { useClients } from '@/hooks/use-clients'
import { ClientDialog } from '@/components/clients/client-dialog'
import { ExportCsvButton } from '@/components/shared/export-csv-button'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'
import type { ClientListItem } from '@/types'

const CLIENT_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  ACTIVE: {
    label: 'Attivo',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  INACTIVE: {
    label: 'Inattivo',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  },
  PENDING_REVIEW: {
    label: 'In Revisione',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
}

const STATUS_FILTERS = [
  { key: 'ALL', label: 'Tutti' },
  ...Object.entries(CLIENT_STATUS_CONFIG).map(([key, config]) => ({
    key,
    label: config.label,
  })),
]

const CLIENT_CSV_COLUMNS = [
  { header: 'Codice', accessor: (c: ClientListItem) => c.code },
  { header: 'Nome', accessor: (c: ClientListItem) => c.name },
  { header: 'P.IVA', accessor: (c: ClientListItem) => c.tax_id },
  { header: 'Email', accessor: (c: ClientListItem) => c.email },
  { header: 'Contatto', accessor: (c: ClientListItem) => c.contact_person },
  { header: 'Stato', accessor: (c: ClientListItem) => c.status },
  {
    header: 'Commesse Attive',
    accessor: (c: ClientListItem) => c.activeCommesseCount,
  },
] as const

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="h-14 animate-pulse rounded-card bg-pf-bg-secondary"
        />
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config = CLIENT_STATUS_CONFIG[status] ?? {
    label: status,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-badge px-2 py-0.5 text-xs font-medium',
        config.bgColor,
        config.color,
      )}
    >
      {config.label}
    </span>
  )
}

export function ClientsPageContent() {
  const [searchInput, setSearchInput] = useState('')
  const [activeStatus, setActiveStatus] = useState('ALL')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientListItem | null>(null)

  const debouncedSearch = useDebounce(searchInput, 300)

  const queryParams = useMemo(() => {
    const params: { search?: string; status?: string } = {}
    if (debouncedSearch) {
      params.search = debouncedSearch
    }
    if (activeStatus !== 'ALL') {
      params.status = activeStatus
    }
    return params
  }, [debouncedSearch, activeStatus])

  const { data: clients, isLoading, error } = useClients(queryParams)

  function handleEdit(client: ClientListItem) {
    setEditingClient(client)
    setDialogOpen(true)
  }

  function handleCloseDialog(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEditingClient(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            Clienti
            {clients && (
              <span className="ml-2 text-base font-normal text-pf-text-muted">
                ({clients.length})
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-pf-text-secondary">
            Gestisci i tuoi clienti e le loro commesse
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            data={clients ?? []}
            columns={CLIENT_CSV_COLUMNS}
            filename="clienti"
          />
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Nuovo Cliente
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-muted" />
          <input
            type="text"
            placeholder="Cerca clienti per nome, codice o P.IVA..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-button border border-pf-border bg-pf-bg-secondary py-2.5 pl-10 pr-4 text-sm text-pf-text-primary transition-colors placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveStatus(filter.key)}
              className={cn(
                'rounded-badge px-3 py-1 text-xs font-medium transition-colors',
                activeStatus === filter.key
                  ? 'bg-pf-accent text-white'
                  : 'border border-pf-border bg-pf-bg-secondary text-pf-text-secondary hover:border-pf-border-hover hover:text-pf-text-primary',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-card border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Errore nel caricamento dei clienti. Riprova più tardi.
        </div>
      )}

      {/* Loading */}
      {isLoading && <TableSkeleton />}

      {/* Table */}
      {!isLoading && clients && clients.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden rounded-card border border-pf-border"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pf-border bg-pf-bg-tertiary text-left">
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-pf-text-secondary">
                    Codice
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-pf-text-secondary">
                    Nome
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 font-medium text-pf-text-secondary md:table-cell">
                    P.IVA
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 font-medium text-pf-text-secondary lg:table-cell">
                    Email
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 font-medium text-pf-text-secondary lg:table-cell">
                    Contatto
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium text-pf-text-secondary">
                    Stato
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-pf-text-secondary">
                    Commesse
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client, i) => (
                  <motion.tr
                    key={client.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    onClick={() => handleEdit(client)}
                    className="cursor-pointer border-b border-pf-border transition-colors last:border-b-0 hover:bg-pf-bg-hover"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-pf-text-muted">
                      {client.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-pf-text-primary">
                      {client.name}
                    </td>
                    <td className="hidden px-4 py-3 text-pf-text-secondary md:table-cell">
                      {client.tax_id || '—'}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {client.email ? (
                        <span className="flex items-center gap-1.5 text-pf-text-secondary">
                          <Mail className="h-3.5 w-3.5 text-pf-text-muted" />
                          {client.email}
                        </span>
                      ) : (
                        <span className="text-pf-text-muted">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {client.contact_person ? (
                        <span className="flex items-center gap-1.5 text-pf-text-secondary">
                          <User className="h-3.5 w-3.5 text-pf-text-muted" />
                          {client.contact_person}
                        </span>
                      ) : (
                        <span className="text-pf-text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={client.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-pf-text-secondary">
                        <Briefcase className="h-3.5 w-3.5 text-pf-text-muted" />
                        {client.activeCommesseCount}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!isLoading && clients && clients.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex min-h-[40vh] flex-col items-center justify-center rounded-card border border-pf-border bg-pf-bg-secondary p-8"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-card bg-pf-accent/10">
            <Building2 className="h-7 w-7 text-pf-accent" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold text-pf-text-primary">
            Nessun cliente trovato
          </h3>
          <p className="mt-1 text-center text-sm text-pf-text-secondary">
            {debouncedSearch || activeStatus !== 'ALL'
              ? 'Prova a modificare i filtri di ricerca'
              : 'Aggiungi il tuo primo cliente per iniziare'}
          </p>
        </motion.div>
      )}

      {/* Create/Edit dialog */}
      <ClientDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        client={editingClient}
      />
    </div>
  )
}
