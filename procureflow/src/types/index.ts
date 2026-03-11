import type { RequestStatusKey, PriorityKey } from '@/lib/constants'

export interface DashboardStats {
  activeRequests: number
  pendingApprovals: number
  monthlySpend: number
  monthlyBudget: number
  overdueDeliveries: number
  previousActiveRequests: number
  previousPendingApprovals: number
  previousMonthlySpend: number
  previousOverdueDeliveries: number
}

export interface RecentRequest {
  id: string
  code: string
  title: string
  status: RequestStatusKey
  priority: PriorityKey
  vendorName: string | null
  estimatedAmount: number | null
  createdAt: string
}

export interface DeliveryItem {
  id: string
  code: string
  title: string
  vendorName: string
  expectedDelivery: string
  status: 'on_time' | 'at_risk' | 'overdue'
}

export interface SpendByVendor {
  vendor: string
  amount: number
}

export interface RequestTrend {
  period: string
  count: number
}

export interface StatusDistribution {
  status: RequestStatusKey
  label: string
  count: number
  color: string
}

export interface MonthlySpendTrend {
  period: string
  amount: number
}
