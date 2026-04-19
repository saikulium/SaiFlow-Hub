// ---------------------------------------------------------------------------
// Inventory Module — barrel export
// ---------------------------------------------------------------------------

// Server — services
export {
  computeWMA,
  getBasicForecast,
  getAiForecast,
  checkReorderAlerts,
  getActiveAlerts,
  dismissAlert,
  resolveAlert,
} from './server/forecast.service'

export {
  getNextMaterialCode,
  getNextLotNumber,
  getNextMovementCode,
  getNextInventoryCode,
  recordInboundMovement,
  recordOutboundMovement,
  getStockLevels,
  getSuggestedInbounds,
  getInventoryDashboardStats,
} from './server/inventory-db.service'

export {
  generateMaterialCode,
  generateLotNumber,
  generateMovementCode,
  generateInventoryCode,
  computeWeightedAverageCost,
  computeStockLevel,
  validateMovement,
} from './server/inventory.service'
export type {
  StockStatus,
  StockLevel,
  MovementValidationInput,
  MovementValidationResult,
} from './server/inventory.service'

// Server — agent tools
export {
  getActiveAlertsTool,
  getMaterialForecastTool,
  getMaterialPriceHistoryTool,
  createMaterialTool,
  updateMaterialStockLevelsTool,
  setPreferredVendorTool,
  INVENTORY_TOOLS,
} from './server/inventory.tools'

export {
  getStockForArticleTool,
  getPendingOrdersForMaterialTool,
  STOCK_TOOLS,
} from './server/stock.tools'

// Server — agent
export { runReorderAgent } from './server/smart-reorder.agent'
export type { ReorderResult } from './server/smart-reorder.agent'

// Validations
export {
  createMaterialSchema,
  updateMaterialSchema,
  createWarehouseSchema,
  updateWarehouseSchema,
  createMovementSchema,
  createReservationSchema,
  updateReservationSchema,
  materialQuerySchema,
  movementQuerySchema,
  createInventorySchema,
  updateInventoryLineSchema,
} from './validations/inventory'
export type {
  CreateMaterialInput,
  UpdateMaterialInput,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  CreateMovementInput,
  CreateReservationInput,
  UpdateReservationInput,
  MaterialQueryInput,
  MovementQueryInput,
  CreateInventoryInput,
  UpdateInventoryLineInput,
} from './validations/inventory'

// Constants
export {
  MOVEMENT_TYPE_CONFIG,
  LOT_STATUS_CONFIG,
  RESERVATION_STATUS_CONFIG,
  INVENTORY_STATUS_CONFIG,
  MOVEMENT_REASON_LABELS,
  STOCK_STATUS_CONFIG,
} from './constants/inventory'
export type { StockStatusKey } from './constants/inventory'

export {
  WMA_WEIGHTS,
  WMA_MONTHS,
  FORECAST_MONTHS_AHEAD,
  AI_FORECAST_RATE_LIMIT,
} from './constants/forecast'

// Hooks
export {
  useForecast,
  useAiForecast,
  useMaterialAlerts,
} from './hooks/use-forecast'
export {
  useInventories,
  useInventory,
  useCreateInventory,
  useUpdateInventoryLines,
  useCloseInventory,
} from './hooks/use-inventory-check'
export {
  useMaterials,
  useMaterial,
  useCreateMaterial,
  useUpdateMaterial,
} from './hooks/use-materials'
export {
  useMovements,
  useCreateMovement,
  useLots,
  useCreateReservation,
  useUpdateReservation,
  useSuggestedInbounds,
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
} from './hooks/use-stock'

// Components
export { ForecastPanel } from './components/forecast-panel'
export { InventoriesPageContent } from './components/inventories-page-content'
export { InventoryDetailContent } from './components/inventory-detail-content'
export {
  InventoryFiltersBar,
  type InventoryFilters,
} from './components/inventory-filters'
export { MaterialDetailContent } from './components/material-detail-content'
export { MaterialFormDialog } from './components/material-form-dialog'
export { MaterialsPageContent } from './components/materials-page-content'
export { MovementFormDialog } from './components/movement-form-dialog'
export { MovementsPageContent } from './components/movements-page-content'
export { ReservationDialog } from './components/reservation-dialog'
export { StockLevelBadge } from './components/stock-level-badge'
export { WarehousesPageContent } from './components/warehouses-page-content'
