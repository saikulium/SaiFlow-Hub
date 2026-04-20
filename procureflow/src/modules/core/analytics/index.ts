// ---------------------------------------------------------------------------
// Analytics module — public API
//
// Dashboard KPI, ROI, spend analysis, AI insights.
// ---------------------------------------------------------------------------

// Server — dashboard aggregator
export {
  getDashboardStats,
  getStatusDistribution,
  getRecentRequests,
  getSpendByVendor,
  getRequestsTrend,
  getMonthlySpendTrend,
  getUpcomingDeliveries,
  getBudgetDashboardStats,
  getInvoiceStats,
  getInvoiceAgingBuckets,
  getOrderedVsInvoiced,
  getInvoiceMatchDistribution,
  getTotalSpend,
  getTenderDashboardStats,
  getInventoryDashboardStats,
} from './server/dashboard.service'

// Server — insights
export {
  getActiveInsights,
  generateInsights,
  dismissInsight,
} from './server/insight.service'

// Server — ROI metrics
export {
  getRoiMetrics,
  getRoiSummaryOnly,
  computePeriodRange,
  computeNegotiationSavings,
  computeRoiSummary,
} from './server/roi-metrics.service'

// Constants
export {
  INSIGHT_TTL_HOURS,
  INSIGHT_SEVERITY_ORDER,
  MAX_ACTIVE_INSIGHTS,
} from './constants/insights'
export {
  DEFAULT_ROI_BENCHMARKS,
  ROI_PERIOD_OPTIONS,
} from './constants/roi'
export type { RoiBenchmarks } from './constants/roi'

// Hooks
export { useInsights } from './hooks/use-insights'
export { useRoiMetrics } from './hooks/use-roi-metrics'

// Components — dashboard
export { StatsRow } from './components/dashboard/stats-row'
export {
  StatCardSkeleton,
  StatsRowSkeleton,
} from './components/dashboard/stat-card-skeleton'
export { DashboardTabs } from './components/dashboard/dashboard-tabs'
export { BudgetOverview } from './components/dashboard/budget-overview'
export { InsightCards } from './components/dashboard/insight-cards'

// Components — analytics
export { RoiDashboard } from './components/analytics/roi-dashboard'
export {
  RoiSummaryCards,
  RoiSummaryMini,
} from './components/analytics/roi-summary-cards'
