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

- Modulo **audit-log**: audit trail immutabile con Prisma extension + trigger
  Postgres. Registra automaticamente CREATE/UPDATE/DELETE su 17 modelli
  compliance-critical (User, PurchaseRequest, Invoice, Vendor, Commessa, ecc.).
  Immutabilità a due livelli (ORM + DB). UI admin a `/admin/audit` con filtri,
  diff espandibile, export CSV. Risolve finding compliance PF-006 (HIGH).
  (`feat/audit-trail`)
