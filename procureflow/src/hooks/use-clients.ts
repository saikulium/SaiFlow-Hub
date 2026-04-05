'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateClientInput, UpdateClientInput } from '@/lib/validations/client'
import type { ClientListItem, ClientDetail } from '@/types'

interface ClientListParams {
  search?: string
  status?: string
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

interface ClientListResponse {
  items: ClientListItem[]
  nextCursor?: string
}

async function fetchClients(
  params?: ClientListParams,
): Promise<ClientListItem[]> {
  const searchParams = new URLSearchParams()

  if (params?.search) {
    searchParams.set('search', params.search)
  }
  if (params?.status) {
    searchParams.set('status', params.status)
  }

  const query = searchParams.toString()
  const url = `/api/clients${query ? `?${query}` : ''}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Errore nel caricamento dei clienti')
  }

  const json: ApiResponse<ClientListResponse> = await response.json()

  if (!json.success) {
    throw new Error('Errore nel caricamento dei clienti')
  }

  return json.data.items
}

async function fetchClient(id: string): Promise<ClientDetail> {
  const response = await fetch(`/api/clients/${id}`)

  if (!response.ok) {
    throw new Error('Errore nel caricamento del cliente')
  }

  const json: ApiResponse<ClientDetail> = await response.json()

  if (!json.success) {
    throw new Error('Errore nel caricamento del cliente')
  }

  return json.data
}

export function useClients(params?: ClientListParams) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: () => fetchClients(params),
  })
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => fetchClient(id),
    enabled: Boolean(id),
  })
}

async function createClient(
  data: CreateClientInput,
): Promise<ApiResponse<ClientDetail>> {
  const response = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      body?.error?.message ?? 'Errore nella creazione del cliente',
    )
  }

  return response.json()
}

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateClientInput) => createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

async function updateClient({
  id,
  data,
}: {
  id: string
  data: UpdateClientInput
}): Promise<ApiResponse<ClientDetail>> {
  const response = await fetch(`/api/clients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      body?.error?.message ?? "Errore nell'aggiornamento del cliente",
    )
  }

  return response.json()
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateClientInput) => updateClient({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

async function deleteClient(id: string): Promise<ApiResponse<unknown>> {
  const response = await fetch(`/api/clients/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      body?.error?.message ?? 'Errore nella disattivazione del cliente',
    )
  }

  return response.json()
}

export function useDeleteClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export type { ClientListParams }
