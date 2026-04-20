'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface ApprovalRequest {
  id: string
  code: string
  title: string
  estimated_amount: number | null
  priority: string
  requester: { id: string; name: string }
}

interface ApprovalItem {
  id: string
  status: string
  notes: string | null
  decision_at: string | null
  created_at: string
  approver: { id: string; name: string; role: string }
  request: ApprovalRequest
}

interface ApiResponse<T> {
  success: boolean
  data: T
}

async function fetchMyApprovals(status?: string): Promise<ApprovalItem[]> {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  const query = params.toString()
  const url = `/api/approvals${query ? `?${query}` : ''}`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Errore nel caricamento delle approvazioni')
  const json: ApiResponse<ApprovalItem[]> = await res.json()
  if (!json.success) throw new Error('Errore nel caricamento delle approvazioni')
  return json.data
}

async function submitForApproval(requestId: string): Promise<unknown> {
  const res = await fetch(`/api/requests/${requestId}/approvals`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      err?.error?.message ?? "Errore nell'invio per approvazione",
    )
  }
  const json: ApiResponse<unknown> = await res.json()
  return json.data
}

async function decideApproval(
  approvalId: string,
  body: { action: 'APPROVED' | 'REJECTED'; notes?: string },
): Promise<unknown> {
  const res = await fetch(`/api/approvals/${approvalId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      err?.error?.message ?? "Errore nella decisione dell'approvazione",
    )
  }
  const json: ApiResponse<unknown> = await res.json()
  return json.data
}

export function useMyApprovals(status?: string) {
  return useQuery({
    queryKey: ['my-approvals', status],
    queryFn: () => fetchMyApprovals(status),
  })
}

export function useSubmitForApproval() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (requestId: string) => submitForApproval(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['my-approvals'] })
    },
  })
}

export function useDecideApproval() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      approvalId,
      ...body
    }: {
      approvalId: string
      action: 'APPROVED' | 'REJECTED'
      notes?: string
    }) => decideApproval(approvalId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['my-approvals'] })
    },
  })
}

export type { ApprovalItem, ApprovalRequest }
