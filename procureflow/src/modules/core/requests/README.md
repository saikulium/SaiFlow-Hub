# Requests Module

**Pack:** `core` · **Always-on:** yes

Core procurement requests (Richieste d'Acquisto). Bundles the PR domain with
its tightly-coupled sub-entities: approvals, comments, attachments, notifications
and timeline events.

## Responsibilities

- CRUD per richieste d'acquisto (PurchaseRequest)
- Workflow di approvazione (ruolo + soglie importo)
- Commenti interni ed esterni con @mentions
- Allegati (PDF, DOCX, XLSX, immagini) con validazione
- Notifiche in-app legate agli eventi della richiesta
- Timeline eventi strutturata per audit
- **Order confirmations** (conferme d'ordine fornitore) con discrepanze per riga
- **Shipments** (spedizioni line-level) con tracking, split shipment e
  delivery_status aggregato su `RequestItem`

## Public API

Import from the barrel:

```ts
import {
  // server
  initiateApprovalWorkflow,
  decideApproval,
  createComment,
  createAttachmentRecord,
  createNotification,
  NOTIFICATION_TYPES,
  // server — order confirmations
  createOrderConfirmation,
  applyConfirmation,
  rejectConfirmation,
  rejectLines,
  getOrderConfirmation,
  listOrderConfirmations,
  // server — shipments
  createShipment,
  updateShipmentStatus,
  listShipmentsForRequestItem,
  listShipmentsForPurchaseRequest,
  recomputeRequestItemDeliveryStatus,
  // hooks
  useRequests,
  useRequest,
  useCreateRequest,
  useDecideApproval,
  useComments,
  useAttachments,
  useNotifications,
  // hooks — order confirmations
  useOrderConfirmations,
  useApplyOrderConfirmation,
  useRejectOrderConfirmation,
  useRejectOrderConfirmationLines,
  // hooks — shipments
  useShipments,
  useCreateShipment,
  useUpdateShipmentStatus,
  // components
  RequestsPageContent,
  RequestDetailContent,
  RequestForm,
  RequestsTable,
  RequestsKanban,
  OrderConfirmationReview,
  SpedizioniTab,
  ShipmentForm,
  // validations
  createRequestSchema,
  updateRequestSchema,
  approvalDecisionSchema,
  createCommentSchema,
  validateAttachment,
  createOrderConfirmationSchema,
  applyConfirmationSchema,
  rejectConfirmationSchema,
  rejectLinesSchema,
  createShipmentSchema,
  updateShipmentStatusSchema,
} from '@/modules/core/requests'
```

## Sub-entities

Le sotto-entità (Approval, Comment, Attachment, Notification, OrderConfirmation)
vivono in questo modulo perché sono **strettamente accoppiate** al ciclo di vita
di una PurchaseRequest — non hanno utilità indipendente fuori dal contesto RdA.

## Order Confirmations

Entità di prima classe introdotta in Fase 3 del Core Order Lifecycle Hardening.
Sostituisce (gradualmente) `PriceVarianceReview`, che restava legata a JSON
non queryable.

**Modelli:** `OrderConfirmation` (1:N con `PurchaseRequest`) + `OrderConfirmationLine`.
**Stati:** `RECEIVED → PARSED → ACKNOWLEDGED → APPLIED` (terminale) oppure
`PARTIALLY_APPLIED` (dopo reject-lines con righe residue gestibili) oppure
`REJECTED` (terminale).
**Source:** `EMAIL | WEBHOOK | MANUAL | IMPORT`.
**LineDeliveryStatus:** `CONFIRMED | PARTIAL | BACKORDERED | UNAVAILABLE | SHIPPED | DELIVERED | CANCELLED`
applicato sia a `OrderConfirmationLine` sia a `RequestItem`.

Service layer (`server/order-confirmation.service.ts`):

- `createOrderConfirmation(input)` — crea confirmation + linee con snapshot
  dell'originale e calcolo automatico di `price_delta_pct` / `delivery_delay_days`.
- `applyConfirmation({confirmationId, userId, acceptedLineIds, notes?})` —
  transazione unica che aggiorna `RequestItem.unit_price`, `total_price`,
  `confirmed_delivery` per le sole righe accettate. Scrive TimelineEvent
  + AuditLog. Idempotente: chiamate successive su stato terminale rilanciano
  `InvalidConfirmationStateError`.
- `rejectConfirmation({confirmationId, userId, reason})` — nessuna modifica
  prezzi, marca status `REJECTED`. Ammesso solo dagli stati iniziali
  (`RECEIVED | PARSED | ACKNOWLEDGED`).
- `rejectLines({confirmationId, userId, rejectedLineIds, reason, newRequestItemStatus})` —
  rifiuto granulare per righe specifiche con propagazione del
  `LineDeliveryStatus` (`UNAVAILABLE` o `CANCELLED`) sul `RequestItem`
  collegato. Se la confirmation era `RECEIVED/PARSED/ACKNOWLEDGED` resta in
  `PARSED` → consentita una successiva `applyConfirmation` delle righe
  residue (che porta lo stato a `APPLIED`). Se invece alcune righe erano già
  applicate, il reject porta la confirmation a `PARTIALLY_APPLIED`
  (terminale). Scrive TimelineEvent + AuditLog. Fail-soft notification al
  requester.

API:

- `POST /api/requests/[id]/confirmations` (ADMIN/MANAGER) — create
- `GET  /api/requests/[id]/confirmations` — list
- `GET  /api/confirmations/[id]` — detail
- `POST /api/confirmations/[id]/apply` (ADMIN/MANAGER) — apply selected lines
- `POST /api/confirmations/[id]/reject` (ADMIN/MANAGER) — reject with reason
- `POST /api/confirmations/[id]/reject-lines` (ADMIN/MANAGER) — reject
  granulare per linee con `new_request_item_status` = `UNAVAILABLE | CANCELLED`

UI: `<OrderConfirmationReview requestId={id} />` renderizzato in
`RequestDetailContent`. Il legacy `PriceVarianceBanner` resta visibile solo per
review senza una `OrderConfirmation` corrispondente (match per `email_log_id`)
per evitare doppio rendering. La review espone sia "Applica selezionate" sia
"Rifiuta selezionate (N)" con dropdown di `LineDeliveryStatus` e textarea
motivo; "Rifiuta tutta la conferma" resta disponibile solo per gli stati
iniziali.

**Per-line delivery dates on RequestItem:** `expected_delivery`, `confirmed_delivery`,
`actual_delivery` (tutti nullable). Il campo request-level `PurchaseRequest.expected_delivery`
resta come fallback.

## Shipments

Entità line-level introdotta nelle estensioni del Core Order Lifecycle.
Modella le spedizioni reali dal fornitore con supporto a **split shipment**
(N spedizioni per `RequestItem`).

**Modello:** `RequestItemShipment` (N:1 con `RequestItem`).
**Stati:** `PENDING | SHIPPED | DELIVERED | RETURNED | LOST | CANCELLED`.
**Source:** `EMAIL | WEBHOOK | MANUAL | API`.

Service layer (`server/shipment.service.ts`):

- `createShipment(input)` — cap con tolleranza `DEFAULT_SHIPMENT_QUANTITY_TOLERANCE`
  (verificato lato server su somma cumulativa shipped/delivered). Scrive
  TimelineEvent + AuditLog. Chiama `recomputeRequestItemDeliveryStatus`.
- `updateShipmentStatus({shipmentId, userId, status, ...})` — transizioni
  status con auto-stamp di `actual_ship_date` / `actual_delivery_date` se
  non già valorizzati. Chiama recompute.
- `listShipmentsForRequestItem(itemId)` / `listShipmentsForPurchaseRequest(requestId)`
  — read helpers.
- `recomputeRequestItemDeliveryStatus(itemId, tx?)` — riaggrega lo stato di
  consegna dell'articolo guardando la somma cumulativa delle spedizioni
  (vedi enum `LineDeliveryStatus`). Chiamato automaticamente in
  create/update.

API:

- `GET  /api/requests/[id]/shipments` — list per PR
- `POST /api/requests/[id]/shipments` (ADMIN/MANAGER) — create scoped al
  `request_item_id`
- `PATCH /api/shipments/[id]` (ADMIN/MANAGER) — update status

UI: `<SpedizioniTab requestId={id} items={...} canManage={...} />` nuovo tab
nel detail page; raggruppa le spedizioni per `RequestItem` con inline status
transitions e `<ShipmentForm />` per la creazione.

## Dependencies

- `@/lib/db` — Prisma client
- `@/lib/constants` — RequestStatus, Priority config
- `@/lib/state-machine` — transizioni stato PR
- `@/lib/constants/approval-thresholds` — soglie di approvazione
- `@/modules/core/vendors` — invio ordine al fornitore
- `@/modules/core/smartfill` — suggerimenti auto-compilazione

## Related Modules

- `@/modules/core/analytics` — legge aggregati su PR/Approval
- `@/modules/core/budgets` — hook su approvazione per consumare budget
- `@/modules/core/invoicing` — riconciliazione fattura ↔ ordine
- `@/modules/core/email-intelligence` — ingestione email crea/aggiorna PR

## Contract

- All external code MUST import from the barrel (`@/modules/core/requests`).
- Internal files use relative paths (`./`, `../`).
- This module is **alwaysOn** — cannot be disabled.
