'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { MaterialListItem, MaterialDetail } from '@/types'

interface MaterialQueryParams {
  page?: number
  pageSize?: number
  search?: string
  category?: string
  is_active?: boolean
  low_stock?: boolean
}

interface MaterialListResponse {
  data: MaterialListItem[]
  meta: { total: number; page: number; pageSize: number }
}

export function useMaterials(params: MaterialQueryParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.search) searchParams.set('search', params.search)
  if (params.category) searchParams.set('category', params.category)
  if (params.is_active !== undefined)
    searchParams.set('is_active', String(params.is_active))
  if (params.low_stock !== undefined)
    searchParams.set('low_stock', String(params.low_stock))

  return useQuery<MaterialListResponse>({
    queryKey: ['materials', params],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/materials?${searchParams}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return { data: json.data, meta: json.meta }
    },
  })
}

export function useMaterial(id: string | null) {
  return useQuery<MaterialDetail>({
    queryKey: ['materials', id],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/materials/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    enabled: !!id,
  })
}

export function useCreateMaterial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/inventory/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      toast.success('Materiale creato')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateMaterial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/inventory/materials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      toast.success('Materiale aggiornato')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
