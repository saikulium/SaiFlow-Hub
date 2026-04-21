// Export pubblico del modulo budgets.
// Chi vuole usare il modulo importa DA QUI, non dai file interni.

// Services
export {
  computeAvailable,
  computeUsagePercent,
  isOverBudget,
  isWarning,
  computeBurnRate,
  projectSpend,
  computeExhaustionDate,
  resolveMostRestrictive,
  buildCheckResult,
  computeBudgetCapacity,
  checkBudgetCapacity,
  computeForecast,
  getBudgetDashboardStats,
  sendBudgetAlerts,
  refreshBudgetSnapshot,
  refreshSnapshotsForCostCenter,
} from './server/budget.service'

// Tools AI
export { listBudgetsTool, BUDGET_TOOLS } from './server/budget.tools'

// Constants
export {
  BUDGET_DEFAULTS,
  BUDGET_PERIOD_LABELS,
  BUDGET_ENFORCEMENT_LABELS,
  COMMITTED_STATUSES,
  SPENT_STATUSES,
  BUDGET_BAR_COLORS,
} from './constants'

// Validations
export {
  createBudgetSchema,
  updateBudgetSchema,
  budgetQuerySchema,
  budgetCheckSchema,
  type CreateBudgetInput,
  type UpdateBudgetInput,
  type BudgetCheckInput,
} from './validations/budget'

// Hooks
export {
  useBudgets,
  useBudget,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
} from './hooks/use-budgets'

export { useBudgetCheck } from './hooks/use-budget-check'

// Components
export { BudgetsPageContent } from './components/budgets-page-content'
export { BudgetDetailContent } from './components/budget-detail-content'
export { BudgetFormDialog } from './components/budget-form-dialog'
export { BudgetCapacityBanner } from './components/budget-capacity-banner'
