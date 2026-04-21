'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { BudgetListItem, BudgetDetail } from '@/types'

interface BudgetQueryParams {
  page?: number
  pageSize?: number
  cost_center?: string
  is_active?: boolean
  period_type?: string
}

interface BudgetListResponse {
  data: BudgetListItem[]
  meta: { total: number; page: number; pageSize: number }
}

export function useBudgets(params: BudgetQueryParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.cost_center) searchParams.set('cost_center', params.cost_center)
  if (params.is_active !== undefined)
    searchParams.set('is_active', String(params.is_active))
  if (params.period_type) searchParams.set('period_type', params.period_type)

  return useQuery<BudgetListResponse>({
    queryKey: ['budgets', params],
    queryFn: async () => {
      const res = await fetch(`/api/budgets?${searchParams}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return { data: json.data, meta: json.meta }
    },
  })
}

export function useBudget(id: string | null) {
  return useQuery<BudgetDetail>({
    queryKey: ['budgets', id],
    queryFn: async () => {
      const res = await fetch(`/api/budgets/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    enabled: !!id,
  })
}

export function useCreateBudget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      toast.success('Budget creato')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateBudget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/budgets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      toast.success('Budget aggiornato')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteBudget() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      toast.success('Budget disattivato')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
