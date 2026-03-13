'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  MovementListItem,
  LotSummary,
  WarehouseListItem,
} from '@/types'

/* ------------------------------------------------------------------ */
/*  Movements                                                         */
/* ------------------------------------------------------------------ */

interface MovementQueryParams {
  page?: number
  pageSize?: number
  material_id?: string
  warehouse_id?: string
  movement_type?: string
  date_from?: string
  date_to?: string
}

interface MovementListResponse {
  data: MovementListItem[]
  meta: { total: number; page: number; pageSize: number }
}

export function useMovements(params: MovementQueryParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.material_id) searchParams.set('material_id', params.material_id)
  if (params.warehouse_id) searchParams.set('warehouse_id', params.warehouse_id)
  if (params.movement_type) searchParams.set('movement_type', params.movement_type)
  if (params.date_from) searchParams.set('date_from', params.date_from)
  if (params.date_to) searchParams.set('date_to', params.date_to)

  return useQuery<MovementListResponse>({
    queryKey: ['movements', params],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/movements?${searchParams}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return { data: json.data, meta: json.meta }
    },
  })
}

export function useCreateMovement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movements'] })
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      queryClient.invalidateQueries({ queryKey: ['lots'] })
      toast.success('Movimento registrato')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/* ------------------------------------------------------------------ */
/*  Lots                                                              */
/* ------------------------------------------------------------------ */

interface LotQueryParams {
  page?: number
  pageSize?: number
  material_id?: string
  warehouse_id?: string
  status?: string
}

interface LotListResponse {
  data: LotSummary[]
  meta: { total: number; page: number; pageSize: number }
}

export function useLots(params: LotQueryParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set('page', String(params.page))
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params.material_id) searchParams.set('material_id', params.material_id)
  if (params.warehouse_id) searchParams.set('warehouse_id', params.warehouse_id)
  if (params.status) searchParams.set('status', params.status)

  return useQuery<LotListResponse>({
    queryKey: ['lots', params],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/lots?${searchParams}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return { data: json.data, meta: json.meta }
    },
  })
}

export function useLot(id: string | null) {
  return useQuery<LotSummary>({
    queryKey: ['lots', id],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/lots/${id}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    enabled: !!id,
  })
}

/* ------------------------------------------------------------------ */
/*  Reservations                                                      */
/* ------------------------------------------------------------------ */

export function useCreateReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/inventory/reservations', {
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
      queryClient.invalidateQueries({ queryKey: ['lots'] })
      toast.success('Riserva creata')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/inventory/reservations/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ['lots'] })
      toast.success('Riserva aggiornata')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

/* ------------------------------------------------------------------ */
/*  Suggested Inbounds                                                */
/* ------------------------------------------------------------------ */

interface SuggestedInbound {
  materialId: string
  materialCode: string
  materialName: string
  currentStock: number
  minLevel: number
  suggestedQty: number
  unit: string
  preferredVendor: string | null
}

export function useSuggestedInbounds() {
  return useQuery<SuggestedInbound[]>({
    queryKey: ['suggested-inbounds'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/suggested-inbounds')
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
  })
}

/* ------------------------------------------------------------------ */
/*  Warehouses                                                        */
/* ------------------------------------------------------------------ */

export function useWarehouses() {
  return useQuery<WarehouseListItem[]>({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/warehouses')
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
  })
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Magazzino creato')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/inventory/warehouses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Magazzino aggiornato')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
