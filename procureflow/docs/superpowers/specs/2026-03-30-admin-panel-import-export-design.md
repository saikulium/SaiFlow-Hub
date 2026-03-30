# Admin Panel + Import/Export — Design Spec

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide ADMIN users with a dedicated `/admin/config` panel to manage system configuration at runtime (modules, approval thresholds, categories, departments, cost centers, integrations) and to import/export data in bulk (CSV).

**Architecture:** Expand the existing `DeployConfig` model with `departments[]` and `cost_centers[]` fields. Add a new `IntegrationConfig` model for encrypted credential storage. All config changes go through REST API routes protected by `requireRole('ADMIN')`. Import uses server-side CSV parsing with upsert logic. Export uses client-side CSV generation for single entities and server-side ZIP generation for full backup.

**Tech Stack:** Next.js 14 App Router, Prisma, PostgreSQL, Node.js `crypto` (AES-256-GCM), `csv-parse` (CSV parsing), `archiver` (ZIP generation), React Hook Form + Zod (form validation).

---

## Decisions Made

| Question | Answer |
|----------|--------|
| Where does the admin panel live? | Separate route `/admin/config` (not inside `/settings`) |
| CSV conflict handling? | Overwrite/upsert — match by `code`, update existing, create new |
| Export scope? | Both: per-entity buttons on list pages + full backup ZIP from admin |
| Integration config storage? | Full config from UI, credentials encrypted (AES-256-GCM) in DB |
| Departments & cost centers? | Managed lists defined by ADMIN, used as dropdowns in forms |

---

## 1. Schema Changes

### 1.1 DeployConfig (expand existing)

Add two `String[]` fields to the existing model:

```prisma
model DeployConfig {
  // ... existing fields ...
  departments      String[]   // ["IT", "Produzione", "Marketing", ...]
  cost_centers     String[]   // ["CC-001 Sede", "CC-002 Magazzino", ...]
}
```

`approval_rules` remains a `Json?` field with this TypeScript shape:

```typescript
interface ApprovalRules {
  autoApproveMax: number      // below this amount -> auto-approve (default 500)
  managerApproveMax: number   // below this -> manager approval, above -> director+CFO (default 5000)
}
```

### 1.2 IntegrationConfig (new model)

```prisma
model IntegrationConfig {
  id              String   @id @default(cuid())
  type            String   @unique  // "imap", "sdi", "vendor_api"
  label           String             // "Email Ingestion", "SDI Fatture", "API Fornitore"
  enabled         Boolean  @default(false)
  config          String             // AES-256-GCM encrypted JSON (host, port, user, password, etc.)
  status          String   @default("disconnected")  // "connected", "disconnected", "error"
  last_sync_at    DateTime?
  last_error      String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  @@map("integration_configs")
}
```

The `config` field stores a JSON string encrypted with AES-256-GCM. The encryption key comes from `process.env.ENCRYPTION_KEY` (32-byte hex string).

---

## 2. Encryption Utility

**File:** `src/lib/crypto.ts`

Two functions:

- `encrypt(plaintext: string): string` — returns `iv:authTag:ciphertext` in base64
- `decrypt(encrypted: string): string` — reverses the process

Uses Node.js built-in `crypto` module with AES-256-GCM. The key is derived from `ENCRYPTION_KEY` env var.

---

## 3. API Routes

All routes require `requireRole('ADMIN')`.

### 3.1 Config CRUD

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/config` | Read DeployConfig + list IntegrationConfigs (without decrypted secrets) |
| `PATCH` | `/api/admin/config` | Update DeployConfig fields (deploy_name, company_logo_url, enabled_modules, categories, departments, cost_centers, approval_rules) |

### 3.2 Integrations

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/integrations` | List all integrations with status (config decrypted server-side, passwords masked in response) |
| `PUT` | `/api/admin/integrations/[type]` | Create or update integration config (encrypts before save) |
| `POST` | `/api/admin/integrations/[type]/test` | Test connection: IMAP→connect, SDI→ping, API→GET base URL. Returns `{success, message, latency_ms}` |
| `DELETE` | `/api/admin/integrations/[type]` | Remove integration |

### 3.3 Import

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/admin/import/vendors` | Upload CSV, parse, upsert vendors by `code`. Returns `{created, updated, errors[]}` |
| `POST` | `/api/admin/import/materials` | Upload CSV, parse, upsert materials by `code`. Returns `{created, updated, errors[]}` |

### 3.4 Export

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/export/[entity]` | Export single entity as CSV (vendors, materials, requests, invoices, users, budgets) |
| `GET` | `/api/admin/export/backup` | Generate ZIP with all CSVs, stream as download |

---

## 4. Import CSV Specification

### 4.1 Vendors CSV Format

```csv
codice,nome,email,telefono,sito_web,categorie,termini_pagamento,note
FORN-001,Tecnofer Srl,info@tecnofer.it,02-1234567,www.tecnofer.it,"IT,Produzione",30gg DFFM,Fornitore storico
```

Required fields: `codice`, `nome`. All others optional.
Multi-value fields (categorie): comma-separated within quotes.
Match key: `codice` → Vendor.code (unique).

### 4.2 Materials CSV Format

```csv
codice,nome,unita,livello_minimo,fornitore_codice,categoria,ubicazione
MAT-001,Cavo RG59,m,500,FORN-001,Cablaggio,Magazzino A
```

Required fields: `codice`, `nome`. All others optional.
`fornitore_codice` must reference an existing vendor — row errors if vendor not found (does not auto-create).
Match key: `codice` → Material.code (unique).

### 4.3 Parsing Rules

- Encoding: UTF-8 (with BOM detection)
- Separator: comma (with fallback to semicolon for Italian Excel)
- Max file size: 5MB
- Max rows: 10,000
- Library: `csv-parse` (streaming parser)

### 4.4 Response Format

```typescript
interface ImportResult {
  readonly created: number
  readonly updated: number
  readonly errors: readonly { row: number; message: string }[]
}
```

---

## 5. Export Specification

### 5.1 Per-Entity Export (client-side)

A reusable `ExportCsvButton` component placed in toolbar of list pages:
- Vendors page
- Materials page
- Requests page
- Invoices page

Component accepts `data: readonly Record<string, unknown>[]` and `columns: readonly { key: string; label: string }[]`. Generates CSV in-browser and triggers download via Blob URL.

### 5.2 Full Backup (server-side)

`GET /api/admin/export/backup` runs 6 queries in parallel:
1. All vendors
2. All materials
3. All requests + items
4. All invoices
5. All users (without password_hash, totp_secret)
6. All budgets + snapshots

Generates 6 CSV files, compresses into ZIP using `archiver`, streams response as `procureflow-backup-YYYY-MM-DD.zip`.

**Excluded from backup:** passwords, TOTP secrets, integration credentials, refresh tokens.

### 5.3 Export CSV Column Definitions

All exports (client-side and backup) use the same column definitions per entity for consistency.

**Vendors:** codice, nome, email, telefono, sito_web, categorie (semicolon-joined), termini_pagamento, rating, stato, note
**Materials:** codice, nome, unita, livello_minimo, fornitore_codice, categoria, ubicazione, attivo
**Requests:** codice, titolo, stato, priorita, richiedente_nome, fornitore_nome, importo_stimato, importo_effettivo, valuta, data_creazione, data_consegna
**Invoices:** numero, fornitore_nome, importo, valuta, data_ricezione, stato_riconciliazione, sdi_id
**Users:** nome, email, ruolo, dipartimento, data_creazione (no password, no TOTP)
**Budgets:** centro_costo, dipartimento, importo_allocato, speso, impegnato, disponibile, periodo_inizio, periodo_fine

---

## 6. UI Design

### 6.1 Layout

Route: `/admin/config` — only accessible to ADMIN role users.

```
┌──────────────────────────────────────────────────┐
│  ← Torna a Dashboard          Admin Panel        │
├────────────┬─────────────────────────────────────┤
│ Generale   │                                     │
│ Approvaz.  │   [Active tab content]              │
│ Categorie  │                                     │
│ Dip & Costi│                                     │
│ Integraz.  │                                     │
│ Import/Exp │                                     │
├────────────┴─────────────────────────────────────┤
```

Vertical sidebar tabs on left. Content area on right. Same styling as rest of app.

### 6.2 Tab: Generale

- Text input: Company name
- Image upload + preview: Company logo (stored as base64 data URI in `company_logo_url` field — no external storage needed for a single small image)
- 8 toggle switches: one per module (core is always ON, disabled)
- Save button

### 6.3 Tab: Approvazioni

- Numeric input: Auto-approve threshold (EUR)
- Numeric input: Manager approve threshold (EUR)
- Explanatory text: "Sopra la soglia manager, serve approvazione director + CFO"
- Save button

### 6.4 Tab: Categorie

- List of existing categories, each with remove (X) button
- Text input + "Aggiungi" button at bottom
- Save button

### 6.5 Tab: Dipartimenti & Centri di Costo

Two sections with same UI as Categorie:
- **Dipartimenti** — simple name list
- **Centri di Costo** — format: `CODICE - Descrizione`

### 6.6 Tab: Integrazioni

3 cards (IMAP, SDI, Vendor API), each with:
- Header: name + status badge (green/red/grey)
- Last sync timestamp + last error (if any)
- Expandable config form with type-specific fields
- "Test Connessione" button
- "Salva" button
- Enable/disable toggle

**IMAP fields:** Host, Port, Protocol (IMAP/IMAPS), Email, Password, Folder (default: INBOX)
**SDI fields:** Endpoint URL, Codice Destinatario, Certificate (uploaded as base64, stored inside encrypted config JSON), Certificate password
**Vendor API fields:** Vendor name, Base URL, API Key, Custom headers

### 6.7 Tab: Import/Export

Two sections:

**Import:**
- Drop zone (or click to select) for vendor CSV
- Drop zone (or click to select) for material CSV
- After upload: result report with green/red badges (created/updated/errors)

**Export:**
- "Backup Completo (ZIP)" button — prominent, primary style
- List of single-entity export links: Fornitori, Materiali, Richieste, Fatture, Utenti, Budget

---

## 7. Navigation

- Add "Admin" item to sidebar navigation, visible only to ADMIN role users
- Icon: Shield or Settings2
- Path: `/admin/config`
- Position: near bottom of sidebar, before Settings
- This nav item is **role-gated** (ADMIN only), not module-gated. It bypasses the module registry system — added directly in the sidebar component with a role check, not in `registry.ts`.

---

## 8. Interaction with Existing Systems

### 8.1 Module Toggle → Sidebar/Dashboard

When ADMIN toggles modules on/off, the `DeployConfig.enabled_modules` is updated. The existing `module.service.ts` cache (60s TTL) will pick up changes. Sidebar nav items and dashboard tabs are already filtered by enabled modules — no additional work needed.

### 8.2 Categories/Departments/Cost Centers → Forms

The request creation form (`request-form.tsx`) and other forms that currently have free-text fields for department/cost_center will be updated to use dropdowns populated from `DeployConfig.departments[]` and `DeployConfig.cost_centers[]`. Categories dropdown already reads from `DeployConfig.categories[]`.

### 8.3 Approval Thresholds → Workflow

The existing `getApprovalTier()` function in `constants/approval-thresholds.ts` currently reads from hardcoded constants. This will be refactored into a service function `getApprovalThresholds()` in `src/server/services/approval.service.ts` that reads `DeployConfig.approval_rules` from DB first, and falls back to the hardcoded constants if not set. Any code calling `getApprovalTier()` will be updated to use the new service.

---

## 9. Security

- All `/api/admin/*` routes: `requireRole('ADMIN')` check
- Integration credentials: AES-256-GCM encryption at rest
- `ENCRYPTION_KEY` required in `.env` (fail-fast at startup if missing)
- Backup export excludes sensitive data (passwords, TOTP, credentials, tokens)
- CSV import: size limit 5MB, row limit 10K, input sanitization
- Passwords in integration config responses are masked (`****`) — never sent to client

---

## 10. File Map

### New Files

| File | Purpose |
|------|---------|
| `src/app/admin/config/page.tsx` | Admin panel page (server component, auth gate) |
| `src/app/admin/config/layout.tsx` | Admin layout with back button |
| `src/components/admin/admin-panel.tsx` | Client component: tab navigation + content |
| `src/components/admin/general-tab.tsx` | Module toggles, company info |
| `src/components/admin/approvals-tab.tsx` | Approval threshold config |
| `src/components/admin/categories-tab.tsx` | Category list management |
| `src/components/admin/departments-tab.tsx` | Departments + cost centers |
| `src/components/admin/integrations-tab.tsx` | Integration cards |
| `src/components/admin/import-export-tab.tsx` | CSV import + export/backup |
| `src/components/shared/export-csv-button.tsx` | Reusable CSV export button |
| `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt |
| `src/lib/validations/admin.ts` | Zod schemas for admin API inputs |
| `src/server/services/import.service.ts` | CSV parsing + upsert logic |
| `src/server/services/export.service.ts` | Backup ZIP generation |
| `src/server/services/approval.service.ts` | DB-backed approval thresholds with fallback to constants |
| `src/app/api/admin/config/route.ts` | GET/PATCH deploy config |
| `src/app/api/admin/integrations/route.ts` | GET integrations list |
| `src/app/api/admin/integrations/[type]/route.ts` | PUT/DELETE single integration |
| `src/app/api/admin/integrations/[type]/test/route.ts` | POST test connection |
| `src/app/api/admin/import/vendors/route.ts` | POST vendor CSV import |
| `src/app/api/admin/import/materials/route.ts` | POST material CSV import |
| `src/app/api/admin/export/[entity]/route.ts` | GET single entity CSV |
| `src/app/api/admin/export/backup/route.ts` | GET full backup ZIP |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `departments[]`, `cost_centers[]` to DeployConfig; add IntegrationConfig model |
| `src/lib/constants.ts` | Add admin nav item (role-gated, not module-gated) |
| `src/components/layout/sidebar.tsx` | Add role check to show Admin nav item only for ADMIN users |
| `src/lib/constants/approval-thresholds.ts` | Refactor to read from DB first, fallback to constants |
| `src/components/requests/request-form.tsx` | Change department/cost_center from text to dropdown |
| `src/components/vendors/vendors-page-content.tsx` | Add ExportCsvButton |
| `src/components/inventory/materials-page-content.tsx` | Add ExportCsvButton |
| `src/components/invoices/invoices-page-content.tsx` | Add ExportCsvButton |
| `src/components/requests/requests-page-content.tsx` | Add ExportCsvButton |
| `package.json` | Add `csv-parse`, `archiver` dependencies |
