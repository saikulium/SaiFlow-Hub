import { useQuery } from '@tanstack/react-query'

interface SidebarBadgeCounts {
  readonly pendingApprovals: number
  readonly actionableRequests: number
}

async function fetchSidebarBadges(): Promise<SidebarBadgeCounts> {
  const [approvalsRes, requestsRes] = await Promise.all([
    fetch('/api/approvals?status=PENDING'),
    fetch('/api/requests?status=PENDING_APPROVAL,SUBMITTED&pageSize=1'),
  ])

  let pendingApprovals = 0
  if (approvalsRes.ok) {
    const json = await approvalsRes.json()
    pendingApprovals = Array.isArray(json.data) ? json.data.length : 0
  }

  let actionableRequests = 0
  if (requestsRes.ok) {
    const json = await requestsRes.json()
    actionableRequests = json.meta?.total ?? 0
  }

  return { pendingApprovals, actionableRequests }
}

export function useSidebarBadges() {
  return useQuery<SidebarBadgeCounts>({
    queryKey: ['sidebar-badges'],
    queryFn: fetchSidebarBadges,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
