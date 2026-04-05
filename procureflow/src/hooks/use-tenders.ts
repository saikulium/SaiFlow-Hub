'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createListHook } from './create-list-hook'
import type { TenderListItem } from '@/types'

interface TenderQueryParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  tender_type?: string
  assigned_to?: string
  deadline_from?: string
  deadline_to?: string
}

export const useTenders = createListHook<TenderListItem, TenderQueryParams>({
  endpoint: '/api/tenders',
  queryKey: 'tenders',
  errorMessage: 'Errore nel caricamento delle gare',
})

export function useCreateTender() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenders'] })
      toast.success('Gara creata')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteTender() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tenders/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenders'] })
      toast.success('Gara eliminata')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
