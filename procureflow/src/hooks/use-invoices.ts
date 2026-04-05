import { createListHook } from './create-list-hook'

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

export const useInvoices = createListHook<InvoiceListItem, InvoicesParams>({
  endpoint: '/api/invoices',
  queryKey: 'invoices',
  errorMessage: 'Errore nel caricamento delle fatture',
})
