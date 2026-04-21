# ProcureFlow — Azioni Pendenti dal Nightly 2026-04-05

> Questo file elenca SOLO le cose **non ancora fatte**. Le fix automatiche del nightly (TypeScript 0 errori, 16 API routes corrette in `fed86e3`, npm audit fix non-breaking) sono gia' state applicate.

---

## CRITICO — Sicurezza

### 1. Auth mancante su `/api/vendors`
- **GET** (`src/app/api/vendors/route.ts:6`): nessun auth check — l'intero DB vendor e' esposto pubblicamente
- **POST** (`src/app/api/vendors/route.ts:36`): nessun role check — anche VIEWER puo' creare vendor
- **Fix**: `requireAuth()` su GET, `requireRole('MANAGER', 'ADMIN')` su POST
- **Effort**: S | **Impact**: CRITICO

### 2. Webhook auth debole
- **File**: `src/lib/webhook-auth.ts:96-108`
- `x-timestamp` opzionale → replay attack possibile se header omesso
- `x-webhook-id` non richiesto → idempotency bypassabile
- Nessun limite dimensione body → memory exhaustion
- **Fix**: rendere timestamp e webhook-id obbligatori, aggiungere check `Content-Length` (max 10MB)
- **Effort**: S | **Impact**: CRITICO

### 3. `sdi_status` non validato
- **File**: `PATCH /api/invoices/[id]` — `body.sdi_status` scritto nel DB senza schema Zod
- **Fix**: aggiungere validazione Zod per `sdi_status`
- **Effort**: S | **Impact**: HIGH

### 4. Password senza `max(72)` nel login
- **File**: `src/lib/validations/auth.ts:5`
- bcrypt tronca a 72 bytes → una password da 10MB causa CPU DoS
- **Fix**: aggiungere `.max(72)` allo schema Zod
- **Effort**: S | **Impact**: HIGH

### 5. Race condition vendor code duplicati
- **File**: `src/app/api/vendors/route.ts:45-51`
- Check unicita' non atomico → due request concorrenti creano duplicati
- **Fix**: gestire errore Prisma P2002 (unique constraint violation)
- **Effort**: S | **Impact**: HIGH

### 6. Math.random() per codici request
- **File**: `src/server/services/agent.service.ts:332-336`
- RNG debole in produzione
- **Fix**: usare `crypto.getRandomValues()`
- **Effort**: S | **Impact**: MEDIUM

### 7. Rate limiting mancante su `/api/chat`
- **File**: `src/app/api/chat/route.ts`
- Utenti autenticati possono spammare Claude API senza limiti
- **Fix**: rate limit per utente (10 msg/min)
- **Effort**: S | **Impact**: HIGH

---

## HIGH — Vulnerabilita' npm (richiedono breaking changes)

| Pacchetto | Severita' | Fix |
|-----------|-----------|-----|
| `next` 15.x → 16.x | HIGH (4 CVE: DoS, HTTP smuggling, disk cache) | Migrazione major |
| `glob` via `eslint-config-next` → 16.x | HIGH (command injection) | Upgrade insieme a next |
| `cookie` via `@auth/prisma-adapter` → 2.11.x | LOW | Breaking change adapter |

---

## HIGH — Performance

### 8. Zero lazy-loading di librerie pesanti
- Recharts (~150KB) caricato eagerly ovunque
- **File principali**: `src/components/dashboard/dashboard-tabs.tsx`, `src/components/analytics/roi-dashboard.tsx`
- **Fix**: wrappare import chart con `next/dynamic({ ssr: false })`
- **Risparmio stimato**: 60-90KB sul caricamento iniziale
- **Effort**: S | **Impact**: HIGH

### 9. Query Prisma senza `select` (fetchano tutte le colonne)
| File | Model |
|------|-------|
| `src/server/services/export.service.ts:156` | Vendor |
| `src/server/services/dashboard.service.ts:212` | Vendor |
| `src/server/services/agent.service.ts:40` | PurchaseRequest |
| `src/app/api/notifications/route.ts:32` | Notification |
| `src/server/services/budget.service.ts` (3 punti) | Budget |
| `src/app/api/webhooks/sdi-invoice/route.ts:91` | Invoice |
| `src/app/api/webhooks/approval-response/route.ts:117` | Approval |
- **Effort**: S-M | **Impact**: HIGH

### 10. React.memo mancante su componenti lista
**Tabelle** (re-render completo ad ogni cambio stato):
- `src/components/requests/requests-table.tsx`
- `src/components/invoices/invoices-table.tsx`
- `src/components/inventory/materials-page-content.tsx`
- `src/components/tenders/tenders-page-content.tsx`
- `src/components/budgets/budgets-page-content.tsx`

**Card/Liste**:
- `src/components/vendors/vendor-card.tsx`
- `src/components/requests/requests-kanban.tsx`
- `src/components/dashboard/insight-cards.tsx`
- `src/components/layout/notification-item.tsx`
- **Effort**: M | **Impact**: MEDIUM-HIGH

---

## MEDIUM — Prisma Schema

### 11. Index mancanti
| Model | Index mancante | Motivo |
|-------|---------------|--------|
| `Approval` | `@@index([request_id, status])`, `@@index([approver_id, status])` | Zero index nonostante query frequenti |
| `TimelineEvent` | `@@index([request_id, created_at])` | Caricato su ogni dettaglio request |
| `Vendor` | `@@index([status])` | Filtro frequente |
| `Invoice` | `@@index([vendor_id])` | Join frequente |

### 12. onDelete mancante su 5 relazioni User
- Approval, Comment, Notification, TimelineEvent, PurchaseRequest → User non ha `onDelete` definito
- Impedisce la cancellazione hard di utenti

---

## MEDIUM — Architettura / Refactoring

### 13. `request-detail-content.tsx` — 785 righe
- Contiene 5 tab component embedded + 9 helper function
- **Fix**: estrarre ogni tab in `src/components/requests/tabs/`, usare RequestContext
- **Effort**: S | **Impact**: MEDIUM

### 14. Estrarre `<DataTable>` e `<PagedListLayout>` condivisi
- ~1500 righe duplicate tra `requests-table`, `invoices-table`, `tenders-page-content`, `materials-page-content`, `requests-page-content`
- Boilerplate identico: SortIcon, SkeletonRow, DeleteButton, selezione, paginazione
- **Fix**: componente generico `<DataTable<T>>` + `<PagedListLayout>`
- **Effort**: M | **Impact**: HIGH (velocita' sviluppo futuro)

### 15. Badge status duplicati (4 componenti quasi identici)
- `src/components/shared/status-badge.tsx`
- `src/components/invoices/invoice-status-badge.tsx`
- `src/components/tenders/tender-status-badge.tsx`
- `src/components/shared/priority-badge.tsx`
- **Fix**: un singolo `<StatusBadge variant={type} value={status} />`
- **Effort**: S | **Impact**: LOW

### 16. Hook data-fetching inconsistenti
- `use-requests.ts`, `use-invoices.ts`, `use-tenders.ts`, `use-vendors.ts` — ognuno con tipo `ApiResponse` locale e gestione errori diversa
- **Fix**: factory `createListHook<T>(endpoint, options)`
- **Effort**: M | **Impact**: MEDIUM

### 17. Boilerplate API route ripetitivo
- Ogni route ripete try/catch + requireRole + successResponse pattern
- **Fix**: wrapper `withApiHandler(config, handler)`
- **Effort**: M | **Impact**: MEDIUM




### 19. AI services creano client per-call
- `email-ai-classifier.service.ts:138` e `invoice-ai-parser.service.ts:172` fanno `new Anthropic()` ad ogni chiamata
- **Fix**: usare `getClaudeClient()` singleton da `src/lib/ai/claude-client.ts`
- **Effort**: S | **Impact**: LOW

### 20. Forecast service duplica calcolo WMA
- `getBasicForecast()` e `getAiForecast()` computano WMA indipendentemente
- **Fix**: estrarre `computeWMA()` e `fetchCurrentStock()` come funzioni pure
- **Effort**: S | **Impact**: LOW

---

## MEDIUM — Loading/Error states mancanti

### 21. 14 route senza `loading.tsx` / `error.tsx`
| Route | Mancante |
|-------|----------|
| `(dashboard)/requests/[id]/` | loading + error |
| `(dashboard)/vendors/[id]/` | loading + error |
| `(dashboard)/invoices/[id]/` | loading + error |
| `(dashboard)/budgets/[id]/` | loading + error |
| `(dashboard)/tenders/[id]/` | loading + error |
| `(dashboard)/inventory/[id]/` | loading + error |
| `(dashboard)/inventory/inventories/[id]/` | loading + error |
| `(dashboard)/inventory/inventories/` | loading + error |
| `(dashboard)/inventory/movements/` | loading + error |
| `(dashboard)/inventory/warehouses/` | loading + error |
| `(dashboard)/requests/new/` | loading + error |
| `(dashboard)/settings/security/` | loading + error |
| `(auth)/login/` | loading + error |
| `admin/config/` | loading + error |

### 22. 4 pagine senza `error.tsx`
- `/budgets`, `/tenders`, `/inventory`, `/users`

---

## LOW — Dead Code

### 23. File orfani (mai importati)
- `src/hooks/use-media-query.ts` — esporta `useMediaQuery`, `useIsMobile`, `useIsTablet`
- `src/lib/validations/cig-cup.ts` — validazione CIG/CUP/P.IVA prematura

### 24. Export mai usati
- `src/hooks/use-stock.ts:111` → `useLot`
- `src/lib/modules/registry.ts:136` → `ALL_MODULE_IDS`

### 25. `use client` non necessario (8 componenti presentazionali puri)
- `page-transition.tsx`, `invoice-status-badge.tsx`, `tender-status-badge.tsx`, `stock-level-badge.tsx`, `invoice-stats-row.tsx`, `stats-row.tsx`, `recent-requests-list.tsx`, `budget-overview.tsx`
- (Nota: alcuni usano `motion.div` di Framer Motion che richiede client — verificare caso per caso)

---

## LOW — Seed / Housekeeping

### 26. Seed issues
- Approvazioni duplicate per `PR-2026-00002` e `PR-2026-00006`
- `RefreshToken`, `ProcessedWebhook`, `IntegrationConfig` non cancellati nel seed cleanup
- Cleanup inventory non nella transaction iniziale

### 27. TODO nei sorgenti
| File | Riga | Commento |
|------|------|----------|
| `sidebar-nav-item.tsx` | 28 | `return 4 // TODO: dynamic` — badge count hardcodato |
| `sidebar-nav-item.tsx` | 30 | `return 3 // TODO: dynamic` — badge count hardcodato |
| `dashboard-shell.tsx` | 12 | `// TODO: re-enable onboarding wizard` |

### 28. Git: 76 modifiche non committate
- 34 file modificati + 42 untracked
- `.superpowers/` da aggiungere a `.gitignore`
- `docs/PROCUREFLOW-GUIDA-COMPLETA.docx` — binario, considerare Git LFS
- `docs/clienti/` — verificare che non contenga dati sensibili

---

## Ordine Consigliato

```
Settimana 1: #1, #2, #3, #4, #5, #7 (security — ship subito)
Settimana 2: #8, #13 (quick win performance + file troppo grande)
Settimana 3-4: #14 (DataTable + PagedListLayout — refactor piu' grande)
Settimana 5+: #21, #22 (loading/error states), #9, #10 (performance DB)
Ongoing: npm major upgrades (next 16), CI/CD, test coverage
```
