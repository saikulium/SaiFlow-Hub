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
