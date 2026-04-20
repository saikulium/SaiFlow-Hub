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
  // hooks
  useRequests,
  useRequest,
  useCreateRequest,
  useDecideApproval,
  useComments,
  useAttachments,
  useNotifications,
  // components
  RequestsPageContent,
  RequestDetailContent,
  RequestForm,
  RequestsTable,
  RequestsKanban,
  // validations
  createRequestSchema,
  updateRequestSchema,
  approvalDecisionSchema,
  createCommentSchema,
  validateAttachment,
} from '@/modules/core/requests'
```

## Sub-entities

Le sotto-entità (Approval, Comment, Attachment, Notification) vivono in questo
modulo perché sono **strettamente accoppiate** al ciclo di vita di una
PurchaseRequest — non hanno utilità indipendente fuori dal contesto RdA.

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
