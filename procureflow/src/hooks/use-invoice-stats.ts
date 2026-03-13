import { useQuery } from '@tanstack/react-query'

interface InvoiceBadgeCount {
  unmatched: number
  pendingReconciliation: number
}

async function fetchInvoiceBadgeCount(): Promise<InvoiceBadgeCount> {
  const response = await fetch('/api/invoices/stats')
  if (!response.ok) {
    return { unmatched: 0, pendingReconciliation: 0 }
  }
  const json = await response.json()
  return json.data ?? { unmatched: 0, pendingReconciliation: 0 }
}

export function useInvoiceBadgeCount() {
  return useQuery<InvoiceBadgeCount>({
    queryKey: ['invoice-badge-count'],
    queryFn: fetchInvoiceBadgeCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
