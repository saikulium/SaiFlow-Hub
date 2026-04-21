# Modulo Audit Log

**Pack**: core
**Always on**: true
**Dipendenze**: core

## Scopo

Audit trail immutabile che registra automaticamente ogni CREATE / UPDATE / DELETE
sui modelli compliance-critical. Soddisfa i requisiti difesa (D.Lgs. 231/2001,
NATO AQAP, AS9100) per Faleni SRL — risolve il finding PF-006 (HIGH).

## Come funziona

Registrazione **automatica** via Prisma query extension. Non serve scrivere
codice nei singoli handler: ogni mutazione su modello audited produce una
riga in `audit_logs`.

```
Handler API  →  withApiHandler(setAuditContext)
                       │
                       ▼
               prisma.<model>.<op>()
                       │
            auditImmutableExtension (blocca mutazioni su AuditLog)
                       │
              auditExtension ($allModels query hook)
                       │
              diff → writeAuditLog → audit_logs row
```

## Immutabilità — difesa in profondità

1. **ORM layer** — `auditImmutableExtension` (`$allOperations` su `auditLog`)
   throwa su `update`, `updateMany`, `delete`, `deleteMany`, `upsert`.
2. **DB layer** — trigger Postgres `audit_logs_immutable` (migration
   `20260420132200_add_audit_log_immutability_trigger`) blocca
   `UPDATE`, `DELETE`, `TRUNCATE` con `ERRCODE 42501`. **Load-bearing**:
   non rimuovere senza sign-off compliance.

## Modelli audited

Vedi [`server/audit.constants.ts`](./server/audit.constants.ts):

- Compliance-critical: `User`, `PurchaseRequest`, `RequestItem`, `Approval`,
  `Invoice`, `PriceVarianceReview`
- Master data: `Vendor`, `Client`, `Article`, `ArticleAlias`, `Budget`,
  `Commessa`, `Tender`
- Inventory: `Material`, `Warehouse`, `StockLot`
- Config: `DeployConfig`

**Escludi intenzionalmente**: `Session`, `StockMovement` (già append-only),
`Notification`, `Comment`, `Attachment`, `TimelineEvent`, `EmailLog`.

### User — campi monitorati

Per `User` il diff è ristretto a `USER_AUDITED_FIELDS`:
`role`, `totp_enabled`, `email`, `department`. Gli altri campi
(`password_hash`, `last_login_at`, ecc.) non generano audit events.

## Uso esplicito — cron / agent / seed

Quando il codice non passa da `withApiHandler`, wrappa manualmente:

```typescript
import { setAuditContext } from '@/lib/audit-context'

await setAuditContext(
  { actorType: 'SYSTEM', actorLabel: 'n8n-webhook' },
  async () => {
    await prisma.purchaseRequest.create({ data: ... })
  },
)
```

Per agenti: `{ actorType: 'AGENT', actorLabel: 'email-intelligence' }`.

**Missing context**: in `NODE_ENV=production` throw; in dev warn + actor
`UNKNOWN`.

## Consultazione

### Service

```typescript
import {
  searchAuditLogs,
  getEntityAuditHistory,
} from '@/modules/core/audit-log'

const page = await searchAuditLogs({
  actorId: 'u1',
  entityType: 'PurchaseRequest',
  action: 'UPDATE',
  from: new Date('2026-01-01'),
  limit: 50,
})

const history = await getEntityAuditHistory('PurchaseRequest', 'pr-42')
```

### API

- `GET /api/admin/audit` — query con filtri, paginazione cursor-based.
- `GET /api/admin/audit/export` — CSV streaming.

Entrambe richiedono ruolo `ADMIN`.

### UI

- Pagina `/admin/audit` con filtri, diff espandibile, esportazione CSV.
- Voce sidebar "Audit Trail" (icona `ShieldCheck`, visibile solo ADMIN).

## Bulk operations

`createMany` / `updateMany` / `deleteMany` generano **un evento audit per
riga** con `correlation_id` condiviso. Costo lineare nel numero di righe.
Gli handler **dovrebbero preferire operazioni singole** quando possibile
per mantenere audit leggibile.

## Correlation ID

Per operazioni multi-step (es. `PurchaseRequest` + `RequestItem` + `Approval`
nella stessa transazione), popola `metadata.correlationId` nel contesto per
raggruppare gli eventi. Le bulk operations auto-generano un UUID.

## Retention

**TODO — feature separata**. La policy difesa richiede retention ≥ 10 anni.
Implementazione prevista: archiviazione fredda + aggregazione trimestrale.

## Performance

Overhead tipico per mutazione audited: ~5-15ms (1-3ms indexed lookup pre-op
+ diff + insert). Monitorare con `EXPLAIN ANALYZE` sui 5 indici definiti.

## TODO

- Rate limiting Redis-backed (ora assente — ADMIN role è il vero controllo).
- Retention policy ≥ 10 anni.
- Grouping UI per `correlation_id`.
