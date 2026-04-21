# Changelog

## [unreleased]

### Added

- **Core Order Lifecycle Hardening**: prima iterazione del ciclo di vita ordini
  fornitore con gestione strutturata delle discrepanze.
  - Nuovi modelli `OrderConfirmation` (1:N con `PurchaseRequest`) e
    `OrderConfirmationLine` con snapshot valori originali, calcolo automatico
    di `price_delta_pct` e `delivery_delay_days` per riga. Stati:
    `RECEIVED → PARSED → ACKNOWLEDGED → APPLIED | REJECTED`. Source:
    `EMAIL | WEBHOOK | MANUAL | IMPORT`.
  - Nuovi campi nullable su `RequestItem`: `expected_delivery`,
    `confirmed_delivery`, `actual_delivery` (delivery per riga, il campo
    request-level `PurchaseRequest.expected_delivery` resta fallback).
  - Service `applyConfirmation` in singola transazione aggiorna
    `RequestItem.unit_price`, `total_price`, `confirmed_delivery` per le sole
    righe accettate. Idempotente. TimelineEvent + AuditLog scritti ad ogni
    apply/reject.
  - API `POST/GET /api/requests/[id]/confirmations`,
    `GET /api/confirmations/[id]`,
    `POST /api/confirmations/[id]/{apply,reject}` (RBAC ADMIN/MANAGER per le
    mutazioni, chiunque autenticato per le letture).
  - UI `OrderConfirmationReview` renderizzata in `RequestDetailContent` con
    selezione righe, indicatori delta prezzo/consegna, apply parziale e
    rifiuto con motivazione. Il legacy `PriceVarianceBanner` viene nascosto
    quando esiste già una `OrderConfirmation` con lo stesso `email_log_id`
    per evitare doppio rendering.
  - Tool AI `create_order_confirmation` (canonico) registrato nell'email
    intelligence agent. `create_price_variance_review` marcato deprecato nel
    prompt VARIAZIONE_PREZZO ma mantenuto per backward compat.
  - Passthrough PDF dal webhook `/api/webhooks/email-ingestion`:
    `fetchAttachmentBytes` (5s timeout, 10MB cap, solo
    `application/pdf` via Content-Type + magic bytes) + `enrichWithAgent`
    fail-soft invoca l'agent coi byte scaricati.
  - `PriceVarianceReview` **non rimosso**: deprecato gradualmente. Il
    workflow n8n richiede aggiornamento operatore (documentato in
    `docs/internal/n8n-workflow-update-required.md`). (`feat/core-order-lifecycle`)

- **Core Order Lifecycle — line-level extensions** (stesso branch
  `feat/core-order-lifecycle`): 4 estensioni additive per scenari reali di
  conferma fornitore con righe eterogenee.
  - Enum `LineDeliveryStatus` (`CONFIRMED | PARTIAL | BACKORDERED | UNAVAILABLE | SHIPPED | DELIVERED | CANCELLED`)
    applicato sia a `OrderConfirmationLine` sia a `RequestItem`.
  - Nuovo modello `RequestItemShipment` (N:1 con `RequestItem`) per split
    shipment: tracking_number, carrier, shipped_quantity, actual_ship_date,
    expected_delivery_date, actual_delivery_date, status
    (`PENDING | SHIPPED | DELIVERED | RETURNED | LOST | CANCELLED`). Cap con
    tolleranza `DEFAULT_SHIPMENT_QUANTITY_TOLERANCE`.
  - Service `rejectLines({confirmationId, userId, rejectedLineIds, reason, newRequestItemStatus})`:
    rifiuto granulare per righe con propagazione di `UNAVAILABLE`/`CANCELLED`
    sul `RequestItem` collegato. Transazione unica. TimelineEvent +
    AuditLog + fail-soft notification.
  - Stato nuovo `PARTIALLY_APPLIED` su `OrderConfirmation` (terminale)
    quando un reject-lines avviene dopo che alcune righe erano già applicate.
  - Service `createShipment` / `updateShipmentStatus` / `recomputeRequestItemDeliveryStatus`
    con auto-stamp di `actual_ship_date` / `actual_delivery_date` nelle
    transizioni stato.
  - API: `POST /api/confirmations/[id]/reject-lines`,
    `GET/POST /api/requests/[id]/shipments`, `PATCH /api/shipments/[id]`
    (tutte ADMIN/MANAGER per le mutazioni).
  - Hooks: `useRejectOrderConfirmationLines`, `useShipments`,
    `useCreateShipment`, `useUpdateShipmentStatus`.
  - UI: `OrderConfirmationReview` estesa con modalità "Rifiuta selezionate"
    (dropdown `UNAVAILABLE | CANCELLED` + motivo) e badge
    `PARTIALLY_APPLIED`. Nuovo tab "Spedizioni" (`SpedizioniTab`) nel detail
    page con spedizioni raggruppate per `RequestItem`, inline status
    transitions e `ShipmentForm` inline per la creazione.

- Modulo **audit-log**: audit trail immutabile con Prisma extension + trigger
  Postgres. Registra automaticamente CREATE/UPDATE/DELETE su 17 modelli
  compliance-critical (User, PurchaseRequest, Invoice, Vendor, Commessa, ecc.).
  Immutabilità a due livelli (ORM + DB). UI admin a `/admin/audit` con filtri,
  diff espandibile, export CSV. Risolve finding compliance PF-006 (HIGH).
  (`feat/audit-trail`)
