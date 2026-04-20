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
  getOrderConfirmation,
  listOrderConfirmations,
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
  // components
  RequestsPageContent,
  RequestDetailContent,
  RequestForm,
  RequestsTable,
  RequestsKanban,
  OrderConfirmationReview,
  // validations
  createRequestSchema,
  updateRequestSchema,
  approvalDecisionSchema,
  createCommentSchema,
  validateAttachment,
  createOrderConfirmationSchema,
  applyConfirmationSchema,
  rejectConfirmationSchema,
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
**Stati:** `RECEIVED → PARSED → ACKNOWLEDGED → APPLIED` (terminale) oppure `REJECTED` (terminale).
**Source:** `EMAIL | WEBHOOK | MANUAL | IMPORT`.

Service layer (`server/order-confirmation.service.ts`):

- `createOrderConfirmation(input)` — crea confirmation + linee con snapshot
  dell'originale e calcolo automatico di `price_delta_pct` / `delivery_delay_days`.
- `applyConfirmation({confirmationId, userId, acceptedLineIds, notes?})` —
  transazione unica che aggiorna `RequestItem.unit_price`, `total_price`,
  `confirmed_delivery` per le sole righe accettate. Scrive TimelineEvent
  + AuditLog. Idempotente: chiamate successive su stato terminale rilanciano
  `InvalidConfirmationStateError`.
- `rejectConfirmation({confirmationId, userId, reason})` — nessuna modifica
  prezzi, marca status `REJECTED`.

API:

- `POST /api/requests/[id]/confirmations` (ADMIN/MANAGER) — create
- `GET  /api/requests/[id]/confirmations` — list
- `GET  /api/confirmations/[id]` — detail
- `POST /api/confirmations/[id]/apply` (ADMIN/MANAGER) — apply selected lines
- `POST /api/confirmations/[id]/reject` (ADMIN/MANAGER) — reject with reason

UI: `<OrderConfirmationReview requestId={id} />` renderizzato in
`RequestDetailContent`. Il legacy `PriceVarianceBanner` resta visibile solo per
review senza una `OrderConfirmation` corrispondente (match per `email_log_id`)
per evitare doppio rendering.

**Per-line delivery dates on RequestItem:** `expected_delivery`, `confirmed_delivery`,
`actual_delivery` (tutti nullable). Il campo request-level `PurchaseRequest.expected_delivery`
resta come fallback.

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
