'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { InventoryListItem } from '@/types'

interface InventoryQueryParams {
  page?: number
  pageSize?: number
  warehouse_id?: string
  status?: string
}

interface InventoryListResponse {
  data: InventoryListItem[]
  meta: { total: number; page: number; pageSize: number }
}

interface InventoryDetail extends InventoryListItem {
  warehouseId: string
  notes: string | null
  lines: InventoryLine[]
}

interface InventoryLine {
  id: string
  materialCode: string
  materialName: string
  unit: string
  expectedQuantity: number
  countedQuantity: number | null
  variance: number | null
}

export function useInventories(params: InventoryQueryParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.warehouse_id) searchParams.set('warehouse_id', params.warehouse_id)
  if (params.status) searchParams.set('status', params.status)

  return useQuery<InventoryListResponse>({
    queryKey: ['inventories', params],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/inventories?${searchParams}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return { data: json.data, meta: json.meta }
    },
  })
}

export function useInventory(id: string | null) {
  return useQuery<InventoryDetail>({
    queryKey: ['inventories', id],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/inventories/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    enabled: !!id,
  })
}

export function useCreateInventory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/inventory/inventories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] })
      toast.success('Inventario creato')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateInventoryLines() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      lines,
    }: {
      id: string
      lines: Array<{ id: string; counted_quantity: number }>
    }) => {
      const res = await fetch(`/api/inventory/inventories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] })
      toast.success('Righe aggiornate')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCloseInventory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inventory/inventories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventories'] })
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      toast.success('Inventario chiuso')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
