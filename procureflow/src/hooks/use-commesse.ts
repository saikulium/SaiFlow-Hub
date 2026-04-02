'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateCommessaInput, UpdateCommessaInput } from '@/lib/validations/commesse'
import type { CommessaListItem, CommessaDetail, CommessaDashboardStats } from '@/types'

interface CommessaListParams {
  search?: string
  status?: string
  client_id?: string
  sort?: 'created_at' | 'deadline'
  dir?: 'asc' | 'desc'
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

interface CommessaListResponse {
  items: CommessaListItem[]
  nextCursor?: string
}

async function fetchCommesse(
  params?: CommessaListParams,
): Promise<CommessaListItem[]> {
  const searchParams = new URLSearchParams()

  if (params?.search) {
    searchParams.set('search', params.search)
  }
  if (params?.status) {
    searchParams.set('status', params.status)
  }
  if (params?.client_id) {
    searchParams.set('client_id', params.client_id)
  }
  if (params?.sort) {
    searchParams.set('sort', params.sort)
  }
  if (params?.dir) {
    searchParams.set('dir', params.dir)
  }

  const query = searchParams.toString()
  const url = `/api/commesse${query ? `?${query}` : ''}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Errore nel caricamento delle commesse')
  }

  const json: ApiResponse<CommessaListResponse> = await response.json()

  if (!json.success) {
    throw new Error('Errore nel caricamento delle commesse')
  }

  return json.data.items
}

async function fetchCommessaDetail(code: string): Promise<CommessaDetail> {
  const response = await fetch(`/api/commesse/${code}`)

  if (!response.ok) {
    throw new Error('Errore nel caricamento della commessa')
  }

  const json: ApiResponse<CommessaDetail> = await response.json()

  if (!json.success) {
    throw new Error('Errore nel caricamento della commessa')
  }

  return json.data
}

async function fetchCommessaStats(): Promise<CommessaDashboardStats> {
  const response = await fetch('/api/commesse/stats')

  if (!response.ok) {
    throw new Error('Errore nel caricamento delle statistiche')
  }

  const json: ApiResponse<CommessaDashboardStats> = await response.json()

  if (!json.success) {
    throw new Error('Errore nel caricamento delle statistiche')
  }

  return json.data
}

export function useCommesse(params?: CommessaListParams) {
  return useQuery({
    queryKey: ['commesse', params],
    queryFn: () => fetchCommesse(params),
  })
}

export function useCommessaDetail(code: string) {
  return useQuery({
    queryKey: ['commessa', code],
    queryFn: () => fetchCommessaDetail(code),
    enabled: !!code,
  })
}

export function useCommessaStats() {
  return useQuery({
    queryKey: ['commessa-stats'],
    queryFn: fetchCommessaStats,
    staleTime: 60_000,
  })
}

async function createCommessa(
  data: CreateCommessaInput,
): Promise<ApiResponse<CommessaDetail>> {
  const response = await fetch('/api/commesse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      body?.error?.message ?? 'Errore nella creazione della commessa',
    )
  }

  return response.json()
}

export function useCreateCommessa() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCommessaInput) => createCommessa(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commesse'] })
      queryClient.invalidateQueries({ queryKey: ['commessa-stats'] })
    },
  })
}

async function updateCommessa({
  code,
  data,
}: {
  code: string
  data: UpdateCommessaInput
}): Promise<ApiResponse<CommessaDetail>> {
  const response = await fetch(`/api/commesse/${code}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      body?.error?.message ?? "Errore nell'aggiornamento della commessa",
    )
  }

  return response.json()
}

export function useUpdateCommessa(code: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateCommessaInput) => updateCommessa({ code, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commessa', code] })
      queryClient.invalidateQueries({ queryKey: ['commesse'] })
      queryClient.invalidateQueries({ queryKey: ['commessa-stats'] })
    },
  })
}

async function acceptSuggestion({
  code,
  suggestionId,
}: {
  code: string
  suggestionId: string
}): Promise<ApiResponse<{ accepted: boolean; request_id: string }>> {
  const response = await fetch(`/api/commesse/${code}/accept-suggestion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suggestion_id: suggestionId }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      body?.error?.message ?? "Errore nell'accettazione del suggerimento",
    )
  }

  return response.json()
}

export function useAcceptSuggestion(code: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (suggestionId: string) =>
      acceptSuggestion({ code, suggestionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commessa', code] })
    },
  })
}

async function rejectSuggestion({
  code,
  suggestionId,
}: {
  code: string
  suggestionId: string
}): Promise<ApiResponse<{ deleted: boolean }>> {
  const response = await fetch(
    `/api/commesse/${code}/suggestions/${suggestionId}`,
    { method: 'DELETE' },
  )

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      body?.error?.message ?? 'Errore nel rifiuto del suggerimento',
    )
  }

  return response.json()
}

export function useRejectSuggestion(code: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (suggestionId: string) =>
      rejectSuggestion({ code, suggestionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commessa', code] })
    },
  })
}

export type { CommessaListParams }
