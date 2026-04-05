'use client'

import { useCallback, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

type EntityType =
  | 'requests'
  | 'vendors'
  | 'invoices'
  | 'tenders'
  | 'inventory/materials'
  | 'budgets'

const ENTITY_LABELS: Record<EntityType, { singular: string; plural: string }> =
  {
    requests: { singular: 'richiesta', plural: 'richieste' },
    vendors: { singular: 'fornitore', plural: 'fornitori' },
    invoices: { singular: 'fattura', plural: 'fatture' },
    tenders: { singular: 'gara', plural: 'gare' },
    'inventory/materials': { singular: 'materiale', plural: 'materiali' },
    budgets: { singular: 'budget', plural: 'budget' },
  }

const QUERY_KEY_MAP: Record<EntityType, string> = {
  requests: 'requests',
  vendors: 'vendors',
  invoices: 'invoices',
  tenders: 'tenders',
  'inventory/materials': 'materials',
  budgets: 'budgets',
}

async function deleteRecord(entity: EntityType, id: string): Promise<void> {
  const res = await fetch(`/api/${entity}/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(
      body?.error?.message ??
        `Errore eliminazione ${ENTITY_LABELS[entity].singular}`,
    )
  }
}

export function useDeleteRecord(entity: EntityType) {
  const queryClient = useQueryClient()
  const labels = ENTITY_LABELS[entity]
  const queryKey = QUERY_KEY_MAP[entity]

  const mutation = useMutation({
    mutationFn: (id: string) => deleteRecord(entity, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] })
      toast.success(
        `${labels.singular.charAt(0).toUpperCase() + labels.singular.slice(1)} eliminata`,
      )
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  return mutation
}

export function useBulkDelete(entity: EntityType) {
  const queryClient = useQueryClient()
  const labels = ENTITY_LABELS[entity]
  const queryKey = QUERY_KEY_MAP[entity]
  const [progress, setProgress] = useState(0)

  const mutation = useMutation({
    mutationFn: async (ids: readonly string[]) => {
      setProgress(0)
      const errors: string[] = []

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i] as string
        try {
          await deleteRecord(entity, id)
        } catch {
          errors.push(id)
        }
        setProgress(i + 1)
      }

      if (errors.length > 0) {
        throw new Error(
          `${errors.length} ${labels.plural} non eliminate (vincoli o permessi)`,
        )
      }
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] })
      toast.success(`${ids.length} ${labels.plural} eliminate`)
      setProgress(0)
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] })
      toast.error(error.message)
      setProgress(0)
    },
  })

  return { ...mutation, progress }
}

export function useIsAdmin(): boolean {
  const { data: session } = useSession()
  return session?.user?.role === 'ADMIN'
}
