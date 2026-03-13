'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Users as UsersIcon } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useUsers, useUpdateUserRole } from '@/hooks/use-users'
import { CreateUserDialog } from '@/components/users/create-user-dialog'
import type { UserRole } from '@prisma/client'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  REQUESTER: 'Richiedente',
  VIEWER: 'Visualizzatore',
}

const ROLE_OPTIONS: UserRole[] = ['ADMIN', 'MANAGER', 'REQUESTER', 'VIEWER']

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function TableSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-pf-border px-4 py-3.5"
        >
          <div className="h-4 w-32 animate-pulse rounded bg-pf-border" />
          <div className="h-4 w-44 animate-pulse rounded bg-pf-border" />
          <div className="h-4 w-24 animate-pulse rounded bg-pf-border" />
          <div className="h-4 w-24 animate-pulse rounded bg-pf-border" />
          <div className="h-4 w-20 animate-pulse rounded bg-pf-border" />
        </div>
      ))}
    </div>
  )
}

export function UsersPageContent() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: session } = useSession()
  const { data: users, isLoading, error } = useUsers()
  const updateRole = useUpdateUserRole()

  const currentUserId = session?.user?.id

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    updateRole.mutate({ id: userId, role: newRole })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            Gestione Utenti
            {users && (
              <span className="ml-2 text-base font-normal text-pf-text-muted">
                ({users.length})
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-pf-text-secondary">
            Gestisci gli utenti e i loro ruoli
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
        >
          <Plus className="h-4 w-4" />
          Nuovo Utente
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-card border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Errore nel caricamento degli utenti. Riprova più tardi.
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-card border border-pf-border bg-pf-bg-secondary">
        {/* Table header */}
        <div className="sticky top-0 z-10 grid grid-cols-[1fr_1.5fr_1fr_1fr_0.8fr] gap-4 border-b border-pf-border bg-pf-bg-tertiary/80 px-4 py-3 backdrop-blur">
          <span className="text-xs font-semibold uppercase tracking-wider text-pf-text-muted">
            Nome
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-pf-text-muted">
            Email
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-pf-text-muted">
            Ruolo
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-pf-text-muted">
            Dipartimento
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-pf-text-muted">
            Data Creazione
          </span>
        </div>

        {/* Loading */}
        {isLoading && <TableSkeleton />}

        {/* Rows */}
        {!isLoading && users && users.length > 0 && (
          <div>
            {users.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.3 }}
                className="grid grid-cols-[1fr_1.5fr_1fr_1fr_0.8fr] items-center gap-4 border-b border-pf-border px-4 py-3.5 transition-colors last:border-b-0 hover:bg-pf-bg-hover"
              >
                <span className="truncate text-sm font-medium text-pf-text-primary">
                  {user.name}
                </span>
                <span className="truncate text-sm text-pf-text-secondary">
                  {user.email}
                </span>
                <div>
                  {currentUserId === user.id ? (
                    <span className="inline-flex rounded-badge bg-pf-accent-subtle px-2.5 py-1 text-xs font-medium text-pf-accent">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  ) : (
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(user.id, e.target.value as UserRole)
                      }
                      disabled={updateRole.isPending}
                      className="rounded-button border border-pf-border bg-pf-bg-tertiary px-2 py-1 text-xs text-pf-text-primary transition-colors focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role] ?? role}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <span className="truncate text-sm text-pf-text-secondary">
                  {user.department ?? '—'}
                </span>
                <span className="text-xs text-pf-text-muted">
                  {formatDate(user.created_at)}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && users && users.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex min-h-[40vh] flex-col items-center justify-center p-8"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-card bg-pf-accent/10">
              <UsersIcon className="h-7 w-7 text-pf-accent" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold text-pf-text-primary">
              Nessun utente trovato
            </h3>
            <p className="mt-1 text-center text-sm text-pf-text-secondary">
              Crea il primo utente per iniziare
            </p>
          </motion.div>
        )}
      </div>

      {/* Create dialog */}
      <CreateUserDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
