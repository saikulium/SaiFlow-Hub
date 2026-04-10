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

// --- Invoice Stats ---

export interface InvoiceStats {
  totalInvoices: number
  unmatchedInvoices: number
  pendingReconciliation: number
  disputedInvoices: number
  totalInvoicedAmount: number
  totalApprovedAmount: number
  discrepanzeAperte: number
  totaleFatturatoMese: number
  totaleDaPagare: number
}

// --- Invoice Chart Types ---

export interface InvoiceMatchDistribution {
  status: string
  label: string
  count: number
  color: string
}

export interface InvoiceAgingBucket {
  bucket: string
  count: number
}

export interface OrderedVsInvoiced {
  period: string
  ordered: number
  invoiced: number
}

// --- Budget Types ---

export interface BudgetCapacity {
  budgetId: string
  costCenter: string
  department: string | null
  periodType: string
  periodStart: string
  periodEnd: string
  allocated: number
  spent: number
  committed: number
  available: number
  usagePercent: number
  alertThreshold: number
  enforcementMode: 'SOFT' | 'HARD'
  isOverBudget: boolean
  isWarning: boolean
}

export interface BudgetCheckResult {
  allowed: boolean
  mode: 'SOFT' | 'HARD' | 'NO_BUDGET'
  budgets: BudgetCapacity[]
  worstCase: BudgetCapacity | null
  message: string
}

export interface BudgetForecast {
  budgetId: string
  costCenter: string
  dailyBurnRate: number
  projectedSpendAtPeriodEnd: number
  exhaustionDate: string | null
  residualAtPeriodEnd: number
  daysRemaining: number
  daysUntilExhaustion: number | null
}

export interface BudgetListItem {
  id: string
  costCenter: string
  department: string | null
  periodType: string
  periodStart: string
  periodEnd: string
  allocated: number
  spent: number
  committed: number
  available: number
  usagePercent: number
  isOverBudget: boolean
  isWarning: boolean
  alertThreshold: number
  enforcementMode: 'SOFT' | 'HARD'
  isActive: boolean
}

export interface BudgetDetail extends BudgetListItem {
  notes: string | null
  createdBy: string
  createdAt: string
  forecast: BudgetForecast
  spentRequests: BudgetRequestItem[]
  committedRequests: BudgetRequestItem[]
}

export interface BudgetRequestItem {
  id: string
  code: string
  title: string
  amount: number
  status: string
  costCenter: string
}

export interface BudgetDashboardItem {
  budgetId: string
  costCenter: string
  department: string | null
  allocated: number
  spent: number
  committed: number
  available: number
  usagePercent: number
  isOverBudget: boolean
  isWarning: boolean
  forecast: BudgetForecast
}

export interface BudgetDashboardStats {
  totalAllocated: number
  totalSpent: number
  totalCommitted: number
  totalAvailable: number
  centricostoInWarning: number
  centricostoSforati: number
  budgets: BudgetDashboardItem[]
}

export interface BudgetSpendTrendPoint {
  date: string
  cumulative: number
  budgetLine: number
}

// --- Tender Types ---

export interface TenderListItem {
  id: string
  code: string
  title: string
  status: string
  tenderType: string
  contractingAuthority: string | null
  cig: string | null
  baseAmount: number | null
  ourOfferAmount: number | null
  submissionDeadline: string | null
  goNoGo: string
  goNoGoScore: number | null
  assignedTo: string | null
  category: string | null
  createdAt: string
}

export interface TenderDetail extends TenderListItem {
  description: string | null
  cup: string | null
  garaNumber: string | null
  lottoNumber: string | null
  platformUrl: string | null
  anacId: string | null
  awardedAmount: number | null
  currency: string
  goNoGoNotes: string | null
  goNoGoDecidedBy: string | null
  goNoGoDecidedAt: string | null
  publicationDate: string | null
  questionDeadline: string | null
  openingDate: string | null
  awardDate: string | null
  contractStartDate: string | null
  contractEndDate: string | null
  awardCriteria: string | null
  technicalWeight: number | null
  economicWeight: number | null
  ourTechnicalScore: number | null
  ourEconomicScore: number | null
  ourTotalScore: number | null
  winnerName: string | null
  winnerAmount: number | null
  participantsCount: number | null
  department: string | null
  costCenter: string | null
  tags: string[]
  createdBy: string
  notes: string | null
  documents: TenderDocumentItem[]
  timeline: TenderTimelineItem[]
}

export interface TenderDocumentItem {
  id: string
  documentType: string
  filename: string
  fileUrl: string
  fileSize: number | null
  mimeType: string | null
  version: number
  notes: string | null
  uploadedBy: string | null
  createdAt: string
}

export interface TenderTimelineItem {
  id: string
  type: string
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  actor: string | null
  createdAt: string
}

export interface TenderDashboardStats {
  activeTenders: number
  pipelineValue: number
  upcomingDeadlines: number
  winRate: number
  winRatePrevious: number
  byStatus: Array<{
    status: string
    label: string
    count: number
    color: string
  }>
  recentResults: Array<{ period: string; won: number; lost: number }>
  nearDeadlines: Array<{
    id: string
    code: string
    title: string
    authority: string | null
    submissionDeadline: string
    daysRemaining: number
    status: string
  }>
}

export interface GoNoGoScoreInput {
  margin: number
  technical: number
  experience: number
  risk: number
  workload: number
  strategic: number
}

// --- Inventory Types ---

export interface MaterialListItem {
  id: string
  code: string
  name: string
  category: string | null
  unitPrimary: string
  unitSecondary: string | null
  unitCost: number
  stockPhysical: number
  stockAvailable: number
  stockReserved: number
  minStockLevel: number | null
  stockStatus: 'OK' | 'LOW' | 'OUT'
  isActive: boolean
  preferredVendor: string | null
  article: {
    readonly id: string
    readonly code: string
    readonly name: string
  } | null
}

export interface MaterialDetail extends MaterialListItem {
  description: string | null
  subcategory: string | null
  conversionFactor: number | null
  maxStockLevel: number | null
  barcode: string | null
  qrCode: string | null
  tags: string[]
  notes: string | null
  createdAt: string
  stockByWarehouse: StockByWarehouse[]
  activeLots: LotSummary[]
  activeReservations: ReservationSummary[]
}

export interface StockByWarehouse {
  warehouseId: string
  warehouseName: string
  physical: number
  available: number
  reserved: number
  zones: Array<{
    zoneId: string
    zoneName: string
    physical: number
  }>
}

export interface LotSummary {
  id: string
  lotNumber: string
  warehouseName: string
  zoneName: string | null
  currentQuantity: number
  currentQuantitySecondary: number | null
  unitCost: number
  expiryDate: string | null
  status: string
  prCode: string | null
}

export interface ReservationSummary {
  id: string
  reservedQuantity: number
  tenderCode: string | null
  prCode: string | null
  status: string
  reservedAt: string
  expiresAt: string | null
}

export interface MovementListItem {
  id: string
  code: string
  materialCode: string
  materialName: string
  lotNumber: string | null
  warehouseName: string
  zoneName: string | null
  movementType: string
  reason: string
  quantity: number
  quantitySecondary: number | null
  unitCost: number | null
  referenceCode: string | null
  prCode: string | null
  tenderCode: string | null
  actor: string | null
  createdAt: string
}

export interface WarehouseListItem {
  id: string
  code: string
  name: string
  address: string | null
  isActive: boolean
  zonesCount: number
  zones: Array<{ id: string; code: string; name: string }>
}

export interface InventoryListItem {
  id: string
  code: string
  warehouseName: string
  status: string
  linesCount: number
  varianceCount: number
  createdBy: string
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

// --- ROI Metrics Types ---

export type RoiPeriod = '30d' | '90d' | '6m' | '12m' | 'all'

export interface TrendPoint {
  readonly period: string
  readonly value: number
}

export interface TimeSavingsMetrics {
  readonly avgCycleTimeDays: number
  readonly avgApprovalTimeHours: number
  readonly cycleTimeTrend: readonly TrendPoint[]
  readonly approvalTimeTrend: readonly TrendPoint[]
  readonly cycleTimeChangePercent: number
  readonly approvalTimeChangePercent: number
}

export interface CostSavingsMetrics {
  readonly totalEstimated: number
  readonly totalActual: number
  readonly negotiationSavings: number
  readonly discrepanciesCaught: number
  readonly discrepanciesCaughtCount: number
  readonly budgetComplianceRate: number
  readonly costSavingsTrend: readonly TrendPoint[]
}

export interface OperationalEfficiencyMetrics {
  readonly requestsPerMonth: number
  readonly requestsTrend: readonly TrendPoint[]
  readonly autoMatchRate: number
  readonly onTimeDeliveryRate: number
  readonly totalRequests: number
  readonly totalDelivered: number
  readonly totalInvoices: number
  readonly autoMatchedInvoices: number
}

export interface AutomationMetrics {
  readonly emailsIngested: number
  readonly emailTimeSavedHours: number
  readonly emailsTrend: readonly TrendPoint[]
  readonly invoicesProcessed: number
  readonly invoicesSdi: number
  readonly invoicesOcr: number
  readonly avgInvoiceProcessingHours: number
  readonly invoiceTimeSavedHours: number
  readonly invoicesTrend: readonly TrendPoint[]
  readonly reconciled: number
  readonly reconciledAuto: number
  readonly autoReconciliationRate: number
  readonly reconciliationTimeSavedHours: number
  readonly autoApprovedCount: number
  readonly autoApprovalRate: number
  readonly autoApprovalTimeSavedHours: number
  readonly activeBudgets: number
}

export interface RoiSummary {
  readonly estimatedHoursSaved: number
  readonly hoursSavedValue: number
  readonly moneySaved: number
  readonly projectedAnnualSavings: number
  readonly projectedAnnualHoursSaved: number
  readonly totalTimeSavedHours: number
  readonly automationTimeSavedHours: number
}

export interface RoiMetrics {
  readonly period: RoiPeriod
  readonly periodStart: string
  readonly periodEnd: string
  readonly timeSavings: TimeSavingsMetrics
  readonly costSavings: CostSavingsMetrics
  readonly efficiency: OperationalEfficiencyMetrics
  readonly automation: AutomationMetrics
  readonly summary: RoiSummary
}

export interface InventoryDashboardStats {
  totalMaterials: number
  totalWarehouseValue: number
  lowStockCount: number
  lowStockCountPrevious: number
  recentMovements: number
  valueByCategory: Array<{ category: string; value: number }>
  movementTrend: Array<{ period: string; inbound: number; outbound: number }>
  lowStockAlerts: Array<{
    id: string
    code: string
    name: string
    currentStock: number
    minLevel: number
    unit: string
    deficit: number
  }>
}

// --- Commessa Types ---

export interface ClientListItem {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly tax_id: string | null
  readonly email: string | null
  readonly phone: string | null
  readonly contact_person: string | null
  readonly status: string
  readonly activeCommesseCount: number
}

export interface ClientDetail extends ClientListItem {
  readonly address: string | null
  readonly notes: string | null
  readonly created_at: string
  readonly commesse: readonly {
    readonly id: string
    readonly code: string
    readonly title: string
    readonly status: string
    readonly clientValue: number | null
    readonly deadline: string | null
  }[]
}

export interface CommessaListItem {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly status: string
  readonly clientName: string
  readonly clientCode: string
  readonly clientValue: number | null
  readonly totalCosts: number
  readonly margin: number | null
  readonly marginPercent: number | null
  readonly deadline: string | null
  readonly priority: string
  readonly requestsCount: number
  readonly suggestionsCount: number
  readonly createdAt: string
}

export interface CommessaDetail extends CommessaListItem {
  readonly description: string | null
  readonly clientId: string
  readonly currency: string
  readonly receivedAt: string | null
  readonly completedAt: string | null
  readonly category: string | null
  readonly department: string | null
  readonly tags: string[]
  readonly assignedTo: string | null
  readonly emailMessageId: string | null
  readonly requests: CommessaRequestItem[]
  readonly suggestions: CommessaRequestItem[]
  readonly timeline: CommessaTimelineItem[]
}

export interface CommessaRequestItem {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly status: string
  readonly priority: string
  readonly estimatedAmount: number | null
  readonly actualAmount: number | null
  readonly vendorName: string | null
  readonly isAiSuggested: boolean
}

export interface CommessaTimelineItem {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly description: string | null
  readonly metadata: Record<string, unknown> | null
  readonly actor: string | null
  readonly createdAt: string
}

export interface CommessaDashboardStats {
  readonly activeCount: number
  readonly totalValueInProgress: number
  readonly avgMarginPercent: number
  readonly dueSoonCount: number
  readonly topCommesse: readonly {
    readonly code: string
    readonly title: string
    readonly clientName: string
    readonly deadline: string | null
    readonly marginPercent: number | null
    readonly status: string
  }[]
}

// --- Anagrafica Articoli ---

import type { AliasTypeKey, PriceSourceKey } from '@/lib/constants/article'

export interface ArticleListItem {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly category: string | null
  readonly unit_of_measure: string
  readonly manufacturer: string | null
  readonly is_active: boolean
  readonly created_at: string
  readonly _count: {
    readonly aliases: number
    readonly prices: number
    readonly materials: number
  }
}

export interface ArticleAlias {
  readonly id: string
  readonly alias_type: AliasTypeKey
  readonly alias_code: string
  readonly alias_label: string | null
  readonly entity_id: string | null
  readonly is_primary: boolean
  readonly created_at: string
}

export interface ArticlePrice {
  readonly id: string
  readonly vendor_id: string
  readonly vendor: { readonly id: string; readonly name: string }
  readonly unit_price: number
  readonly currency: string
  readonly min_quantity: number
  readonly valid_from: string
  readonly valid_until: string | null
  readonly source: PriceSourceKey
  readonly notes: string | null
  readonly created_at: string
}

export interface ArticleDetail {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly description: string | null
  readonly category: string | null
  readonly unit_of_measure: string
  readonly manufacturer: string | null
  readonly manufacturer_code: string | null
  readonly is_active: boolean
  readonly notes: string | null
  readonly tags: readonly string[]
  readonly created_at: string
  readonly updated_at: string
  readonly aliases: readonly ArticleAlias[]
  readonly prices: readonly ArticlePrice[]
  readonly _count: {
    readonly aliases: number
    readonly prices: number
    readonly request_items: number
    readonly invoice_items: number
    readonly materials: number
  }
}

// --- Article Stock Types ---

export interface ArticleStockLastMovement {
  readonly id: string
  readonly code: string
  readonly type: string
  readonly reason: string
  readonly quantity: number
  readonly notes: string | null
  readonly actor: string | null
  readonly date: string
}

export interface ArticleStockWarehouse {
  readonly warehouseId: string
  readonly warehouseName: string
  readonly physical: number
  readonly available: number
  readonly reserved: number
  readonly zones: readonly {
    readonly zoneId: string
    readonly zoneName: string
    readonly physical: number
  }[]
}

export interface ArticleStockInfo {
  readonly hasInventory: boolean
  readonly materialId: string | null
  readonly materialCode: string | null
  readonly physical: number
  readonly reserved: number
  readonly available: number
  readonly status: string
  readonly unit: string
  readonly byWarehouse: readonly ArticleStockWarehouse[]
  readonly lastMovement: ArticleStockLastMovement | null
}

export interface ArticleSearchResult {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly category: string | null
  readonly unit_of_measure: string
  readonly matched_via: string
  readonly matched_value: string
}

export interface ArticleImportResult {
  readonly articles_created: number
  readonly aliases_created: number
  readonly skipped: number
  readonly errors: readonly ArticleImportError[]
}

export interface ArticleImportError {
  readonly row: number
  readonly field: string
  readonly message: string
}

export * from './ai'
