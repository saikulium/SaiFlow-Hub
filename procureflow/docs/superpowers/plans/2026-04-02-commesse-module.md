# Commesse Module Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Commesse (Projects/Jobs) module that tracks client orders, links them to purchase requests, calculates margin, and auto-creates commesse from client emails via AI.

**Architecture:** Three new Prisma models (Client, Commessa, CommessaTimeline) extend the existing schema. The email ingestion pipeline gains a new `ORDINE_CLIENTE` intent that creates commesse with AI-suggested purchase requests. The module follows the established registry pattern for feature-flagging, and mirrors the Vendors module patterns for UI/API/hooks.

**Tech Stack:** Next.js 14 App Router, Prisma, PostgreSQL, Zod, TanStack Query, Recharts (dashboard), Framer Motion (animations)

**Spec:** `docs/superpowers/specs/2026-04-02-commesse-module-design.md`

---

## Chunk 1: Data Layer (Schema + Validations + Types + Code Generator Refactor)

### Task 1: Refactor `generateNextCodeAtomic` to accept prefix/table

The existing code generator is hardcoded for `PR-` codes. We need it to support `COM-` and `CLI-` prefixes too.

**Files:**
- Modify: `src/server/services/code-generator.service.ts`
- Modify: `src/lib/utils.ts` (add `generateCode` helper)
- Test: `tests/code-generator.test.ts`

- [ ] **Step 1: Write failing test for parameterized code generation**

```typescript
// tests/code-generator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
const mockQueryRawUnsafe = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (fn: Function, opts?: unknown) => mockTransaction(fn, opts),
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}))

import { generateNextCodeAtomic } from '@/server/services/code-generator.service'

describe('generateNextCodeAtomic', () => {
  const year = new Date().getFullYear()

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: transaction executes the callback with a tx client
    mockTransaction.mockImplementation(async (fn) => {
      const tx = { $queryRawUnsafe: mockQueryRawUnsafe }
      return fn(tx)
    })
  })

  it('generates PR code with default args (backwards compatible)', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([])
    const code = await generateNextCodeAtomic()
    expect(code).toBe(`PR-${year}-00001`)
  })

  it('generates COM code when prefix and table provided', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([])
    const code = await generateNextCodeAtomic('COM', 'commesse')
    expect(code).toBe(`COM-${year}-00001`)
  })

  it('increments from last existing code', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ code: `COM-${year}-00003` }])
    const code = await generateNextCodeAtomic('COM', 'commesse')
    expect(code).toBe(`COM-${year}-00004`)
  })

  it('generates CLI code without year (noYear flag)', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([])
    const code = await generateNextCodeAtomic('CLI', 'clients', undefined, true)
    expect(code).toBe('CLI-001')
  })

  it('increments CLI code without year', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ code: 'CLI-042' }])
    const code = await generateNextCodeAtomic('CLI', 'clients', undefined, true)
    expect(code).toBe('CLI-043')
  })

  it('uses external transaction client when provided', async () => {
    const externalTx = { $queryRawUnsafe: vi.fn().mockResolvedValueOnce([]) }
    // When tx is provided, should NOT call prisma.$transaction
    const code = await generateNextCodeAtomic('COM', 'commesse', externalTx as any)
    expect(code).toBe(`COM-${year}-00001`)
    expect(externalTx.$queryRawUnsafe).toHaveBeenCalled()
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd procureflow && npx vitest run tests/code-generator.test.ts`
Expected: FAIL — `generateNextCodeAtomic` does not accept parameters

- [ ] **Step 3: Add `generateCode` helper to utils**

```typescript
// In src/lib/utils.ts — add at end of file:

export function generateCode(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(5, '0')}`
}
```

- [ ] **Step 4: Refactor code generator to accept parameters**

Replace the entire content of `src/server/services/code-generator.service.ts`:

```typescript
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { generateCode } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Generazione atomica di codici sequenziali (PR, COM, CLI, etc.)
//
// Usa SELECT ... FOR UPDATE per garantire unicità sotto richieste concorrenti.
// Accetta un prefix, il nome della tabella, e opzionalmente un transaction
// client esterno (per quando il chiamante è già in una $transaction).
// ---------------------------------------------------------------------------

type TxClient = Prisma.TransactionClient

export async function generateNextCodeAtomic(
  prefix = 'PR',
  table = 'purchase_requests',
  externalTx?: TxClient,
  noYear = false,
): Promise<string> {
  const year = new Date().getFullYear()
  const fullPrefix = noYear ? `${prefix}-` : `${prefix}-${year}-`
  const padLen = noYear ? 3 : 5

  async function generate(tx: TxClient): Promise<string> {
    const rows = await tx.$queryRawUnsafe<{ code: string }[]>(
      `SELECT code FROM "${table}"
       WHERE code LIKE $1
       ORDER BY code DESC
       LIMIT 1
       FOR UPDATE`,
      `${fullPrefix}%`,
    )

    const lastCode = rows[0]?.code
    const lastNum = lastCode
      ? parseInt(lastCode.split('-').pop() ?? '0', 10)
      : 0

    return `${fullPrefix}${String(lastNum + 1).padStart(padLen, '0')}`
  }

  // If caller provided a transaction, use it directly (no nested $transaction)
  if (externalTx) {
    return generate(externalTx)
  }

  return prisma.$transaction(
    async (tx) => generate(tx),
    { timeout: 5000 },
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd procureflow && npx vitest run tests/code-generator.test.ts`
Expected: 6/6 PASS

- [ ] **Step 6: Verify existing code still compiles**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors (existing callers use `generateNextCodeAtomic()` with no args, which matches defaults)

- [ ] **Step 7: Commit**

```bash
cd procureflow && git add src/server/services/code-generator.service.ts src/lib/utils.ts tests/code-generator.test.ts && git commit -m "refactor: parameterize code generator for multi-entity support"
```

---

### Task 2: Add Prisma schema — Client, Commessa, CommessaTimeline models + PR/User extensions

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add ClientStatus and CommessaStatus enums**

Add after the existing `enum Priority` block in `prisma/schema.prisma`:

```prisma
enum ClientStatus {
  ACTIVE
  INACTIVE
  PENDING_REVIEW
}

enum CommessaStatus {
  DRAFT
  PLANNING
  ACTIVE
  ON_HOLD
  COMPLETED
  CANCELLED
}
```

- [ ] **Step 2: Add Client model**

Add after the enums:

```prisma
model Client {
  id              String        @id @default(cuid())
  code            String        @unique
  name            String
  tax_id          String?
  email           String?
  phone           String?
  address         String?
  contact_person  String?
  notes           String?
  status          ClientStatus  @default(ACTIVE)
  created_at      DateTime      @default(now())
  updated_at      DateTime      @updatedAt

  commesse        Commessa[]

  @@index([status])
  @@index([name])
  @@map("clients")
}
```

- [ ] **Step 3: Add Commessa model**

```prisma
model Commessa {
  id               String          @id @default(cuid())
  code             String          @unique
  title            String
  description      String?
  status           CommessaStatus  @default(DRAFT)

  client_id        String
  client           Client          @relation(fields: [client_id], references: [id])

  client_value     Decimal?        @db.Decimal(12, 2)
  currency         String          @default("EUR")

  received_at      DateTime?
  deadline         DateTime?
  completed_at     DateTime?

  category         String?
  department       String?
  priority         Priority        @default(MEDIUM)
  tags             String[]
  assigned_to      String?
  assigned_user    User?           @relation("CommessaAssigned", fields: [assigned_to], references: [id])

  email_message_id String?         @unique

  created_at       DateTime        @default(now())
  updated_at       DateTime        @updatedAt

  requests         PurchaseRequest[]
  timeline         CommessaTimeline[]

  @@index([status, created_at])
  @@index([client_id])
  @@index([deadline])
  @@map("commesse")
}
```

- [ ] **Step 4: Add CommessaTimeline model**

```prisma
model CommessaTimeline {
  id               String    @id @default(cuid())
  commessa_id      String
  commessa         Commessa  @relation(fields: [commessa_id], references: [id], onDelete: Cascade)

  type             String
  title            String
  description      String?
  metadata         Json?
  actor            String?
  email_message_id String?

  created_at       DateTime  @default(now())

  @@index([commessa_id, created_at])
  @@map("commessa_timeline")
}
```

- [ ] **Step 5: Extend PurchaseRequest model**

Add these fields to the existing `PurchaseRequest` model, after the `stock_movements` relation:

```prisma
  // Commessa link
  commessa_id     String?
  commessa        Commessa?  @relation(fields: [commessa_id], references: [id])
  is_ai_suggested Boolean    @default(false)
```

Add this index to PurchaseRequest's existing indexes:

```prisma
  @@index([commessa_id])
```

- [ ] **Step 6: Extend User model**

Add this relation to the existing `User` model, after `tenders_created`:

```prisma
  commesse_assigned Commessa[] @relation("CommessaAssigned")
```

- [ ] **Step 7: Generate and apply migration**

Run: `cd procureflow && npx prisma migrate dev --name add-commesse-module`
Expected: Migration created and applied successfully

- [ ] **Step 8: Verify Prisma client generation**

Run: `cd procureflow && npx prisma generate && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 9: Commit**

```bash
cd procureflow && git add prisma/ && git commit -m "feat: add Client, Commessa, CommessaTimeline schema + PR/User extensions"
```

---

### Task 3: Add Commessa state machine

**Files:**
- Create: `src/lib/commessa-state-machine.ts`
- Test: `tests/commessa-state-machine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/commessa-state-machine.test.ts
import { describe, it, expect } from 'vitest'
import {
  canCommessaTransition,
  assertCommessaTransition,
  CommessaTransitionError,
} from '@/lib/commessa-state-machine'
import type { CommessaStatus } from '@prisma/client'

const s = (v: string) => v as CommessaStatus

describe('canCommessaTransition', () => {
  it.each([
    ['DRAFT', 'PLANNING'],
    ['DRAFT', 'CANCELLED'],
    ['PLANNING', 'ACTIVE'],
    ['PLANNING', 'ON_HOLD'],
    ['ACTIVE', 'COMPLETED'],
    ['ACTIVE', 'ON_HOLD'],
    ['ON_HOLD', 'PLANNING'],
    ['ON_HOLD', 'ACTIVE'],
  ])('%s -> %s is valid', (from, to) => {
    expect(canCommessaTransition(s(from), s(to))).toBe(true)
  })

  it.each([
    ['DRAFT', 'COMPLETED'],
    ['DRAFT', 'ACTIVE'],
    ['COMPLETED', 'DRAFT'],
    ['CANCELLED', 'ACTIVE'],
    ['ACTIVE', 'DRAFT'],
  ])('%s -> %s is invalid', (from, to) => {
    expect(canCommessaTransition(s(from), s(to))).toBe(false)
  })

  it('assertCommessaTransition throws for invalid transition', () => {
    expect(() => assertCommessaTransition(s('DRAFT'), s('COMPLETED'))).toThrow(
      CommessaTransitionError,
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd procureflow && npx vitest run tests/commessa-state-machine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement state machine**

```typescript
// src/lib/commessa-state-machine.ts
import type { CommessaStatus } from '@prisma/client'

export const VALID_COMMESSA_TRANSITIONS: Readonly<
  Record<CommessaStatus, readonly CommessaStatus[]>
> = {
  DRAFT: ['PLANNING', 'CANCELLED'],
  PLANNING: ['ACTIVE', 'ON_HOLD', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'ON_HOLD'],
  ON_HOLD: ['PLANNING', 'ACTIVE'],
  COMPLETED: [],
  CANCELLED: [],
} as const

export function canCommessaTransition(
  from: CommessaStatus,
  to: CommessaStatus,
): boolean {
  const allowed = VALID_COMMESSA_TRANSITIONS[from]
  return allowed.includes(to)
}

export function assertCommessaTransition(
  from: CommessaStatus,
  to: CommessaStatus,
): void {
  if (!canCommessaTransition(from, to)) {
    throw new CommessaTransitionError(
      `Transizione commessa non valida: ${from} → ${to}`,
      from,
      to,
    )
  }
}

export class CommessaTransitionError extends Error {
  readonly from: CommessaStatus
  readonly to: CommessaStatus
  constructor(message: string, from: CommessaStatus, to: CommessaStatus) {
    super(message)
    this.name = 'CommessaTransitionError'
    this.from = from
    this.to = to
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd procureflow && npx vitest run tests/commessa-state-machine.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd procureflow && git add src/lib/commessa-state-machine.ts tests/commessa-state-machine.test.ts && git commit -m "feat: add commessa state machine with transitions"
```

---

### Task 4: Add Zod validation schemas

**Files:**
- Create: `src/lib/validations/client.ts`
- Create: `src/lib/validations/commesse.ts`

- [ ] **Step 1: Create client validation schema**

```typescript
// src/lib/validations/client.ts
import { z } from 'zod'

export const createClientSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1, 'Nome obbligatorio').max(200),
  tax_id: z.string().max(20).optional(),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  contact_person: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
})

export const updateClientSchema = createClientSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING_REVIEW']).optional(),
})

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
```

- [ ] **Step 2: Create commessa validation schema**

```typescript
// src/lib/validations/commesse.ts
import { z } from 'zod'

export const createCommessaSchema = z.object({
  title: z.string().min(1, 'Titolo obbligatorio').max(200),
  description: z.string().max(5000).optional(),
  client_id: z.string().min(1, 'Cliente obbligatorio'),
  client_value: z.number().min(0).optional(),
  currency: z.string().default('EUR'),
  deadline: z.string().datetime().optional(),
  category: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  tags: z.array(z.string()).default([]),
  assigned_to: z.string().optional(),
})

export const updateCommessaSchema = createCommessaSchema.partial().extend({
  status: z
    .enum(['DRAFT', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
    .optional(),
})

export type CreateCommessaInput = z.infer<typeof createCommessaSchema>
export type UpdateCommessaInput = z.infer<typeof updateCommessaSchema>
```

- [ ] **Step 3: Type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
cd procureflow && git add src/lib/validations/client.ts src/lib/validations/commesse.ts && git commit -m "feat: add Zod schemas for Client and Commessa"
```

---

### Task 5: Add TypeScript types for Commessa/Client

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add types at end of file (before the `export * from './ai'` line)**

```typescript
// --- Commessa Types ---

export interface ClientListItem {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly tax_id: string | null
  readonly email: string | null
  readonly phone: string | null
  readonly contact_person: string | null
  readonly status: string
  readonly activeCommesseCount: number
}

export interface ClientDetail extends ClientListItem {
  readonly address: string | null
  readonly notes: string | null
  readonly created_at: string
}

export interface CommessaListItem {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly status: string
  readonly clientName: string
  readonly clientCode: string
  readonly clientValue: number | null
  readonly totalCosts: number
  readonly margin: number | null
  readonly marginPercent: number | null
  readonly deadline: string | null
  readonly priority: string
  readonly requestsCount: number
  readonly suggestionsCount: number
  readonly createdAt: string
}

export interface CommessaDetail extends CommessaListItem {
  readonly description: string | null
  readonly clientId: string
  readonly currency: string
  readonly receivedAt: string | null
  readonly completedAt: string | null
  readonly category: string | null
  readonly department: string | null
  readonly tags: string[]
  readonly assignedTo: string | null
  readonly emailMessageId: string | null
  readonly requests: CommessaRequestItem[]
  readonly suggestions: CommessaRequestItem[]
  readonly timeline: CommessaTimelineItem[]
}

export interface CommessaRequestItem {
  readonly id: string
  readonly code: string
  readonly title: string
  readonly status: string
  readonly priority: string
  readonly estimatedAmount: number | null
  readonly actualAmount: number | null
  readonly vendorName: string | null
  readonly isAiSuggested: boolean
}

export interface CommessaTimelineItem {
  readonly id: string
  readonly type: string
  readonly title: string
  readonly description: string | null
  readonly metadata: Record<string, unknown> | null
  readonly actor: string | null
  readonly createdAt: string
}

export interface CommessaDashboardStats {
  readonly activeCount: number
  readonly totalValueInProgress: number
  readonly avgMarginPercent: number
  readonly dueSoonCount: number
  readonly topCommesse: readonly {
    readonly code: string
    readonly title: string
    readonly clientName: string
    readonly deadline: string | null
    readonly marginPercent: number | null
    readonly status: string
  }[]
}
```

- [ ] **Step 2: Type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
cd procureflow && git add src/types/index.ts && git commit -m "feat: add TypeScript types for Commessa and Client"
```

---

### Task 6: Register commesse module + add nav items

**Files:**
- Modify: `src/lib/modules/registry.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Add `'commesse'` to ModuleId union**

In `src/lib/modules/registry.ts`, add `| 'commesse'` to the `ModuleId` type (after `| 'smartfill'`).

- [ ] **Step 2: Add module definition to MODULE_REGISTRY**

Add this entry before the closing `]` of the Map constructor array:

```typescript
    [
      'commesse',
      {
        id: 'commesse',
        label: 'Commesse',
        description: 'Gestione commesse cliente, tracciamento margine, suggerimenti AI',
        navPaths: ['/commesse', '/clients'],
        dashboardTabs: ['commesse'],
        apiPrefixes: ['/api/commesse', '/api/clients'],
      },
    ],
```

- [ ] **Step 3: Add nav items to constants**

In `src/lib/constants.ts`, add these imports at top:

```typescript
import { Briefcase, Building2 } from 'lucide-react'
```

Then add these entries to the `NAV_ITEMS` array (after the analytics entry, before settings):

```typescript
  { label: 'Commesse', href: '/commesse', icon: Briefcase },
  { label: 'Clienti', href: '/clients', icon: Building2 },
```

- [ ] **Step 4: Type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd procureflow && git add src/lib/modules/registry.ts src/lib/constants.ts && git commit -m "feat: register commesse module and add nav items"
```

---

## Chunk 2: API Layer (Client CRUD + Commessa CRUD + Stats)

### Task 7: Client API — list + create

**Files:**
- Create: `src/app/api/clients/route.ts`

- [ ] **Step 1: Create client list + create endpoint**

```typescript
// src/app/api/clients/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { createClientSchema } from '@/lib/validations/client'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const search = params.get('search')
    const status = params.get('status')
    const cursor = params.get('cursor')
    const limit = Math.min(parseInt(params.get('limit') ?? '25', 10), 100)

    const where: Prisma.ClientWhereInput = {}
    if (status && status !== 'ALL') {
      where.status = status as Prisma.EnumClientStatusFilter
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { tax_id: { contains: search, mode: 'insensitive' } },
      ]
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        _count: {
          select: {
            commesse: { where: { status: { in: ['DRAFT', 'PLANNING', 'ACTIVE'] } } },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = clients.length > limit
    const data = (hasMore ? clients.slice(0, limit) : clients).map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      tax_id: c.tax_id,
      email: c.email,
      phone: c.phone,
      contact_person: c.contact_person,
      status: c.status,
      activeCommesseCount: c._count.commesse,
    }))

    return successResponse({
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
    })
  } catch (err) {
    return errorResponse('INTERNAL', 'Errore nel caricamento clienti', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = createClientSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { code: manualCode, ...rest } = parsed.data
    const code = manualCode ?? await generateNextCodeAtomic('CLI', 'clients', undefined, true)

    // Check for duplicate code
    const existing = await prisma.client.findUnique({ where: { code } })
    if (existing) {
      return errorResponse('DUPLICATE', `Codice cliente "${code}" già esistente`, 409)
    }

    const client = await prisma.client.create({
      data: { code, ...rest },
    })

    return successResponse(client)
  } catch (err) {
    return errorResponse('INTERNAL', 'Errore nella creazione del cliente', 500)
  }
}
```

- [ ] **Step 2: Type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
cd procureflow && git add src/app/api/clients/route.ts && git commit -m "feat: add client list + create API endpoints"
```

---

### Task 8: Client API — detail, update, soft-delete

**Files:**
- Create: `src/app/api/clients/[id]/route.ts`

- [ ] **Step 1: Create client detail endpoint**

```typescript
// src/app/api/clients/[id]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { updateClientSchema } from '@/lib/validations/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            commesse: { where: { status: { in: ['DRAFT', 'PLANNING', 'ACTIVE'] } } },
          },
        },
      },
    })
    if (!client) return notFoundResponse('Cliente non trovato')

    return successResponse({
      ...client,
      activeCommesseCount: client._count.commesse,
    })
  } catch {
    return errorResponse('INTERNAL', 'Errore nel caricamento del cliente', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    const parsed = updateClientSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.client.findUnique({ where: { id: params.id } })
    if (!existing) return notFoundResponse('Cliente non trovato')

    const updated = await prisma.client.update({
      where: { id: params.id },
      data: parsed.data,
    })

    return successResponse(updated)
  } catch {
    return errorResponse('INTERNAL', 'Errore nell\'aggiornamento del cliente', 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { commesse: { where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } } } },
        },
      },
    })
    if (!client) return notFoundResponse('Cliente non trovato')

    if (client._count.commesse > 0) {
      return errorResponse(
        'HAS_ACTIVE_COMMESSE',
        `Il cliente ha ${client._count.commesse} commesse attive. Completale o annullale prima di disattivare il cliente.`,
        400,
      )
    }

    await prisma.client.update({
      where: { id: params.id },
      data: { status: 'INACTIVE' },
    })

    return successResponse({ deleted: true })
  } catch {
    return errorResponse('INTERNAL', 'Errore nella disattivazione del cliente', 500)
  }
}
```

- [ ] **Step 2: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/app/api/clients/ && git commit -m "feat: add client detail, update, soft-delete API"
```

---

### Task 9: Commessa service — business logic

**Files:**
- Create: `src/server/services/commessa.service.ts`

- [ ] **Step 1: Create commessa service**

```typescript
// src/server/services/commessa.service.ts
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { assertCommessaTransition } from '@/lib/commessa-state-machine'
import type { CommessaStatus } from '@prisma/client'

// ---------------------------------------------------------------------------
// Margin calculation — computed, never stored
// ---------------------------------------------------------------------------

export function computeMargin(
  clientValue: Prisma.Decimal | null,
  totalActual: Prisma.Decimal | null,
  totalEstimated: Prisma.Decimal | null,
): { margin: number | null; marginPercent: number | null } {
  if (!clientValue) return { margin: null, marginPercent: null }

  const cv = clientValue.toNumber()
  const costs = (totalActual ?? totalEstimated)?.toNumber() ?? 0
  const margin = cv - costs
  const marginPercent = cv > 0 ? (margin / cv) * 100 : 0

  return { margin: Math.round(margin * 100) / 100, marginPercent: Math.round(marginPercent * 10) / 10 }
}

// ---------------------------------------------------------------------------
// Fetch commessa with all relations and computed margin
// ---------------------------------------------------------------------------

export async function getCommessaDetail(code: string) {
  const commessa = await prisma.commessa.findUnique({
    where: { code },
    include: {
      client: { select: { id: true, code: true, name: true } },
      requests: {
        include: { vendor: { select: { name: true } } },
        orderBy: { created_at: 'desc' },
      },
      timeline: { orderBy: { created_at: 'desc' } },
    },
  })

  if (!commessa) return null

  const totalCosts = await prisma.purchaseRequest.aggregate({
    where: {
      commessa_id: commessa.id,
      status: { notIn: ['CANCELLED', 'DRAFT'] },
      is_ai_suggested: false,
    },
    _sum: { actual_amount: true, estimated_amount: true },
  })

  const { margin, marginPercent } = computeMargin(
    commessa.client_value,
    totalCosts._sum.actual_amount,
    totalCosts._sum.estimated_amount,
  )

  const costs = (totalCosts._sum.actual_amount ?? totalCosts._sum.estimated_amount)?.toNumber() ?? 0

  const confirmedRequests = commessa.requests.filter((r) => !r.is_ai_suggested)
  const suggestions = commessa.requests.filter((r) => r.is_ai_suggested)

  return {
    id: commessa.id,
    code: commessa.code,
    title: commessa.title,
    description: commessa.description,
    status: commessa.status,
    clientId: commessa.client_id,
    clientName: commessa.client.name,
    clientCode: commessa.client.code,
    clientValue: commessa.client_value?.toNumber() ?? null,
    totalCosts: costs,
    margin,
    marginPercent,
    currency: commessa.currency,
    receivedAt: commessa.received_at?.toISOString() ?? null,
    deadline: commessa.deadline?.toISOString() ?? null,
    completedAt: commessa.completed_at?.toISOString() ?? null,
    category: commessa.category,
    department: commessa.department,
    priority: commessa.priority,
    tags: commessa.tags,
    assignedTo: commessa.assigned_to,
    emailMessageId: commessa.email_message_id,
    requestsCount: confirmedRequests.length,
    suggestionsCount: suggestions.length,
    createdAt: commessa.created_at.toISOString(),
    requests: confirmedRequests.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      status: r.status,
      priority: r.priority,
      estimatedAmount: r.estimated_amount?.toNumber() ?? null,
      actualAmount: r.actual_amount?.toNumber() ?? null,
      vendorName: r.vendor?.name ?? null,
      isAiSuggested: r.is_ai_suggested,
    })),
    suggestions: suggestions.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      status: r.status,
      priority: r.priority,
      estimatedAmount: r.estimated_amount?.toNumber() ?? null,
      actualAmount: r.actual_amount?.toNumber() ?? null,
      vendorName: r.vendor?.name ?? null,
      isAiSuggested: r.is_ai_suggested,
    })),
    timeline: commessa.timeline.map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      description: t.description,
      metadata: t.metadata as Record<string, unknown> | null,
      actor: t.actor,
      createdAt: t.created_at.toISOString(),
    })),
  }
}

// ---------------------------------------------------------------------------
// Status update with state machine validation
// ---------------------------------------------------------------------------

export async function updateCommessaStatus(
  code: string,
  newStatus: CommessaStatus,
) {
  const commessa = await prisma.commessa.findUnique({ where: { code } })
  if (!commessa) throw new Error('Commessa non trovata')

  assertCommessaTransition(commessa.status, newStatus)

  const data: Prisma.CommessaUpdateInput = { status: newStatus }
  if (newStatus === 'COMPLETED') {
    data.completed_at = new Date()
  }

  const updated = await prisma.commessa.update({
    where: { code },
    data,
  })

  await prisma.commessaTimeline.create({
    data: {
      commessa_id: updated.id,
      type: 'status_change',
      title: `Stato cambiato: ${commessa.status} → ${newStatus}`,
      actor: 'user', // TODO: pass actual user from session
    },
  })

  return updated
}
```

- [ ] **Step 2: Write margin calculation tests**

```typescript
// tests/commessa-margin.test.ts
import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { computeMargin } from '@/server/services/commessa.service'

describe('computeMargin', () => {
  it('returns null when clientValue is null', () => {
    const result = computeMargin(null, new Prisma.Decimal(100), null)
    expect(result.margin).toBeNull()
    expect(result.marginPercent).toBeNull()
  })

  it('calculates positive margin', () => {
    const result = computeMargin(
      new Prisma.Decimal(10000),
      new Prisma.Decimal(7000),
      null,
    )
    expect(result.margin).toBe(3000)
    expect(result.marginPercent).toBe(30)
  })

  it('calculates negative margin', () => {
    const result = computeMargin(
      new Prisma.Decimal(5000),
      new Prisma.Decimal(6000),
      null,
    )
    expect(result.margin).toBe(-1000)
    expect(result.marginPercent).toBe(-20)
  })

  it('falls back to estimated when actual is null', () => {
    const result = computeMargin(
      new Prisma.Decimal(10000),
      null,
      new Prisma.Decimal(8000),
    )
    expect(result.margin).toBe(2000)
    expect(result.marginPercent).toBe(20)
  })

  it('returns 0 costs when both actual and estimated are null', () => {
    const result = computeMargin(
      new Prisma.Decimal(10000),
      null,
      null,
    )
    expect(result.margin).toBe(10000)
    expect(result.marginPercent).toBe(100)
  })
})
```

- [ ] **Step 3: Run margin tests**

Run: `cd procureflow && npx vitest run tests/commessa-margin.test.ts`
Expected: 5/5 PASS

- [ ] **Step 4: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/server/services/commessa.service.ts tests/commessa-margin.test.ts && git commit -m "feat: add commessa service with margin calc and status transitions"
```

---

### Task 10: Commessa API — list + create

**Files:**
- Create: `src/app/api/commesse/route.ts`

- [ ] **Step 1: Create commessa list + create endpoint**

```typescript
// src/app/api/commesse/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { generateNextCodeAtomic } from '@/server/services/code-generator.service'
import { computeMargin } from '@/server/services/commessa.service'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { createCommessaSchema } from '@/lib/validations/commesse'

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const search = params.get('search')
    const status = params.get('status')
    const clientId = params.get('client_id')
    const cursor = params.get('cursor')
    const limit = Math.min(parseInt(params.get('limit') ?? '25', 10), 100)
    const sortBy = params.get('sort') ?? 'created_at'
    const sortDir = params.get('dir') === 'asc' ? 'asc' : 'desc'

    const where: Prisma.CommessaWhereInput = {}
    if (status && status !== 'ALL') {
      where.status = status as Prisma.EnumCommessaStatusFilter
    }
    if (clientId) where.client_id = clientId
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { client: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const orderBy: Prisma.CommessaOrderByWithRelationInput =
      sortBy === 'deadline' ? { deadline: sortDir } : { created_at: sortDir }

    const commesse = await prisma.commessa.findMany({
      where,
      include: {
        client: { select: { name: true, code: true } },
        _count: { select: { requests: true } },
        requests: {
          where: { status: { notIn: ['CANCELLED', 'DRAFT'] }, is_ai_suggested: false },
          select: { actual_amount: true, estimated_amount: true },
        },
      },
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = commesse.length > limit
    const list = hasMore ? commesse.slice(0, limit) : commesse

    const data = list.map((c) => {
      const totalActual = c.requests.reduce(
        (sum, r) => sum + (r.actual_amount?.toNumber() ?? 0), 0,
      )
      const totalEstimated = c.requests.reduce(
        (sum, r) => sum + (r.estimated_amount?.toNumber() ?? 0), 0,
      )
      const costs = totalActual || totalEstimated
      const { margin, marginPercent } = computeMargin(
        c.client_value,
        totalActual ? new Prisma.Decimal(totalActual) : null,
        totalEstimated ? new Prisma.Decimal(totalEstimated) : null,
      )

      return {
        id: c.id,
        code: c.code,
        title: c.title,
        status: c.status,
        clientName: c.client.name,
        clientCode: c.client.code,
        clientValue: c.client_value?.toNumber() ?? null,
        totalCosts: costs,
        margin,
        marginPercent,
        deadline: c.deadline?.toISOString() ?? null,
        priority: c.priority,
        requestsCount: c._count.requests,
        suggestionsCount: 0, // List view doesn't need this
        createdAt: c.created_at.toISOString(),
      }
    })

    return successResponse({
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
    })
  } catch {
    return errorResponse('INTERNAL', 'Errore nel caricamento commesse', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = createCommessaSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: parsed.data.client_id },
    })
    if (!client) {
      return errorResponse('CLIENT_NOT_FOUND', 'Cliente non trovato', 404)
    }

    const code = await generateNextCodeAtomic('COM', 'commesse')

    const commessa = await prisma.commessa.create({
      data: {
        code,
        title: parsed.data.title,
        description: parsed.data.description,
        client_id: parsed.data.client_id,
        client_value: parsed.data.client_value
          ? new Prisma.Decimal(parsed.data.client_value)
          : null,
        currency: parsed.data.currency,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
        category: parsed.data.category,
        department: parsed.data.department,
        priority: parsed.data.priority,
        tags: parsed.data.tags,
        assigned_to: parsed.data.assigned_to,
      },
    })

    // Timeline event
    await prisma.commessaTimeline.create({
      data: {
        commessa_id: commessa.id,
        type: 'created',
        title: 'Commessa creata manualmente',
        actor: 'user',
      },
    })

    return successResponse(commessa)
  } catch {
    return errorResponse('INTERNAL', 'Errore nella creazione della commessa', 500)
  }
}
```

- [ ] **Step 2: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/app/api/commesse/route.ts && git commit -m "feat: add commessa list + create API"
```

---

### Task 11: Commessa API — detail + update

**Files:**
- Create: `src/app/api/commesse/[code]/route.ts`

- [ ] **Step 1: Create commessa detail + update endpoint**

```typescript
// src/app/api/commesse/[code]/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getCommessaDetail, updateCommessaStatus } from '@/server/services/commessa.service'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { updateCommessaSchema } from '@/lib/validations/commesse'
import { CommessaTransitionError } from '@/lib/commessa-state-machine'
import type { CommessaStatus } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  try {
    const detail = await getCommessaDetail(params.code)
    if (!detail) return notFoundResponse('Commessa non trovata')
    return successResponse(detail)
  } catch {
    return errorResponse('INTERNAL', 'Errore nel caricamento della commessa', 500)
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  try {
    const body = await req.json()
    const parsed = updateCommessaSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const existing = await prisma.commessa.findUnique({ where: { code: params.code } })
    if (!existing) return notFoundResponse('Commessa non trovata')

    // Handle status change through state machine
    const { status, client_value, deadline, ...rest } = parsed.data
    if (status && status !== existing.status) {
      try {
        await updateCommessaStatus(params.code, status as CommessaStatus)
      } catch (err) {
        if (err instanceof CommessaTransitionError) {
          return errorResponse('INVALID_TRANSITION', err.message, 400)
        }
        throw err
      }
    }

    // Update other fields
    const updateData: Prisma.CommessaUpdateInput = { ...rest }
    if (client_value !== undefined) {
      updateData.client_value = client_value !== null
        ? new Prisma.Decimal(client_value)
        : null
    }
    if (deadline !== undefined) {
      updateData.deadline = deadline ? new Date(deadline) : null
    }

    const updated = await prisma.commessa.update({
      where: { code: params.code },
      data: updateData,
    })

    return successResponse(updated)
  } catch {
    return errorResponse('INTERNAL', 'Errore nell\'aggiornamento della commessa', 500)
  }
}
```

- [ ] **Step 2: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/app/api/commesse/[code]/ && git commit -m "feat: add commessa detail + update API with state machine"
```

---

### Task 12: Commessa API — accept/reject/modify suggestions

**Files:**
- Create: `src/app/api/commesse/[code]/accept-suggestion/route.ts`
- Create: `src/app/api/commesse/[code]/suggestions/[id]/route.ts`

- [ ] **Step 1: Create accept-suggestion endpoint**

```typescript
// src/app/api/commesse/[code]/accept-suggestion/route.ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse, notFoundResponse } from '@/lib/api-response'
import { z } from 'zod'

const acceptSchema = z.object({
  suggestion_id: z.string().min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  try {
    const body = await req.json()
    const parsed = acceptSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse('VALIDATION', 'suggestion_id obbligatorio', 400)
    }

    const commessa = await prisma.commessa.findUnique({ where: { code: params.code } })
    if (!commessa) return notFoundResponse('Commessa non trovata')

    // Optimistic concurrency: only update if still a suggestion
    const updated = await prisma.purchaseRequest.updateMany({
      where: {
        id: parsed.data.suggestion_id,
        commessa_id: commessa.id,
        is_ai_suggested: true,
      },
      data: {
        is_ai_suggested: false,
        status: 'SUBMITTED',
      },
    })

    if (updated.count === 0) {
      return errorResponse('ALREADY_PROCESSED', 'Suggerimento già elaborato', 409)
    }

    // Timeline event
    await prisma.commessaTimeline.create({
      data: {
        commessa_id: commessa.id,
        type: 'pr_accepted',
        title: 'Suggerimento AI accettato',
        metadata: { suggestion_id: parsed.data.suggestion_id },
        actor: 'user',
      },
    })

    return successResponse({ accepted: true })
  } catch {
    return errorResponse('INTERNAL', 'Errore nell\'accettazione del suggerimento', 500)
  }
}
```

- [ ] **Step 2: Create suggestion reject/modify endpoint**

```typescript
// src/app/api/commesse/[code]/suggestions/[id]/route.ts
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { z } from 'zod'

const modifySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  estimated_amount: z.number().min(0).optional(),
  vendor_id: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string; id: string } },
) {
  try {
    const body = await req.json()
    const parsed = modifySchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const commessa = await prisma.commessa.findUnique({ where: { code: params.code } })
    if (!commessa) return notFoundResponse('Commessa non trovata')

    const suggestion = await prisma.purchaseRequest.findFirst({
      where: { id: params.id, commessa_id: commessa.id, is_ai_suggested: true },
    })
    if (!suggestion) return notFoundResponse('Suggerimento non trovato')

    const { estimated_amount, ...rest } = parsed.data
    const updated = await prisma.purchaseRequest.update({
      where: { id: params.id },
      data: {
        ...rest,
        ...(estimated_amount !== undefined
          ? { estimated_amount: new Prisma.Decimal(estimated_amount) }
          : {}),
      },
    })

    return successResponse(updated)
  } catch {
    return errorResponse('INTERNAL', 'Errore nella modifica del suggerimento', 500)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string; id: string } },
) {
  try {
    const commessa = await prisma.commessa.findUnique({ where: { code: params.code } })
    if (!commessa) return notFoundResponse('Commessa non trovata')

    const deleted = await prisma.purchaseRequest.deleteMany({
      where: { id: params.id, commessa_id: commessa.id, is_ai_suggested: true },
    })

    if (deleted.count === 0) {
      return errorResponse('NOT_FOUND', 'Suggerimento non trovato o già elaborato', 404)
    }

    // Timeline event
    await prisma.commessaTimeline.create({
      data: {
        commessa_id: commessa.id,
        type: 'pr_rejected',
        title: 'Suggerimento AI rifiutato',
        metadata: { suggestion_id: params.id },
        actor: 'user',
      },
    })

    return successResponse({ deleted: true })
  } catch {
    return errorResponse('INTERNAL', 'Errore nella rimozione del suggerimento', 500)
  }
}
```

- [ ] **Step 3: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/app/api/commesse/[code]/ && git commit -m "feat: add suggestion accept/reject/modify API endpoints"
```

---

### Task 13: Commessa stats API

**Files:**
- Create: `src/app/api/commesse/stats/route.ts`

- [ ] **Step 1: Create stats endpoint**

```typescript
// src/app/api/commesse/stats/route.ts
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse } from '@/lib/api-response'
import { computeMargin } from '@/server/services/commessa.service'

export async function GET() {
  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [activeCount, activeCommesse, dueSoonCount] = await Promise.all([
      prisma.commessa.count({
        where: { status: { in: ['DRAFT', 'PLANNING', 'ACTIVE'] } },
      }),
      prisma.commessa.findMany({
        where: { status: { in: ['DRAFT', 'PLANNING', 'ACTIVE'] } },
        include: {
          client: { select: { name: true } },
          requests: {
            where: { status: { notIn: ['CANCELLED', 'DRAFT'] }, is_ai_suggested: false },
            select: { actual_amount: true, estimated_amount: true },
          },
        },
        orderBy: { deadline: 'asc' },
        take: 5,
      }),
      prisma.commessa.count({
        where: {
          status: { in: ['DRAFT', 'PLANNING', 'ACTIVE'] },
          deadline: { lte: sevenDaysFromNow, gte: now },
        },
      }),
    ])

    const totalValue = activeCommesse.reduce(
      (sum, c) => sum + (c.client_value?.toNumber() ?? 0), 0,
    )

    const margins = activeCommesse.map((c) => {
      const totalActual = c.requests.reduce(
        (s, r) => s + (r.actual_amount?.toNumber() ?? 0), 0,
      )
      const totalEstimated = c.requests.reduce(
        (s, r) => s + (r.estimated_amount?.toNumber() ?? 0), 0,
      )
      return computeMargin(
        c.client_value,
        totalActual ? new Prisma.Decimal(totalActual) : null,
        totalEstimated ? new Prisma.Decimal(totalEstimated) : null,
      )
    })

    const validMargins = margins.filter((m) => m.marginPercent !== null)
    const avgMarginPercent = validMargins.length > 0
      ? Math.round((validMargins.reduce((a, b) => a + (b.marginPercent ?? 0), 0) / validMargins.length) * 10) / 10
      : 0

    const topCommesse = activeCommesse.map((c, i) => ({
      code: c.code,
      title: c.title,
      clientName: c.client.name,
      deadline: c.deadline?.toISOString() ?? null,
      marginPercent: margins[i].marginPercent,
      status: c.status,
    }))

    return successResponse({
      activeCount,
      totalValueInProgress: Math.round(totalValue * 100) / 100,
      avgMarginPercent,
      dueSoonCount,
      topCommesse,
    })
  } catch {
    return errorResponse('INTERNAL', 'Errore nel caricamento statistiche commesse', 500)
  }
}
```

- [ ] **Step 2: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/app/api/commesse/stats/ && git commit -m "feat: add commessa dashboard stats API"
```

---

## Chunk 3: TanStack Query Hooks + UI Pages

### Task 14: TanStack Query hooks — clients

**Files:**
- Create: `src/hooks/use-clients.ts`

- [ ] **Step 1: Create client hooks**

```typescript
// src/hooks/use-clients.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiResponse } from '@/lib/api-response'
import type { ClientListItem } from '@/types'
import type { CreateClientInput, UpdateClientInput } from '@/lib/validations/client'

interface ClientListParams {
  search?: string
  status?: string
}

interface ClientListResponse {
  data: ClientListItem[]
  nextCursor: string | null
}

async function fetchClients(params?: ClientListParams): Promise<ClientListItem[]> {
  const sp = new URLSearchParams()
  if (params?.search) sp.set('search', params.search)
  if (params?.status) sp.set('status', params.status)
  const query = sp.toString()

  const res = await fetch(`/api/clients${query ? `?${query}` : ''}`)
  if (!res.ok) throw new Error('Errore nel caricamento clienti')

  const json: ApiResponse<ClientListResponse> = await res.json()
  if (!json.success || !json.data) throw new Error('Errore nel caricamento clienti')

  return json.data.data
}

export function useClients(params?: ClientListParams) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: () => fetchClients(params),
  })
}

async function createClient(data: CreateClientInput) {
  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Errore')
  return json.data
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createClient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

async function updateClient({ id, data }: { id: string; data: UpdateClientInput }) {
  const res = await fetch(`/api/clients/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Errore')
  return json.data
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateClient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

async function deleteClient(id: string) {
  const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Errore')
  return json.data
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteClient,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}
```

- [ ] **Step 2: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/hooks/use-clients.ts && git commit -m "feat: add TanStack Query hooks for clients"
```

---

### Task 15: TanStack Query hooks — commesse

**Files:**
- Create: `src/hooks/use-commesse.ts`

- [ ] **Step 1: Create commesse hooks**

```typescript
// src/hooks/use-commesse.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiResponse } from '@/lib/api-response'
import type {
  CommessaListItem,
  CommessaDetail,
  CommessaDashboardStats,
} from '@/types'
import type { CreateCommessaInput, UpdateCommessaInput } from '@/lib/validations/commesse'

interface CommessaListParams {
  search?: string
  status?: string
  client_id?: string
  sort?: string
  dir?: string
}

interface CommessaListResponse {
  data: CommessaListItem[]
  nextCursor: string | null
}

async function fetchCommesse(params?: CommessaListParams): Promise<CommessaListItem[]> {
  const sp = new URLSearchParams()
  if (params?.search) sp.set('search', params.search)
  if (params?.status) sp.set('status', params.status)
  if (params?.client_id) sp.set('client_id', params.client_id)
  if (params?.sort) sp.set('sort', params.sort)
  if (params?.dir) sp.set('dir', params.dir)
  const query = sp.toString()

  const res = await fetch(`/api/commesse${query ? `?${query}` : ''}`)
  if (!res.ok) throw new Error('Errore nel caricamento commesse')

  const json: ApiResponse<CommessaListResponse> = await res.json()
  if (!json.success || !json.data) throw new Error('Errore nel caricamento commesse')

  return json.data.data
}

export function useCommesse(params?: CommessaListParams) {
  return useQuery({
    queryKey: ['commesse', params],
    queryFn: () => fetchCommesse(params),
  })
}

async function fetchCommessaDetail(code: string): Promise<CommessaDetail> {
  const res = await fetch(`/api/commesse/${code}`)
  if (!res.ok) throw new Error('Errore nel caricamento commessa')

  const json: ApiResponse<CommessaDetail> = await res.json()
  if (!json.success || !json.data) throw new Error('Errore nel caricamento commessa')

  return json.data
}

export function useCommessaDetail(code: string) {
  return useQuery({
    queryKey: ['commessa', code],
    queryFn: () => fetchCommessaDetail(code),
    enabled: !!code,
  })
}

async function fetchCommessaStats(): Promise<CommessaDashboardStats> {
  const res = await fetch('/api/commesse/stats')
  if (!res.ok) throw new Error('Errore nel caricamento statistiche')

  const json: ApiResponse<CommessaDashboardStats> = await res.json()
  if (!json.success || !json.data) throw new Error('Errore')

  return json.data
}

export function useCommessaStats() {
  return useQuery({
    queryKey: ['commessa-stats'],
    queryFn: fetchCommessaStats,
    staleTime: 60_000,
  })
}

export function useCreateCommessa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateCommessaInput) => {
      const res = await fetch('/api/commesse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commesse'] })
      qc.invalidateQueries({ queryKey: ['commessa-stats'] })
    },
  })
}

export function useUpdateCommessa(code: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: UpdateCommessaInput) => {
      const res = await fetch(`/api/commesse/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commessa', code] })
      qc.invalidateQueries({ queryKey: ['commesse'] })
      qc.invalidateQueries({ queryKey: ['commessa-stats'] })
    },
  })
}

export function useAcceptSuggestion(code: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await fetch(`/api/commesse/${code}/accept-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion_id: suggestionId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commessa', code] })
    },
  })
}

export function useRejectSuggestion(code: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const res = await fetch(`/api/commesse/${code}/suggestions/${suggestionId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commessa', code] })
    },
  })
}
```

- [ ] **Step 2: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/hooks/use-commesse.ts && git commit -m "feat: add TanStack Query hooks for commesse"
```

---

### Task 16: Client pages + components

**Files:**
- Create: `src/app/(dashboard)/clients/page.tsx`
- Create: `src/app/(dashboard)/clients/loading.tsx`
- Create: `src/app/(dashboard)/clients/error.tsx`
- Create: `src/components/clients/clients-page-content.tsx`
- Create: `src/components/clients/client-dialog.tsx`

This task creates the Clients UI. Follow the **exact patterns** from the Vendors module:
- `src/app/(dashboard)/vendors/page.tsx` for the page wrapper
- `src/components/vendors/vendors-page-content.tsx` for the list layout
- `src/components/vendors/vendor-create-dialog.tsx` for the modal dialog

- [ ] **Step 1: Create page + loading + error**

Page: thin wrapper delegating to content component. Loading: skeleton shimmer. Error: retry button with `border-pf-danger/30 bg-pf-danger/5` styling. See existing `src/app/(dashboard)/vendors/page.tsx`, `loading.tsx`, `error.tsx` for the exact patterns to replicate.

- [ ] **Step 2: Create `clients-page-content.tsx`**

Client 'use client' component with: search input (debounced), status filter (ALL/ACTIVE/INACTIVE/PENDING_REVIEW), create button, table with columns (Codice, Nome, P.IVA, Email, Contatto, Stato, Commesse Attive), empty state, loading skeleton. Mirrors `vendors-page-content.tsx` structure.

- [ ] **Step 3: Create `client-dialog.tsx`**

Modal dialog for create/edit, using React Hook Form + Zod resolver with `createClientSchema`. Fields: nome, codice (optional), P.IVA, email, telefono, indirizzo, referente, note. Mirrors `vendor-create-dialog.tsx` pattern.

- [ ] **Step 4: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/app/\(dashboard\)/clients/ src/components/clients/ && git commit -m "feat: add Clients pages and components"
```

---

### Task 17: Commesse list page + components

**Files:**
- Create: `src/app/(dashboard)/commesse/page.tsx`
- Create: `src/app/(dashboard)/commesse/loading.tsx`
- Create: `src/app/(dashboard)/commesse/error.tsx`
- Create: `src/components/commesse/commesse-page-content.tsx`
- Create: `src/components/commesse/commessa-create-dialog.tsx`

- [ ] **Step 1: Create page + loading + error**

Same thin wrapper pattern. Delegate to `CommessePageContent`.

- [ ] **Step 2: Create `commesse-page-content.tsx`**

Client component with: search, status filter (ALL + each CommessaStatus), client filter dropdown. Table/card grid showing: Codice, Titolo, Cliente, Stato (badge), Valore Cliente, Costi, Margine (green/red colored), Scadenza, PR Count. Sort by created_at, deadline. Create button opens dialog. Follows same patterns as vendors list.

- [ ] **Step 3: Create `commessa-create-dialog.tsx`**

Modal with React Hook Form + Zod. Fields: titolo, descrizione, cliente (searchable select from `useClients()`), valore cliente, scadenza, categoria, dipartimento, priorità, tags. Uses `useCreateCommessa()` mutation.

- [ ] **Step 4: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/app/\(dashboard\)/commesse/page.tsx src/app/\(dashboard\)/commesse/loading.tsx src/app/\(dashboard\)/commesse/error.tsx src/components/commesse/commesse-page-content.tsx src/components/commesse/commessa-create-dialog.tsx && git commit -m "feat: add Commesse list page and components"
```

---

### Task 18: Commessa detail page + components

**Files:**
- Create: `src/app/(dashboard)/commesse/[code]/page.tsx`
- Create: `src/app/(dashboard)/commesse/[code]/loading.tsx`
- Create: `src/app/(dashboard)/commesse/[code]/error.tsx`
- Create: `src/components/commesse/commessa-detail.tsx`
- Create: `src/components/commesse/suggestion-card.tsx`

- [ ] **Step 1: Create page + loading + error**

Page extracts `code` from params, renders `CommessaDetail`. Loading/error follow established patterns.

- [ ] **Step 2: Create `commessa-detail.tsx`**

Uses `useCommessaDetail(code)`. Layout:
- **Header**: code, title, status badge (use CommessaStatus styling), client name link, deadline, assigned_to
- **3 stat cards**: Valore Cliente, Costi Acquisti, Margine (green if >0, red if <0, with %)
- **3 tabs** (local state, no routing):
  - **Richieste**: table of confirmed PRs + section for AI suggestions using `SuggestionCard`
  - **Timeline**: chronological events list
  - **Dettagli**: edit form for metadata (uses `useUpdateCommessa()`)

- [ ] **Step 3: Create `suggestion-card.tsx`**

Card component for each AI suggestion. Shows: title, estimated amount, vendor (if any). Three buttons: Accetta (green), Modifica (amber), Rifiuta (red). Uses `useAcceptSuggestion()` and `useRejectSuggestion()` mutations. Optimistic updates via TanStack Query.

- [ ] **Step 4: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/app/\(dashboard\)/commesse/[code]/ src/components/commesse/commessa-detail.tsx src/components/commesse/suggestion-card.tsx && git commit -m "feat: add Commessa detail page with suggestions UI"
```

---

### Task 19: Dashboard commesse tab

**Files:**
- Create: `src/components/dashboard/commesse-tab.tsx`
- Modify: `src/components/dashboard/dashboard-tabs.tsx`

- [ ] **Step 1: Create `commesse-tab.tsx`**

```typescript
// src/components/dashboard/commesse-tab.tsx
'use client'

import Link from 'next/link'
import { Briefcase, TrendingUp, Clock, AlertTriangle } from 'lucide-react'
import { useCommessaStats } from '@/hooks/use-commesse'
import { formatCurrency } from '@/lib/utils'

export function CommesseTab() {
  const { data: stats, isLoading } = useCommessaStats()

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-shimmer h-28 rounded-card" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  const cards = [
    { label: 'Commesse attive', value: String(stats.activeCount), icon: Briefcase },
    { label: 'Valore in corso', value: formatCurrency(stats.totalValueInProgress), icon: TrendingUp },
    { label: 'Margine medio', value: `${stats.avgMarginPercent}%`, icon: TrendingUp },
    { label: 'In scadenza', value: String(stats.dueSoonCount), icon: stats.dueSoonCount > 0 ? AlertTriangle : Clock },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-card border border-pf-border bg-pf-bg-secondary p-5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pf-accent-subtle">
                <c.icon className="h-5 w-5 text-pf-accent" />
              </div>
              <div>
                <p className="text-xs text-pf-text-secondary">{c.label}</p>
                <p className="font-display text-xl font-bold text-pf-text-primary">
                  {c.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mini table: top 5 commesse */}
      {stats.topCommesse.length > 0 && (
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-5">
          <h3 className="mb-4 font-display text-base font-semibold text-pf-text-primary">
            Prossime scadenze
          </h3>
          <div className="space-y-2">
            {stats.topCommesse.map((c) => (
              <Link
                key={c.code}
                href={`/commesse/${c.code}`}
                className="flex items-center justify-between rounded-lg bg-pf-bg-tertiary px-4 py-3 transition-colors hover:bg-pf-bg-hover"
              >
                <div>
                  <span className="font-mono text-xs text-pf-text-muted">{c.code}</span>
                  <p className="text-sm font-medium text-pf-text-primary">{c.title}</p>
                  <p className="text-xs text-pf-text-secondary">{c.clientName}</p>
                </div>
                <div className="text-right">
                  {c.marginPercent !== null && (
                    <p className={`text-sm font-bold ${c.marginPercent >= 0 ? 'text-pf-success' : 'text-pf-danger'}`}>
                      {c.marginPercent > 0 ? '+' : ''}{c.marginPercent}%
                    </p>
                  )}
                  {c.deadline && (
                    <p className="text-xs text-pf-text-muted">
                      {new Date(c.deadline).toLocaleDateString('it-IT')}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Register tab in dashboard-tabs**

In `src/components/dashboard/dashboard-tabs.tsx`:

1. Add import: `import { CommesseTab } from './commesse-tab'`
2. Add to `TabId` type: `| 'commesse'`
3. Add to `BASE_TABS` array: `{ id: 'commesse', label: 'Commesse', icon: Briefcase }`
4. Add to the tab content rendering switch/conditional: render `<CommesseTab />` when `activeTab === 'commesse'`

- [ ] **Step 3: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/components/dashboard/commesse-tab.tsx src/components/dashboard/dashboard-tabs.tsx && git commit -m "feat: add Commesse dashboard tab"
```

---

## Chunk 4: Email Integration + Seed Data + Final Verification

### Task 20: Extend email classifier with ORDINE_CLIENTE intent

**Files:**
- Modify: `src/server/services/email-ai-classifier.service.ts`
- Modify: `src/lib/validations/email-ingestion.ts`

- [ ] **Step 1: Add ORDINE_CLIENTE to EmailIntent type**

In `email-ai-classifier.service.ts`, add `| 'ORDINE_CLIENTE'` to the `EmailIntent` type union.

- [ ] **Step 2: Add to VALID_INTENTS set**

Find the `VALID_INTENTS` Set and add `'ORDINE_CLIENTE'`.

- [ ] **Step 3: Update INTENT_TO_ACTION**

Import `ActionType` from `@/lib/validations/email-ingestion`. Change the type annotation of `INTENT_TO_ACTION` to `Record<EmailIntent, ActionType>`. Add entry: `ORDINE_CLIENTE: 'create_commessa'`.

- [ ] **Step 4: Extend extracted_data in ClassificationResult**

Add optional fields to `extracted_data`: `client_name`, `client_code`, `client_order_items`, `client_deadline`, `client_value` (as per spec section 2.3).

- [ ] **Step 5: Update mapClassificationToPayload**

Add the new `ai_client_*` fields to the return object (as per spec section 2.4).

- [ ] **Step 6: Update classification prompt**

Add `ORDINE_CLIENTE` to the prompt's intent list with Italian description.

- [ ] **Step 7: Extend actionTypeSchema**

In `src/lib/validations/email-ingestion.ts`, add `'create_commessa'` to the `actionTypeSchema` enum. Add the new fields: `ai_client_name`, `ai_client_code`, `ai_client_order_items`, `ai_client_deadline`, `ai_client_value`.

- [ ] **Step 8: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/server/services/email-ai-classifier.service.ts src/lib/validations/email-ingestion.ts && git commit -m "feat: add ORDINE_CLIENTE intent to email classifier"
```

---

### Task 21: Add handleCreateCommessa to email ingestion service

**Files:**
- Modify: `src/server/services/email-ingestion.service.ts`
- Modify: `src/server/services/notification.service.ts` (add COMMESSA_CREATED type)

- [ ] **Step 1: Add COMMESSA_CREATED notification type**

In `notification.service.ts`, add to `NOTIFICATION_TYPES`:

```typescript
COMMESSA_CREATED: 'commessa_created',
```

- [ ] **Step 2: Add CommessaIngestionResult type**

In `email-ingestion.service.ts`, add after the existing `IngestionResult`:

```typescript
interface CommessaIngestionResult {
  readonly action: 'create_commessa'
  readonly commessa_id: string
  readonly commessa_code: string
  readonly suggested_prs_created: number
  readonly timeline_event_id: string
  readonly ai_confidence: number | null
  readonly deduplicated: boolean
}

type ProcessingResult = IngestionResult | CommessaIngestionResult
```

- [ ] **Step 3: Narrow IngestionResult action type**

Change `IngestionResult.action` from `ActionType` to `Exclude<ActionType, 'create_commessa'>`.

- [ ] **Step 4: Add handleCreateCommessa function**

Implement the handler as specified in spec section 2.5. Uses `prisma.$transaction`, `generateNextCodeAtomic('COM', 'commesse', tx)`, creates Commessa + suggested PRs + timeline + notifications.

- [ ] **Step 5: Add case to processEmailIngestion switch**

Add `case 'create_commessa': return handleCreateCommessa(payload)` to the switch.

- [ ] **Step 6: Update return type of processEmailIngestion**

Change return type to `Promise<ProcessingResult>`.

- [ ] **Step 7: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/server/services/email-ingestion.service.ts src/server/services/notification.service.ts && git commit -m "feat: add handleCreateCommessa to email ingestion pipeline"
```

---

### Task 22: Extend request form with commessa dropdown

**Files:**
- Modify: `src/components/requests/request-form.tsx`

- [ ] **Step 1: Add commessa dropdown**

In the request creation form, add an optional searchable select for Commessa in the organizational section (near department/category fields):

1. Import `useCommesse` hook
2. Fetch commesse filtered by status `PLANNING` and `ACTIVE`
3. Add a select dropdown labeled "Commessa" with placeholder "Nessuna commessa"
4. When selected, auto-fill department and category from commessa data if available
5. Pass `commessa_id` to the request creation payload

- [ ] **Step 2: Type check + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
cd procureflow && git add src/components/requests/request-form.tsx && git commit -m "feat: add commessa dropdown to request creation form"
```

---

### Task 23: Add seed data for clients and commesse

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add client and commessa seed data**

Add sample data after the existing seed logic:

```typescript
// Sample clients
const clients = [
  { code: 'CLI-001', name: 'Faleni S.r.l.', tax_id: '12345678901', email: 'ordini@faleni.it', contact_person: 'Mario Faleni', status: 'ACTIVE' as const },
  { code: 'CLI-002', name: 'TechCorp Italia', tax_id: '98765432109', email: 'procurement@techcorp.it', contact_person: 'Laura Bianchi', status: 'ACTIVE' as const },
  { code: 'CLI-003', name: 'Elettronica Rossi', email: 'info@elettronicarossi.it', status: 'PENDING_REVIEW' as const },
]

for (const c of clients) {
  await prisma.client.upsert({
    where: { code: c.code },
    update: {},
    create: c,
  })
}

// Sample commesse linked to first client
const cli001 = await prisma.client.findUnique({ where: { code: 'CLI-001' } })
if (cli001) {
  const commesse = [
    { code: 'COM-2026-00001', title: 'Cavi potenza VBM Freccia', status: 'ACTIVE' as const, client_id: cli001.id, client_value: new Prisma.Decimal(45000), priority: 'HIGH' as const, deadline: new Date('2026-05-15') },
    { code: 'COM-2026-00002', title: 'Schede elettroniche SMT lotto 3', status: 'PLANNING' as const, client_id: cli001.id, client_value: new Prisma.Decimal(22000), priority: 'MEDIUM' as const },
  ]

  for (const cm of commesse) {
    await prisma.commessa.upsert({
      where: { code: cm.code },
      update: {},
      create: cm,
    })
  }
}
```

- [ ] **Step 2: Run seed**

Run: `cd procureflow && npx prisma db seed`
Expected: Seed completes successfully

- [ ] **Step 3: Commit**

```bash
cd procureflow && git add prisma/seed.ts && git commit -m "feat: add client and commessa seed data"
```

---

### Task 24: Final verification

- [ ] **Step 1: Type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run all tests**

Run: `cd procureflow && npx vitest run`
Expected: All existing tests pass + new tests pass

- [ ] **Step 3: Build**

Run: `cd procureflow && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Manual smoke test**

Start the dev server and verify:
1. Navigate to `/clients` — should show the client list with seed data
2. Create a new client via the dialog
3. Navigate to `/commesse` — should show commesse list with seed data
4. Create a new commessa manually, selecting a client
5. Navigate to commessa detail page — should show margin cards, tabs
6. Check dashboard — should show "Commesse" tab with stats
7. Check sidebar — should show Commesse and Clienti nav items (when module enabled)

- [ ] **Step 5: Final commit if any fixes needed**

```bash
cd procureflow && git add -u && git commit -m "fix: address smoke test issues"
```
