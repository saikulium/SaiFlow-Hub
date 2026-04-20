'use client'

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { DEFAULT_ROI_BENCHMARKS } from '../../constants/roi'
import type {
  TimeSavingsMetrics,
  CostSavingsMetrics,
  OperationalEfficiencyMetrics,
  AutomationMetrics,
} from '@/types'

// --- Shared tooltip factory ---

function makeTooltipContent(unit: string) {
  return function TooltipContent({
    active,
    payload,
    label,
  }: TooltipContentProps) {
    if (!active || !payload?.[0]) return null
    const val = payload[0].value
    const formatted =
      typeof val === 'number' ? val.toLocaleString('it-IT') : String(val ?? '')
    return (
      <div className="rounded-badge border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-xs shadow-lg">
        <p className="font-medium text-pf-text-primary">{label}</p>
        <p className="text-pf-text-secondary">
          {formatted} {unit}
        </p>
      </div>
    )
  }
}

const CycleTooltip = makeTooltipContent('giorni')
const ApprovalTooltip = makeTooltipContent('ore')
const CurrencyTooltip = makeTooltipContent('\u20AC')
const VolumeTooltip = makeTooltipContent('richieste')

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
      <div className="mb-4">
        <h3 className="font-display text-base font-semibold text-pf-text-primary">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-pf-text-muted">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-pf-text-muted">
      Nessun dato disponibile
    </div>
  )
}

function StatBadge({
  label,
  value,
  unit,
}: {
  label: string
  value: number
  unit: string
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-pf-bg-tertiary px-3 py-2">
      <span className="text-xs text-pf-text-secondary">{label}</span>
      <span className="font-display text-sm font-bold text-pf-text-primary">
        {value.toLocaleString('it-IT')}
        {unit}
      </span>
    </div>
  )
}

function ProgressBar({
  label,
  value,
  benchmark,
}: {
  label: string
  value: number
  benchmark: number
}) {
  const percentage = Math.min(value, 100)
  const isBetter = value >= benchmark

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-pf-text-secondary">{label}</span>
        <span className="font-display text-sm font-bold text-pf-text-primary">
          {value}%
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-pf-bg-tertiary">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            isBetter ? 'bg-pf-success' : 'bg-pf-warning'
          }`}
          style={{ width: `${percentage}%` }}
        />
        {/* Benchmark marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-pf-text-muted"
          style={{ left: `${Math.min(benchmark, 100)}%` }}
        />
      </div>
      <p className="text-[10px] text-pf-text-muted">Benchmark: {benchmark}%</p>
    </div>
  )
}

// --- Time Savings ---

interface TimeSavingsChartProps {
  readonly data: TimeSavingsMetrics
}

export function RoiTimeSavingsChart({ data }: TimeSavingsChartProps) {
  const b = DEFAULT_ROI_BENCHMARKS
  const hasCycleData = data.cycleTimeTrend.some((t) => t.value > 0)
  const hasApprovalData = data.approvalTimeTrend.some((t) => t.value > 0)

  return (
    <ChartCard
      title="Risparmio Tempo"
      subtitle="Tempi medi vs benchmark industria"
    >
      <div className="space-y-6">
        {/* Cycle time summary */}
        <div className="grid gap-2 sm:grid-cols-2">
          <StatBadge
            label="Ciclo medio"
            value={data.avgCycleTimeDays}
            unit=" gg"
          />
          <StatBadge
            label="Approvazione media"
            value={data.avgApprovalTimeHours}
            unit="h"
          />
        </div>

        {/* Cycle time trend */}
        {hasCycleData ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.cycleTimeTrend}>
                <defs>
                  <linearGradient id="cycleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                  width={30}
                />
                <Tooltip content={CycleTooltip} />
                <ReferenceLine
                  y={b.manualCycleTimeDays}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  label={{
                    value: `Manuale: ${b.manualCycleTimeDays}gg`,
                    position: 'right',
                    fill: '#EF4444',
                    fontSize: 10,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6366F1"
                  strokeWidth={2}
                  fill="url(#cycleGrad)"
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart />
        )}

        {/* Approval time trend */}
        {hasApprovalData ? (
          <div className="h-40">
            <p className="mb-2 text-xs font-medium text-pf-text-secondary">
              Tempo Approvazione (ore)
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.approvalTimeTrend}>
                <defs>
                  <linearGradient id="approvalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                  width={30}
                />
                <Tooltip content={ApprovalTooltip} />
                <ReferenceLine
                  y={b.manualApprovalTimeHours}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  label={{
                    value: `Manuale: ${b.manualApprovalTimeHours}h`,
                    position: 'right',
                    fill: '#EF4444',
                    fontSize: 10,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#22C55E"
                  strokeWidth={2}
                  fill="url(#approvalGrad)"
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </ChartCard>
  )
}

// --- Cost Savings ---

interface CostSavingsChartProps {
  readonly data: CostSavingsMetrics
}

export function RoiCostSavingsChart({ data }: CostSavingsChartProps) {
  const hasTrend = data.costSavingsTrend.some((t) => t.value > 0)

  return (
    <ChartCard
      title="Risparmio Economico"
      subtitle="Negoziazione e discrepanze intercettate"
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <StatBadge
            label="Savings negoziazione"
            value={data.negotiationSavings}
            unit="\u20AC"
          />
          <StatBadge
            label={`Discrepanze (${data.discrepanciesCaughtCount})`}
            value={data.discrepanciesCaught}
            unit="\u20AC"
          />
        </div>

        <ProgressBar
          label="Compliance Budget"
          value={data.budgetComplianceRate}
          benchmark={80}
        />

        {hasTrend ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.costSavingsTrend}>
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                  width={40}
                />
                <Tooltip content={CurrencyTooltip} />
                <Bar
                  dataKey="value"
                  fill="#22C55E"
                  radius={[4, 4, 0, 0]}
                  animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart />
        )}
      </div>
    </ChartCard>
  )
}

// --- Operational Efficiency ---

interface EfficiencyChartProps {
  readonly data: OperationalEfficiencyMetrics
}

export function RoiEfficiencyChart({ data }: EfficiencyChartProps) {
  const b = DEFAULT_ROI_BENCHMARKS
  const hasTrend = data.requestsTrend.some((t) => t.value > 0)

  return (
    <ChartCard
      title="Efficienza Operativa"
      subtitle={`${data.totalRequests} richieste nel periodo`}
    >
      <div className="space-y-4">
        <StatBadge
          label="Volume medio"
          value={data.requestsPerMonth}
          unit=" PR/mese"
        />

        <div className="space-y-3">
          <ProgressBar
            label="Auto-match fatture"
            value={data.autoMatchRate}
            benchmark={b.manualAutoMatchRate}
          />
          <ProgressBar
            label="Consegne puntuali"
            value={data.onTimeDeliveryRate}
            benchmark={b.manualOnTimeDeliveryRate}
          />
        </div>

        {hasTrend ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.requestsTrend}>
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                  width={30}
                />
                <Tooltip content={VolumeTooltip} />
                <Bar
                  dataKey="value"
                  fill="#6366F1"
                  radius={[4, 4, 0, 0]}
                  animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart />
        )}
      </div>
    </ChartCard>
  )
}

// --- Automation ---

const EmailTooltip = makeTooltipContent('email')

interface AutomationChartProps {
  readonly data: AutomationMetrics
}

export function RoiAutomationChart({ data }: AutomationChartProps) {
  const hasEmailTrend = data.emailsTrend.some((t) => t.value > 0)
  const hasInvoiceTrend = data.invoicesTrend.some((t) => t.value > 0)
  const hasTrend = hasEmailTrend || hasInvoiceTrend

  const combinedTrend = data.emailsTrend.map((e, i) => ({
    period: e.period,
    email: e.value,
    fatture: data.invoicesTrend[i]?.value ?? 0,
  }))

  const totalAutomationHours =
    data.emailTimeSavedHours +
    data.invoiceTimeSavedHours +
    data.reconciliationTimeSavedHours +
    data.autoApprovalTimeSavedHours

  return (
    <ChartCard
      title="Automazione"
      subtitle={`${Math.round(totalAutomationHours * 10) / 10}h risparmiate da processi automatici`}
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <StatBadge
            label="Email processate"
            value={data.emailsIngested}
            unit=""
          />
          <StatBadge
            label={`Fatture (SDI: ${data.invoicesSdi} / OCR: ${data.invoicesOcr})`}
            value={data.invoicesProcessed}
            unit=""
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <StatBadge
            label="Fatture riconciliate"
            value={data.reconciled}
            unit=""
          />
          <StatBadge
            label="Budget monitorati"
            value={data.activeBudgets}
            unit=""
          />
        </div>

        <div className="space-y-3">
          <ProgressBar
            label="Auto-riconciliazione"
            value={data.autoReconciliationRate}
            benchmark={0}
          />
          <ProgressBar
            label="Auto-approvazione"
            value={data.autoApprovalRate}
            benchmark={0}
          />
        </div>

        {hasTrend ? (
          <div className="h-40">
            <p className="mb-2 text-xs font-medium text-pf-text-secondary">
              Volume Automazione Mensile
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={combinedTrend}>
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                  width={30}
                />
                <Tooltip content={EmailTooltip} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar
                  dataKey="email"
                  name="Email"
                  fill="#6366F1"
                  radius={[4, 4, 0, 0]}
                  animationDuration={1000}
                />
                <Bar
                  dataKey="fatture"
                  name="Fatture"
                  fill="#22C55E"
                  radius={[4, 4, 0, 0]}
                  animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart />
        )}
      </div>
    </ChartCard>
  )
}
