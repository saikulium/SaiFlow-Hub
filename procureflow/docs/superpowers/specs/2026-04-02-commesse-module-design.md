# Commesse Module — Design Spec

## Goal

Add a "Commesse" (Projects/Jobs) module to ProcureFlow that tracks client orders, links them to purchase requests, and calculates margin. When a client order arrives via PEC email, the system creates a commessa and suggests draft purchase requests for the operator to confirm.

## Architecture

The module introduces two new database models (Client, Commessa) plus a CommessaTimeline for audit trail. It integrates with the existing email ingestion pipeline via a new AI intent (`CLIENT_ORDER`) and extends the PurchaseRequest model with an optional `commessa_id` foreign key. The module follows the established registry pattern for feature-flagging, navigation, and API routing.

## Tech Stack

- Prisma (schema migration)
- Next.js API Routes (CRUD + suggestion endpoints)
- React + TanStack Query (UI)
- Zod (validation)
- Existing email AI classifier (extended with new intent)

---

## 1. Data Model

### 1.1 Client

New model for client companies (separate from Vendor).

```prisma
model Client {
  id              String        @id @default(cuid())
  code            String        @unique           // "CLI-001"
  name            String
  tax_id          String?                          // P.IVA
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
}

enum ClientStatus {
  ACTIVE
  INACTIVE
  PENDING_REVIEW     // Auto-created from unknown email sender, needs operator verification
}
```

### 1.2 Commessa

Central entity linking a client order to purchase requests.

```prisma
model Commessa {
  id               String          @id @default(cuid())
  code             String          @unique           // "COM-2026-00001"
  title            String
  description      String?
  status           CommessaStatus  @default(DRAFT)

  // Client relation
  client_id        String
  client           Client          @relation(fields: [client_id], references: [id])

  // Value tracking (no budget — margin = client_value - SUM(requests.actual_amount))
  client_value     Decimal?        @db.Decimal(12,2) // What the client pays
  currency         String          @default("EUR")

  // Dates
  received_at      DateTime?                          // When order arrived
  deadline         DateTime?                          // Delivery deadline to client
  completed_at     DateTime?

  // Metadata
  category         String?
  department       String?
  priority         Priority        @default(MEDIUM)
  tags             String[]
  assigned_to      String?                            // User ID (FK to User.id)
  assigned_user    User?          @relation(fields: [assigned_to], references: [id])

  // Email source (dedup)
  email_message_id String?         @unique

  created_at       DateTime        @default(now())
  updated_at       DateTime        @updatedAt

  // Relations
  requests         PurchaseRequest[]
  timeline         CommessaTimeline[]

  @@index([status, created_at])
  @@index([client_id])
  @@index([deadline])
}

enum CommessaStatus {
  DRAFT             // Just received, pending evaluation
  PLANNING          // Planning purchases
  ACTIVE            // Purchases in progress
  ON_HOLD
  COMPLETED         // Delivered to client
  CANCELLED
}
```

### 1.3 CommessaTimeline

Audit trail for commessa events (mirrors TimelineEvent pattern).

```prisma
model CommessaTimeline {
  id               String    @id @default(cuid())
  commessa_id      String
  commessa         Commessa  @relation(fields: [commessa_id], references: [id], onDelete: Cascade)

  type             String    // "created", "email_received", "pr_suggested", "pr_accepted",
                             // "pr_rejected", "status_change", "comment"
  title            String
  description      String?
  metadata         Json?
  actor            String?
  email_message_id String?

  created_at       DateTime  @default(now())

  @@index([commessa_id, created_at])
}
```

### 1.4 User Model Extension

Add reverse relation for commessa assignment:

```prisma
// Add to existing User model:
commesse_assigned  Commessa[]
```

### 1.5 PurchaseRequest Extension

```prisma
// Add to existing PurchaseRequest model:
commessa_id       String?
commessa          Commessa?  @relation(fields: [commessa_id], references: [id])
is_ai_suggested   Boolean    @default(false)  // True = AI-generated draft, pending operator confirmation

@@index([commessa_id])
```

### 1.6 Commessa State Machine

```
DRAFT ──────► PLANNING ──────► ACTIVE ──────► COMPLETED
  │              │                │
  └──► CANCELLED └──► ON_HOLD ◄──┘
                      │
                      └──► PLANNING / ACTIVE (resume)
```

---

## 2. Email Ingestion — Client Order Flow

### 2.1 New AI Intent: ORDINE_CLIENTE

Add to `EmailIntent` type in `email-ai-classifier.service.ts` (follows existing Italian naming convention):

```typescript
export type EmailIntent =
  | 'CONFERMA_ORDINE'
  | 'RITARDO_CONSEGNA'
  | 'VARIAZIONE_PREZZO'
  | 'RICHIESTA_INFO'
  | 'FATTURA_ALLEGATA'
  | 'ALTRO'
  | 'ORDINE_CLIENTE'    // Un cliente ci ordina prodotti/servizi
```

Also add `'ORDINE_CLIENTE'` to `VALID_INTENTS` set and update the classification prompt to include:
- `ORDINE_CLIENTE`: Il mittente è un cliente che ordina prodotti/servizi DA NOI (non un fornitore che comunica su un nostro ordine A LORO)

### 2.2 Intent-to-Action Mapping

Extend `INTENT_TO_ACTION` and `actionTypeSchema`:

```typescript
// In email-ai-classifier.service.ts — import ActionType and update map:
import type { ActionType } from '@/lib/validations/email-ingestion'

const INTENT_TO_ACTION: Record<EmailIntent, ActionType> = {
  CONFERMA_ORDINE: 'update_existing',
  RITARDO_CONSEGNA: 'update_existing',
  VARIAZIONE_PREZZO: 'update_existing',
  RICHIESTA_INFO: 'info_only',
  FATTURA_ALLEGATA: 'info_only',
  ALTRO: 'info_only',
  ORDINE_CLIENTE: 'create_commessa',  // NEW
}

// In validations/email-ingestion.ts — extend actionTypeSchema:
const actionTypeSchema = z.enum(['new_request', 'update_existing', 'info_only', 'create_commessa'])
// ActionType union automatically updates via z.infer

// In email-ingestion.service.ts — narrow IngestionResult.action for type safety:
// IngestionResult.action should use Exclude<ActionType, 'create_commessa'>
// so the discriminated union ProcessingResult = IngestionResult | CommessaIngestionResult works correctly
interface IngestionResult {
  readonly action: Exclude<ActionType, 'create_commessa'>
  // ... rest unchanged
}
```

Also update in `email-ai-classifier.service.ts`:
- Add `'ORDINE_CLIENTE'` to the `VALID_INTENTS` set
- Add `ORDINE_CLIENTE` to the `AiClassificationResponse` interface's intent field
- Update the `CLASSIFICATION_PROMPT` to include the new intent in the categories list

### 2.3 Extended AI Classification Response

Extend `ClassificationResult.extracted_data` (nested under existing structure):

```typescript
// In email-ai-classifier.service.ts — extend extracted_data:
export interface ClassificationResult {
  readonly intent: EmailIntent
  readonly confidence: number
  readonly extracted_data: {
    // Existing fields:
    readonly matched_request_code?: string
    readonly vendor_name?: string
    readonly external_ref?: string
    readonly new_amount?: number
    readonly new_delivery_date?: string
    readonly tracking_number?: string
    readonly summary: string
    // New fields for ORDINE_CLIENTE:
    readonly client_name?: string              // Extracted client company name
    readonly client_code?: string              // Matched client code if found in DB
    readonly client_order_items?: readonly {   // Structured items for PR generation
      readonly description: string
      readonly quantity?: number
      readonly unit?: string
      readonly estimated_unit_price?: number
    }[]
    readonly client_deadline?: string          // Requested delivery date
    readonly client_value?: number             // Total order value if stated
  }
}
```

### 2.4 Update `mapClassificationToPayload`

Extend the mapping function to populate commessa-specific fields:

```typescript
// In email-ai-classifier.service.ts — add to mapClassificationToPayload return:
export function mapClassificationToPayload(
  raw: RawEmailData,
  classification: ClassificationResult,
): EmailIngestionPayload {
  const action = INTENT_TO_ACTION[classification.intent]
  // ... existing fields ...
  return {
    // ... existing mapping ...

    // New commessa fields (only populated for ORDINE_CLIENTE):
    ai_client_name: classification.extracted_data.client_name,
    ai_client_code: classification.extracted_data.client_code,
    ai_client_order_items: classification.extracted_data.client_order_items ?? [],
    ai_client_deadline: classification.extracted_data.client_deadline,
    ai_client_value: classification.extracted_data.client_value,
  }
}
```

### 2.5 New Action: `create_commessa`

Add a new handler function in `email-ingestion.service.ts`. **Unlike the existing handlers which use the raw `prisma` client, `handleCreateCommessa` uses a `$transaction` because it atomically creates multiple entities (Commessa + N PurchaseRequests + timeline event + notifications).**

```typescript
// New return type for commessa ingestion (extends existing IngestionResult pattern):
interface CommessaIngestionResult {
  readonly action: 'create_commessa'
  readonly commessa_id: string
  readonly commessa_code: string
  readonly suggested_prs_created: number
  readonly timeline_event_id: string
  readonly ai_confidence: number | null
  readonly deduplicated: boolean
}

// processEmailIngestion return type becomes a union:
type ProcessingResult = IngestionResult | CommessaIngestionResult

// New handler:
async function handleCreateCommessa(
  data: EmailIngestionPayload,
): Promise<CommessaIngestionResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Resolve client (match sender email domain to Client, or auto-create with PENDING_REVIEW)
    const client = await resolveClient(data.email_from, data.ai_client_name, tx)

    // 2. Generate commessa code using refactored atomic generator
    const code = await generateNextCodeAtomic('COM', 'commesse', tx)

    // 3. Create Commessa in DRAFT status
    const commessa = await tx.commessa.create({
      data: {
        code,
        title: data.email_subject ?? 'Ordine cliente',
        description: data.ai_summary,
        status: 'DRAFT',
        client_id: client.id,
        client_value: data.ai_client_value ? new Prisma.Decimal(data.ai_client_value) : null,
        currency: data.ai_currency ?? 'EUR',
        received_at: new Date(),
        deadline: data.ai_client_deadline ? new Date(data.ai_client_deadline) : null,
        email_message_id: data.email_message_id,
      },
    })

    // 4. Generate suggested PRs for each extracted item
    let prsCreated = 0
    for (const item of data.ai_client_order_items ?? []) {
      const prCode = await generateNextCodeAtomic('PR', 'purchase_requests', tx)
      await tx.purchaseRequest.create({
        data: {
          code: prCode,
          title: item.description,
          status: 'DRAFT',
          commessa_id: commessa.id,
          is_ai_suggested: true,
          estimated_amount: item.estimated_unit_price
            ? new Prisma.Decimal(item.estimated_unit_price * (item.quantity ?? 1))
            : null,
          requester_id: SYSTEM_USER_ID,
        },
      })
      prsCreated++
    }

    // 5. Create timeline event
    const event = await tx.commessaTimeline.create({
      data: {
        commessa_id: commessa.id,
        type: 'created',
        title: 'Commessa creata da email PEC',
        description: `Email da ${data.email_from}: ${data.email_subject}`,
        email_message_id: data.email_message_id,
        actor: 'system',
      },
    })

    // 6. Notify ADMIN/MANAGER users
    const admins = await tx.user.findMany({
      where: { role: { in: ['ADMIN', 'MANAGER'] } },
      select: { id: true },
    })
    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: NOTIFICATION_TYPES.COMMESSA_CREATED,
        title: `Nuova commessa: ${code}`,
        body: `Ordine cliente da ${client.name}`,
        link: `/commesse/${code}`,
      }, tx)
    }

    return {
      action: 'create_commessa' as const,
      commessa_id: commessa.id,
      commessa_code: code,
      suggested_prs_created: prsCreated,
      timeline_event_id: event.id,
      ai_confidence: data.ai_confidence ?? null,
      deduplicated: false,
    }
  })
}

// Main processEmailIngestion switch — add branch:
export async function processEmailIngestion(
  payload: EmailIngestionPayload,
): Promise<ProcessingResult> {
  switch (payload.action) {
    case 'new_request':     return handleNewRequest(payload)
    case 'update_existing': return handleUpdateExisting(payload)
    case 'create_commessa': return handleCreateCommessa(payload)
    case 'info_only':       return handleInfoOnly(payload)
  }
}
```

### 2.6 Auto-Generation of Codes

The existing `generateNextCodeAtomic()` in `code-generator.service.ts` is hardcoded for `PR-YYYY-NNNNN` codes with its own internal `$transaction`. It must be **refactored** to accept a prefix and table name parameter:

```typescript
// Refactored signature in code-generator.service.ts:
export async function generateNextCodeAtomic(
  prefix: string,                               // 'PR', 'COM', 'CLI'
  table: string,                                // 'purchase_requests', 'commesse', 'clients'
  tx?: Prisma.TransactionClient,                // Optional — use external tx if in transaction
): Promise<string> {
  const year = new Date().getFullYear()
  const fullPrefix = `${prefix}-${year}-`
  const client = tx ?? prisma

  const rows = await client.$queryRawUnsafe<{ code: string }[]>(
    `SELECT code FROM ${table}
     WHERE code LIKE $1
     ORDER BY code DESC
     LIMIT 1
     FOR UPDATE`,
    `${fullPrefix}%`,
  )
  const lastNum = rows[0]?.code
    ? parseInt(rows[0].code.split('-').pop() ?? '0', 10)
    : 0
  return `${fullPrefix}${String(lastNum + 1).padStart(5, '0')}`
}

// Usage in handleCreateCommessa (within its $transaction):
const code = await generateNextCodeAtomic('COM', 'commesse', tx)
const prCode = await generateNextCodeAtomic('PR', 'purchase_requests', tx)

// Client code (no year prefix): CLI-NNN
// Use a separate helper or pass a flag to omit year from prefix
```

For the Client create API (manual creation), the `code` field in the schema is optional — if omitted, auto-generate via the refactored code generator.

### 2.7 How AI Distinguishes Client vs Supplier Email

Three signals:
1. **Known client**: Sender email domain matches a Client record → `ORDINE_CLIENTE`
2. **Content analysis**: AI detects "ordering from us" language ("vi chiediamo di fornire...", "ordiniamo...", "ci servono N pezzi di...") vs "updating our order" language ("confermiamo il vostro ordine...", "spedizione in corso...")
3. **Unknown sender + uncertain AI** (confidence < 0.8): Classify as `ALTRO` with tag `possibile-ordine-cliente` → operator decides manually

### 2.8 Email Ingestion Schema Extension

Add to `emailIngestionSchema` in `validations/email-ingestion.ts`:

```typescript
// New fields in emailIngestionSchema:
ai_client_name: nullableString,
ai_client_code: nullableString,
ai_client_order_items: z.array(z.object({
  description: z.string(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  estimated_unit_price: z.number().nullable().optional(),
})).nullable().optional(),
ai_client_deadline: nullableString,
ai_client_value: z.number().nullable().optional(),
```

---

## 3. API Routes

### 3.1 Clients

```
GET    /api/clients              — List clients (paginated, filterable by status/name)
POST   /api/clients              — Create client
GET    /api/clients/[id]         — Get client detail + commesse count
PATCH  /api/clients/[id]         — Update client
DELETE /api/clients/[id]         — Soft-delete (set INACTIVE)
```

### 3.2 Commesse

```
GET    /api/commesse                          — List commesse (filterable by status/client/date)
POST   /api/commesse                          — Create commessa manually
GET    /api/commesse/[code]                   — Get commessa detail + requests + timeline + margin calc
PATCH  /api/commesse/[code]                   — Update commessa (status, details)
POST   /api/commesse/[code]/accept-suggestion — Accept AI-suggested PR (sets is_ai_suggested=false, status=SUBMITTED)
DELETE /api/commesse/[code]/suggestions/[id]  — Reject AI-suggested PR (deletes the draft PR)
PATCH  /api/commesse/[code]/suggestions/[id]  — Modify AI-suggested PR before accepting
GET    /api/commesse/stats                    — Dashboard stats (active count, total value, avg margin, due soon)
```

### 3.3 Suggestion Acceptance — Concurrency

The `accept-suggestion` endpoint must handle concurrent access (two operators accepting/rejecting the same suggestion simultaneously):

```typescript
// POST /api/commesse/[code]/accept-suggestion
// Use optimistic concurrency: check is_ai_suggested=true before updating
const updated = await prisma.purchaseRequest.updateMany({
  where: {
    id: suggestionId,
    commessa_id: commessa.id,
    is_ai_suggested: true,   // Only update if still a suggestion
  },
  data: {
    is_ai_suggested: false,
    status: 'SUBMITTED',
  },
})
if (updated.count === 0) {
  return NextResponse.json({ error: 'Suggestion already processed' }, { status: 409 })
}
```

### 3.4 Pagination

All list endpoints (`GET /api/clients`, `GET /api/commesse`) support cursor-based pagination following the existing pattern:

```typescript
// Query params: ?cursor=<id>&limit=25&status=ACTIVE&search=...
// Response: { data: [...], nextCursor: string | null, total: number }
```

### 3.5 Margin Calculation (computed, not stored)

```typescript
// In commessa detail endpoint:
const totalCosts = await prisma.purchaseRequest.aggregate({
  where: { commessa_id: commessa.id, status: { notIn: ['CANCELLED', 'DRAFT'] } },
  _sum: { actual_amount: true, estimated_amount: true },
})

const costs = totalCosts._sum.actual_amount ?? totalCosts._sum.estimated_amount ?? 0
const margin = (commessa.client_value ?? 0) - costs
const marginPercent = commessa.client_value ? (margin / commessa.client_value) * 100 : 0
```

---

## 4. UI Components

### 4.1 Page: `/commesse` — List

Table with columns:
- Codice, Titolo, Cliente, Stato (badge), Valore Cliente, Costi, Margine (colored), Scadenza, PR Count
- Filters: status, client, date range
- Sort by: date, deadline, margin
- Action: + Nuova Commessa (opens create dialog)

### 4.2 Page: `/commesse/[code]` — Detail

Header: code, title, status badge, client name, deadline, assigned_to

Three stat cards:
- Valore Cliente (what the client pays)
- Costi Acquisti (sum of linked PR amounts)
- Margine (difference, green if positive, red if negative, with %)

Three tabs:
- **Richieste**: List of linked PRs with status. Section for AI suggestions with Accept/Modify/Reject buttons. Button to add new PR linked to this commessa.
- **Timeline**: Chronological events (email received, PR created, status changes)
- **Dettagli**: Edit form for commessa metadata (description, category, deadline, tags, assigned_to, client_value)

### 4.3 Page: `/clients` — Client List

Simple CRUD table (mirrors Vendors page pattern):
- Columns: Codice, Nome, P.IVA, Email, Contatto, Stato, Commesse Attive (count)
- Create/Edit via modal dialog
- No separate detail page (too simple — modal is enough)

### 4.4 Dashboard Tab: "Commesse"

Four summary cards:
- Commesse attive (count)
- Valore totale in corso (sum client_value of ACTIVE)
- Margine medio (avg margin % across ACTIVE)
- In scadenza (count where deadline <= now + 7 days)

Mini table: top 5 commesse attive by deadline (soonest first).

### 4.5 Request Form Extension

Add optional `Commessa` dropdown (searchable select) in the organizational section of the request creation form. Shows only PLANNING/ACTIVE commesse. When selected, auto-fills department and category from commessa if available.

### 4.6 UI States

All pages implement the standard ProcureFlow state pattern:

- **Loading**: Skeleton shimmer placeholders matching the layout structure (cards, table rows)
- **Error**: Centered error message with retry button, styled with `border-pf-danger/30 bg-pf-danger/5`
- **Empty**: Illustrated empty state with CTA ("Crea la tua prima commessa", "Aggiungi un cliente")
- **Suggestion card states**: Accept → optimistic update (green flash, move to "Richieste" section), Reject → confirm dialog → optimistic removal with undo toast

### 4.7 Sidebar Navigation

Two new nav items (visible when `commesse` module enabled):
- "Commesse" (icon: Briefcase) → `/commesse`
- "Clienti" (icon: Building2) → `/clients`

---

## 5. Module Registry

Add `'commesse'` to the `ModuleId` union type in `registry.ts`:

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
  | 'commesse'        // NEW
```

Register the module in `MODULE_REGISTRY`:

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

---

## 6. Validation Schemas (Zod)

### Client

```typescript
export const createClientSchema = z.object({
  code: z.string().min(1).max(20).optional(),  // Auto-generated via generateNextCodeAtomic if omitted
  name: z.string().min(1).max(200),
  tax_id: z.string().max(20).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  contact_person: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
})
```

### Commessa

```typescript
export const createCommessaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  client_id: z.string().min(1),
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
  status: z.enum(['DRAFT','PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED']).optional(),
})
```

---

## 7. Files to Create/Modify

### New files (~30)
- `prisma/schema.prisma` — Add Client, Commessa, CommessaTimeline models + PR/User extensions
- `src/lib/validations/commesse.ts` — Zod schemas
- `src/lib/validations/client.ts` — Zod schemas
- `src/types/index.ts` — Add Commessa/Client types
- `src/server/services/commessa.service.ts` — Business logic
- `src/app/api/clients/route.ts` — Client CRUD
- `src/app/api/clients/[id]/route.ts` — Client detail
- `src/app/api/commesse/route.ts` — Commessa list + create
- `src/app/api/commesse/[code]/route.ts` — Commessa detail + update
- `src/app/api/commesse/[code]/accept-suggestion/route.ts` — Accept PR
- `src/app/api/commesse/[code]/suggestions/[id]/route.ts` — Reject/modify PR
- `src/app/api/commesse/stats/route.ts` — Dashboard stats
- `src/app/(dashboard)/commesse/page.tsx` — Commesse list page
- `src/app/(dashboard)/commesse/loading.tsx` — Skeleton loader
- `src/app/(dashboard)/commesse/error.tsx` — Error boundary
- `src/app/(dashboard)/commesse/[code]/page.tsx` — Commesse detail page
- `src/app/(dashboard)/commesse/[code]/loading.tsx` — Skeleton loader
- `src/app/(dashboard)/commesse/[code]/error.tsx` — Error boundary
- `src/app/(dashboard)/clients/page.tsx` — Clients page
- `src/app/(dashboard)/clients/loading.tsx` — Skeleton loader
- `src/app/(dashboard)/clients/error.tsx` — Error boundary
- `src/components/commesse/commesse-page-content.tsx` — List component
- `src/components/commesse/commessa-detail.tsx` — Detail component
- `src/components/commesse/suggestion-card.tsx` — AI suggestion accept/reject UI
- `src/components/commesse/commessa-create-dialog.tsx` — Create dialog
- `src/components/clients/clients-page-content.tsx` — Client list
- `src/components/clients/client-dialog.tsx` — Create/edit modal
- `src/components/dashboard/commesse-tab.tsx` — Dashboard tab
- `src/hooks/use-commesse.ts` — TanStack Query hooks
- `src/hooks/use-clients.ts` — TanStack Query hooks

### Modified files (~8)
- `src/lib/modules/registry.ts` — Add `'commesse'` to ModuleId union + register module
- `src/lib/constants.ts` — Add nav items for Commesse and Clienti
- `src/types/index.ts` — Add Commessa/Client TypeScript types
- `src/components/requests/request-form.tsx` — Add commessa dropdown
- `src/server/services/email-ai-classifier.service.ts` — Add `ORDINE_CLIENTE` intent, extend `extracted_data`, update `mapClassificationToPayload`
- `src/server/services/email-ingestion.service.ts` — Add `handleCreateCommessa` handler, extend `ProcessingResult` union
- `src/lib/validations/email-ingestion.ts` — Extend `actionTypeSchema` with `'create_commessa'`, add `ai_client_*` fields
- `prisma/seed.ts` — Add sample Clients and Commesse for dev/demo

---

## 8. Out of Scope

- BOM (Bill of Materials) / distinta base — future enhancement
- Client portal (client self-service) — future
- Invoicing to clients (fatturazione attiva) — future, but Client model is ready for it
- Budget per commessa — explicitly excluded per requirements
