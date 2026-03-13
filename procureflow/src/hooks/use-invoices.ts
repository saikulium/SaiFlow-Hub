import { useQuery } from '@tanstack/react-query'
import type { ApiResponse } from '@/lib/api-response'

export interface InvoiceListItem {
  id: string
  invoice_number: string
  invoice_date: string
  document_type: string
  total_amount: number
  currency: string
  supplier_name: string
  supplier_vat_id: string | null
  match_status: string
  match_confidence: number | null
  reconciliation_status: string
  pr_code_extracted: string | null
  received_at: string
  vendor: { id: string; name: string; code: string } | null
  purchase_request: { id: string; code: string; title: string } | null
}

export interface InvoicesParams {
  page?: number
  pageSize?: number
  search?: string
  match_status?: string
  reconciliation_status?: string
  vendor_id?: string
  date_from?: string
  date_to?: string
  sort?: string
  order?: 'asc' | 'desc'
}

type InvoicesResponse = ApiResponse<InvoiceListItem[]>

async function fetchInvoices(
  params: InvoicesParams,
): Promise<InvoicesResponse> {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  }

  const url = `/api/invoices?${searchParams.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('Errore nel caricamento delle fatture')
  }

  return response.json()
}

export function useInvoices(params: InvoicesParams = {}) {
  return useQuery<InvoicesResponse>({
    queryKey: ['invoices', params],
    queryFn: () => fetchInvoices(params),
  })
}
