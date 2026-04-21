import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiResponse } from '@/lib/api-response'

export interface InvoiceLineItemDetail {
  id: string
  line_number: number
  description: string
  quantity: number
  unit_of_measure: string | null
  unit_price: number | null
  total_price: number | null
  vat_rate: number | null
  vat_amount: number | null
  vat_nature: string | null
}

export interface InvoiceDetail {
  id: string
  invoice_number: string
  invoice_date: string
  document_type: string
  total_amount: number
  total_taxable: number | null
  total_tax: number | null
  currency: string
  supplier_name: string
  supplier_vat_id: string | null
  customer_vat_id: string | null
  match_status: string
  match_confidence: number | null
  match_candidates: unknown | null
  reconciliation_status: string
  reconciliation_notes: string | null
  pr_code_extracted: string | null
  causale: string | null
  received_at: string
  sdi_id: string | null
  sdi_filename: string | null
  sdi_status: string | null
  payment_due_date: string | null
  payment_method: string | null
  payment_terms: string | null
  iban: string | null
  amount_discrepancy: number | null
  discrepancy_type: string | null
  discrepancy_resolved: boolean
  vendor: {
    id: string
    name: string
    code: string
    email: string | null
  } | null
  purchase_request: {
    id: string
    code: string
    title: string
    status: string
    estimated_amount: number | null
    actual_amount: number | null
    requester: { id: string; name: string }
    items: Array<{
      id: string
      name: string
      quantity: number
      unit_price: number | null
      total_price: number | null
    }>
  } | null
  line_items: InvoiceLineItemDetail[]
  timeline_events: Array<{
    id: string
    type: string
    title: string
    description: string | null
    actor: string | null
    created_at: string
  }>
}

type InvoiceResponse = ApiResponse<InvoiceDetail>

async function fetchInvoice(id: string): Promise<InvoiceResponse> {
  const response = await fetch(`/api/invoices/${id}`)
  if (!response.ok) {
    throw new Error('Errore nel caricamento della fattura')
  }
  return response.json()
}

export function useInvoice(id: string) {
  return useQuery<InvoiceResponse>({
    queryKey: ['invoice', id],
    queryFn: () => fetchInvoice(id),
    enabled: Boolean(id),
  })
}

export function useMatchInvoice(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (purchaseRequestId: string) => {
      const response = await fetch(`/api/invoices/${invoiceId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchase_request_id: purchaseRequestId }),
      })
      if (!response.ok) throw new Error('Errore nel match')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-badge-count'] })
    },
  })
}

export function useUnmatchInvoice(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/invoices/${invoiceId}/unmatch`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Errore nello scollegamento')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-badge-count'] })
    },
  })
}

export function useReconcileInvoice(invoiceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      action: 'approve' | 'dispute' | 'reject'
      notes?: string
    }) => {
      const response = await fetch(`/api/invoices/${invoiceId}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Errore nella riconciliazione')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-badge-count'] })
    },
  })
}

export function useUploadInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) throw new Error('Errore nel caricamento')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-badge-count'] })
    },
  })
}
