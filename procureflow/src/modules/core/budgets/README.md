# Modulo Budgets

**Pack**: core
**Always on**: false
**Dipendenze**: core, requests

## Scopo

Budget per centro di costo con snapshot periodici, forecast di consumo,
enforcement (hard/soft) in fase di submit richiesta, alert su soglie.

## Entità Prisma coinvolte

- `Budget`
- `BudgetSnapshot`
- `PurchaseRequest.cost_center` / `PurchaseRequest.estimated_amount`

## Struttura interna

```
src/modules/core/budgets/
├── server/
│   ├── budget.service.ts           # capacity, forecast, snapshot, alerts
│   └── budget.tools.ts              # list_budgets (READ tool AI)
├── validations/
│   └── budget.ts
├── hooks/
│   ├── use-budgets.ts              # list + CRUD mutations
│   └── use-budget-check.ts         # capacity check per UI banner
├── components/
│   ├── budgets-page-content.tsx
│   ├── budget-detail-content.tsx
│   ├── budget-form-dialog.tsx
│   └── budget-capacity-banner.tsx  # usato da requests/request-form
├── constants.ts
└── index.ts
```

## API esposte

- `GET/POST /api/budgets`
- `GET/PATCH/DELETE /api/budgets/[id]`
- `POST /api/budgets/check` (capacity pre-check per una RDA)

## Tool AI esposti

`list_budgets` (array `BUDGET_TOOLS`) — usato dal procurement assistant e
compliance monitor.

## Cross-module

Il componente `BudgetCapacityBanner` è consumato da `components/requests/request-form.tsx`
ma appartiene a budgets. Import via `@/modules/core/budgets`.

`getBudgetDashboardStats` viene aggregato da `analytics/dashboard.service.ts`.

## Regola d'oro

Chi importa dal modulo importa **sempre** dall'`index.ts`, mai dai file interni.
