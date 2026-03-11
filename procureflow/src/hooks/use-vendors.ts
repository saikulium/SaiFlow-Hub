'use client'

import { useQuery } from '@tanstack/react-query'

interface VendorListParams {
  search?: string
  status?: string
}

interface VendorListItem {
  id: string
  name: string
  code: string
  email: string | null
  phone: string | null
  website: string | null
  status: string
  category: string[]
  rating: number | null
  payment_terms: string | null
  _count: {
    requests: number
  }
}

interface VendorContact {
  id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
}

interface VendorRequest {
  id: string
  code: string
  title: string
  status: string
  priority: string
  estimated_amount: number | null
  created_at: string
}

interface VendorDetail {
  id: string
  name: string
  code: string
  email: string | null
  phone: string | null
  website: string | null
  portal_url: string | null
  portal_type: string | null
  status: string
  category: string[]
  rating: number | null
  payment_terms: string | null
  notes: string | null
  contacts: VendorContact[]
  requests: VendorRequest[]
  _count: {
    requests: number
  }
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

async function fetchVendors(
  params?: VendorListParams,
): Promise<VendorListItem[]> {
  const searchParams = new URLSearchParams()

  if (params?.search) {
    searchParams.set('search', params.search)
  }
  if (params?.status) {
    searchParams.set('status', params.status)
  }

  const query = searchParams.toString()
  const url = `/api/vendors${query ? `?${query}` : ''}`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Errore nel caricamento dei fornitori')
  }

  const json: ApiResponse<VendorListItem[]> = await response.json()

  if (!json.success) {
    throw new Error('Errore nel caricamento dei fornitori')
  }

  return json.data
}

async function fetchVendor(id: string): Promise<VendorDetail> {
  const response = await fetch(`/api/vendors/${id}`)

  if (!response.ok) {
    throw new Error('Errore nel caricamento del fornitore')
  }

  const json: ApiResponse<VendorDetail> = await response.json()

  if (!json.success) {
    throw new Error('Errore nel caricamento del fornitore')
  }

  return json.data
}

export function useVendors(params?: VendorListParams) {
  return useQuery({
    queryKey: ['vendors', params],
    queryFn: () => fetchVendors(params),
  })
}

export function useVendor(id: string) {
  return useQuery({
    queryKey: ['vendor', id],
    queryFn: () => fetchVendor(id),
    enabled: Boolean(id),
  })
}

export type {
  VendorListItem,
  VendorDetail,
  VendorContact,
  VendorRequest,
  VendorListParams,
}
