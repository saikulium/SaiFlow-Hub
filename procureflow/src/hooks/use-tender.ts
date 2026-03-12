'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { TenderDetail, GoNoGoScoreInput } from '@/types'

export function useTender(id: string | null) {
  return useQuery<TenderDetail>({
    queryKey: ['tenders', id],
    queryFn: async () => {
      const res = await fetch(`/api/tenders/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    enabled: !!id,
  })
}

export function useUpdateTender() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/tenders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenders'] })
      toast.success('Gara aggiornata')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateTenderStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string
      status: string
      notes?: string
    }) => {
      const res = await fetch(`/api/tenders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenders'] })
      toast.success('Stato aggiornato')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useGoNoGoDecision() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      decision,
      scores,
      notes,
    }: {
      id: string
      decision: 'GO' | 'NO_GO'
      scores: GoNoGoScoreInput
      notes?: string
    }) => {
      const res = await fetch(`/api/tenders/${id}/go-no-go`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, scores, notes }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenders'] })
      toast.success('Decisione registrata')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
