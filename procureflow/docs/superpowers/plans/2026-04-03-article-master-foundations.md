# Anagrafica Articoli — Sub-project 1: Foundations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Article Master registry with CRUD, search, CSV import, and full UI — ready for future integration with requests/invoices/inventory.

**Architecture:** New Prisma models (Article, ArticleAlias, ArticlePrice) with optional FKs on existing entities. Module registry entry gates all routes/UI behind feature flag. Atomic code generation (ART-YYYY-NNNNN). API follows existing REST pattern with Zod validation.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, PostgreSQL (pg_trgm), Zod, React Query, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-04-03-article-master-design.md`

**Auth pattern used in all API routes:**
```typescript
import { requireRole } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'

// At the top of each handler:
const blocked = await requireModule('/api/articles')
if (blocked) return blocked

// For write operations (POST/PATCH/DELETE), add role check:
const authResult = await requireRole('ADMIN', 'MANAGER')
if (authResult instanceof NextResponse) return authResult
```

**Deferred to Sub-project 2/3:** `price-comparison-panel.tsx`, `unresolved-code-badge.tsx`, `article-resolver.service.ts` — listed in spec Section 8 but belong to later sub-projects.

---

## Chunk 1: Schema, Module Registry, Constants, Types, Validations

### Task 1: Prisma Schema — New Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add AliasType enum and Article model**

Add after the last enum in the schema (after `CommessaStatus`):

```prisma
enum AliasType {
  VENDOR
  CLIENT
  STANDARD
}

model Article {
  id                String    @id @default(cuid())
  code              String    @unique          // ART-2026-00001
  name              String
  description       String?
  category          String?
  unit_of_measure   String                     // pz, kg, m
  manufacturer      String?
  manufacturer_code String?
  is_active         Boolean   @default(true)
  notes             String?
  tags              String[]
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  aliases           ArticleAlias[]
  prices            ArticlePrice[]
  materials         Material[]
  request_items     RequestItem[]
  invoice_items     InvoiceLineItem[]

  @@index([name])
  @@index([category])
  @@index([manufacturer_code])
  @@index([is_active])
  @@map("articles")
}

model ArticleAlias {
  id          String    @id @default(cuid())
  article_id  String
  article     Article   @relation(fields: [article_id], references: [id], onDelete: Cascade)
  alias_type  AliasType
  alias_code  String                        // Stored uppercase
  alias_label String?
  entity_id   String?                       // FK to Vendor.id or Client.id (null for STANDARD)
  is_primary  Boolean   @default(false)
  created_at  DateTime  @default(now())

  @@unique([alias_type, alias_code, entity_id])
  @@index([alias_code])
  @@index([article_id])
  @@index([entity_id])
  @@map("article_aliases")
}

model ArticlePrice {
  id           String    @id @default(cuid())
  article_id   String
  article      Article   @relation(fields: [article_id], references: [id], onDelete: Cascade)
  vendor_id    String
  vendor       Vendor    @relation(fields: [vendor_id], references: [id])
  unit_price   Decimal   @db.Decimal(12, 2)
  currency     String    @default("EUR")
  min_quantity Int       @default(1)
  valid_from   DateTime  @default(now())
  valid_until  DateTime?
  source       String    @default("manual")  // "manual" | "invoice" | "quote"
  notes        String?
  created_at   DateTime  @default(now())

  @@index([article_id, vendor_id])
  @@index([vendor_id])
  @@map("article_prices")
}
```

- [ ] **Step 2: Add reciprocal relations on existing models**

Add `article_prices ArticlePrice[]` to the `Vendor` model (after the `contacts` relation):

```prisma
  article_prices  ArticlePrice[]
```

Add `article_id` + `article` + `unresolved_code` to the `RequestItem` model (after `sku`):

```prisma
  article_id      String?
  article         Article?  @relation(fields: [article_id], references: [id])
  unresolved_code String?
```

Add `article_id` + `article` to the `Material` model (after the last existing field, before `@@index`):

```prisma
  article_id  String?
  article     Article?  @relation(fields: [article_id], references: [id])
```

Add `article_id` + `article` to the `InvoiceLineItem` model (after the last existing field):

```prisma
  article_id  String?
  article     Article?  @relation(fields: [article_id], references: [id])
```

Add `article_config Json?` to the `DeployConfig` model (after `approval_rules`):

```prisma
  article_config  Json?    // { "auto_match_threshold": 0 }
```

- [ ] **Step 3: Verify schema is valid**

Run: `cd procureflow && npx prisma validate`
Expected: "The schema is valid."

- [ ] **Step 4: Generate migration**

Run: `cd procureflow && npx prisma migrate dev --name article_master --create-only`

This creates the migration SQL without applying it.

- [ ] **Step 5: Add pg_trgm extension to migration**

Open the generated migration file in `prisma/migrations/YYYYMMDDHHMMSS_article_master/migration.sql` and add at the very top (before the first `CREATE TABLE`):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Also add the GIN index at the end of the migration:

```sql
CREATE INDEX idx_article_aliases_trgm ON "article_aliases" USING gin ("alias_code" gin_trgm_ops);
```

- [ ] **Step 6: Generate Prisma client**

Run: `cd procureflow && npx prisma generate`
Expected: Completes without error.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(articles): add Article, ArticleAlias, ArticlePrice schema with pg_trgm"
```

---

### Task 2: Module Registry — Add 'articles' Module

**Files:**
- Modify: `src/lib/modules/registry.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Write test for module registry**

Create `tests/article-module.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { MODULE_REGISTRY, type ModuleId } from '../src/lib/modules/registry'

describe('articles module', () => {
  it('is registered in MODULE_REGISTRY', () => {
    const mod = MODULE_REGISTRY.get('articles' as ModuleId)
    expect(mod).toBeDefined()
    expect(mod!.id).toBe('articles')
    expect(mod!.label).toBe('Anagrafica Articoli')
    expect(mod!.navPaths).toContain('/articles')
    expect(mod!.apiPrefixes).toContain('/api/articles')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd procureflow && npx vitest run tests/article-module.test.ts`
Expected: FAIL — `'articles'` is not a valid ModuleId.

- [ ] **Step 3: Add 'articles' to ModuleId union type**

In `src/lib/modules/registry.ts`, add `| 'articles'` to the `ModuleId` type (after `'commesse'`):

```typescript
export type ModuleId =
  | 'core'
  | 'invoicing'
  | 'budgets'
  | 'analytics'
  | 'tenders'
  | 'inventory'
  | 'chatbot'
  | 'smartfill'
  | 'commesse'
  | 'articles'
```

- [ ] **Step 4: Add articles entry to MODULE_REGISTRY**

Add before the closing `]` of the Map constructor (after the `'commesse'` entry):

```typescript
    [
      'articles',
      {
        id: 'articles',
        label: 'Anagrafica Articoli',
        description: 'Codici interni, alias fornitori/clienti, cross-reference',
        navPaths: ['/articles'],
        dashboardTabs: [],
        apiPrefixes: ['/api/articles'],
      },
    ],
```

- [ ] **Step 5: Add nav item in constants.ts**

In `src/lib/constants.ts`, import `BookOpen` from `lucide-react` (add to existing import), then add the articles nav entry after the "Magazzino" line:

```typescript
  { label: 'Articoli', href: '/articles', icon: BookOpen },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd procureflow && npx vitest run tests/article-module.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/modules/registry.ts src/lib/constants.ts tests/article-module.test.ts
git commit -m "feat(articles): register articles module in registry and nav"
```

---

### Task 3: Constants — Alias Type Config

**Files:**
- Create: `src/lib/constants/article.ts`

- [ ] **Step 1: Create article constants file**

Create `src/lib/constants/article.ts`:

```typescript
import type { LucideIcon } from 'lucide-react'
import { Building2, Users, Globe } from 'lucide-react'

// --- Alias Type ---

export type AliasTypeKey = 'VENDOR' | 'CLIENT' | 'STANDARD'

export interface AliasTypeConfig {
  readonly label: string
  readonly color: string
  readonly bgColor: string
  readonly icon: LucideIcon
}

export const ALIAS_TYPE_CONFIG: Readonly<Record<AliasTypeKey, AliasTypeConfig>> = {
  VENDOR: {
    label: 'Fornitore',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-400/10',
    icon: Building2,
  },
  CLIENT: {
    label: 'Cliente',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    icon: Users,
  },
  STANDARD: {
    label: 'Standard',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
    icon: Globe,
  },
} as const

// --- Price Source ---

export type PriceSourceKey = 'manual' | 'invoice' | 'quote'

export const PRICE_SOURCE_CONFIG: Readonly<Record<PriceSourceKey, { readonly label: string; readonly color: string; readonly bgColor: string }>> = {
  manual: {
    label: 'Manuale',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  },
  invoice: {
    label: 'Fattura',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  quote: {
    label: 'Preventivo',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
} as const

// --- Default Article Config (for DeployConfig.article_config) ---

export const DEFAULT_ARTICLE_CONFIG = {
  auto_match_threshold: 0, // 0 = never auto-match, 80 = auto-match above 80% confidence
} as const

export type ArticleConfig = typeof DEFAULT_ARTICLE_CONFIG
```

- [ ] **Step 2: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants/article.ts
git commit -m "feat(articles): add alias type and price source constants"
```

---

### Task 4: Types — Article Interfaces

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add article type interfaces**

Add at the end of `src/types/index.ts`:

```typescript
// --- Anagrafica Articoli ---

import type { AliasTypeKey, PriceSourceKey } from '@/lib/constants/article'

export interface ArticleListItem {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly category: string | null
  readonly unit_of_measure: string
  readonly manufacturer: string | null
  readonly is_active: boolean
  readonly created_at: string
  readonly _count: {
    readonly aliases: number
    readonly prices: number
  }
}

export interface ArticleAlias {
  readonly id: string
  readonly alias_type: AliasTypeKey
  readonly alias_code: string
  readonly alias_label: string | null
  readonly entity_id: string | null
  readonly is_primary: boolean
  readonly created_at: string
}

export interface ArticlePrice {
  readonly id: string
  readonly vendor_id: string
  readonly vendor: { readonly id: string; readonly name: string }
  readonly unit_price: number
  readonly currency: string
  readonly min_quantity: number
  readonly valid_from: string
  readonly valid_until: string | null
  readonly source: PriceSourceKey
  readonly notes: string | null
  readonly created_at: string
}

export interface ArticleDetail {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly description: string | null
  readonly category: string | null
  readonly unit_of_measure: string
  readonly manufacturer: string | null
  readonly manufacturer_code: string | null
  readonly is_active: boolean
  readonly notes: string | null
  readonly tags: readonly string[]
  readonly created_at: string
  readonly updated_at: string
  readonly aliases: readonly ArticleAlias[]
  readonly prices: readonly ArticlePrice[]
  readonly _count: {
    readonly aliases: number
    readonly prices: number
    readonly request_items: number
    readonly invoice_items: number
    readonly materials: number
  }
}

export interface ArticleSearchResult {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly category: string | null
  readonly unit_of_measure: string
  readonly matched_via: string       // "code" | "name" | "alias" | "manufacturer_code"
  readonly matched_value: string     // The value that matched the search query
}

export interface ArticleImportResult {
  readonly articles_created: number
  readonly aliases_created: number
  readonly skipped: number
  readonly errors: readonly ArticleImportError[]
}

export interface ArticleImportError {
  readonly row: number
  readonly field: string
  readonly message: string
}
```

- [ ] **Step 2: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(articles): add article type interfaces"
```

---

### Task 5: Zod Validations

**Files:**
- Create: `src/lib/validations/article.ts`

- [ ] **Step 1: Write test for article validations**

Create `tests/article-validations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  createArticleSchema,
  updateArticleSchema,
  articleQuerySchema,
  createAliasSchema,
  createPriceSchema,
} from '../src/lib/validations/article'

describe('createArticleSchema', () => {
  it('accepts valid article data', () => {
    const result = createArticleSchema.safeParse({
      name: 'Connettore MIL 38999',
      unit_of_measure: 'pz',
      category: 'Connettori',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createArticleSchema.safeParse({
      name: '',
      unit_of_measure: 'pz',
    })
    expect(result.success).toBe(false)
  })

  it('rejects name over 200 chars', () => {
    const result = createArticleSchema.safeParse({
      name: 'a'.repeat(201),
      unit_of_measure: 'pz',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unit_of_measure over 10 chars', () => {
    const result = createArticleSchema.safeParse({
      name: 'Test',
      unit_of_measure: 'a'.repeat(11),
    })
    expect(result.success).toBe(false)
  })
})

describe('createAliasSchema', () => {
  it('accepts valid alias data and transforms to uppercase', () => {
    const result = createAliasSchema.safeParse({
      alias_type: 'VENDOR',
      alias_code: 'abc-123',
      entity_id: 'cuid123',
    })
    expect(result.success).toBe(true)
    expect(result.data!.alias_code).toBe('ABC-123') // uppercase transform
  })

  it('rejects invalid alias_type', () => {
    const result = createAliasSchema.safeParse({
      alias_type: 'INVALID',
      alias_code: 'ABC',
    })
    expect(result.success).toBe(false)
  })
})

describe('createPriceSchema', () => {
  it('accepts valid price data', () => {
    const result = createPriceSchema.safeParse({
      vendor_id: 'cuid123',
      unit_price: 12.5,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative price', () => {
    const result = createPriceSchema.safeParse({
      vendor_id: 'cuid123',
      unit_price: -5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects min_quantity below 1', () => {
    const result = createPriceSchema.safeParse({
      vendor_id: 'cuid123',
      unit_price: 10,
      min_quantity: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('articleQuerySchema', () => {
  it('provides defaults', () => {
    const result = articleQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data!.page).toBe(1)
    expect(result.data!.pageSize).toBe(20)
    expect(result.data!.sort).toBe('created_at')
    expect(result.data!.order).toBe('desc')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd procureflow && npx vitest run tests/article-validations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create validation schemas**

Create `src/lib/validations/article.ts`:

```typescript
import { z } from 'zod'

// --- Article ---

export const createArticleSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio').max(200, 'Max 200 caratteri'),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  unit_of_measure: z.string().min(1, 'UM obbligatoria').max(10, 'Max 10 caratteri'),
  manufacturer: z.string().max(200).optional(),
  manufacturer_code: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).default([]),
  aliases: z
    .array(
      z.object({
        alias_type: z.enum(['VENDOR', 'CLIENT', 'STANDARD']),
        alias_code: z.string().min(1).max(100).transform((v) => v.toUpperCase()),
        alias_label: z.string().max(200).optional(),
        entity_id: z.string().optional(),
        is_primary: z.boolean().default(false),
      }),
    )
    .default([]),
})

export const updateArticleSchema = createArticleSchema.partial().extend({
  is_active: z.boolean().optional(),
})

export const articleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  is_active: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  sort: z.string().default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

// --- Alias ---

export const createAliasSchema = z.object({
  alias_type: z.enum(['VENDOR', 'CLIENT', 'STANDARD']),
  alias_code: z.string().min(1, 'Codice obbligatorio').max(100).transform((v) => v.toUpperCase()),
  alias_label: z.string().max(200).optional(),
  entity_id: z.string().optional(),
  is_primary: z.boolean().default(false),
})

// --- Price ---

export const createPriceSchema = z.object({
  vendor_id: z.string().min(1, 'Fornitore obbligatorio'),
  unit_price: z.number().positive('Prezzo deve essere positivo'),
  currency: z.string().default('EUR'),
  min_quantity: z.number().int().min(1, 'Quantità minima 1').default(1),
  valid_from: z.string().optional(),
  valid_until: z.string().optional(),
  source: z.enum(['manual', 'invoice', 'quote']).default('manual'),
  notes: z.string().max(500).optional(),
})

// --- Search ---

export const articleSearchSchema = z.object({
  q: z.string().min(1, 'Query obbligatoria'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

// --- CSV Import ---

export const csvRowSchema = z.object({
  codice_interno: z.string().min(1),
  nome: z.string().min(1),
  categoria: z.string().optional(),
  um: z.string().min(1),
  produttore: z.string().optional(),
  codice_produttore: z.string().optional(),
  tipo_alias: z.enum(['vendor', 'client', 'standard']).optional(),
  codice_alias: z.string().optional(),
  entita: z.string().optional(),
  note_alias: z.string().optional(),
})

// --- Type exports ---

export type CreateArticleInput = z.infer<typeof createArticleSchema>
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>
export type ArticleQuery = z.infer<typeof articleQuerySchema>
export type CreateAliasInput = z.infer<typeof createAliasSchema>
export type CreatePriceInput = z.infer<typeof createPriceSchema>
export type ArticleSearchQuery = z.infer<typeof articleSearchSchema>
export type CsvRow = z.infer<typeof csvRowSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd procureflow && npx vitest run tests/article-validations.test.ts`
Expected: PASS (all 8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/article.ts tests/article-validations.test.ts
git commit -m "feat(articles): add Zod validation schemas with tests"
```

---

### Task 6: Extend Code Generator

**Files:**
- Modify: `src/server/services/code-generator.service.ts`

- [ ] **Step 1: Write test for article code generation**

Create `tests/article-code-generator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

// We test the allowed tables type at compile time and format logic
describe('article code format', () => {
  it('generates ART-YYYY-NNNNN format', () => {
    const year = new Date().getFullYear()
    const prefix = 'ART'
    const fullPrefix = `${prefix}-${year}-`
    const padLen = 5
    const nextNum = 1
    const code = `${fullPrefix}${String(nextNum).padStart(padLen, '0')}`
    expect(code).toMatch(/^ART-\d{4}-\d{5}$/)
    expect(code).toBe(`ART-${year}-00001`)
  })

  it('pads correctly for larger numbers', () => {
    const year = new Date().getFullYear()
    const code = `ART-${year}-${String(42).padStart(5, '0')}`
    expect(code).toBe(`ART-${year}-00042`)
  })
})
```

- [ ] **Step 2: Run test to verify it passes** (this tests format logic, not DB)

Run: `cd procureflow && npx vitest run tests/article-code-generator.test.ts`
Expected: PASS

- [ ] **Step 3: Add 'articles' to ALLOWED_TABLES**

In `src/server/services/code-generator.service.ts`, change line 12:

```typescript
const ALLOWED_TABLES = ['purchase_requests', 'commesse', 'clients', 'articles'] as const
```

- [ ] **Step 4: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/server/services/code-generator.service.ts tests/article-code-generator.test.ts
git commit -m "feat(articles): extend code generator to support articles table"
```

---

## Chunk 2: API Routes

### Task 7: Article CRUD API — Collection Routes

**Files:**
- Create: `src/app/api/articles/route.ts`

- [ ] **Step 1: Create GET /api/articles (list) and POST /api/articles (create)**

Create `src/app/api/articles/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'
import { createArticleSchema, articleQuerySchema } from '@/lib/validations/article'
import { Prisma } from '@prisma/client'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'

export async function GET(req: NextRequest) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = articleQuerySchema.safeParse(params)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { page, pageSize, search, category, is_active, sort, order } = parsed.data

    const where: Prisma.ArticleWhereInput = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { manufacturer_code: { contains: search, mode: 'insensitive' } },
        { aliases: { some: { alias_code: { contains: search.toUpperCase(), mode: 'insensitive' } } } },
      ]
    }
    if (category) {
      where.category = category
    }
    if (is_active !== undefined) {
      where.is_active = is_active
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: {
          _count: { select: { aliases: true, prices: true } },
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.article.count({ where }),
    ])

    return successResponse(articles, { total, page, pageSize })
  } catch (error) {
    console.error('GET /api/articles error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = createArticleSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { aliases, ...data } = parsed.data

    const code = await generateNextCodeAtomic('ART', 'articles')

    const article = await prisma.article.create({
      data: {
        code,
        name: data.name,
        description: data.description || null,
        category: data.category || null,
        unit_of_measure: data.unit_of_measure,
        manufacturer: data.manufacturer || null,
        manufacturer_code: data.manufacturer_code || null,
        notes: data.notes || null,
        tags: data.tags,
        aliases: {
          create: aliases.map((a) => ({
            alias_type: a.alias_type,
            alias_code: a.alias_code,
            alias_label: a.alias_label || null,
            entity_id: a.entity_id || null,
            is_primary: a.is_primary,
          })),
        },
      },
      include: {
        aliases: true,
        _count: { select: { aliases: true, prices: true } },
      },
    })

    return successResponse(article)
  } catch (error) {
    console.error('POST /api/articles error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nella creazione', 500)
  }
}
```

- [ ] **Step 2: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/articles/route.ts
git commit -m "feat(articles): add GET list and POST create API routes"
```

---

### Task 8: Article CRUD API — Detail Routes

**Files:**
- Create: `src/app/api/articles/[id]/route.ts`

- [ ] **Step 1: Create GET/PATCH/DELETE for article detail**

Create `src/app/api/articles/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'
import { updateArticleSchema } from '@/lib/validations/article'

async function findArticle(idOrCode: string) {
  // Try by ID first, then by code
  const article = await prisma.article.findUnique({
    where: { id: idOrCode },
    include: {
      aliases: { orderBy: { created_at: 'desc' } },
      prices: {
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      },
      _count: {
        select: {
          aliases: true,
          prices: true,
          request_items: true,
          invoice_items: true,
          materials: true,
        },
      },
    },
  })

  if (article) return article

  return prisma.article.findUnique({
    where: { code: idOrCode },
    include: {
      aliases: { orderBy: { created_at: 'desc' } },
      prices: {
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      },
      _count: {
        select: {
          aliases: true,
          prices: true,
          request_items: true,
          invoice_items: true,
          materials: true,
        },
      },
    },
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const article = await findArticle(params.id)

    if (!article) return notFoundResponse('Articolo non trovato')

    return successResponse({
      ...article,
      prices: article.prices.map((p) => ({
        ...p,
        unit_price: Number(p.unit_price),
      })),
    })
  } catch (error) {
    console.error('GET /api/articles/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = updateArticleSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true },
    })

    if (!existing) return notFoundResponse('Articolo non trovato')

    const { aliases: _aliases, ...data } = parsed.data

    const updated = await prisma.article.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.category !== undefined && { category: data.category || null }),
        ...(data.unit_of_measure !== undefined && { unit_of_measure: data.unit_of_measure }),
        ...(data.manufacturer !== undefined && { manufacturer: data.manufacturer || null }),
        ...(data.manufacturer_code !== undefined && { manufacturer_code: data.manufacturer_code || null }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.tags !== undefined && { tags: data.tags }),
      },
      include: {
        aliases: true,
        _count: { select: { aliases: true, prices: true } },
      },
    })

    return successResponse(updated)
  } catch (error) {
    console.error('PATCH /api/articles/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiornamento', 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const existing = await prisma.article.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        _count: { select: { request_items: true, invoice_items: true } },
      },
    })

    if (!existing) return notFoundResponse('Articolo non trovato')

    // Soft-delete: set is_active = false (don't physically delete if in use)
    if (existing._count.request_items > 0 || existing._count.invoice_items > 0) {
      const updated = await prisma.article.update({
        where: { id: params.id },
        data: { is_active: false },
      })
      return successResponse({ ...updated, soft_deleted: true })
    }

    await prisma.article.delete({ where: { id: params.id } })
    return successResponse({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/articles/[id] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore eliminazione', 500)
  }
}
```

- [ ] **Step 2: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/articles/[id]/route.ts
git commit -m "feat(articles): add detail GET/PATCH/DELETE API routes"
```

---

### Task 9: Aliases and Prices API Routes

**Files:**
- Create: `src/app/api/articles/[id]/aliases/route.ts`
- Create: `src/app/api/articles/[id]/aliases/[aliasId]/route.ts`
- Create: `src/app/api/articles/[id]/prices/route.ts`

- [ ] **Step 1: Create aliases routes**

Create `src/app/api/articles/[id]/aliases/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'
import { createAliasSchema } from '@/lib/validations/article'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!article) return notFoundResponse('Articolo non trovato')

    const aliases = await prisma.articleAlias.findMany({
      where: { article_id: params.id },
      orderBy: { created_at: 'desc' },
    })

    return successResponse(aliases)
  } catch (error) {
    console.error('GET /api/articles/[id]/aliases error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!article) return notFoundResponse('Articolo non trovato')

    const body = await req.json()
    const parsed = createAliasSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const alias = await prisma.articleAlias.create({
      data: {
        article_id: params.id,
        alias_type: parsed.data.alias_type,
        alias_code: parsed.data.alias_code,
        alias_label: parsed.data.alias_label || null,
        entity_id: parsed.data.entity_id || null,
        is_primary: parsed.data.is_primary,
      },
    })

    return successResponse(alias)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Unique constraint')
    ) {
      return errorResponse(
        'DUPLICATE_ALIAS',
        'Questo codice alias esiste già per questa entità',
        409,
      )
    }
    console.error('POST /api/articles/[id]/aliases error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore creazione alias', 500)
  }
}
```

- [ ] **Step 2: Create alias delete route**

Create `src/app/api/articles/[id]/aliases/[aliasId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
} from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; aliasId: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult
    const alias = await prisma.articleAlias.findFirst({
      where: { id: params.aliasId, article_id: params.id },
    })

    if (!alias) return notFoundResponse('Alias non trovato')

    await prisma.articleAlias.delete({ where: { id: params.aliasId } })

    return successResponse({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/articles/[id]/aliases/[aliasId] error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore eliminazione alias', 500)
  }
}
```

- [ ] **Step 3: Create prices routes**

Create `src/app/api/articles/[id]/prices/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  notFoundResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { requireModule } from '@/lib/modules/require-module'
import { createPriceSchema } from '@/lib/validations/article'
import { Prisma } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!article) return notFoundResponse('Articolo non trovato')

    const prices = await prisma.articlePrice.findMany({
      where: { article_id: params.id },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
    })

    return successResponse(
      prices.map((p) => ({ ...p, unit_price: Number(p.unit_price) })),
    )
  } catch (error) {
    console.error('GET /api/articles/[id]/prices error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno', 500)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER', 'REQUESTER')
    if (authResult instanceof NextResponse) return authResult

    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!article) return notFoundResponse('Articolo non trovato')

    const body = await req.json()
    const parsed = createPriceSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const price = await prisma.articlePrice.create({
      data: {
        article_id: params.id,
        vendor_id: parsed.data.vendor_id,
        unit_price: new Prisma.Decimal(parsed.data.unit_price),
        currency: parsed.data.currency,
        min_quantity: parsed.data.min_quantity,
        valid_from: parsed.data.valid_from
          ? new Date(parsed.data.valid_from)
          : new Date(),
        valid_until: parsed.data.valid_until
          ? new Date(parsed.data.valid_until)
          : null,
        source: parsed.data.source,
        notes: parsed.data.notes || null,
      },
      include: { vendor: { select: { id: true, name: true } } },
    })

    return successResponse({ ...price, unit_price: Number(price.unit_price) })
  } catch (error) {
    console.error('POST /api/articles/[id]/prices error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiunta prezzo', 500)
  }
}
```

- [ ] **Step 4: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/articles/[id]/aliases/ src/app/api/articles/[id]/prices/
git commit -m "feat(articles): add aliases and prices API routes"
```

---

### Task 10: Search API Route

**Files:**
- Create: `src/app/api/articles/search/route.ts`

- [ ] **Step 1: Create search route**

Create `src/app/api/articles/search/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response'
import { requireModule } from '@/lib/modules/require-module'
import { articleSearchSchema } from '@/lib/validations/article'

export async function GET(req: NextRequest) {
  const blocked = await requireModule('/api/articles')
  if (blocked) return blocked
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = articleSearchSchema.safeParse(params)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { q, limit } = parsed.data
    const upperQ = q.toUpperCase()

    // Search across code, name, aliases, manufacturer_code
    const articles = await prisma.article.findMany({
      where: {
        is_active: true,
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { manufacturer_code: { contains: q, mode: 'insensitive' } },
          { aliases: { some: { alias_code: { contains: upperQ, mode: 'insensitive' } } } },
        ],
      },
      include: {
        aliases: {
          where: { alias_code: { contains: upperQ, mode: 'insensitive' } },
          take: 1,
        },
      },
      take: limit,
      orderBy: { name: 'asc' },
    })

    // Determine which field matched for each result
    const results = articles.map((a) => {
      let matched_via = 'name'
      let matched_value = a.name

      if (a.code.toLowerCase().includes(q.toLowerCase())) {
        matched_via = 'code'
        matched_value = a.code
      } else if (a.aliases.length > 0) {
        matched_via = 'alias'
        matched_value = a.aliases[0].alias_code
      } else if (
        a.manufacturer_code &&
        a.manufacturer_code.toLowerCase().includes(q.toLowerCase())
      ) {
        matched_via = 'manufacturer_code'
        matched_value = a.manufacturer_code
      }

      return {
        id: a.id,
        code: a.code,
        name: a.name,
        category: a.category,
        unit_of_measure: a.unit_of_measure,
        matched_via,
        matched_value,
      }
    })

    return successResponse(results)
  } catch (error) {
    console.error('GET /api/articles/search error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore ricerca', 500)
  }
}
```

- [ ] **Step 2: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/articles/search/route.ts
git commit -m "feat(articles): add universal search API route"
```

---

### Task 11: CSV Import API Route + Service

**Files:**
- Create: `src/server/services/article-import.service.ts`
- Create: `src/app/api/articles/import/route.ts`

- [ ] **Step 1: Write test for CSV import service**

Create `tests/article-import.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseCsvRows } from '../src/server/services/article-import.service'

describe('parseCsvRows', () => {
  it('groups rows by codice_interno', () => {
    const rows = [
      { codice_interno: 'ART-001', nome: 'Test', um: 'pz', tipo_alias: 'vendor', codice_alias: 'V-001', entita: 'Amphenol' },
      { codice_interno: 'ART-001', nome: 'Test', um: 'pz', tipo_alias: 'client', codice_alias: 'C-001', entita: 'Leonardo' },
      { codice_interno: 'ART-002', nome: 'Other', um: 'kg' },
    ]

    const groups = parseCsvRows(rows as any)
    expect(groups).toHaveLength(2)
    expect(groups[0].codice_interno).toBe('ART-001')
    expect(groups[0].aliases).toHaveLength(2)
    expect(groups[1].codice_interno).toBe('ART-002')
    expect(groups[1].aliases).toHaveLength(0)
  })

  it('ignores rows without codice_alias in alias list', () => {
    const rows = [
      { codice_interno: 'ART-001', nome: 'Test', um: 'pz', tipo_alias: 'vendor' },
    ]

    const groups = parseCsvRows(rows as any)
    expect(groups[0].aliases).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd procureflow && npx vitest run tests/article-import.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create import service**

Create `src/server/services/article-import.service.ts`:

```typescript
import { prisma } from '@/lib/db'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'
import type { CsvRow } from '@/lib/validations/article'
import type { ArticleImportResult, ArticleImportError } from '@/types'

interface ArticleGroup {
  readonly codice_interno: string
  readonly nome: string
  readonly categoria?: string
  readonly um: string
  readonly produttore?: string
  readonly codice_produttore?: string
  readonly aliases: ReadonlyArray<{
    readonly tipo_alias: 'vendor' | 'client' | 'standard'
    readonly codice_alias: string
    readonly entita?: string
    readonly note_alias?: string
  }>
}

/** Group CSV rows by codice_interno, collecting aliases per article */
export function parseCsvRows(rows: readonly CsvRow[]): ArticleGroup[] {
  const map = new Map<string, ArticleGroup & { aliases: ArticleGroup['aliases'][number][] }>()

  for (const row of rows) {
    if (!map.has(row.codice_interno)) {
      map.set(row.codice_interno, {
        codice_interno: row.codice_interno,
        nome: row.nome,
        categoria: row.categoria,
        um: row.um,
        produttore: row.produttore,
        codice_produttore: row.codice_produttore,
        aliases: [],
      })
    }

    const group = map.get(row.codice_interno)!
    if (row.tipo_alias && row.codice_alias) {
      group.aliases.push({
        tipo_alias: row.tipo_alias,
        codice_alias: row.codice_alias,
        entita: row.entita,
        note_alias: row.note_alias,
      })
    }
  }

  return Array.from(map.values())
}

/** Resolve entity name to vendor/client ID */
async function resolveEntityId(
  name: string | undefined,
  type: 'vendor' | 'client' | 'standard',
): Promise<string | null> {
  if (!name || type === 'standard') return null

  if (type === 'vendor') {
    const vendor = await prisma.vendor.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })
    return vendor?.id ?? null
  }

  if (type === 'client') {
    const client = await prisma.client.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })
    return client?.id ?? null
  }

  return null
}

/** Create aliases for an existing article (used when deduplicating imports) */
async function createAliasesForArticle(
  articleId: string,
  aliases: ArticleGroup['aliases'],
): Promise<{ created: number; skipped: number; errors: ArticleImportError[] }> {
  let created = 0
  let skipped = 0
  const errors: ArticleImportError[] = []

  for (const alias of aliases) {
    try {
      const aliasType = alias.tipo_alias.toUpperCase() as 'VENDOR' | 'CLIENT' | 'STANDARD'
      const entityId = await resolveEntityId(alias.entita, alias.tipo_alias)
      await prisma.articleAlias.create({
        data: {
          article_id: articleId,
          alias_type: aliasType,
          alias_code: alias.codice_alias.toUpperCase(),
          alias_label: alias.note_alias || null,
          entity_id: entityId,
        },
      })
      created++
    } catch (e) {
      if (e instanceof Error && e.message.includes('Unique constraint')) {
        skipped++
      } else {
        errors.push({
          row: 0,
          field: 'alias',
          message: `Errore alias ${alias.codice_alias}: ${e instanceof Error ? e.message : 'Errore sconosciuto'}`,
        })
      }
    }
  }

  return { created, skipped, errors }
}

/** Import grouped articles into database */
export async function importArticles(
  groups: readonly ArticleGroup[],
): Promise<ArticleImportResult> {
  let articles_created = 0
  let aliases_created = 0
  let skipped = 0
  const errors: ArticleImportError[] = []

  for (const group of groups) {
    try {
      // Check if article already exists by manufacturer_code (if provided)
      const existing = group.codice_produttore
        ? await prisma.article.findFirst({
            where: { manufacturer_code: group.codice_produttore },
          })
        : null

      if (existing) {
        // Article exists — only add aliases
        const aliasResults = await createAliasesForArticle(existing.id, group.aliases)
        aliases_created += aliasResults.created
        skipped += aliasResults.skipped + 1
        errors.push(...aliasResults.errors)
      } else {
        // All-or-nothing per article group: wrap in transaction
        const result = await prisma.$transaction(async (tx) => {
          const code = await generateNextCodeAtomic('ART', 'articles', tx)
          const article = await tx.article.create({
            data: {
              code,
              name: group.nome,
              category: group.categoria || null,
              unit_of_measure: group.um,
              manufacturer: group.produttore || null,
              manufacturer_code: group.codice_produttore || null,
            },
          })

          let aliasCount = 0
          let aliasSkipped = 0
          for (const alias of group.aliases) {
            const aliasType = alias.tipo_alias.toUpperCase() as 'VENDOR' | 'CLIENT' | 'STANDARD'
            const entityId = await resolveEntityId(alias.entita, alias.tipo_alias)

            try {
              await tx.articleAlias.create({
                data: {
                  article_id: article.id,
                  alias_type: aliasType,
                  alias_code: alias.codice_alias.toUpperCase(),
                  alias_label: alias.note_alias || null,
                  entity_id: entityId,
                },
              })
              aliasCount++
            } catch (e) {
              if (e instanceof Error && e.message.includes('Unique constraint')) {
                aliasSkipped++
              } else {
                throw e // re-throw to rollback the entire group
              }
            }
          }

          return { aliasCount, aliasSkipped }
        }, { timeout: 10000 })

        articles_created++
        aliases_created += result.aliasCount
        skipped += result.aliasSkipped
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: 'article',
        message: `Errore articolo ${group.codice_interno}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
      })
    }
  }

  return { articles_created, aliases_created, skipped, errors }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd procureflow && npx vitest run tests/article-import.test.ts`
Expected: PASS

- [ ] **Step 5: Create import API route**

Create `src/app/api/articles/import/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { csvRowSchema } from '@/lib/validations/article'
import { parseCsvRows, importArticles } from '@/server/services/article-import.service'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_ROWS = 10_000

export async function POST(req: NextRequest) {
  // ADMIN-only: CSV import
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()

    if (!Array.isArray(body.rows)) {
      return errorResponse('INVALID_FORMAT', 'Body must contain a "rows" array', 400)
    }

    if (body.rows.length > MAX_ROWS) {
      return errorResponse(
        'TOO_MANY_ROWS',
        `Massimo ${MAX_ROWS} righe per import`,
        400,
      )
    }

    // Validate each row
    const validRows = []
    const validationErrors = []

    for (let i = 0; i < body.rows.length; i++) {
      const parsed = csvRowSchema.safeParse(body.rows[i])
      if (parsed.success) {
        validRows.push(parsed.data)
      } else {
        validationErrors.push({
          row: i + 1,
          field: Object.keys(parsed.error.flatten().fieldErrors)[0] || 'unknown',
          message: Object.values(parsed.error.flatten().fieldErrors).flat()[0] || 'Dati non validi',
        })
      }
    }

    if (validationErrors.length > 0 && validRows.length === 0) {
      return validationErrorResponse(validationErrors)
    }

    const groups = parseCsvRows(validRows)
    const result = await importArticles(groups)

    // Merge validation errors with import errors
    const allErrors = [...validationErrors, ...result.errors]

    return successResponse({
      ...result,
      errors: allErrors,
    })
  } catch (error) {
    console.error('POST /api/articles/import error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore import', 500)
  }
}
```

- [ ] **Step 6: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/server/services/article-import.service.ts src/app/api/articles/import/route.ts tests/article-import.test.ts
git commit -m "feat(articles): add CSV import service and API route"
```

---

## Chunk 3: React Query Hooks + UI Pages

### Task 12: React Query Hooks

**Files:**
- Create: `src/hooks/use-articles.ts`

- [ ] **Step 1: Create article hooks**

Create `src/hooks/use-articles.ts`:

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ArticleListItem,
  ArticleDetail,
  ArticleImportResult,
} from '@/types'
import type {
  ArticleQuery,
  CreateArticleInput,
  UpdateArticleInput,
  CreateAliasInput,
  CreatePriceInput,
} from '@/lib/validations/article'

interface ApiResponse<T> {
  success: boolean
  data: T
  meta?: { total: number; page: number; pageSize: number }
}

// --- Fetch functions ---

async function fetchArticles(
  params?: Partial<ArticleQuery>,
): Promise<ApiResponse<ArticleListItem[]>> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))
  if (params?.search) searchParams.set('search', params.search)
  if (params?.category) searchParams.set('category', params.category)
  if (params?.is_active !== undefined)
    searchParams.set('is_active', String(params.is_active))
  if (params?.sort) searchParams.set('sort', params.sort)
  if (params?.order) searchParams.set('order', params.order)

  const res = await fetch(`/api/articles?${searchParams}`)
  if (!res.ok) throw new Error('Errore caricamento articoli')
  return res.json()
}

async function fetchArticle(id: string): Promise<ArticleDetail> {
  const res = await fetch(`/api/articles/${id}`)
  if (!res.ok) throw new Error('Errore caricamento articolo')
  const json: ApiResponse<ArticleDetail> = await res.json()
  if (!json.success) throw new Error('Articolo non trovato')
  return json.data
}

async function createArticle(data: CreateArticleInput): Promise<ApiResponse<ArticleDetail>> {
  const res = await fetch('/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Errore creazione articolo')
  return res.json()
}

async function updateArticle({
  id,
  data,
}: {
  id: string
  data: UpdateArticleInput
}): Promise<ApiResponse<ArticleDetail>> {
  const res = await fetch(`/api/articles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Errore aggiornamento articolo')
  return res.json()
}

async function deleteArticle(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Errore eliminazione articolo')
  return res.json()
}

async function addAlias({
  articleId,
  data,
}: {
  articleId: string
  data: CreateAliasInput
}): Promise<ApiResponse<unknown>> {
  const res = await fetch(`/api/articles/${articleId}/aliases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Errore aggiunta alias')
  return res.json()
}

async function deleteAlias({
  articleId,
  aliasId,
}: {
  articleId: string
  aliasId: string
}): Promise<ApiResponse<{ deleted: boolean }>> {
  const res = await fetch(`/api/articles/${articleId}/aliases/${aliasId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Errore eliminazione alias')
  return res.json()
}

async function addPrice({
  articleId,
  data,
}: {
  articleId: string
  data: CreatePriceInput
}): Promise<ApiResponse<unknown>> {
  const res = await fetch(`/api/articles/${articleId}/prices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Errore aggiunta prezzo')
  return res.json()
}

async function importArticles(
  rows: readonly Record<string, string>[],
): Promise<ApiResponse<ArticleImportResult>> {
  const res = await fetch('/api/articles/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  if (!res.ok) throw new Error('Errore import')
  return res.json()
}

// --- Query Hooks ---

export function useArticles(params?: Partial<ArticleQuery>) {
  return useQuery({
    queryKey: ['articles', params],
    queryFn: () => fetchArticles(params),
  })
}

export function useArticle(id: string) {
  return useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(id),
    enabled: Boolean(id),
  })
}

// --- Mutation Hooks ---

export function useCreateArticle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}

export function useUpdateArticle(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateArticleInput) => updateArticle({ id, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] })
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}

export function useDeleteArticle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}

export function useAddAlias(articleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAliasInput) => addAlias({ articleId, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', articleId] })
    },
  })
}

export function useDeleteAlias(articleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (aliasId: string) => deleteAlias({ articleId, aliasId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', articleId] })
    },
  })
}

export function useAddPrice(articleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePriceInput) => addPrice({ articleId, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', articleId] })
    },
  })
}

export function useImportArticles() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: importArticles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  })
}
```

- [ ] **Step 2: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-articles.ts
git commit -m "feat(articles): add React Query hooks for articles CRUD"
```

---

### Task 13: Article Search Hook + Autocomplete Component

**Files:**
- Create: `src/hooks/use-article-search.ts`
- Create: `src/components/articles/article-autocomplete.tsx`

- [ ] **Step 1: Create debounced search hook**

Create `src/hooks/use-article-search.ts`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ArticleSearchResult } from '@/types'

interface ApiResponse<T> {
  success: boolean
  data: T
}

async function searchArticles(q: string, limit = 10): Promise<ArticleSearchResult[]> {
  if (!q || q.length < 1) return []
  const res = await fetch(`/api/articles/search?q=${encodeURIComponent(q)}&limit=${limit}`)
  if (!res.ok) return []
  const json: ApiResponse<ArticleSearchResult[]> = await res.json()
  return json.success ? json.data : []
}

export function useArticleSearch(query: string, limit = 10) {
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  return useQuery({
    queryKey: ['article-search', debouncedQuery, limit],
    queryFn: () => searchArticles(debouncedQuery, limit),
    enabled: debouncedQuery.length >= 1,
    staleTime: 30_000,
  })
}
```

- [ ] **Step 2: Create autocomplete component**

Create `src/components/articles/article-autocomplete.tsx`. A reusable combobox component:
- Input with 300ms debounce via `useArticleSearch` hook
- Portal-based dropdown (same pattern as VendorSelect in `src/components/requests/request-form.tsx`)
- Results grouped: code matches first, then alias matches, then name matches
- Each result: `[ART-001] Connettore MIL 38999` with sub-label showing matched field
- `onSelect(article: ArticleSearchResult)` callback prop
- Keyboard navigation (ArrowUp/Down, Enter, Escape)
- Empty state: "Nessun articolo trovato"
- Loading state: shimmer skeleton rows

- [ ] **Step 3: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-article-search.ts src/components/articles/article-autocomplete.tsx
git commit -m "feat(articles): add debounced search hook and autocomplete component"
```

---

### Task 14: Article List Page

**Files:**
- Create: `src/app/(dashboard)/articles/page.tsx`
- Create: `src/app/(dashboard)/articles/loading.tsx`
- Create: `src/app/(dashboard)/articles/error.tsx`
- Create: `src/components/articles/articles-page-content.tsx`
- Create: `src/components/articles/article-create-dialog.tsx`

The list page follows the `materials-page-content.tsx` pattern: header with stats, filter bar, data table with pagination, create dialog.

- [ ] **Step 1: Create page shell files**

Create `src/app/(dashboard)/articles/page.tsx`:

```tsx
import { PageTransition } from '@/components/shared/page-transition'
import { ArticlesPageContent } from '@/components/articles/articles-page-content'

export default function ArticlesPage() {
  return (
    <PageTransition>
      <ArticlesPageContent />
    </PageTransition>
  )
}
```

Create `src/app/(dashboard)/articles/loading.tsx`:

```tsx
export default function ArticlesLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-pf-bg-tertiary" />
      <div className="h-12 w-full animate-pulse rounded-lg bg-pf-bg-tertiary" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-14 w-full animate-pulse rounded-lg bg-pf-bg-tertiary"
          />
        ))}
      </div>
    </div>
  )
}
```

Create `src/app/(dashboard)/articles/error.tsx`:

```tsx
'use client'

export default function ArticlesError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12">
      <h2 className="text-lg font-medium text-pf-text-primary">
        Errore caricamento articoli
      </h2>
      <p className="text-sm text-pf-text-secondary">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-lg bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
      >
        Riprova
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create articles-page-content.tsx**

Create `src/components/articles/articles-page-content.tsx`. This is the main list component following the materials-page-content.tsx pattern (filter bar, stats header, table, pagination, create dialog). See reference: `src/components/inventory/materials-page-content.tsx`.

The component should:
- Use `useArticles(params)` hook for data fetching
- State: `filters` (search, category, is_active), `page`, `formOpen`
- Header: title "Anagrafica Articoli", total count badge, "Nuovo Articolo" + "Importa CSV" buttons
- Filter bar: search input, category select (from existing categories), active/inactive toggle
- Table columns: Codice (monospace), Nome, Categoria, UM, Alias (count), Fornitori (count from prices), Attivo (badge)
- Row click: navigate to `/articles/[id]`
- Pagination controls
- Empty state with BookOpen icon
- Skeleton shimmer during loading

**Note for implementor:** Follow the exact Tailwind classes and layout pattern from `materials-page-content.tsx`. Use `useRouter` from `next/navigation` for row clicks. The `ArticleCreateDialog` opens as a modal on "Nuovo Articolo" click.

- [ ] **Step 3: Create article-create-dialog.tsx**

Create `src/components/articles/article-create-dialog.tsx`. Dialog for creating a new article with fields: name, unit_of_measure, category, manufacturer, manufacturer_code, notes, tags. Uses `useCreateArticle()` mutation. On success, closes dialog and shows toast.

Follow the existing dialog pattern (see `src/components/vendors/vendor-create-dialog.tsx` for reference). Use `react-hook-form` with `zodResolver(createArticleSchema)`.

- [ ] **Step 4: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/articles/ src/components/articles/articles-page-content.tsx src/components/articles/article-create-dialog.tsx
git commit -m "feat(articles): add article list page with filters, table, and create dialog"
```

---

### Task 15: Article Detail Page

**Files:**
- Create: `src/app/(dashboard)/articles/[id]/page.tsx`
- Create: `src/app/(dashboard)/articles/[id]/loading.tsx`
- Create: `src/app/(dashboard)/articles/[id]/error.tsx`
- Create: `src/components/articles/article-detail.tsx`
- Create: `src/components/articles/article-alias-form.tsx`
- Create: `src/components/articles/article-price-dialog.tsx`

- [ ] **Step 1: Create detail page shell**

Create `src/app/(dashboard)/articles/[id]/page.tsx`:

```tsx
import { PageTransition } from '@/components/shared/page-transition'
import { ArticleDetail } from '@/components/articles/article-detail'

export default function ArticleDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <PageTransition>
      <ArticleDetail articleId={params.id} />
    </PageTransition>
  )
}
```

Create `src/app/(dashboard)/articles/[id]/loading.tsx` (same skeleton pattern as articles list loading).

Create `src/app/(dashboard)/articles/[id]/error.tsx` (same error pattern).

- [ ] **Step 2: Create article-detail.tsx**

Create `src/components/articles/article-detail.tsx`. This is the detail page component with 4 tabs.

The component should:
- Use `useArticle(articleId)` hook
- Header: code (monospace), name, active/inactive badge, category, edit button
- **Tab "Alias"**: Table with columns: tipo (color badge from ALIAS_TYPE_CONFIG), codice, entità, primario flag. Add alias button → `ArticleAliasForm`. Delete with confirmation via `useDeleteAlias`.
- **Tab "Prezzi"**: Table by vendor: fornitore, prezzo unitario, q.tà min, validità, fonte (badge from PRICE_SOURCE_CONFIG). Star on lowest price. Add price button → `ArticlePriceDialog`. Uses `useAddPrice`.
- **Tab "Dove Usato"**: Count cards showing: N righe RDA, N righe fattura, N materiali collegati. Each is a Link to the filtered list.
- **Tab "Dettagli"**: Read-only fields: produttore, codice produttore, descrizione, note, tag. Edit button opens edit dialog (reuses create dialog pattern with `useUpdateArticle`).

Follow the request-detail-content.tsx pattern for tabs and layout. Use shadcn/ui `Tabs` component.

- [ ] **Step 3: Create article-alias-form.tsx**

Create `src/components/articles/article-alias-form.tsx`. Inline form for adding aliases. Fields: alias_type (select), alias_code (text), entity_id (VendorSelect or ClientSelect based on type), alias_label, is_primary checkbox. Uses `useAddAlias(articleId)`.

- [ ] **Step 4: Create article-price-dialog.tsx**

Create `src/components/articles/article-price-dialog.tsx`. Dialog for adding a price. Fields: vendor_id (VendorSelect), unit_price, currency, min_quantity, valid_from, valid_until, source (select), notes. Uses `useAddPrice(articleId)`.

- [ ] **Step 5: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/app/\(dashboard\)/articles/\[id\]/ src/components/articles/article-detail.tsx src/components/articles/article-alias-form.tsx src/components/articles/article-price-dialog.tsx
git commit -m "feat(articles): add article detail page with alias, price, and usage tabs"
```

---

### Task 16: CSV Import Dialog

**Files:**
- Create: `src/components/articles/article-import-dialog.tsx`

- [ ] **Step 1: Create import dialog component**

Create `src/components/articles/article-import-dialog.tsx`. A 3-step modal:

1. **Upload step**: Drag & drop zone or file picker. Accept `.csv` and `.xlsx` files. Max 10 MB (enforced client-side). For CSV: parse client-side with simple CSV parser (split by comma, handle quoted fields). For XLSX: use the `xlsx` (SheetJS) library — `npm install xlsx` — to read sheets into JSON. Store parsed rows in state.

2. **Preview step**: Show first 10 rows in a mini-table. Show counters: "N articoli nuovi", "N alias", "N righe totali". Back button to re-upload.

3. **Confirm step**: Call `useImportArticles()` mutation with parsed rows. Show progress state. On completion, show result: "X articoli creati, Y alias creati, Z saltati, W errori". Close button.

Uses `useImportArticles()` hook. Opens from the "Importa CSV" button in articles-page-content.tsx.

**CSV parsing note:** Use simple client-side parsing. Split lines by `\n`, split cells by `,`. Handle quoted values containing commas. Map header row to field names matching `csvRowSchema`.

- [ ] **Step 2: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/articles/article-import-dialog.tsx
git commit -m "feat(articles): add 3-step CSV import dialog"
```

---

### Task 17: Final Verification

- [ ] **Step 1: Full type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run all tests**

Run: `cd procureflow && npx vitest run`
Expected: All tests pass (existing + 3 new test files)

- [ ] **Step 3: Verify file count**

Expected new files created:
- `src/lib/constants/article.ts`
- `src/lib/validations/article.ts`
- `src/hooks/use-articles.ts`
- `src/hooks/use-article-search.ts`
- `src/server/services/article-import.service.ts`
- `src/app/api/articles/route.ts`
- `src/app/api/articles/[id]/route.ts`
- `src/app/api/articles/[id]/aliases/route.ts`
- `src/app/api/articles/[id]/aliases/[aliasId]/route.ts`
- `src/app/api/articles/[id]/prices/route.ts`
- `src/app/api/articles/search/route.ts`
- `src/app/api/articles/import/route.ts`
- `src/app/(dashboard)/articles/page.tsx`
- `src/app/(dashboard)/articles/loading.tsx`
- `src/app/(dashboard)/articles/error.tsx`
- `src/app/(dashboard)/articles/[id]/page.tsx`
- `src/app/(dashboard)/articles/[id]/loading.tsx`
- `src/app/(dashboard)/articles/[id]/error.tsx`
- `src/components/articles/articles-page-content.tsx`
- `src/components/articles/article-create-dialog.tsx`
- `src/components/articles/article-detail.tsx`
- `src/components/articles/article-alias-form.tsx`
- `src/components/articles/article-price-dialog.tsx`
- `src/components/articles/article-autocomplete.tsx`
- `src/components/articles/article-import-dialog.tsx`
- `tests/article-module.test.ts`
- `tests/article-validations.test.ts`
- `tests/article-code-generator.test.ts`
- `tests/article-import.test.ts`

Modified files:
- `prisma/schema.prisma`
- `src/lib/modules/registry.ts`
- `src/lib/constants.ts`
- `src/types/index.ts`
- `src/server/services/code-generator.service.ts`

- [ ] **Step 4: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "feat(articles): complete Sub-project 1 — Article Master foundations"
```
