# Changelog

## [unreleased]

### Added

- Modulo **audit-log**: audit trail immutabile con Prisma extension + trigger
  Postgres. Registra automaticamente CREATE/UPDATE/DELETE su 17 modelli
  compliance-critical (User, PurchaseRequest, Invoice, Vendor, Commessa, ecc.).
  Immutabilità a due livelli (ORM + DB). UI admin a `/admin/audit` con filtri,
  diff espandibile, export CSV. Risolve finding compliance PF-006 (HIGH).
  (`feat/audit-trail`)
