'use client'

import { useState } from 'react'
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Gavel,
  Package,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModules } from '@/hooks/use-modules'
import { filterDashboardTabs } from '@/lib/modules/helpers'
import { RecentRequestsList } from './recent-requests-list'
import { QuickActions } from './quick-actions'
import { DeliveryTimeline } from './delivery-timeline'
import { MonthlySpendTrendChart } from './monthly-spend-trend-chart'
import { StatusDistributionChart } from './status-distribution-chart'
import { InvoiceStatsRow } from './invoice-stats-row'
import { MatchStatusChart } from './match-status-chart'
import { InvoiceAgingChart } from './invoice-aging-chart'
import { OrderedVsInvoicedChart } from './ordered-vs-invoiced-chart'
import { BudgetOverview } from './budget-overview'
import { TenderPipelineChart } from './tender-pipeline-chart'
import { InventoryOverviewChart } from './inventory-overview-chart'
import { SpendByVendorChart } from './spend-by-vendor-chart'
import { RequestsTrendChart } from './requests-trend-chart'
import { RoiSummaryMini } from '@/components/analytics/roi-summary-cards'
import { InsightCards } from './insight-cards'
import type {
  RecentRequest,
  DeliveryItem,
  MonthlySpendTrend,
  StatusDistribution,
  InvoiceStats,
  InvoiceMatchDistribution,
  InvoiceAgingBucket,
  OrderedVsInvoiced,
  BudgetDashboardStats,
  TenderDashboardStats,
  InventoryDashboardStats,
  SpendByVendor,
  RequestTrend,
  RoiSummary,
} from '@/types'

type TabId =
  | 'panoramica'
  | 'fatture'
  | 'budget'
  | 'gare'
  | 'magazzino'
  | 'analisi'

interface Tab {
  readonly id: TabId
  readonly label: string
  readonly icon: typeof LayoutDashboard
}

interface DashboardTabsProps {
  readonly recentRequests: RecentRequest[]
  readonly deliveries: DeliveryItem[]
  readonly monthlySpend: MonthlySpendTrend[]
  readonly statusDist: StatusDistribution[]
  readonly invoiceStats: InvoiceStats
  readonly matchDist: InvoiceMatchDistribution[]
  readonly invoiceAging: InvoiceAgingBucket[]
  readonly orderedVsInvoiced: OrderedVsInvoiced[]
  readonly budgetStats: BudgetDashboardStats
  readonly tenderStats: TenderDashboardStats
  readonly inventoryStats: InventoryDashboardStats
  readonly spendByVendor: SpendByVendor[]
  readonly trend: RequestTrend[]
  readonly roiSummary?: RoiSummary | null
}

const BASE_TABS: readonly Tab[] = [
  { id: 'panoramica', label: 'Panoramica', icon: LayoutDashboard },
  { id: 'fatture', label: 'Fatture', icon: Receipt },
  { id: 'budget', label: 'Budget', icon: PiggyBank },
  { id: 'gare', label: 'Gare', icon: Gavel },
  { id: 'magazzino', label: 'Magazzino', icon: Package },
  { id: 'analisi', label: 'Analisi', icon: BarChart3 },
] as const

export function DashboardTabs(props: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('panoramica')
  const { enabledModules } = useModules()

  // Filter tabs by enabled modules; also hide budget tab if no budgets exist
  const hasBudgets = props.budgetStats.budgets.length > 0
  const tabs = filterDashboardTabs(enabledModules, BASE_TABS).filter(
    (t) => t.id !== 'budget' || hasBudgets,
  )

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-pf-border bg-pf-bg-secondary p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-pf-accent text-white shadow-sm'
                  : 'text-pf-text-secondary hover:bg-pf-bg-hover hover:text-pf-text-primary',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in-up">
        {activeTab === 'panoramica' && (
          <PanoramicaTab
            recentRequests={props.recentRequests}
            deliveries={props.deliveries}
            monthlySpend={props.monthlySpend}
            statusDist={props.statusDist}
          />
        )}
        {activeTab === 'fatture' && (
          <FattureTab
            invoiceStats={props.invoiceStats}
            matchDist={props.matchDist}
            invoiceAging={props.invoiceAging}
            orderedVsInvoiced={props.orderedVsInvoiced}
          />
        )}
        {activeTab === 'budget' && hasBudgets && (
          <BudgetOverview stats={props.budgetStats} />
        )}
        {activeTab === 'gare' && (
          <TenderPipelineChart stats={props.tenderStats} />
        )}
        {activeTab === 'magazzino' && (
          <InventoryOverviewChart stats={props.inventoryStats} />
        )}
        {activeTab === 'analisi' && (
          <AnalisiTab
            spendByVendor={props.spendByVendor}
            trend={props.trend}
            roiSummary={props.roiSummary ?? null}
          />
        )}
      </div>
    </div>
  )
}

function PanoramicaTab({
  recentRequests,
  deliveries,
  monthlySpend,
  statusDist,
}: {
  readonly recentRequests: RecentRequest[]
  readonly deliveries: DeliveryItem[]
  readonly monthlySpend: MonthlySpendTrend[]
  readonly statusDist: StatusDistribution[]
}) {
  return (
    <div className="space-y-6">
      <InsightCards />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <RecentRequestsList requests={recentRequests} />
        <div className="space-y-6">
          <QuickActions />
          <DeliveryTimeline deliveries={deliveries} />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <MonthlySpendTrendChart data={monthlySpend} />
        <StatusDistributionChart data={statusDist} />
      </div>
    </div>
  )
}

function FattureTab({
  invoiceStats,
  matchDist,
  invoiceAging,
  orderedVsInvoiced,
}: {
  readonly invoiceStats: InvoiceStats
  readonly matchDist: InvoiceMatchDistribution[]
  readonly invoiceAging: InvoiceAgingBucket[]
  readonly orderedVsInvoiced: OrderedVsInvoiced[]
}) {
  return (
    <div className="space-y-6">
      <InvoiceStatsRow stats={invoiceStats} />
      <div className="grid gap-6 md:grid-cols-3">
        <MatchStatusChart data={matchDist} />
        <InvoiceAgingChart data={invoiceAging} />
        <OrderedVsInvoicedChart data={orderedVsInvoiced} />
      </div>
    </div>
  )
}

function AnalisiTab({
  spendByVendor,
  trend,
  roiSummary,
}: {
  readonly spendByVendor: SpendByVendor[]
  readonly trend: RequestTrend[]
  readonly roiSummary: RoiSummary | null
}) {
  return (
    <div className="space-y-6">
      {roiSummary && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-pf-text-secondary">
              ROI & Impatto (ultimi 90 giorni)
            </h3>
            <a
              href="/analytics"
              className="text-xs font-medium text-pf-accent hover:text-pf-accent-hover"
            >
              Dettagli &rarr;
            </a>
          </div>
          <RoiSummaryMini summary={roiSummary} />
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <SpendByVendorChart data={spendByVendor} />
        <RequestsTrendChart data={trend} />
      </div>
    </div>
  )
}
