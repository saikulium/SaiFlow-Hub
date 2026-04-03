# Anagrafica Articoli — Design Spec

## Goal

Introduce an Article Master registry with cross-reference code mapping (internal, vendor, client, standard) so that the same physical product can be identified by any of its codes across all ProcureFlow modules. Enable automatic code translation between clients and vendors, AI-assisted matching for unknown codes, multi-vendor price comparison, and bulk CSV import for initial migration.

## Architecture

**Approach B — Article as a separate entity.** Article is the pure master record ("what is this product?"). Material (inventory) gains an optional FK to Article. RequestItem, CommessaItem, and InvoiceLineItem each gain an optional `article_id`. All existing flows continue to work without the article registry (opt-in).

**Three sub-projects**, each independently valuable:
1. Foundations — schema, CRUD, search, import
2. Integration — autocomplete in forms, code translation, price comparison
3. AI Matching — fuzzy/AI resolution, unresolved code handling, learning

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Separate Article entity | Keeps inventory (Material) and master data (Article) cleanly separated |
| Categories | Flat string | Matches existing Material pattern, avoids category CRUD complexity |
| AI match threshold | Admin-configurable | Client starts conservative, lowers as trust builds |
| CSV import format | Single normalized file | One row per alias, article data repeated. Simple for user, handles N aliases per article |
| AI auto-confirm | Never for AI source | Safety net: fuzzy/exact can auto-match above threshold, AI always requires human confirmation |

---

## 1. Data Model

### 1.1 New Entities

#### Article

The internal truth about a product.

```prisma
model Article {
  id                String    @id @default(cuid())
  code              String    @unique          // ART-2026-00001
  name              String
  description       String?
  category          String?
  unit_of_measure   String                     // pz, kg, m
  manufacturer      String?                    // Original manufacturer name
  manufacturer_code String?                    // Manufacturer part number
  is_active         Boolean   @default(true)
  notes             String?
  tags              String[]
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  aliases           ArticleAlias[]
  prices            ArticlePrice[]
  materials         Material[]
  request_items     RequestItem[]
  commessa_items    CommessaItem[]
  invoice_items     InvoiceLineItem[]

  @@index([code])
  @@index([name])
  @@index([category])
  @@index([manufacturer_code])
  @@index([is_active])
}
```

#### ArticleAlias

External codes mapping N:1 to Article.

```prisma
model ArticleAlias {
  id          String        @id @default(cuid())
  article_id  String
  article     Article       @relation(fields: [article_id], references: [id], onDelete: Cascade)
  alias_type  AliasType                     // VENDOR, CLIENT, STANDARD
  alias_code  String                        // The external code
  alias_label String?                       // Optional description
  entity_id   String?                       // FK to Vendor.id or Client.id (null for STANDARD)
  entity_type String?                       // "vendor" | "client" | null
  is_primary  Boolean       @default(false) // Preferred alias for this type+entity
  created_at  DateTime      @default(now())

  @@unique([alias_type, alias_code, entity_id])  // No duplicates per scope
  @@index([alias_code])
  @@index([article_id])
  @@index([entity_id])
}

enum AliasType {
  VENDOR
  CLIENT
  STANDARD
}
```

**Uniqueness constraint:** Same external code can exist for different vendors, but not twice for the same vendor. For STANDARD aliases (NSN, EAN), `entity_id` is null making the code globally unique.

#### ArticlePrice

Historical prices per vendor for multi-vendor comparison.

```prisma
model ArticlePrice {
  id           String    @id @default(cuid())
  article_id   String
  article      Article   @relation(fields: [article_id], references: [id], onDelete: Cascade)
  vendor_id    String
  vendor       Vendor    @relation(fields: [vendor_id], references: [id])
  unit_price   Decimal   @db.Decimal(12,2)
  currency     String    @default("EUR")
  min_quantity Int       @default(1)         // Price valid from N units
  valid_from   DateTime  @default(now())
  valid_until  DateTime?                     // Null = no expiry
  source       String    @default("manual")  // "manual" | "invoice" | "quote"
  notes        String?
  created_at   DateTime  @default(now())

  @@index([article_id, vendor_id])
  @@index([vendor_id])
}
```

### 1.2 Modifications to Existing Entities

All additions are optional (nullable FK). No breaking changes.

```prisma
// Material — add optional link to Article
model Material {
  // ... existing fields ...
  article_id  String?
  article     Article?  @relation(fields: [article_id], references: [id])
}

// RequestItem — add optional link to Article + unresolved code
model RequestItem {
  // ... existing fields ...
  article_id      String?
  article         Article?  @relation(fields: [article_id], references: [id])
  unresolved_code String?   // External code that couldn't be resolved
}

// CommessaItem — add optional link to Article + unresolved code
model CommessaItem {
  // ... existing fields ...
  article_id      String?
  article         Article?  @relation(fields: [article_id], references: [id])
  unresolved_code String?
}

// InvoiceLineItem — add optional link to Article
model InvoiceLineItem {
  // ... existing fields ...
  article_id  String?
  article     Article?  @relation(fields: [article_id], references: [id])
}
```

### 1.3 DeployConfig Extension

```
article_auto_match_threshold: Int  @default(0)  // 0 = never auto-match
```

---

## 2. Code Resolution Service

### 2.1 Interface

```typescript
// article-resolver.service.ts

interface ResolveContext {
  entity_type?: 'vendor' | 'client'
  entity_id?: string
  description?: string  // Additional text for AI matching
}

type ResolveResult =
  | { status: 'MATCHED'; article: Article; alias: ArticleAlias }
  | { status: 'SUGGESTED'; candidates: SuggestedMatch[]; original_code: string }
  | { status: 'UNMATCHED'; original_code: string }

interface SuggestedMatch {
  article_id: string
  article_code: string
  article_name: string
  confidence: number    // 0-100
  reason: string        // Human-readable explanation
  source: 'exact' | 'fuzzy' | 'ai'
}

function resolveCode(code: string, context?: ResolveContext): Promise<ResolveResult>
```

### 2.2 Resolution Logic (3 steps)

**Step 1 — Exact match:** Query `ArticleAlias` where `alias_code = input`. If context provides `entity_id`, filter by it first (scoped match), then fall back to unscoped. If found → `MATCHED`.

**Step 2 — Fuzzy match (DB):** If exact fails, use PostgreSQL `pg_trgm` similarity on `ArticleAlias.alias_code` and `Article.name`. Return candidates with similarity score mapped to 0-100. Only candidates above 50% similarity are included.

**Step 3 — AI match:** If no fuzzy candidate exceeds the minimum threshold, call Claude with: the unknown code, the description (if provided), the entity's order history, and articles in the same category. Claude returns candidates with confidence scores and reasoning.

### 2.3 Auto-match Rules

- Threshold is read from `DeployConfig.article_auto_match_threshold` (default 0 = never)
- Only `source: "exact"` or `source: "fuzzy"` candidates can auto-match
- `source: "ai"` candidates ALWAYS require human confirmation regardless of threshold
- When auto-matched: the alias is created automatically and the item's `article_id` is set

### 2.4 Learning

Every manual mapping (operator confirms a suggestion or manually searches) creates a new `ArticleAlias`. Next time the same code from the same entity arrives → exact match at step 1.

---

## 3. Module Integration

### 3.1 Module Registry

New module `articles` in `MODULE_REGISTRY`:

```typescript
{
  id: 'articles',
  label: 'Anagrafica Articoli',
  description: 'Codici interni, alias fornitori/clienti, cross-reference',
  navPaths: ['/articles'],
  dashboardTabs: [],
  apiPrefixes: ['/api/articles'],
}
```

Added to `ModuleId` union type.

### 3.2 Commesse Integration (client orders inbound)

When creating a `CommessaItem` with a client product code:
1. Form has a "Codice cliente" free text field
2. On blur, calls `resolveCode(code, { entity_type: "client", entity_id: client_id })`
3. If `MATCHED` → auto-populates `article_id`, shows internal article name, UM, last purchase price
4. If `SUGGESTED` → shows inline suggestion panel (SmartFill style)
5. If `UNMATCHED` → amber "Non mappato" badge, row created with `unresolved_code` set

**Reverse translation (commessa → RDA):**
When generating a PurchaseRequest from a commessa, for each row with `article_id`:
1. Look up `ArticleAlias` of type VENDOR for the selected vendor
2. If found → pre-fill `RequestItem.sku` with the vendor code
3. If not found → leave internal code, operator completes manually

### 3.3 PurchaseRequest / RequestItem Integration

**Article autocomplete in item form:**
- Universal search field that queries `GET /api/articles/search?q=...`
- Searches across: `Article.code`, `Article.name`, `ArticleAlias.alias_code`, `Article.manufacturer_code`
- Results grouped by article with sub-label showing which code matched

When operator selects an article:
- `article_id` is set
- `name` auto-fills with article name
- `unit` auto-fills with article UM
- If vendor is selected and article has VENDOR alias for it → `sku` auto-fills
- If `ArticlePrice` exists for that vendor → `unit_price` is suggested (does not overwrite if already filled)

### 3.4 Price Comparison Panel

When creating a RDA and selecting an article with prices from 2+ vendors:

```
Confronto Prezzi
────────────────────────────────
Amphenol       €12,00/pz  (15g fa)
TE Connect.    €14,50/pz  (30g fa)
Molex          €11,80/pz  (7g fa) ★

★ = prezzo più basso
```

Informational only — does not force vendor choice.

### 3.5 Invoice Integration (SDI)

During three-way matching:
- If `InvoiceLineItem` matches a `RequestItem` with `article_id` → propagate `article_id` to the invoice line
- Automatically save the invoice unit price as a new `ArticlePrice` with `source: "invoice"`

### 3.6 Inventory (Material) Integration

`Material` gains optional `article_id`:
- Material detail page shows linked article and all its aliases
- Material creation form suggests unlinked articles via autocomplete
- Materials without `article_id` work exactly as today

---

## 4. API Routes

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/articles` | GET | requireModule('articles') | Paginated list with filters: search, category, is_active |
| `/api/articles` | POST | requireModule('articles') | Create article (+ inline aliases optional) |
| `/api/articles/[id]` | GET | requireModule('articles') | Detail with aliases, prices, usage links |
| `/api/articles/[id]` | PATCH | requireModule('articles') | Update article |
| `/api/articles/[id]/aliases` | GET | requireModule('articles') | List aliases for article |
| `/api/articles/[id]/aliases` | POST | requireModule('articles') | Add alias |
| `/api/articles/[id]/aliases/[aliasId]` | DELETE | requireModule('articles') | Remove alias |
| `/api/articles/[id]/prices` | GET | requireModule('articles') | Price history by vendor |
| `/api/articles/[id]/prices` | POST | requireModule('articles') | Add manual price |
| `/api/articles/resolve` | POST | requireModule('articles') | Resolve external code → article |
| `/api/articles/search` | GET | requireModule('articles') | Universal autocomplete |
| `/api/articles/import` | POST | requireRole('ADMIN') | Bulk CSV import |

### Response Patterns

Follow existing patterns: `successResponse(data, meta)`, `errorResponse(code, message, status)`, `validationErrorResponse(zodErrors)`.

---

## 5. UI Pages

### 5.1 Article List (`/articles`)

Follows `materials-page-content.tsx` pattern:
- Header with stats: total articles, active, pending unresolved codes
- Filter bar: universal search, category select, active/inactive toggle
- Table columns: code, name, category, UM, alias count, vendor count, active badge
- Row click → detail page
- Action buttons: "Nuovo Articolo", "Importa CSV"
- CSV export button

### 5.2 Article Detail (`/articles/[code]`)

Header: code, name, active/inactive badge, category, manufacturer.

**Tab "Alias":**
- Table: type (color-coded badge — Fornitore=indigo, Cliente=verde, Standard=grigio), code, entity name, primary flag
- Add alias button → inline form or dialog
- Delete alias with confirmation

**Tab "Prezzi":**
- Table by vendor: vendor name, unit price, min quantity, validity period, source badge
- Highlight best price with star
- Add price button → dialog

**Tab "Dove Usato":**
- Aggregated list of where the article appears: RDA lines, commessa lines, invoice lines, linked material
- Each entry is a clickable link to the source document

**Tab "Dettagli":**
- Master fields: manufacturer, manufacturer code, description, notes, tags
- Edit button → dialog

### 5.3 CSV Import Dialog

3-step modal:
1. **Upload** — drag & drop or file picker, accepts .csv and .xlsx
2. **Preview** — first 10 rows, auto-detected column mapping with manual override, counters: N new articles, N new aliases, N duplicates (skip)
3. **Confirm** — executes with progress bar, final report: X articles created, Y aliases created, Z errors with detail

### 5.4 CSV Format

```csv
codice_interno,nome,categoria,um,produttore,codice_produttore,tipo_alias,codice_alias,entita,note_alias
FAL-CON-038,Connettore circolare MIL 38999,Connettori,pz,Amphenol,38999-20WG35SN,vendor,38999-20WG35SN,Amphenol,Part number originale
FAL-CON-038,Connettore circolare MIL 38999,Connettori,pz,Amphenol,38999-20WG35SN,vendor,CIR-D38999/20WG35SN,TE Connectivity,Equivalente TE
FAL-CON-038,Connettore circolare MIL 38999,Connettori,pz,Amphenol,38999-20WG35SN,client,LEO-EL-7842,Leonardo,Codice ordine Leonardo
FAL-CON-038,Connettore circolare MIL 38999,Connettori,pz,Amphenol,38999-20WG35SN,standard,5935-01-234-5678,,NSN NATO
```

Import logic:
- If `codice_interno` doesn't exist → create Article
- If `codice_interno` exists → skip creation (update if fields differ)
- For each row with `tipo_alias` + `codice_alias` → create ArticleAlias (skip if duplicate)
- `entita` is resolved by name → case-insensitive match against Vendor/Client `name`. If not found → warning in report, alias created with `entity_id = null`

### 5.5 ArticleAutocomplete Component

Reusable component used in RequestItem form, CommessaItem form, Material linking:
- Input with 300ms debounce
- Calls `GET /api/articles/search?q=...`
- Results grouped: internal code matches first, then alias matches, then name matches
- Each result shows: `[ART-001] Connettore MIL 38999` with sub-label `via: LEO-EL-7842 (codice Leonardo)`
- Portal-based dropdown (same pattern as VendorSelect in request-form.tsx)

---

## 6. Unresolved Code Handling

When a CommessaItem or RequestItem arrives with a code that cannot be resolved:

1. Row is created normally (nothing blocks)
2. `article_id = null`, `unresolved_code` is set to the original external code
3. A `Notification` is created for ADMIN/MANAGER users: "Codice non mappato: LEO-EL-7842 sulla commessa COM-2026-00003"
4. In the UI, unresolved rows show an amber "Non mappato" badge (clickable)
5. Clicking opens a resolution panel with:
   - Fuzzy/AI suggested matches (if any)
   - "Associa a articolo esistente" → opens ArticleAutocomplete
   - "Crea nuovo articolo" → opens article creation form pre-filled with available data
   - "Ignora" → dismisses for now
6. On resolution: `article_id` is set, `unresolved_code` is cleared, a new `ArticleAlias` is created (learning)

---

## 7. Sub-Project Decomposition

### Sub-project 1: Foundations

Schema (Article, ArticleAlias, ArticlePrice + migration), article_id on existing models, module registry entry, full CRUD API, search/autocomplete API, CSV import, UI pages (list + detail + import dialog), Zod validations, React Query hooks, constants, atomic code generation (ART-YYYY-NNNNN).

**Value:** Standalone article registry is usable. Operators can create articles, add aliases, import from Excel, search by any code.

### Sub-project 2: Integration

ArticleAutocomplete component, RequestItem form integration (autocomplete + auto-fill), CommessaItem form integration (client code resolution), reverse translation commessa→RDA (vendor code auto), price comparison panel in RDA creation, article_id propagation in three-way matching, automatic ArticlePrice from invoices, Material→Article link in material page.

**Depends on:** Sub-project 1.

**Value:** Existing flows benefit from the registry. Automatic code translation, price suggestions, full traceability.

### Sub-project 3: AI Matching

`article-resolver.service.ts` with 3-step logic, `pg_trgm` extension for fuzzy search, `unresolved_code` field on CommessaItem/RequestItem, "Non mappato" badge + resolution panel UI, notifications for unresolvable codes, configurable auto-match threshold in DeployConfig + Settings UI, learning loop (manual mapping → saved alias).

**Depends on:** Sub-projects 1 and 2.

**Value:** System becomes intelligent. Unknown codes don't block anything, AI suggests matches, every manual mapping teaches the system.

### Implementation Order

```
Sub-project 1 (Foundations) → Sub-project 2 (Integration) → Sub-project 3 (AI Matching)
```

Each sub-project follows its own plan→build→review cycle.

---

## 8. File Structure (New Files)

```
prisma/
  migrations/YYYYMMDD_article_master/   — Schema migration

src/
  app/
    (dashboard)/articles/
      page.tsx                          — Article list page
      [code]/page.tsx                   — Article detail page
    api/articles/
      route.ts                          — GET list, POST create
      [id]/route.ts                     — GET detail, PATCH update
      [id]/aliases/route.ts             — GET/POST aliases
      [id]/aliases/[aliasId]/route.ts   — DELETE alias
      [id]/prices/route.ts              — GET/POST prices
      resolve/route.ts                  — POST resolve code
      search/route.ts                   — GET autocomplete
      import/route.ts                   — POST CSV import
  components/articles/
    articles-page-content.tsx           — List page component
    article-detail.tsx                  — Detail page component
    article-create-dialog.tsx           — Create article dialog
    article-alias-form.tsx              — Add alias inline form
    article-price-dialog.tsx            — Add price dialog
    article-import-dialog.tsx           — CSV import 3-step modal
    article-autocomplete.tsx            — Reusable autocomplete
    price-comparison-panel.tsx          — Multi-vendor price panel
    unresolved-code-badge.tsx           — Amber badge + resolution panel
  hooks/
    use-articles.ts                     — React Query hooks
    use-article-search.ts              — Autocomplete hook with debounce
  lib/
    validations/article.ts              — Zod schemas
    constants/article.ts                — Status configs, alias type configs
  server/services/
    article.service.ts                  — Pure business logic
    article-db.service.ts               — DB queries, code generation
    article-resolver.service.ts         — Code resolution (3-step)
    article-import.service.ts           — CSV parsing and import logic
  types/
    index.ts                            — Add ArticleListItem, ArticleDetail, etc.
```

---

## 9. Non-Goals (Explicitly Out of Scope)

- Article hierarchy / category tree CRUD
- Article versioning / revision history
- Barcode/QR scanning integration
- Automatic vendor catalog sync via API
- Article images / technical drawings
- BOM (Bill of Materials) / product structure
- Article approval workflow
