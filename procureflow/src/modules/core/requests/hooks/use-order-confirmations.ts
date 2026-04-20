// ---------------------------------------------------------------------------
// Order Confirmation hooks — list/apply/reject conferme d'ordine per una PR.
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiResponse } from '@/lib/api-response'

// --- Types -------------------------------------------------------------------

export type OrderConfirmationStatus =
  | 'RECEIVED'
  | 'PARSED'
  | 'ACKNOWLEDGED'
  | 'APPLIED'
  | 'REJECTED'

export type OrderConfirmationSource = 'EMAIL' | 'WEBHOOK' | 'MANUAL' | 'IMPORT'

export interface OrderConfirmationLine {
  readonly id: string
  readonly confirmation_id: string
  readonly request_item_id: string | null

  readonly original_name: string | null
  readonly original_quantity: number | null
  readonly original_unit: string | null
  readonly original_unit_price: string | number | null
  readonly original_expected_delivery: string | null

  readonly confirmed_name: string | null
  readonly confirmed_quantity: number | null
  readonly confirmed_unit: string | null
  readonly confirmed_unit_price: string | number | null
  readonly confirmed_delivery: string | null
  readonly confirmed_sku: string | null

  readonly price_delta_pct: string | number | null
  readonly delivery_delay_days: number | null

  readonly applied: boolean
  readonly applied_at: string | null
  readonly rejected: boolean
  readonly rejected_at: string | null
  readonly notes: string | null

  readonly created_at: string
}

export interface OrderConfirmation {
  readonly id: string
  readonly request_id: string
  readonly email_log_id: string | null
  readonly source: OrderConfirmationSource
  readonly status: OrderConfirmationStatus
  readonly subject: string | null
  readonly vendor_reference: string | null
  readonly received_at: string | null
  readonly parsed_at: string | null
  readonly acknowledged_at: string | null
  readonly applied_at: string | null
  readonly applied_by: string | null
  readonly rejected_at: string | null
  readonly rejected_by: string | null
  readonly rejection_reason: string | null
  readonly notes: string | null
  readonly created_at: string
  readonly updated_at: string
  readonly lines: readonly OrderConfirmationLine[]
}

// --- Fetchers ----------------------------------------------------------------

async function fetchConfirmations(
  requestId: string,
): Promise<readonly OrderConfirmation[]> {
  const res = await fetch(`/api/requests/${requestId}/confirmations`)
  if (!res.ok) {
    throw new Error('Errore nel caricamento delle conferme d\'ordine')
  }
  const json = (await res.json()) as ApiResponse<readonly OrderConfirmation[]>
  if (!json.success || !json.data) {
    throw new Error(json.error?.message ?? 'Errore sconosciuto')
  }
  return json.data
}

interface ApplyInput {
  readonly confirmationId: string
  readonly acceptedLineIds: readonly string[]
  readonly notes?: string
}

async function applyConfirmationRequest(
  input: ApplyInput,
): Promise<OrderConfirmation> {
  const res = await fetch(`/api/confirmations/${input.confirmationId}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accepted_line_ids: input.acceptedLineIds,
      notes: input.notes,
    }),
  })
  const json = (await res.json().catch(() => null)) as
    | ApiResponse<OrderConfirmation>
    | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(
      json?.error?.message ?? 'Errore nell\'applicazione della conferma',
    )
  }
  return json.data
}

interface RejectInput {
  readonly confirmationId: string
  readonly reason: string
}

async function rejectConfirmationRequest(
  input: RejectInput,
): Promise<OrderConfirmation> {
  const res = await fetch(`/api/confirmations/${input.confirmationId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: input.reason }),
  })
  const json = (await res.json().catch(() => null)) as
    | ApiResponse<OrderConfirmation>
    | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(
      json?.error?.message ?? 'Errore nel rifiuto della conferma',
    )
  }
  return json.data
}

// --- Hooks -------------------------------------------------------------------

export function useOrderConfirmations(requestId: string) {
  return useQuery({
    queryKey: ['order-confirmations', requestId],
    queryFn: () => fetchConfirmations(requestId),
    enabled: Boolean(requestId),
  })
}

export function useApplyOrderConfirmation(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: applyConfirmationRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['order-confirmations', requestId],
      })
      queryClient.invalidateQueries({ queryKey: ['request', requestId] })
    },
  })
}

export function useRejectOrderConfirmation(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rejectConfirmationRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['order-confirmations', requestId],
      })
      queryClient.invalidateQueries({ queryKey: ['request', requestId] })
    },
  })
}
