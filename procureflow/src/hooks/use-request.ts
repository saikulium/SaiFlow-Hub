import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { RequestStatusKey, PriorityKey } from '@/lib/constants'
import type { ApiResponse } from '@/lib/api-response'
import type { UpdateRequestInput } from '@/lib/validations/request'

// --- Types ---

export interface RequestItem {
  id: string
  name: string
  description: string | null
  quantity: number
  unit: string | null
  unit_price: number | null
  total_price: number | null
  sku: string | null
}

export interface RequestApproval {
  id: string
  approver: {
    id: string
    name: string
    role: string
  }
  status: string
  decided_at: string | null
  comment: string | null
  created_at: string
}

export interface TimelineEvent {
  id: string
  type: string
  title: string
  description: string | null
  actor: {
    id: string
    name: string
  } | null
  created_at: string
}

export interface RequestComment {
  id: string
  content: string
  author: {
    id: string
    name: string
  }
  created_at: string
}

export interface RequestAttachment {
  id: string
  filename: string
  size: number
  mime_type: string
  uploaded_at: string
  uploader: {
    id: string
    name: string
  }
}

export interface RequestDetail {
  id: string
  code: string
  title: string
  description: string | null
  status: RequestStatusKey
  priority: PriorityKey
  estimated_amount: number | null
  actual_amount: number | null
  needed_by: string | null
  category: string | null
  department: string | null
  cost_center: string | null
  budget_code: string | null
  cig: string | null
  cup: string | null
  is_mepa: boolean
  mepa_oda_number: string | null
  tracking_number: string | null
  external_ref: string | null
  external_url: string | null
  tags: string[]
  created_at: string
  updated_at: string
  vendor: {
    id: string
    name: string
    code: string
  } | null
  commessa: {
    id: string
    code: string
    title: string
  } | null
  requester: {
    id: string
    name: string
  }
  items: RequestItem[]
  approvals: RequestApproval[]
  timeline: TimelineEvent[]
  comments: RequestComment[]
  attachments: RequestAttachment[]
}

export interface Vendor {
  id: string
  name: string
  code: string
}

// --- Fetchers ---

async function fetchRequest(id: string): Promise<ApiResponse<RequestDetail>> {
  const response = await fetch(`/api/requests/${id}`)

  if (!response.ok) {
    throw new Error('Errore nel caricamento della richiesta')
  }

  return response.json()
}

async function createRequest(
  data: Record<string, unknown>,
): Promise<ApiResponse<RequestDetail>> {
  const response = await fetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message =
      body?.error?.message ?? 'Errore nella creazione della richiesta'
    throw new Error(message)
  }

  return response.json()
}

async function updateRequest({
  id,
  data,
}: {
  id: string
  data: UpdateRequestInput
}): Promise<ApiResponse<RequestDetail>> {
  const response = await fetch(`/api/requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message =
      body?.error?.message ?? "Errore nell'aggiornamento della richiesta"
    throw new Error(message)
  }

  return response.json()
}

async function fetchVendors(): Promise<ApiResponse<Vendor[]>> {
  const response = await fetch('/api/vendors')

  if (!response.ok) {
    throw new Error('Errore nel caricamento dei fornitori')
  }

  return response.json()
}

// --- Hooks ---

export function useRequest(id: string) {
  return useQuery({
    queryKey: ['request', id],
    queryFn: () => fetchRequest(id),
    enabled: Boolean(id),
  })
}

export function useCreateRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export function useUpdateRequest(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdateRequestInput) => updateRequest({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export function useSubmitRequest(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/requests/${id}/submit`, {
        method: 'POST',
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const message =
          body?.error?.message ?? 'Errore nella sottomissione della richiesta'
        throw new Error(message)
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', id] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
    },
  })
}

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: fetchVendors,
  })
}
