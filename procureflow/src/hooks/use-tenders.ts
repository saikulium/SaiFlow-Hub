'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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

interface TenderListResponse {
  data: TenderListItem[]
  meta: { total: number; page: number; pageSize: number }
}

export function useTenders(params: TenderQueryParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.search) searchParams.set('search', params.search)
  if (params.status) searchParams.set('status', params.status)
  if (params.tender_type) searchParams.set('tender_type', params.tender_type)
  if (params.assigned_to) searchParams.set('assigned_to', params.assigned_to)
  if (params.deadline_from) searchParams.set('deadline_from', params.deadline_from)
  if (params.deadline_to) searchParams.set('deadline_to', params.deadline_to)

  return useQuery<TenderListResponse>({
    queryKey: ['tenders', params],
    queryFn: async () => {
      const res = await fetch(`/api/tenders?${searchParams}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return { data: json.data, meta: json.meta }
    },
  })
}

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
