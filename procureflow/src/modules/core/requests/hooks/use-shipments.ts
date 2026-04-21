// ---------------------------------------------------------------------------
// Shipment hooks — list/create/update spedizioni per una PR.
//
// Le spedizioni sono aggregate a livello di PurchaseRequest ma ogni shipment
// è collegato a un singolo RequestItem. Gli hook invalidano la lista della PR
// + la query del dettaglio richiesta per aggiornare `delivery_status`.
// ---------------------------------------------------------------------------

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiResponse } from '@/lib/api-response'

// --- Types -------------------------------------------------------------------

export type ShipmentStatus =
  | 'PENDING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'RETURNED'
  | 'LOST'
  | 'CANCELLED'

export type ShipmentSource = 'MANUAL' | 'EMAIL' | 'DDT_PARSING' | 'API'

export interface Shipment {
  readonly id: string
  readonly request_item_id: string
  readonly shipped_quantity: string | number
  readonly status: ShipmentStatus
  readonly source: ShipmentSource
  readonly tracking_number: string | null
  readonly carrier: string | null
  readonly tracking_url: string | null
  readonly expected_ship_date: string | null
  readonly actual_ship_date: string | null
  readonly expected_delivery_date: string | null
  readonly actual_delivery_date: string | null
  readonly notes: string | null
  readonly source_email_log_id: string | null
  readonly created_at: string
  readonly updated_at: string
}

// --- Fetchers ----------------------------------------------------------------

async function fetchShipments(
  requestId: string,
): Promise<readonly Shipment[]> {
  const res = await fetch(`/api/requests/${requestId}/shipments`)
  if (!res.ok) {
    throw new Error('Errore nel caricamento delle spedizioni')
  }
  const json = (await res.json()) as ApiResponse<readonly Shipment[]>
  if (!json.success || !json.data) {
    throw new Error(json.error?.message ?? 'Errore sconosciuto')
  }
  return json.data
}

export interface CreateShipmentInput {
  readonly requestId: string
  readonly requestItemId: string
  readonly shippedQuantity: number | string
  readonly status?: ShipmentStatus
  readonly trackingNumber?: string
  readonly carrier?: string
  readonly trackingUrl?: string
  readonly expectedShipDate?: string
  readonly actualShipDate?: string
  readonly expectedDeliveryDate?: string
  readonly actualDeliveryDate?: string
  readonly notes?: string
}

async function createShipmentRequest(
  input: CreateShipmentInput,
): Promise<Shipment> {
  const res = await fetch(`/api/requests/${input.requestId}/shipments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request_item_id: input.requestItemId,
      shipped_quantity: input.shippedQuantity,
      status: input.status,
      tracking_number: input.trackingNumber,
      carrier: input.carrier,
      tracking_url: input.trackingUrl,
      expected_ship_date: input.expectedShipDate,
      actual_ship_date: input.actualShipDate,
      expected_delivery_date: input.expectedDeliveryDate,
      actual_delivery_date: input.actualDeliveryDate,
      notes: input.notes,
    }),
  })
  const json = (await res
    .json()
    .catch(() => null)) as ApiResponse<Shipment> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(
      json?.error?.message ?? 'Errore nella creazione della spedizione',
    )
  }
  return json.data
}

export interface UpdateShipmentStatusInput {
  readonly shipmentId: string
  readonly status: ShipmentStatus
  readonly actualShipDate?: string | null
  readonly actualDeliveryDate?: string | null
  readonly notes?: string
}

async function updateShipmentStatusRequest(
  input: UpdateShipmentStatusInput,
): Promise<Shipment> {
  const res = await fetch(`/api/shipments/${input.shipmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: input.status,
      actual_ship_date: input.actualShipDate,
      actual_delivery_date: input.actualDeliveryDate,
      notes: input.notes,
    }),
  })
  const json = (await res
    .json()
    .catch(() => null)) as ApiResponse<Shipment> | null
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(
      json?.error?.message ?? "Errore nell'aggiornamento della spedizione",
    )
  }
  return json.data
}

// --- Hooks -------------------------------------------------------------------

export function useShipments(requestId: string) {
  return useQuery({
    queryKey: ['shipments', requestId],
    queryFn: () => fetchShipments(requestId),
    enabled: Boolean(requestId),
  })
}

export function useCreateShipment(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createShipmentRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', requestId] })
      queryClient.invalidateQueries({ queryKey: ['request', requestId] })
    },
  })
}

export function useUpdateShipmentStatus(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateShipmentStatusRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', requestId] })
      queryClient.invalidateQueries({ queryKey: ['request', requestId] })
    },
  })
}
