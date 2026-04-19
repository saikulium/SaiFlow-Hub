# Inventory Module

Pack: `core` · Path: `@/modules/core/inventory`

Gestisce magazzini, materiali, movimenti, lotti, prenotazioni, inventari fisici
e le funzioni AI correlate (forecast WMA/AI + alert riordino).

## Public API

Importa **solo** dal barrel:

```typescript
import {
  // services
  getBasicForecast, getAiForecast, getActiveAlerts,
  getStockLevels, getInventoryDashboardStats, validateMovement,
  recordInboundMovement, recordOutboundMovement,
  // agent tools
  INVENTORY_TOOLS, STOCK_TOOLS,
  // agent
  runReorderAgent,
  // validations
  createMaterialSchema, createMovementSchema,
  // hooks
  useMaterials, useMovements, useWarehouses, useMaterialAlerts,
  // components
  MaterialsPageContent, MovementsPageContent, MaterialFormDialog,
} from '@/modules/core/inventory'
```

## Struttura

```
server/
  forecast.service.ts       WMA forecast + AI forecast + alert riordino
  inventory.service.ts      pure helpers (code generation, stock level, validation)
  inventory-db.service.ts   DB ops (movimenti, stock, suggeriti)
  inventory.tools.ts        Claude tools (forecast, material management)
  stock.tools.ts            Claude tools (stock levels, pending orders)
  smart-reorder.agent.ts    autonomous reorder agent
components/                 page contents, form dialogs, badges
hooks/                      use-materials, use-stock, use-forecast, use-inventory-check
validations/inventory.ts    Zod schemas
constants/                  stock/movement/lot/inventory config + forecast params
```

## Dependencies

Core: articles (material-article link), vendors (preferred vendor).
