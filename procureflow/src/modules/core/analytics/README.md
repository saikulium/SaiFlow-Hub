# Analytics module

**Pack:** core · **alwaysOn:** false · **depends on:** core

Dashboard KPI, ROI, spend analysis, AI insights.

## Public API

```ts
import {
  // Dashboard aggregator (server)
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
  // AI insights
  getActiveInsights,
  generateInsights,
  dismissInsight,
  // ROI
  getRoiMetrics,
  getRoiSummaryOnly,
  // Constants
  DEFAULT_ROI_BENCHMARKS,
  ROI_PERIOD_OPTIONS,
  INSIGHT_TTL_HOURS,
  // Hooks
  useInsights,
  useRoiMetrics,
  // Components
  StatsRow,
  DashboardTabs,
  BudgetOverview,
  InsightCards,
  RoiDashboard,
  RoiSummaryCards,
  RoiSummaryMini,
} from '@/modules/core/analytics'
```

## Scope

- Aggregatore dashboard principale (`dashboard.service.ts`) che compone stats
  dagli altri moduli (tenders, inventory, budgets, invoicing).
- Servizio insight AI (`insight.service.ts`) — usa `INSIGHT_SYSTEM_PROMPT` da
  `@/lib/ai/prompts` condiviso.
- Servizio ROI (`roi-metrics.service.ts`) — tempo risparmiato, savings, KPI.
- Componenti dashboard home (cards, tabs, grafici Recharts).
- Componenti pagina analytics/ROI.

## Fuori scope

- `src/lib/ai/{claude-client,models,prompts}` — infrastruttura AI condivisa.
- `/api/ai/forecast/*` — route che importano da `@/modules/core/inventory`.
- `src/app/(dashboard)/page.tsx` e `src/app/(dashboard)/analytics/page.tsx` —
  consumer Next.js.
