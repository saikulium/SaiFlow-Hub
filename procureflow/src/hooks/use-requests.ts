import { useQuery } from '@tanstack/react-query'
import type { RequestStatusKey, PriorityKey } from '@/lib/constants'
import type { ApiResponse } from '@/lib/api-response'

export interface RequestListItem {
  id: string
  code: string
  title: string
  status: RequestStatusKey
  priority: PriorityKey
  estimated_amount: number | null
  actual_amount: number | null
  created_at: string
  needed_by: string | null
  vendor: {
    id: string
    name: string
    code: string
  } | null
  requester: {
    id: string
    name: string
  }
  _count: {
    items: number
    comments: number
  }
}

export interface RequestsParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  priority?: string
  sort?: string
  order?: 'asc' | 'desc'
}

type RequestsResponse = ApiResponse<RequestListItem[]>

async function fetchRequests(params: RequestsParams): Promise<RequestsResponse> {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  }

  const url = `/api/requests?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Errore nel caricamento delle richieste')
  }

  return response.json()
}

export function useRequests(params: RequestsParams = {}) {
  return useQuery<RequestsResponse>({
    queryKey: ['requests', params],
    queryFn: () => fetchRequests(params),
  })
}
