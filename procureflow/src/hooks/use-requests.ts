import { createListHook } from './create-list-hook'
import type { RequestStatusKey, PriorityKey } from '@/lib/constants'

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

export const useRequests = createListHook<RequestListItem, RequestsParams>({
  endpoint: '/api/requests',
  queryKey: 'requests',
  errorMessage: 'Errore nel caricamento delle richieste',
})
