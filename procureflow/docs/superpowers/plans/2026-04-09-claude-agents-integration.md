# Claude Managed Agents — Piano di Implementazione Completo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrare Claude Managed Agents in ProcureFlow per automatizzare procurement, email processing, riconciliazione fatture, riordino inventario, analisi gare, compliance monitoring e onboarding clienti — tutto su misura per PMI italiane.

**Architecture:** 8 fasi incrementali. Phase 0 fix le breaking changes (modelli retired). Phase 1 upgrada il chat agent da loop manuale a tool runner. Phases 2-7 aggiungono agenti specializzati, ognuno con tool Zod-typed, structured outputs, e (dove serve) Files API o adaptive thinking. Ogni agente espone un API route Next.js e si integra con l'infrastruttura notifiche/webhook esistente.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, `@anthropic-ai/sdk ^0.78`, Zod v4, Prisma, PostgreSQL, `betaZodTool` + `toolRunner` per agenti, `messages.parse()` per structured output, Files API per PDF, adaptive thinking (Opus 4.6) per decisioni complesse.

---

## File Structure Map

### New Files

```
src/lib/ai/
  models.ts                         # Model constants + selection helper
  schemas/
    email-classification.schema.ts  # Zod schema for email classification
    invoice-extraction.schema.ts    # Zod schema for invoice OCR
    tender-analysis.schema.ts       # Zod schema for tender go/no-go
    reorder-suggestion.schema.ts    # Zod schema for reorder agent output
    compliance-check.schema.ts      # Zod schema for compliance monitor output
    onboarding-import.schema.ts     # Zod schema for onboarding agent output

src/server/agents/
  tools/
    procurement.tools.ts            # betaZodTool: search_requests, get_detail, etc.
    invoice.tools.ts                # betaZodTool: parse_invoice, match_invoice, etc.
    inventory.tools.ts              # betaZodTool: get_stock, get_forecast, etc.
    vendor.tools.ts                 # betaZodTool: search_vendors, get_history, etc.
    notification.tools.ts           # betaZodTool: send_notification, create_timeline
    commessa.tools.ts               # betaZodTool: search_commesse, create_commessa
    budget.tools.ts                 # betaZodTool: check_budget, get_budget_overview
  email-intelligence.agent.ts       # Phase 2: Multi-step email processor
  invoice-reconciliation.agent.ts   # Phase 3: Three-way match + dispute resolution
  procurement-assistant.agent.ts    # Phase 1: Upgraded chat agent (replaces agent.service)
  smart-reorder.agent.ts            # Phase 4: Auto-draft reorder PRs
  tender-analysis.agent.ts          # Phase 5: Go/no-go analysis with Opus
  compliance-monitor.agent.ts       # Phase 6: Background deadline/DURC checker
  onboarding.agent.ts               # Phase 7: Excel/CSV vendor import

src/app/api/agents/
  reorder/route.ts                  # Trigger smart reorder
  tender-analysis/route.ts          # Trigger tender analysis
  compliance/route.ts               # Trigger compliance check
  onboarding/[sessionId]/route.ts   # Onboarding agent session

tests/server/agents/
  tools/procurement.tools.test.ts
  tools/invoice.tools.test.ts
  email-intelligence.agent.test.ts
  invoice-reconciliation.agent.test.ts
  smart-reorder.agent.test.ts
  tender-analysis.agent.test.ts
  compliance-monitor.agent.test.ts
  onboarding.agent.test.ts
```

### Modified Files

```
src/lib/ai/claude-client.ts          # Fix retired model, add parse/files helpers
src/lib/ai/tool-registry.ts          # Add new tools for commesse, materials, alerts
src/server/services/
  email-ai-classifier.service.ts     # Phase 0: model fix + structured output
  invoice-ai-parser.service.ts       # Phase 0: model fix + Files API
  suggest.service.ts                 # Phase 0: model fix
  agent.service.ts                   # Phase 1: replace with tool runner
  forecast.service.ts                # Phase 4: integrate with reorder agent
  insight.service.ts                 # Phase 0: model fix via callClaude default
  three-way-matching.service.ts      # Phase 3: add AI explanation output
src/app/api/webhooks/
  email-ingestion/classify/route.ts  # Phase 2: connect to email intelligence agent
src/app/api/chat/route.ts            # Phase 1: use new procurement-assistant agent
src/components/chat/chat-panel.tsx    # Phase 1: enhanced tool feedback UI
src/components/invoices/
  reconciliation-dialog.tsx          # Phase 3: AI explanation panel
src/components/tenders/
  tender-detail-content.tsx          # Phase 5: go/no-go result panel
```

---

## Phase 0: Foundation — Fix Breaking Changes

### Task 0.1: Create Model Constants + Fix Retired Models

**Files:**
- Create: `src/lib/ai/models.ts`
- Modify: `src/lib/ai/claude-client.ts:27`
- Modify: `src/server/services/email-ai-classifier.service.ts:17`
- Modify: `src/server/services/invoice-ai-parser.service.ts:14`
- Modify: `src/server/services/suggest.service.ts:13`
- Test: `tests/lib/ai/models.test.ts`

- [ ] **Step 1: Write test for model constants**

```typescript
// tests/lib/ai/models.test.ts
import { describe, it, expect } from 'vitest'
import { MODELS, getModelForTask } from '@/lib/ai/models'

describe('models', () => {
  it('exports valid model IDs', () => {
    expect(MODELS.SONNET).toBe('claude-sonnet-4-6')
    expect(MODELS.OPUS).toBe('claude-opus-4-6')
    expect(MODELS.HAIKU).toBe('claude-haiku-4-5')
  })

  it('returns correct model for task type', () => {
    expect(getModelForTask('classification')).toBe('claude-sonnet-4-6')
    expect(getModelForTask('extraction')).toBe('claude-sonnet-4-6')
    expect(getModelForTask('chat')).toBe('claude-sonnet-4-6')
    expect(getModelForTask('reasoning')).toBe('claude-opus-4-6')
    expect(getModelForTask('simple')).toBe('claude-haiku-4-5')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd procureflow && npx vitest run tests/lib/ai/models.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create models.ts**

```typescript
// src/lib/ai/models.ts

export const MODELS = {
  /** Best combo speed + intelligence. Default for most tasks. */
  SONNET: 'claude-sonnet-4-6',
  /** Deepest reasoning. Use for complex decisions (go/no-go, disputes). */
  OPUS: 'claude-opus-4-6',
  /** Fastest, cheapest. Simple classification, quick lookups. */
  HAIKU: 'claude-haiku-4-5',
} as const

export type ModelId = (typeof MODELS)[keyof typeof MODELS]

type TaskType = 'classification' | 'extraction' | 'chat' | 'reasoning' | 'simple'

const TASK_MODEL_MAP: Record<TaskType, ModelId> = {
  classification: MODELS.SONNET,
  extraction: MODELS.SONNET,
  chat: MODELS.SONNET,
  reasoning: MODELS.OPUS,
  simple: MODELS.HAIKU,
}

export function getModelForTask(task: TaskType): ModelId {
  return TASK_MODEL_MAP[task]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd procureflow && npx vitest run tests/lib/ai/models.test.ts`
Expected: PASS

- [ ] **Step 5: Fix all retired model references**

In `src/lib/ai/claude-client.ts` line 27, change:
```typescript
// BEFORE
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
// AFTER
import { MODELS } from '@/lib/ai/models'
const DEFAULT_MODEL = MODELS.SONNET
```

In `src/server/services/email-ai-classifier.service.ts` line 17, change:
```typescript
// BEFORE
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
// AFTER
import { MODELS } from '@/lib/ai/models'
const DEFAULT_MODEL = MODELS.SONNET
```

In `src/server/services/invoice-ai-parser.service.ts` line 14, change:
```typescript
// BEFORE
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
// AFTER
import { MODELS } from '@/lib/ai/models'
const DEFAULT_MODEL = MODELS.SONNET
```

In `src/server/services/suggest.service.ts` line 13, change:
```typescript
// BEFORE
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
// AFTER
import { MODELS } from '@/lib/ai/models'
const DEFAULT_MODEL = MODELS.SONNET
```

- [ ] **Step 6: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
cd procureflow
git add src/lib/ai/models.ts tests/lib/ai/models.test.ts src/lib/ai/claude-client.ts src/server/services/email-ai-classifier.service.ts src/server/services/invoice-ai-parser.service.ts src/server/services/suggest.service.ts
git commit -m "fix: replace retired claude-sonnet-4-5 with sonnet-4-6 across all services"
```

---

### Task 0.2: Add Structured Output Schemas

**Files:**
- Create: `src/lib/ai/schemas/email-classification.schema.ts`
- Create: `src/lib/ai/schemas/invoice-extraction.schema.ts`
- Modify: `src/server/services/email-ai-classifier.service.ts`
- Modify: `src/server/services/invoice-ai-parser.service.ts`
- Test: `tests/lib/ai/schemas/email-classification.schema.test.ts`

- [ ] **Step 1: Write test for email classification schema**

```typescript
// tests/lib/ai/schemas/email-classification.schema.test.ts
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { EmailClassificationSchema, EMAIL_INTENTS } from '@/lib/ai/schemas/email-classification.schema'

describe('EmailClassificationSchema', () => {
  it('validates a correct classification', () => {
    const valid = {
      intent: 'CONFERMA_ORDINE',
      confidence: 0.92,
      matched_request_code: 'PR-2026-00042',
      vendor_name: 'Amphenol Italia',
      external_ref: 'PO-12345',
      new_amount: null,
      new_delivery_date: null,
      tracking_number: null,
      summary: 'Il fornitore conferma la ricezione dell\'ordine PR-2026-00042.',
      client_name: null,
      client_code: null,
      client_order_items: null,
      client_deadline: null,
      client_value: null,
    }
    const result = EmailClassificationSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects invalid intent', () => {
    const invalid = {
      intent: 'INVALID_INTENT',
      confidence: 0.5,
      summary: 'test',
    }
    const result = EmailClassificationSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('clamps confidence to 0-1 range', () => {
    const result = EmailClassificationSchema.safeParse({
      intent: 'ALTRO',
      confidence: 1.5,
      summary: 'test',
      matched_request_code: null,
      vendor_name: null,
      external_ref: null,
      new_amount: null,
      new_delivery_date: null,
      tracking_number: null,
      client_name: null,
      client_code: null,
      client_order_items: null,
      client_deadline: null,
      client_value: null,
    })
    // Zod v4 doesn't auto-clamp — it rejects
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd procureflow && npx vitest run tests/lib/ai/schemas/email-classification.schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create email classification schema**

```typescript
// src/lib/ai/schemas/email-classification.schema.ts
import { z } from 'zod'

export const EMAIL_INTENTS = [
  'CONFERMA_ORDINE',
  'RITARDO_CONSEGNA',
  'VARIAZIONE_PREZZO',
  'RICHIESTA_INFO',
  'FATTURA_ALLEGATA',
  'ORDINE_CLIENTE',
  'ALTRO',
] as const

export type EmailIntent = (typeof EMAIL_INTENTS)[number]

const ClientOrderItemSchema = z.object({
  description: z.string(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
})

export const EmailClassificationSchema = z.object({
  intent: z.enum(EMAIL_INTENTS),
  confidence: z.number().min(0).max(1),
  matched_request_code: z.string().nullable(),
  vendor_name: z.string().nullable(),
  external_ref: z.string().nullable(),
  new_amount: z.number().nullable(),
  new_delivery_date: z.string().nullable(),
  tracking_number: z.string().nullable(),
  summary: z.string(),
  client_name: z.string().nullable(),
  client_code: z.string().nullable(),
  client_order_items: z.array(ClientOrderItemSchema).nullable(),
  client_deadline: z.string().nullable(),
  client_value: z.number().nullable(),
})

export type EmailClassification = z.infer<typeof EmailClassificationSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd procureflow && npx vitest run tests/lib/ai/schemas/email-classification.schema.test.ts`
Expected: PASS

- [ ] **Step 5: Create invoice extraction schema**

```typescript
// src/lib/ai/schemas/invoice-extraction.schema.ts
import { z } from 'zod'

const LineItemSchema = z.object({
  line_number: z.number(),
  description: z.string(),
  quantity: z.number(),
  unit_of_measure: z.string().nullable(),
  unit_price: z.number(),
  total_price: z.number(),
  vat_rate: z.number(),
})

const SupplierSchema = z.object({
  name: z.string(),
  vat_id: z.string(),
  tax_code: z.string().nullable(),
  vat_country: z.string().default('IT'),
})

const CustomerSchema = z.object({
  vat_id: z.string(),
  tax_code: z.string().nullable(),
})

const PaymentSchema = z.object({
  method: z.string().nullable(),
  due_date: z.string().nullable(),
  iban: z.string().nullable(),
  terms: z.string().nullable(),
})

export const InvoiceExtractionSchema = z.object({
  invoice_number: z.string(),
  invoice_date: z.string(),
  document_type: z.string().default('TD01'),
  total_amount: z.number(),
  total_taxable: z.number(),
  total_tax: z.number(),
  currency: z.string().default('EUR'),
  supplier: SupplierSchema,
  customer: CustomerSchema,
  causale: z.string().nullable(),
  pr_code_extracted: z.string().nullable(),
  line_items: z.array(LineItemSchema),
  payment: PaymentSchema.nullable(),
  ai_confidence: z.number().min(0).max(1),
})

export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>
```

- [ ] **Step 6: Refactor email-ai-classifier to use structured output**

Replace the body of `classifyEmailIntent()` in `src/server/services/email-ai-classifier.service.ts`:

```typescript
// Replace the entire classifyEmailIntent function with:
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { EmailClassificationSchema } from '@/lib/ai/schemas/email-classification.schema'

export async function classifyEmailIntent(
  email: RawEmailData,
): Promise<ClassificationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new EmailClassificationError(
      'AI_NOT_CONFIGURED',
      'ANTHROPIC_API_KEY non configurata.',
    )
  }

  const model = process.env.AI_EMAIL_MODEL ?? DEFAULT_MODEL
  const client = getClaudeClient()
  const emailContent = formatEmailForClassification(email)

  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 1024,
      system: CLASSIFICATION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `--- EMAIL DA CLASSIFICARE ---\n${emailContent}`,
        },
      ],
      output_format: EmailClassificationSchema,
    })

    const parsed = response.parsed_output
    if (!parsed) {
      throw new EmailClassificationError(
        'AI_NO_RESPONSE',
        'Claude non ha restituito dati strutturati',
      )
    }

    return {
      intent: parsed.intent as EmailIntent,
      confidence: parsed.confidence,
      extracted_data: {
        matched_request_code: parsed.matched_request_code ?? undefined,
        vendor_name: parsed.vendor_name ?? undefined,
        external_ref: parsed.external_ref ?? undefined,
        new_amount: parsed.new_amount ?? undefined,
        new_delivery_date: parsed.new_delivery_date ?? undefined,
        tracking_number: parsed.tracking_number ?? undefined,
        summary: parsed.summary,
        client_name: parsed.client_name ?? undefined,
        client_code: parsed.client_code ?? undefined,
        client_order_items: parsed.client_order_items ?? undefined,
        client_deadline: parsed.client_deadline ?? undefined,
        client_value: parsed.client_value ?? undefined,
      },
    }
  } catch (err) {
    if (err instanceof EmailClassificationError) throw err
    if (err instanceof Anthropic.APIError) {
      throw new EmailClassificationError(
        'AI_API_ERROR',
        `Errore Claude API: ${err.message}`,
      )
    }
    throw new EmailClassificationError(
      'AI_UNKNOWN_ERROR',
      `Errore imprevisto: ${String(err)}`,
    )
  }
}
```

- [ ] **Step 7: Verify build + commit**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

```bash
git add src/lib/ai/schemas/ src/server/services/email-ai-classifier.service.ts tests/lib/ai/schemas/
git commit -m "feat: add Zod structured output schemas for email classification and invoice extraction"
```

---

## Phase 1: Procurement Assistant Agent (Chat Upgrade)

### Task 1.1: Create betaZodTool Definitions for Procurement Tools

**Files:**
- Create: `src/server/agents/tools/procurement.tools.ts`
- Test: `tests/server/agents/tools/procurement.tools.test.ts`

- [ ] **Step 1: Write test for procurement tools**

```typescript
// tests/server/agents/tools/procurement.tools.test.ts
import { describe, it, expect } from 'vitest'
import { PROCUREMENT_READ_TOOLS, PROCUREMENT_WRITE_TOOLS } from '@/server/agents/tools/procurement.tools'

describe('procurement tools', () => {
  it('exports read tools as array', () => {
    expect(Array.isArray(PROCUREMENT_READ_TOOLS)).toBe(true)
    expect(PROCUREMENT_READ_TOOLS.length).toBeGreaterThan(0)
  })

  it('exports write tools as array', () => {
    expect(Array.isArray(PROCUREMENT_WRITE_TOOLS)).toBe(true)
    expect(PROCUREMENT_WRITE_TOOLS.length).toBeGreaterThan(0)
  })

  it('each tool has name and description', () => {
    for (const tool of [...PROCUREMENT_READ_TOOLS, ...PROCUREMENT_WRITE_TOOLS]) {
      expect(tool).toHaveProperty('name')
      expect(tool).toHaveProperty('description')
    }
  })

  it('search_requests tool exists', () => {
    const tool = PROCUREMENT_READ_TOOLS.find(t => t.name === 'search_requests')
    expect(tool).toBeDefined()
  })

  it('create_request tool exists', () => {
    const tool = PROCUREMENT_WRITE_TOOLS.find(t => t.name === 'create_request')
    expect(tool).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test — expect fail**

Run: `cd procureflow && npx vitest run tests/server/agents/tools/procurement.tools.test.ts`

- [ ] **Step 3: Create procurement tools with betaZodTool**

```typescript
// src/server/agents/tools/procurement.tools.ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const MAX_RESULTS = 20

// ---------------------------------------------------------------------------
// READ TOOLS
// ---------------------------------------------------------------------------

const searchRequests = betaZodTool({
  name: 'search_requests',
  description:
    'Cerca richieste di acquisto. Usa per domande su ordini, stato, spese.',
  inputSchema: z.object({
    status: z
      .enum([
        'DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
        'ORDERED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'ON_HOLD',
        'INVOICED', 'RECONCILED', 'CLOSED',
      ])
      .optional()
      .describe('Filtra per stato'),
    priority: z
      .enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
      .optional()
      .describe('Filtra per priorita'),
    search: z.string().optional().describe('Ricerca testo su codice o titolo'),
    pageSize: z.number().max(MAX_RESULTS).default(10).describe('Max risultati'),
  }),
  run: async (input) => {
    const where: Record<string, unknown> = { tenant_id: 'default' }
    if (input.status) where.status = input.status
    if (input.priority) where.priority = input.priority
    if (input.search) {
      where.OR = [
        { code: { contains: input.search, mode: 'insensitive' } },
        { title: { contains: input.search, mode: 'insensitive' } },
      ]
    }
    const [requests, total] = await prisma.$transaction([
      prisma.purchaseRequest.findMany({
        where,
        select: {
          code: true, title: true, status: true, priority: true,
          estimated_amount: true, actual_amount: true, currency: true,
          created_at: true, needed_by: true,
          vendor: { select: { name: true } },
          requester: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: input.pageSize,
      }),
      prisma.purchaseRequest.count({ where }),
    ])
    return JSON.stringify({ total, results: requests })
  },
})

const getRequestDetail = betaZodTool({
  name: 'get_request_detail',
  description:
    'Dettaglio completo di una richiesta per codice (es: PR-2026-00001).',
  inputSchema: z.object({
    code: z.string().describe('Codice richiesta PR-YYYY-NNNNN'),
  }),
  run: async (input) => {
    const request = await prisma.purchaseRequest.findUnique({
      where: { code: input.code },
      select: {
        code: true, title: true, description: true, status: true,
        priority: true, estimated_amount: true, actual_amount: true,
        currency: true, created_at: true, needed_by: true,
        ordered_at: true, expected_delivery: true, delivered_at: true,
        external_ref: true, tracking_number: true, category: true,
        department: true, cost_center: true,
        vendor: { select: { name: true, code: true } },
        requester: { select: { name: true, department: true } },
        items: {
          select: {
            name: true, quantity: true, unit: true,
            unit_price: true, total_price: true,
          },
        },
        timeline: {
          select: { type: true, title: true, created_at: true },
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    })
    if (!request) return JSON.stringify({ error: `Richiesta ${input.code} non trovata` })
    return JSON.stringify(request)
  },
})

const searchVendors = betaZodTool({
  name: 'search_vendors',
  description: 'Cerca fornitori per nome, stato, categoria.',
  inputSchema: z.object({
    search: z.string().optional().describe('Nome fornitore'),
    status: z
      .enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED', 'PENDING_REVIEW'])
      .optional(),
    pageSize: z.number().max(MAX_RESULTS).default(10),
  }),
  run: async (input) => {
    const where: Record<string, unknown> = {}
    if (input.status) where.status = input.status
    if (input.search)
      where.name = { contains: input.search, mode: 'insensitive' }
    const [vendors, total] = await prisma.$transaction([
      prisma.vendor.findMany({
        where,
        select: {
          id: true, name: true, code: true, status: true, email: true,
          category: true, payment_terms: true, rating: true,
          _count: { select: { requests: true } },
        },
        orderBy: { name: 'asc' },
        take: input.pageSize,
      }),
      prisma.vendor.count({ where }),
    ])
    return JSON.stringify({ total, results: vendors })
  },
})

const getBudgetOverview = betaZodTool({
  name: 'get_budget_overview',
  description:
    'Panoramica budget per centro di costo o dipartimento. Mostra allocato, speso, disponibile.',
  inputSchema: z.object({
    cost_center: z.string().optional(),
    department: z.string().optional(),
  }),
  run: async (input) => {
    const where: Record<string, unknown> = { is_active: true }
    if (input.cost_center)
      where.cost_center = { contains: input.cost_center, mode: 'insensitive' }
    if (input.department)
      where.department = { contains: input.department, mode: 'insensitive' }

    const budgets = await prisma.budget.findMany({
      where,
      select: {
        cost_center: true, department: true, period_type: true,
        allocated_amount: true, alert_threshold_percent: true,
        snapshots: {
          select: { spent: true, committed: true, available: true },
          orderBy: { computed_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { cost_center: 'asc' },
      take: MAX_RESULTS,
    })

    const enriched = budgets.map((b) => {
      const allocated = Number(b.allocated_amount)
      const snapshot = b.snapshots[0]
      const spent = snapshot ? Number(snapshot.spent) : 0
      const committed = snapshot ? Number(snapshot.committed) : 0
      const available = allocated - spent - committed
      return {
        cost_center: b.cost_center,
        department: b.department,
        allocated_amount: allocated,
        spent, committed, available,
        usagePercent: allocated > 0 ? Math.round(((spent + committed) / allocated) * 100) : 0,
        isOverBudget: available < 0,
      }
    })
    return JSON.stringify({ total: budgets.length, results: enriched })
  },
})

const getInvoiceStats = betaZodTool({
  name: 'get_invoice_stats',
  description: 'Statistiche fatture: totali, non matchate, contestate, importi.',
  inputSchema: z.object({}),
  run: async () => {
    const [total, unmatched, pending, disputed, amounts] =
      await prisma.$transaction([
        prisma.invoice.count({ where: { tenant_id: 'default' } }),
        prisma.invoice.count({ where: { tenant_id: 'default', match_status: 'UNMATCHED' } }),
        prisma.invoice.count({ where: { tenant_id: 'default', reconciliation_status: 'PENDING' } }),
        prisma.invoice.count({ where: { tenant_id: 'default', reconciliation_status: 'DISPUTED' } }),
        prisma.invoice.aggregate({ where: { tenant_id: 'default' }, _sum: { total_amount: true } }),
      ])
    return JSON.stringify({
      totalInvoices: total, unmatchedInvoices: unmatched,
      pendingReconciliation: pending, disputedInvoices: disputed,
      totalInvoicedAmount: Number(amounts._sum.total_amount ?? 0),
    })
  },
})

const searchInvoices = betaZodTool({
  name: 'search_invoices',
  description: 'Cerca fatture per numero, fornitore, stato matching/riconciliazione.',
  inputSchema: z.object({
    search: z.string().optional(),
    match_status: z.enum(['UNMATCHED', 'AUTO_MATCHED', 'MANUAL_MATCHED', 'SUGGESTED']).optional(),
    reconciliation_status: z.enum(['PENDING', 'APPROVED', 'DISPUTED', 'REJECTED']).optional(),
    pageSize: z.number().max(MAX_RESULTS).default(10),
  }),
  run: async (input) => {
    const where: Record<string, unknown> = { tenant_id: 'default' }
    if (input.match_status) where.match_status = input.match_status
    if (input.reconciliation_status) where.reconciliation_status = input.reconciliation_status
    if (input.search) {
      where.OR = [
        { invoice_number: { contains: input.search, mode: 'insensitive' } },
        { supplier_name: { contains: input.search, mode: 'insensitive' } },
      ]
    }
    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        select: {
          invoice_number: true, invoice_date: true, supplier_name: true,
          total_amount: true, match_status: true, reconciliation_status: true,
          pr_code_extracted: true,
        },
        orderBy: { received_at: 'desc' },
        take: input.pageSize,
      }),
      prisma.invoice.count({ where }),
    ])
    return JSON.stringify({ total, results: invoices })
  },
})

const getInventoryStats = betaZodTool({
  name: 'get_inventory_stats',
  description: 'Statistiche magazzino: materiali, valore, movimenti recenti.',
  inputSchema: z.object({}),
  run: async () => {
    const [totalMaterials, activeMaterials, recentMovements] =
      await prisma.$transaction([
        prisma.material.count(),
        prisma.material.count({ where: { is_active: true } }),
        prisma.stockMovement.count({
          where: { created_at: { gte: new Date(Date.now() - 7 * 86400000) } },
        }),
      ])
    return JSON.stringify({ totalMaterials, activeMaterials, recentMovements7d: recentMovements })
  },
})

const getTenderStats = betaZodTool({
  name: 'get_tender_stats',
  description: 'Statistiche gare: attive, valore pipeline, scadenze imminenti.',
  inputSchema: z.object({}),
  run: async () => {
    const activeStatuses = ['EVALUATING', 'GO', 'PREPARING', 'SUBMITTED', 'UNDER_EVALUATION'] as const
    const [active, totalValue, upcoming] = await prisma.$transaction([
      prisma.tender.count({ where: { status: { in: [...activeStatuses] } } }),
      prisma.tender.aggregate({
        where: { status: { in: [...activeStatuses] } },
        _sum: { base_amount: true },
      }),
      prisma.tender.count({
        where: {
          status: { in: [...activeStatuses] },
          submission_deadline: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) },
        },
      }),
    ])
    return JSON.stringify({
      activeTenders: active,
      pipelineValue: Number(totalValue._sum?.base_amount ?? 0),
      upcomingDeadlines7d: upcoming,
    })
  },
})

export const PROCUREMENT_READ_TOOLS = [
  searchRequests,
  getRequestDetail,
  searchVendors,
  getBudgetOverview,
  getInvoiceStats,
  searchInvoices,
  getInventoryStats,
  getTenderStats,
]

// ---------------------------------------------------------------------------
// WRITE TOOLS
// ---------------------------------------------------------------------------

const createRequest = betaZodTool({
  name: 'create_request',
  description: "Crea una nuova richiesta d'acquisto in stato DRAFT.",
  inputSchema: z.object({
    title: z.string().describe('Titolo della richiesta'),
    description: z.string().optional(),
    vendor_id: z.string().optional().describe('ID fornitore'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
    needed_by: z.string().optional().describe('Data necessita ISO 8601'),
    category: z.string().optional(),
    department: z.string().optional(),
    cost_center: z.string().optional(),
    items: z.array(z.object({
      name: z.string(),
      quantity: z.number(),
      unit: z.string().optional(),
      unit_price: z.number().optional(),
    })).optional(),
    _userId: z.string().describe('ID utente che crea (injected dal sistema)'),
  }),
  run: async (input) => {
    const items = input.items ?? []
    const estimatedAmount = items.reduce((sum, item) => {
      return sum + item.quantity * (item.unit_price ?? 0)
    }, 0)

    const year = new Date().getFullYear()
    const bytes = new Uint32Array(1)
    globalThis.crypto.getRandomValues(bytes)
    const seq = String((bytes[0]! % 99999) + 1).padStart(5, '0')
    const code = `PR-${year}-${seq}`

    const request = await prisma.purchaseRequest.create({
      data: {
        code,
        title: input.title,
        description: input.description,
        status: 'DRAFT',
        priority: input.priority,
        requester_id: input._userId,
        vendor_id: input.vendor_id,
        estimated_amount: estimatedAmount > 0 ? estimatedAmount : undefined,
        needed_by: input.needed_by ? new Date(input.needed_by) : undefined,
        category: input.category,
        department: input.department,
        cost_center: input.cost_center,
        items: items.length > 0 ? {
          createMany: {
            data: items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              unit_price: item.unit_price,
              total_price: item.unit_price ? item.quantity * item.unit_price : undefined,
            })),
          },
        } : undefined,
      },
    })
    return JSON.stringify({ success: true, code: request.code, id: request.id })
  },
})

const approveRequest = betaZodTool({
  name: 'approve_request',
  description: 'Approva una richiesta in attesa di approvazione.',
  inputSchema: z.object({
    request_id: z.string(),
    notes: z.string().optional(),
    _userId: z.string().describe('ID approvatore (injected dal sistema)'),
  }),
  run: async (input) => {
    const [approval] = await prisma.$transaction([
      prisma.approval.create({
        data: {
          request_id: input.request_id,
          approver_id: input._userId,
          status: 'APPROVED',
          decision_at: new Date(),
          notes: input.notes,
        },
      }),
      prisma.purchaseRequest.update({
        where: { id: input.request_id },
        data: { status: 'APPROVED' },
      }),
    ])
    return JSON.stringify({ success: true, approval_id: approval.id })
  },
})

export const PROCUREMENT_WRITE_TOOLS = [
  createRequest,
  approveRequest,
]
```

- [ ] **Step 4: Run test — expect pass**

Run: `cd procureflow && npx vitest run tests/server/agents/tools/procurement.tools.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/server/agents/tools/procurement.tools.ts tests/server/agents/tools/
git commit -m "feat: add betaZodTool definitions for procurement read/write tools"
```

---

### Task 1.2: Build Procurement Assistant Agent with Tool Runner

**Files:**
- Create: `src/server/agents/procurement-assistant.agent.ts`
- Test: `tests/server/agents/procurement-assistant.agent.test.ts`

- [ ] **Step 1: Write test for agent**

```typescript
// tests/server/agents/procurement-assistant.agent.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    beta: {
      messages: {
        toolRunner: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield {
              role: 'assistant',
              content: [{ type: 'text', text: 'Ecco i risultati.' }],
              stop_reason: 'end_turn',
            }
          },
        }),
      },
    },
  })),
}))

vi.mock('@/lib/db', () => ({ prisma: {} }))

describe('ProcurementAssistantAgent', () => {
  it('exports streamAssistantResponse generator', async () => {
    const { streamAssistantResponse } = await import(
      '@/server/agents/procurement-assistant.agent'
    )
    expect(typeof streamAssistantResponse).toBe('function')
  })
})
```

- [ ] **Step 2: Run test — expect fail**

Run: `cd procureflow && npx vitest run tests/server/agents/procurement-assistant.agent.test.ts`

- [ ] **Step 3: Create the procurement assistant agent**

```typescript
// src/server/agents/procurement-assistant.agent.ts
import Anthropic from '@anthropic-ai/sdk'
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import { AGENT_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import {
  PROCUREMENT_READ_TOOLS,
  PROCUREMENT_WRITE_TOOLS,
} from '@/server/agents/tools/procurement.tools'
import { storePendingAction } from '@/lib/ai/pending-actions'
import type { AgentStreamEvent, ActionPreview } from '@/types/ai'
import type { UserRole } from '@/lib/ai/tool-registry'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_MODEL = MODELS.SONNET
const WRITE_TOOL_NAMES = new Set(PROCUREMENT_WRITE_TOOLS.map((t) => t.name))

// ---------------------------------------------------------------------------
// Role-based tool filtering
// ---------------------------------------------------------------------------

const ROLE_LEVEL: Record<UserRole, number> = {
  VIEWER: 0,
  REQUESTER: 1,
  MANAGER: 2,
  ADMIN: 3,
}

const TOOL_MIN_ROLE: Record<string, UserRole> = {
  create_request: 'REQUESTER',
  approve_request: 'MANAGER',
}

function getToolsForRole(role: UserRole) {
  const level = ROLE_LEVEL[role]
  const writeFiltered = PROCUREMENT_WRITE_TOOLS.filter((t) => {
    const minRole = TOOL_MIN_ROLE[t.name] ?? 'VIEWER'
    return ROLE_LEVEL[minRole] <= level
  })
  return [...PROCUREMENT_READ_TOOLS, ...writeFiltered]
}

// ---------------------------------------------------------------------------
// Action preview generator (for write tool confirmation)
// ---------------------------------------------------------------------------

function generateActionPreview(
  toolName: string,
  params: Record<string, unknown>,
): ActionPreview {
  switch (toolName) {
    case 'create_request':
      return {
        label: "Crea richiesta d'acquisto",
        fields: [
          { key: 'Titolo', value: String(params.title ?? '') },
          { key: 'Priorita', value: String(params.priority ?? 'MEDIUM') },
        ],
      }
    case 'approve_request':
      return {
        label: 'Approva richiesta',
        fields: [
          { key: 'Richiesta', value: String(params.request_id ?? '') },
        ],
      }
    default:
      return { label: toolName, fields: [] }
  }
}

// ---------------------------------------------------------------------------
// Stream Agent Response
// ---------------------------------------------------------------------------

export async function* streamAssistantResponse(
  userId: string,
  role: UserRole,
  messages: readonly {
    readonly role: 'user' | 'assistant'
    readonly content: string
  }[],
): AsyncGenerator<AgentStreamEvent> {
  const client = getClaudeClient()
  const tools = getToolsForRole(role)

  // Inject userId into all messages for write tools
  const systemPrompt = `${AGENT_SYSTEM_PROMPT}\n\nUser ID per le operazioni di scrittura: ${userId}`

  const anthropicMessages: Anthropic.Beta.BetaMessageParam[] = messages.map(
    (m) => ({ role: m.role, content: m.content }),
  )

  try {
    const runner = client.beta.messages.toolRunner({
      model: AGENT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: anthropicMessages,
    })

    for await (const message of runner) {
      for (const block of message.content) {
        if (block.type === 'text') {
          yield { type: 'text', content: block.text }
        } else if (block.type === 'tool_use') {
          const toolName = block.name
          yield { type: 'tool_start', name: toolName }

          // For write tools, intercept and request confirmation
          if (WRITE_TOOL_NAMES.has(toolName)) {
            const params = block.input as Record<string, unknown>
            const preview = generateActionPreview(toolName, params)
            const actionId = storePendingAction({
              tool: toolName,
              params,
              userId,
              preview,
            })
            yield {
              type: 'action_request',
              actionId,
              tool: toolName,
              params,
              preview,
            }
            return // Stop — wait for user confirmation
          }

          yield { type: 'tool_end', name: toolName }
        }
      }
    }

    yield { type: 'done' }
  } catch (err) {
    yield { type: 'error', message: `Errore AI: ${String(err)}` }
  }
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `cd procureflow && npx vitest run tests/server/agents/procurement-assistant.agent.test.ts`

- [ ] **Step 5: Update chat API route to use new agent**

In `src/app/api/chat/route.ts`, replace the import and call:
```typescript
// BEFORE
import { streamAgentResponse } from '@/server/services/agent.service'

// AFTER
import { streamAssistantResponse } from '@/server/agents/procurement-assistant.agent'
```

And replace `streamAgentResponse(userId, role, messages)` with `streamAssistantResponse(userId, role, messages)`.

- [ ] **Step 6: Verify build + commit**

Run: `cd procureflow && npx tsc --noEmit`

```bash
git add src/server/agents/procurement-assistant.agent.ts tests/server/agents/ src/app/api/chat/route.ts
git commit -m "feat: replace manual agent loop with tool runner in procurement assistant"
```

---

## Phase 2: Email Intelligence Agent

### Task 2.1: Create Email Agent Tools

**Files:**
- Create: `src/server/agents/tools/notification.tools.ts`
- Create: `src/server/agents/tools/commessa.tools.ts`

- [ ] **Step 1: Create notification tools**

```typescript
// src/server/agents/tools/notification.tools.ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { prisma } from '@/lib/db'

export const createNotification = betaZodTool({
  name: 'create_notification',
  description: 'Invia una notifica in-app a un utente.',
  inputSchema: z.object({
    user_id: z.string().describe('ID utente destinatario'),
    title: z.string().describe('Titolo notifica'),
    body: z.string().describe('Corpo notifica'),
    type: z.string().describe('Tipo: approval_required, delivery_overdue, email_processed, etc.'),
    link: z.string().optional().describe('Deep link alla risorsa (es: /requests/PR-2026-00042)'),
  }),
  run: async (input) => {
    const notification = await prisma.notification.create({
      data: {
        user_id: input.user_id,
        title: input.title,
        body: input.body,
        type: input.type,
        link: input.link,
      },
    })
    return JSON.stringify({ success: true, notification_id: notification.id })
  },
})

export const createTimelineEvent = betaZodTool({
  name: 'create_timeline_event',
  description: 'Aggiunge un evento alla timeline di una richiesta.',
  inputSchema: z.object({
    request_id: z.string(),
    type: z.string().describe('Tipo evento: email_received, status_change, ai_action, etc.'),
    title: z.string(),
    description: z.string().optional(),
    actor: z.string().optional().describe('Chi ha causato l\'evento'),
  }),
  run: async (input) => {
    const event = await prisma.timelineEvent.create({
      data: {
        request_id: input.request_id,
        type: input.type,
        title: input.title,
        description: input.description,
        actor: input.actor ?? 'AI Agent',
      },
    })
    return JSON.stringify({ success: true, event_id: event.id })
  },
})

export const NOTIFICATION_TOOLS = [createNotification, createTimelineEvent]
```

- [ ] **Step 2: Create commessa tools**

```typescript
// src/server/agents/tools/commessa.tools.ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { prisma } from '@/lib/db'

export const searchCommesse = betaZodTool({
  name: 'search_commesse',
  description: 'Cerca commesse per codice, stato, cliente.',
  inputSchema: z.object({
    search: z.string().optional(),
    status: z.enum(['DRAFT', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
    pageSize: z.number().max(20).default(10),
  }),
  run: async (input) => {
    const where: Record<string, unknown> = {}
    if (input.status) where.status = input.status
    if (input.search) {
      where.OR = [
        { code: { contains: input.search, mode: 'insensitive' } },
        { client_name: { contains: input.search, mode: 'insensitive' } },
      ]
    }
    const commesse = await prisma.commessa.findMany({
      where,
      select: {
        code: true, client_name: true, status: true,
        client_value: true, created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: input.pageSize,
    })
    return JSON.stringify(commesse)
  },
})

export const createCommessa = betaZodTool({
  name: 'create_commessa',
  description: 'Crea una nuova commessa da un ordine cliente.',
  inputSchema: z.object({
    client_name: z.string(),
    client_code: z.string().optional(),
    client_value: z.number().optional(),
    deadline: z.string().optional().describe('Scadenza ISO 8601'),
    items: z.array(z.object({
      description: z.string(),
      quantity: z.number().optional(),
      unit: z.string().optional(),
    })).optional(),
    source_email_subject: z.string().optional(),
  }),
  run: async (input) => {
    const year = new Date().getFullYear()
    const count = await prisma.commessa.count()
    const code = `COM-${year}-${String(count + 1).padStart(5, '0')}`

    const commessa = await prisma.commessa.create({
      data: {
        code,
        client_name: input.client_name,
        client_code: input.client_code,
        status: 'DRAFT',
        client_value: input.client_value,
        deadline: input.deadline ? new Date(input.deadline) : undefined,
        notes: input.source_email_subject
          ? `Creata da email: ${input.source_email_subject}`
          : undefined,
      },
    })
    return JSON.stringify({ success: true, code: commessa.code, id: commessa.id })
  },
})

export const COMMESSA_TOOLS = [searchCommesse, createCommessa]
```

- [ ] **Step 3: Commit**

```bash
git add src/server/agents/tools/notification.tools.ts src/server/agents/tools/commessa.tools.ts
git commit -m "feat: add notification and commessa betaZodTool definitions"
```

---

### Task 2.2: Build Email Intelligence Agent

**Files:**
- Create: `src/server/agents/email-intelligence.agent.ts`
- Test: `tests/server/agents/email-intelligence.agent.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/server/agents/email-intelligence.agent.test.ts
import { describe, it, expect } from 'vitest'

describe('EmailIntelligenceAgent', () => {
  it('exports processEmail function', async () => {
    const mod = await import('@/server/agents/email-intelligence.agent')
    expect(typeof mod.processEmail).toBe('function')
  })
})
```

- [ ] **Step 2: Create the email intelligence agent**

```typescript
// src/server/agents/email-intelligence.agent.ts
import Anthropic from '@anthropic-ai/sdk'
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import { PROCUREMENT_READ_TOOLS } from '@/server/agents/tools/procurement.tools'
import { NOTIFICATION_TOOLS, createTimelineEvent } from '@/server/agents/tools/notification.tools'
import { COMMESSA_TOOLS } from '@/server/agents/tools/commessa.tools'
import type { RawEmailData } from '@/server/services/email-ai-classifier.service'

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const EMAIL_AGENT_SYSTEM_PROMPT = `Sei un agente di procurement per PMI italiane. Ricevi email commerciali e devi:

1. CLASSIFICARE l'intent (conferma ordine, ritardo, variazione prezzo, ordine cliente, fattura, etc.)
2. CERCARE nel database se esiste una richiesta d'acquisto correlata
3. AGIRE in base all'intent:
   - CONFERMA_ORDINE: cerca la PR correlata, aggiorna la timeline
   - RITARDO_CONSEGNA: cerca la PR, notifica il richiedente con la nuova data
   - VARIAZIONE_PREZZO: cerca la PR, notifica il manager con la differenza
   - ORDINE_CLIENTE: crea una nuova commessa con gli articoli estratti
   - FATTURA_ALLEGATA: segnala con notifica per il reparto contabilita
   - RICHIESTA_INFO: notifica il richiedente della PR correlata

REGOLE:
- Se non trovi una PR correlata, NON inventare un codice. Metti un flag "da verificare".
- Se un codice articolo e sconosciuto, includi una nota "codice non trovato nel catalogo".
- Se un importo e ambiguo, segnalalo nella notifica.
- Rispondi SEMPRE in italiano.
- Per le date usa formato italiano (gg/mm/aaaa) nelle notifiche, ISO nelle operazioni.`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailProcessingResult {
  readonly intent: string
  readonly confidence: number
  readonly actions_taken: readonly string[]
  readonly needs_review: boolean
  readonly summary: string
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function processEmail(
  email: RawEmailData,
): Promise<EmailProcessingResult> {
  const client = getClaudeClient()

  const emailContent = [
    `Da: ${email.email_from}`,
    `Oggetto: ${email.email_subject}`,
    email.email_date ? `Data: ${email.email_date}` : '',
    '',
    email.email_body,
    email.attachments?.length
      ? `\nAllegati: ${email.attachments.map((a) => a.filename).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const tools = [
    ...PROCUREMENT_READ_TOOLS,
    ...NOTIFICATION_TOOLS,
    ...COMMESSA_TOOLS,
  ]

  const runner = client.beta.messages.toolRunner({
    model: MODELS.SONNET,
    max_tokens: 4096,
    system: EMAIL_AGENT_SYSTEM_PROMPT,
    tools,
    messages: [
      {
        role: 'user',
        content: `Analizza e processa questa email:\n\n${emailContent}`,
      },
    ],
  })

  const actionsTaken: string[] = []
  let finalText = ''

  for await (const message of runner) {
    for (const block of message.content) {
      if (block.type === 'text') {
        finalText += block.text
      } else if (block.type === 'tool_use') {
        actionsTaken.push(block.name)
      }
    }
  }

  // Parse the final text for structured summary
  const needsReview =
    finalText.includes('da verificare') ||
    finalText.includes('non trovato') ||
    finalText.includes('ambiguo')

  return Object.freeze({
    intent: extractIntent(actionsTaken),
    confidence: needsReview ? 0.6 : 0.9,
    actions_taken: actionsTaken,
    needs_review: needsReview,
    summary: finalText.slice(0, 500),
  })
}

function extractIntent(actions: readonly string[]): string {
  if (actions.includes('create_commessa')) return 'ORDINE_CLIENTE'
  if (actions.includes('create_timeline_event')) return 'UPDATE_EXISTING'
  if (actions.includes('create_notification')) return 'NOTIFICATION'
  return 'INFO_ONLY'
}
```

- [ ] **Step 3: Update the classify webhook to use the agent**

In `src/app/api/webhooks/email-ingestion/classify/route.ts`, add the agent as an alternative path:

```typescript
import { processEmail } from '@/server/agents/email-intelligence.agent'

// In the POST handler, after the existing classification:
// If ANTHROPIC_API_KEY is set and AI_USE_AGENT=true, use the agent
const useAgent = process.env.AI_USE_EMAIL_AGENT === 'true'
if (useAgent) {
  const result = await processEmail(emailData)
  return NextResponse.json({ success: true, data: result })
}
// Otherwise, fall back to existing single-call classifier
```

- [ ] **Step 4: Commit**

```bash
git add src/server/agents/email-intelligence.agent.ts tests/server/agents/email-intelligence.agent.test.ts src/app/api/webhooks/email-ingestion/classify/route.ts
git commit -m "feat: add email intelligence agent with multi-step processing"
```

---

## Phase 3: Invoice Reconciliation Agent

### Task 3.1: Create Invoice Agent Tools

**Files:**
- Create: `src/server/agents/tools/invoice.tools.ts`

- [ ] **Step 1: Create invoice-specific tools**

```typescript
// src/server/agents/tools/invoice.tools.ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { prisma } from '@/lib/db'

export const getInvoiceDetail = betaZodTool({
  name: 'get_invoice_detail',
  description: 'Ottieni dettaglio completo di una fattura con righe.',
  inputSchema: z.object({
    invoice_id: z.string(),
  }),
  run: async (input) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoice_id },
      include: { line_items: true, matched_request: { select: { code: true, title: true } } },
    })
    if (!invoice) return JSON.stringify({ error: 'Fattura non trovata' })
    return JSON.stringify(invoice)
  },
})

export const getOrderForInvoice = betaZodTool({
  name: 'get_order_for_invoice',
  description: 'Cerca l\'ordine correlato a una fattura tramite PR code o fornitore.',
  inputSchema: z.object({
    pr_code: z.string().optional().describe('Codice PR estratto dalla fattura'),
    supplier_name: z.string().optional().describe('Nome fornitore'),
    supplier_vat_id: z.string().optional().describe('P.IVA fornitore'),
  }),
  run: async (input) => {
    if (input.pr_code) {
      const request = await prisma.purchaseRequest.findUnique({
        where: { code: input.pr_code },
        include: { items: true, vendor: { select: { name: true, code: true } } },
      })
      if (request) return JSON.stringify(request)
    }
    if (input.supplier_name) {
      const vendor = await prisma.vendor.findFirst({
        where: { name: { contains: input.supplier_name, mode: 'insensitive' } },
      })
      if (vendor) {
        const requests = await prisma.purchaseRequest.findMany({
          where: { vendor_id: vendor.id, status: { in: ['ORDERED', 'SHIPPED', 'DELIVERED'] } },
          include: { items: true },
          orderBy: { created_at: 'desc' },
          take: 5,
        })
        return JSON.stringify({ vendor, requests })
      }
    }
    return JSON.stringify({ error: 'Nessun ordine correlato trovato' })
  },
})

export const getVendorPriceHistory = betaZodTool({
  name: 'get_vendor_price_history',
  description: 'Storico prezzi di un articolo da un fornitore.',
  inputSchema: z.object({
    vendor_name: z.string(),
    item_description: z.string(),
  }),
  run: async (input) => {
    const vendor = await prisma.vendor.findFirst({
      where: { name: { contains: input.vendor_name, mode: 'insensitive' } },
    })
    if (!vendor) return JSON.stringify({ error: 'Fornitore non trovato' })

    const pastItems = await prisma.requestItem.findMany({
      where: {
        name: { contains: input.item_description, mode: 'insensitive' },
        request: { vendor_id: vendor.id, status: { in: ['DELIVERED', 'CLOSED', 'RECONCILED'] } },
      },
      select: {
        name: true, unit_price: true, quantity: true,
        request: { select: { code: true, created_at: true } },
      },
      orderBy: { request: { created_at: 'desc' } },
      take: 10,
    })
    return JSON.stringify(pastItems)
  },
})

export const updateReconciliationStatus = betaZodTool({
  name: 'update_reconciliation_status',
  description: 'Aggiorna lo stato di riconciliazione di una fattura.',
  inputSchema: z.object({
    invoice_id: z.string(),
    status: z.enum(['APPROVED', 'DISPUTED', 'PENDING']),
    notes: z.string().optional(),
  }),
  run: async (input) => {
    await prisma.invoice.update({
      where: { id: input.invoice_id },
      data: {
        reconciliation_status: input.status,
        reconciliation_notes: input.notes,
      },
    })
    return JSON.stringify({ success: true })
  },
})

export const INVOICE_TOOLS = [
  getInvoiceDetail,
  getOrderForInvoice,
  getVendorPriceHistory,
  updateReconciliationStatus,
]
```

- [ ] **Step 2: Commit**

```bash
git add src/server/agents/tools/invoice.tools.ts
git commit -m "feat: add invoice-specific betaZodTool definitions"
```

---

### Task 3.2: Build Invoice Reconciliation Agent

**Files:**
- Create: `src/server/agents/invoice-reconciliation.agent.ts`

- [ ] **Step 1: Create the reconciliation agent**

```typescript
// src/server/agents/invoice-reconciliation.agent.ts
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import { INVOICE_TOOLS } from '@/server/agents/tools/invoice.tools'
import { NOTIFICATION_TOOLS } from '@/server/agents/tools/notification.tools'

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const RECONCILIATION_SYSTEM_PROMPT = `Sei un esperto contabile per PMI italiane. Devi riconciliare fatture passive con gli ordini di acquisto.

PROCEDURA:
1. Leggi il dettaglio della fattura (righe, importi, fornitore)
2. Cerca l'ordine correlato (tramite codice PR o nome fornitore)
3. Confronta RIGA PER RIGA:
   - Descrizione articolo
   - Quantita ordinata vs fatturata
   - Prezzo unitario ordinato vs fatturato
   - Totale riga
4. Confronta il TOTALE: importo ordinato vs importo fatturato
5. Produci un report in italiano comprensibile che includa:
   - Stato match: CONFORME / DISCREPANZA MINORE / DISCREPANZA GRAVE
   - Lista discrepanze trovate con importi e percentuali
   - Raccomandazione: APPROVA / CONTESTA / METTI IN ATTESA
   - Se CONTESTA: bozza email al fornitore in italiano

REGOLE:
- Discrepanza < 2%: DISCREPANZA MINORE, raccomanda APPROVA
- Discrepanza 2-5%: valuta caso per caso con storico prezzi
- Discrepanza > 5%: DISCREPANZA GRAVE, raccomanda CONTESTA
- Controlla anche se ci sono articoli fatturati non ordinati
- Usa importi con 2 decimali e separatore migliaia italiano`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReconciliationResult {
  readonly status: 'CONFORME' | 'DISCREPANZA_MINORE' | 'DISCREPANZA_GRAVE'
  readonly recommendation: 'APPROVA' | 'CONTESTA' | 'ATTESA'
  readonly report: string
  readonly email_draft: string | null
  readonly discrepancies: readonly {
    readonly field: string
    readonly ordered: string
    readonly invoiced: string
    readonly difference: string
  }[]
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function reconcileInvoice(
  invoiceId: string,
  notifyUserId?: string,
): Promise<ReconciliationResult> {
  const client = getClaudeClient()

  const tools = [...INVOICE_TOOLS, ...NOTIFICATION_TOOLS]

  const runner = client.beta.messages.toolRunner({
    model: MODELS.SONNET,
    max_tokens: 4096,
    system: RECONCILIATION_SYSTEM_PROMPT,
    tools,
    messages: [
      {
        role: 'user',
        content: [
          `Riconcilia la fattura con ID: ${invoiceId}`,
          notifyUserId
            ? `Se trovi discrepanze, notifica l'utente ${notifyUserId}.`
            : '',
          'Produci il report completo.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  })

  let fullReport = ''
  for await (const message of runner) {
    for (const block of message.content) {
      if (block.type === 'text') {
        fullReport += block.text
      }
    }
  }

  return parseReconciliationReport(fullReport)
}

function parseReconciliationReport(text: string): ReconciliationResult {
  const isGrave = text.includes('DISCREPANZA GRAVE') || text.includes('CONTESTA')
  const isMinore = text.includes('DISCREPANZA MINORE')
  const hasEmailDraft = text.includes('Oggetto:') || text.includes('Gentile')

  const status = isGrave
    ? 'DISCREPANZA_GRAVE'
    : isMinore
      ? 'DISCREPANZA_MINORE'
      : 'CONFORME'

  const recommendation = isGrave
    ? 'CONTESTA'
    : isMinore
      ? 'APPROVA'
      : 'APPROVA'

  // Extract email draft if present
  const emailMatch = text.match(/---\s*BOZZA EMAIL\s*---\s*([\s\S]*?)(?:---|\z)/i)
  const emailDraft = emailMatch ? emailMatch[1]!.trim() : null

  return Object.freeze({
    status,
    recommendation,
    report: text,
    email_draft: hasEmailDraft ? (emailDraft ?? text) : null,
    discrepancies: [], // Parsed from structured output in production
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/agents/invoice-reconciliation.agent.ts
git commit -m "feat: add invoice reconciliation agent with three-way matching"
```

---

## Phase 4: Smart Reorder Agent

### Task 4.1: Create Inventory Tools

**Files:**
- Create: `src/server/agents/tools/inventory.tools.ts`

- [ ] **Step 1: Create inventory tools**

```typescript
// src/server/agents/tools/inventory.tools.ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getBasicForecast } from '@/server/services/forecast.service'

export const getActiveAlerts = betaZodTool({
  name: 'get_active_alerts',
  description: 'Lista materiali con alert attivo (sotto scorta, esauriti).',
  inputSchema: z.object({}),
  run: async () => {
    const alerts = await prisma.materialAlert.findMany({
      where: { dismissed: false },
      include: {
        material: { select: { id: true, name: true, code: true, min_stock_level: true, preferred_vendor_id: true } },
        suggested_vendor: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    })
    return JSON.stringify(alerts)
  },
})

export const getMaterialForecast = betaZodTool({
  name: 'get_material_forecast',
  description: 'Previsione consumo per un materiale: stock attuale, consumo mensile, giorni rimanenti.',
  inputSchema: z.object({
    material_id: z.string(),
  }),
  run: async (input) => {
    const forecast = await getBasicForecast(input.material_id)
    return JSON.stringify(forecast)
  },
})

export const getMaterialPriceHistory = betaZodTool({
  name: 'get_material_price_history',
  description: 'Storico prezzi acquisto di un materiale.',
  inputSchema: z.object({
    material_id: z.string(),
  }),
  run: async (input) => {
    const material = await prisma.material.findUnique({
      where: { id: input.material_id },
      select: { name: true, code: true },
    })
    if (!material) return JSON.stringify({ error: 'Materiale non trovato' })

    const pastPurchases = await prisma.requestItem.findMany({
      where: {
        name: { contains: material.name, mode: 'insensitive' },
        request: { status: { in: ['DELIVERED', 'CLOSED', 'RECONCILED'] } },
      },
      select: {
        unit_price: true, quantity: true,
        request: { select: { code: true, created_at: true, vendor: { select: { name: true } } } },
      },
      orderBy: { request: { created_at: 'desc' } },
      take: 10,
    })
    return JSON.stringify({ material, purchases: pastPurchases })
  },
})

export const INVENTORY_TOOLS = [getActiveAlerts, getMaterialForecast, getMaterialPriceHistory]
```

- [ ] **Step 2: Commit**

```bash
git add src/server/agents/tools/inventory.tools.ts
git commit -m "feat: add inventory betaZodTool definitions for reorder agent"
```

---

### Task 4.2: Build Smart Reorder Agent

**Files:**
- Create: `src/server/agents/smart-reorder.agent.ts`
- Create: `src/app/api/agents/reorder/route.ts`

- [ ] **Step 1: Create the smart reorder agent**

```typescript
// src/server/agents/smart-reorder.agent.ts
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import { INVENTORY_TOOLS } from '@/server/agents/tools/inventory.tools'
import { PROCUREMENT_READ_TOOLS, PROCUREMENT_WRITE_TOOLS } from '@/server/agents/tools/procurement.tools'
import { NOTIFICATION_TOOLS } from '@/server/agents/tools/notification.tools'

const REORDER_SYSTEM_PROMPT = `Sei un agente di riordino automatico per PMI italiane.

PROCEDURA:
1. Controlla gli alert attivi (materiali sotto scorta)
2. Per ogni materiale con alert:
   a. Ottieni la previsione di consumo (forecast)
   b. Controlla il budget disponibile per quel centro di costo
   c. Cerca lo storico prezzi per trovare il prezzo medio
   d. Cerca il fornitore preferito o quello con il miglior prezzo
3. Per ogni materiale dove il riordino e giustificato:
   a. Calcola la quantita ottimale (copertura 2 mesi + scorta sicurezza)
   b. Crea una richiesta d'acquisto in DRAFT con:
      - Titolo: "Riordino automatico: [nome materiale]"
      - Fornitore preferito
      - Quantita calcolata
      - Prezzo unitario storico
4. Alla fine, notifica il manager con un riepilogo

REGOLE:
- NON riordinare se il budget disponibile e insufficiente — segnala il problema
- NON riordinare materiali con alert gia collegato a una PR esistente
- Quantita minima: almeno la scorta minima (min_stock_level)
- Prezzi in EUR con 2 decimali
- Usa _userId per il campo requester delle PR create`

export interface ReorderResult {
  readonly drafts_created: number
  readonly alerts_processed: number
  readonly skipped_budget: number
  readonly skipped_existing: number
  readonly summary: string
}

export async function runReorderAgent(
  userId: string,
  notifyManagerId?: string,
): Promise<ReorderResult> {
  const client = getClaudeClient()

  const tools = [
    ...INVENTORY_TOOLS,
    ...PROCUREMENT_READ_TOOLS,
    ...PROCUREMENT_WRITE_TOOLS,
    ...NOTIFICATION_TOOLS,
  ]

  const runner = client.beta.messages.toolRunner({
    model: MODELS.SONNET,
    max_tokens: 8192,
    system: REORDER_SYSTEM_PROMPT,
    tools,
    messages: [
      {
        role: 'user',
        content: [
          'Esegui il ciclo di riordino automatico.',
          `User ID per le PR: ${userId}`,
          notifyManagerId ? `Notifica il manager ${notifyManagerId} al termine.` : '',
        ].filter(Boolean).join('\n'),
      },
    ],
  })

  const toolCalls: string[] = []
  let finalText = ''

  for await (const message of runner) {
    for (const block of message.content) {
      if (block.type === 'text') finalText += block.text
      else if (block.type === 'tool_use') toolCalls.push(block.name)
    }
  }

  const draftsCreated = toolCalls.filter((t) => t === 'create_request').length

  return Object.freeze({
    drafts_created: draftsCreated,
    alerts_processed: toolCalls.filter((t) => t === 'get_active_alerts').length,
    skipped_budget: finalText.includes('budget insufficiente') ? 1 : 0,
    skipped_existing: 0,
    summary: finalText.slice(0, 1000),
  })
}
```

- [ ] **Step 2: Create the API route**

```typescript
// src/app/api/agents/reorder/route.ts
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { runReorderAgent } from '@/server/agents/smart-reorder.agent'

export const dynamic = 'force-dynamic'

export async function POST() {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const { user } = authResult
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Solo Admin/Manager' } },
      { status: 403 },
    )
  }

  const result = await runReorderAgent(user.id)

  return NextResponse.json({ success: true, data: result })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/server/agents/smart-reorder.agent.ts src/app/api/agents/reorder/route.ts
git commit -m "feat: add smart reorder agent with auto-draft purchase requests"
```

---

## Phase 5: Tender Analysis Agent

### Task 5.1: Create Tender Analysis Schema + Agent

**Files:**
- Create: `src/lib/ai/schemas/tender-analysis.schema.ts`
- Create: `src/server/agents/tender-analysis.agent.ts`
- Create: `src/app/api/agents/tender-analysis/route.ts`

- [ ] **Step 1: Create tender analysis schema**

```typescript
// src/lib/ai/schemas/tender-analysis.schema.ts
import { z } from 'zod'

export const TenderAnalysisSchema = z.object({
  fit_score: z.number().min(0).max(100).describe('Score compatibilita 0-100'),
  recommendation: z.enum(['GO', 'NO_GO', 'CONDITIONAL_GO']),
  reasoning: z.string().describe('Spiegazione della raccomandazione in italiano'),
  pros: z.array(z.string()).describe('Punti di forza'),
  cons: z.array(z.string()).describe('Punti deboli / rischi'),
  risks: z.array(z.object({
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    mitigation: z.string(),
  })),
  estimated_participation_cost: z.number().optional().describe('Costo stimato partecipazione in EUR'),
  key_requirements: z.array(z.string()).describe('Requisiti tecnici chiave estratti'),
  missing_capabilities: z.array(z.string()).describe('Capacita mancanti rispetto ai requisiti'),
})

export type TenderAnalysis = z.infer<typeof TenderAnalysisSchema>
```

- [ ] **Step 2: Create tender analysis agent**

```typescript
// src/server/agents/tender-analysis.agent.ts
import Anthropic, { toFile } from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import { TenderAnalysisSchema, type TenderAnalysis } from '@/lib/ai/schemas/tender-analysis.schema'
import { prisma } from '@/lib/db'

const TENDER_ANALYSIS_PROMPT = `Sei un consulente strategico per gare d'appalto di PMI italiane (settore difesa/aerospazio/elettronica).

Analizza il documento di gara fornito e produci un'analisi go/no-go strutturata.

CONSIDERA:
- Requisiti tecnici vs capacita aziendali
- Importo base vs capacita finanziaria
- Scadenza vs capacita produttiva attuale
- Certificazioni richieste vs certificazioni possedute
- Storico gare simili (se disponibile)
- Marginalita attesa
- Rischio di penali

RISPONDI con il JSON strutturato richiesto. Sii onesto: se la PMI non e competitiva, dillo chiaramente.`

export interface TenderAnalysisResult {
  readonly analysis: TenderAnalysis
  readonly model_used: string
  readonly file_id?: string
}

export async function analyzeTender(
  tenderId: string,
  pdfBuffer?: Buffer,
  pdfFilename?: string,
): Promise<TenderAnalysisResult> {
  const client = getClaudeClient()

  // Fetch tender data from DB
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: {
      title: true, description: true, contracting_authority: true,
      base_amount: true, submission_deadline: true, requirements: true,
      status: true,
    },
  })
  if (!tender) throw new Error('Gara non trovata')

  // Build message content
  const content: Anthropic.ContentBlockParam[] = []

  // If PDF provided, upload via Files API
  let fileId: string | undefined
  if (pdfBuffer && pdfFilename) {
    const uploaded = await client.beta.files.upload({
      file: await toFile(pdfBuffer, pdfFilename, { type: 'application/pdf' }),
      betas: ['files-api-2025-04-14'],
    })
    fileId = uploaded.id
    content.push({
      type: 'document',
      source: { type: 'file', file_id: uploaded.id },
      title: pdfFilename,
    } as unknown as Anthropic.ContentBlockParam)
  }

  // Add tender context from DB
  content.push({
    type: 'text',
    text: [
      `DATI GARA DAL SISTEMA:`,
      `Titolo: ${tender.title}`,
      `Stazione appaltante: ${tender.contracting_authority ?? 'N/A'}`,
      `Importo base: EUR ${Number(tender.base_amount ?? 0).toLocaleString('it-IT')}`,
      `Scadenza: ${tender.submission_deadline?.toLocaleDateString('it-IT') ?? 'N/A'}`,
      tender.description ? `Descrizione: ${tender.description}` : '',
      tender.requirements ? `Requisiti noti: ${JSON.stringify(tender.requirements)}` : '',
    ].filter(Boolean).join('\n'),
  })

  // Use Opus with adaptive thinking for complex reasoning
  const response = await client.messages.parse({
    model: MODELS.OPUS,
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    system: TENDER_ANALYSIS_PROMPT,
    messages: [{ role: 'user', content }],
    output_format: TenderAnalysisSchema,
    ...(fileId ? { betas: ['files-api-2025-04-14'] } : {}),
  } as Parameters<typeof client.messages.parse>[0])

  const analysis = response.parsed_output
  if (!analysis) throw new Error('Analisi non disponibile')

  return Object.freeze({
    analysis,
    model_used: MODELS.OPUS,
    file_id: fileId,
  })
}
```

- [ ] **Step 3: Create API route**

```typescript
// src/app/api/agents/tender-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { analyzeTender } from '@/server/agents/tender-analysis.agent'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const formData = await req.formData()
  const tenderId = formData.get('tender_id') as string
  if (!tenderId) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'tender_id richiesto' } },
      { status: 400 },
    )
  }

  const pdfFile = formData.get('pdf') as File | null
  let pdfBuffer: Buffer | undefined
  let pdfFilename: string | undefined

  if (pdfFile) {
    const arrayBuffer = await pdfFile.arrayBuffer()
    pdfBuffer = Buffer.from(arrayBuffer)
    pdfFilename = pdfFile.name
  }

  const result = await analyzeTender(tenderId, pdfBuffer, pdfFilename)

  return NextResponse.json({ success: true, data: result })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/schemas/tender-analysis.schema.ts src/server/agents/tender-analysis.agent.ts src/app/api/agents/tender-analysis/route.ts
git commit -m "feat: add tender analysis agent with Opus adaptive thinking + Files API"
```

---

## Phase 6: Compliance Monitor Agent

### Task 6.1: Build Compliance Monitor Agent + Route

**Files:**
- Create: `src/lib/ai/schemas/compliance-check.schema.ts`
- Create: `src/server/agents/compliance-monitor.agent.ts`
- Create: `src/app/api/agents/compliance/route.ts`

- [ ] **Step 1: Create compliance schema**

```typescript
// src/lib/ai/schemas/compliance-check.schema.ts
import { z } from 'zod'

export const ComplianceAlertSchema = z.object({
  category: z.enum([
    'VENDOR_DURC_EXPIRING',
    'VENDOR_CERT_EXPIRING',
    'ORDER_OVERDUE',
    'BUDGET_OVERRUN',
    'INVOICE_UNRECONCILED',
    'APPROVAL_STALE',
  ]),
  severity: z.enum(['info', 'warning', 'critical']),
  title: z.string(),
  description: z.string(),
  entity_type: z.string().describe('vendor, request, invoice, budget'),
  entity_id: z.string(),
  action_label: z.string().optional(),
  action_url: z.string().optional(),
  days_until_deadline: z.number().optional(),
})

export const ComplianceReportSchema = z.object({
  alerts: z.array(ComplianceAlertSchema),
  summary: z.string(),
  checked_at: z.string(),
})

export type ComplianceAlert = z.infer<typeof ComplianceAlertSchema>
export type ComplianceReport = z.infer<typeof ComplianceReportSchema>
```

- [ ] **Step 2: Create compliance monitor agent**

```typescript
// src/server/agents/compliance-monitor.agent.ts
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import { PROCUREMENT_READ_TOOLS } from '@/server/agents/tools/procurement.tools'
import { NOTIFICATION_TOOLS } from '@/server/agents/tools/notification.tools'
import { prisma } from '@/lib/db'
import type { ComplianceReport } from '@/lib/ai/schemas/compliance-check.schema'

const COMPLIANCE_SYSTEM_PROMPT = `Sei un agente di compliance per PMI italiane. Controlli quotidianamente:

1. FORNITORI: DURC in scadenza (entro 30gg), certificazioni in scadenza
2. ORDINI: richieste in stato ORDERED con expected_delivery passata (OVERDUE)
3. BUDGET: centri di costo con utilizzo > 90% o in sforamento
4. FATTURE: fatture non riconciliate da piu di 30 giorni
5. APPROVAZIONI: richieste in PENDING_APPROVAL da piu di 7 giorni

Per ogni problema trovato:
- Classifica la severita (info/warning/critical)
- Scrivi titolo e descrizione in italiano chiaro
- Suggerisci l'azione da intraprendere
- Notifica l'utente responsabile

REGOLE:
- CRITICAL: scadenza entro 7 giorni, budget sforato, ordini overdue > 14 giorni
- WARNING: scadenza entro 30 giorni, budget > 90%, ordini overdue < 14 giorni
- INFO: scadenza entro 60 giorni, approvazioni stagnanti`

export async function runComplianceCheck(
  adminUserId: string,
): Promise<ComplianceReport> {
  const client = getClaudeClient()

  // Pre-fetch data to inject as context
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)

  const [overdueOrders, staleApprovals, unreconciledInvoices] =
    await prisma.$transaction([
      prisma.purchaseRequest.findMany({
        where: {
          status: { in: ['ORDERED', 'SHIPPED'] },
          expected_delivery: { lt: now },
        },
        select: { id: true, code: true, title: true, expected_delivery: true, requester_id: true },
        take: 50,
      }),
      prisma.approval.findMany({
        where: { status: 'PENDING', created_at: { lt: sevenDaysAgo } },
        include: { request: { select: { code: true, title: true } }, approver: { select: { name: true } } },
        take: 50,
      }),
      prisma.invoice.findMany({
        where: {
          reconciliation_status: 'PENDING',
          received_at: { lt: thirtyDaysAgo },
        },
        select: { id: true, invoice_number: true, supplier_name: true, total_amount: true },
        take: 50,
      }),
    ])

  const contextData = JSON.stringify({
    overdue_orders: overdueOrders,
    stale_approvals: staleApprovals,
    unreconciled_invoices: unreconciledInvoices,
    check_date: now.toISOString(),
  })

  const tools = [...PROCUREMENT_READ_TOOLS, ...NOTIFICATION_TOOLS]

  const runner = client.beta.messages.toolRunner({
    model: MODELS.SONNET,
    max_tokens: 8192,
    system: COMPLIANCE_SYSTEM_PROMPT,
    tools,
    messages: [
      {
        role: 'user',
        content: `Esegui il controllo compliance giornaliero.\n\nDati pre-caricati:\n${contextData}\n\nAdmin user ID per notifiche: ${adminUserId}`,
      },
    ],
  })

  let fullText = ''
  const toolCalls: string[] = []

  for await (const message of runner) {
    for (const block of message.content) {
      if (block.type === 'text') fullText += block.text
      else if (block.type === 'tool_use') toolCalls.push(block.name)
    }
  }

  const notificationsSent = toolCalls.filter((t) => t === 'create_notification').length

  return Object.freeze({
    alerts: [], // In production, parse from structured output
    summary: `Controllo completato. ${notificationsSent} notifiche inviate. ${fullText.slice(0, 500)}`,
    checked_at: now.toISOString(),
  })
}
```

- [ ] **Step 3: Create API route**

```typescript
// src/app/api/agents/compliance/route.ts
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { runComplianceCheck } from '@/server/agents/compliance-monitor.agent'

export const dynamic = 'force-dynamic'

export async function POST() {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const { user } = authResult
  if (user.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Solo Admin' } },
      { status: 403 },
    )
  }

  const result = await runComplianceCheck(user.id)
  return NextResponse.json({ success: true, data: result })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/schemas/compliance-check.schema.ts src/server/agents/compliance-monitor.agent.ts src/app/api/agents/compliance/route.ts
git commit -m "feat: add compliance monitor agent for deadlines, DURC, overdue orders"
```

---

## Phase 7: Onboarding Agent

### Task 7.1: Build Onboarding Agent

**Files:**
- Create: `src/lib/ai/schemas/onboarding-import.schema.ts`
- Create: `src/server/agents/onboarding.agent.ts`
- Create: `src/app/api/agents/onboarding/[sessionId]/route.ts`

- [ ] **Step 1: Create onboarding schema**

```typescript
// src/lib/ai/schemas/onboarding-import.schema.ts
import { z } from 'zod'

export const VendorMappingSchema = z.object({
  name: z.string(),
  code: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  vat_id: z.string().nullable(),
  category: z.array(z.string()),
  payment_terms: z.string().nullable(),
  address: z.string().nullable(),
  confidence: z.number().min(0).max(1).describe('Confidenza nel mapping colonne'),
  warnings: z.array(z.string()).describe('Problemi trovati (duplicati, campi mancanti, etc.)'),
})

export const OnboardingResultSchema = z.object({
  vendors_parsed: z.number(),
  vendors_imported: z.number(),
  vendors_skipped: z.number(),
  column_mapping: z.record(z.string(), z.string()).describe('Colonna file -> campo SaiFlow'),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
})

export type VendorMapping = z.infer<typeof VendorMappingSchema>
export type OnboardingResult = z.infer<typeof OnboardingResultSchema>
```

- [ ] **Step 2: Create onboarding agent**

```typescript
// src/server/agents/onboarding.agent.ts
import Anthropic, { toFile } from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { getClaudeClient } from '@/lib/ai/claude-client'
import { MODELS } from '@/lib/ai/models'
import { VendorMappingSchema } from '@/lib/ai/schemas/onboarding-import.schema'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const ONBOARDING_PROMPT = `Sei un agente di onboarding per SaiFlow, un software di procurement per PMI italiane.

Ricevi un file (Excel o CSV) con la lista fornitori del cliente. Il formato e SPORCO: ogni cliente usa colonne diverse, nomi diversi, formati diversi.

IL TUO COMPITO:
1. Analizza il file e identifica le colonne
2. Mappa ogni colonna al campo SaiFlow corretto:
   - name (ragione sociale)
   - code (codice fornitore — se manca, generalo da nome)
   - email
   - phone (telefono)
   - vat_id (partita IVA — formato: 11 cifre senza IT)
   - category (categorie merceologiche — array)
   - payment_terms (condizioni pagamento — es: "30gg DFFM")
   - address (indirizzo)
3. Per ogni riga, estrai i dati e normalizzali:
   - Nomi: Title Case
   - P.IVA: solo cifre, 11 caratteri
   - Telefono: formato +39 XXX XXXXXXX
   - Email: lowercase, valida
4. Segnala problemi: duplicati, P.IVA invalide, campi obbligatori mancanti

RISPONDI con un array JSON di oggetti VendorMapping.`

const VendorBatchSchema = z.array(VendorMappingSchema)

export interface OnboardingSessionResult {
  readonly vendors_parsed: number
  readonly vendors_imported: number
  readonly vendors_skipped: number
  readonly warnings: readonly string[]
}

export async function processVendorImport(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<OnboardingSessionResult> {
  const client = getClaudeClient()

  // Upload file via Files API
  const uploaded = await client.beta.files.upload({
    file: await toFile(fileBuffer, filename, { type: mimeType }),
    betas: ['files-api-2025-04-14'],
  })

  // Analyze with Claude
  const response = await client.messages.parse({
    model: MODELS.SONNET,
    max_tokens: 16384,
    system: ONBOARDING_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'file', file_id: uploaded.id },
            title: filename,
          } as unknown as Anthropic.ContentBlockParam,
          { type: 'text', text: `Analizza questo file fornitori e mappa i dati. Filename: ${filename}` },
        ],
      },
    ],
    output_format: VendorBatchSchema,
    ...(uploaded.id ? { betas: ['files-api-2025-04-14'] } : {}),
  } as Parameters<typeof client.messages.parse>[0])

  const vendors = response.parsed_output
  if (!vendors || !Array.isArray(vendors)) {
    return Object.freeze({
      vendors_parsed: 0,
      vendors_imported: 0,
      vendors_skipped: 0,
      warnings: ['Parsing fallito: nessun dato estratto dal file'],
    })
  }

  // Import vendors into DB
  const warnings: string[] = []
  let imported = 0
  let skipped = 0

  for (const vendor of vendors) {
    // Skip low-confidence mappings
    if (vendor.confidence < 0.5) {
      skipped++
      warnings.push(`Skipped "${vendor.name}": confidenza troppo bassa (${vendor.confidence})`)
      continue
    }

    // Check for duplicates
    const existing = await prisma.vendor.findFirst({
      where: { OR: [{ code: vendor.code }, { name: vendor.name }] },
    })
    if (existing) {
      skipped++
      warnings.push(`Skipped "${vendor.name}": duplicato (codice ${vendor.code})`)
      continue
    }

    await prisma.vendor.create({
      data: {
        name: vendor.name,
        code: vendor.code,
        email: vendor.email,
        phone: vendor.phone,
        category: vendor.category,
        payment_terms: vendor.payment_terms,
        status: 'ACTIVE',
      },
    })
    imported++

    // Report vendor-level warnings
    for (const w of vendor.warnings) {
      warnings.push(`${vendor.name}: ${w}`)
    }
  }

  // Cleanup uploaded file
  try {
    await client.beta.files.delete(uploaded.id, { betas: ['files-api-2025-04-14'] })
  } catch { /* ignore cleanup errors */ }

  return Object.freeze({
    vendors_parsed: vendors.length,
    vendors_imported: imported,
    vendors_skipped: skipped,
    warnings,
  })
}
```

- [ ] **Step 3: Create API route**

```typescript
// src/app/api/agents/onboarding/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { processVendorImport } from '@/server/agents/onboarding.agent'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult

  const { user } = authResult
  if (user.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Solo Admin' } },
      { status: 403 },
    )
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'File richiesto' } },
      { status: 400 },
    )
  }

  const allowedTypes = new Set([
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ])
  if (!allowedTypes.has(file.type)) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Formato non supportato. Usa CSV o Excel.' } },
      { status: 400 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await processVendorImport(buffer, file.name, file.type)

  return NextResponse.json({ success: true, data: result })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/schemas/onboarding-import.schema.ts src/server/agents/onboarding.agent.ts src/app/api/agents/onboarding/route.ts
git commit -m "feat: add onboarding agent for automatic vendor import from Excel/CSV"
```

---

## Summary: Agent Architecture Map

```
┌──────────────────────────────────────────────────────────────┐
│                    CLAUDE AGENTS LAYER                       │
│                                                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │  Procurement     │  │  Email           │  │  Invoice   │  │
│  │  Assistant       │  │  Intelligence    │  │  Reconcile │  │
│  │  (Sonnet 4.6)    │  │  (Sonnet 4.6)    │  │ (Sonnet)   │  │
│  │  Tool Runner     │  │  Tool Runner     │  │ Tool Runner│  │
│  └────────┬────────┘  └────────┬─────────┘  └─────┬──────┘  │
│           │                    │                    │         │
│  ┌────────┴────────┐  ┌───────┴──────────┐  ┌─────┴──────┐  │
│  │  Smart Reorder  │  │  Tender Analysis │  │ Compliance │  │
│  │  (Sonnet 4.6)   │  │  (Opus 4.6)      │  │ Monitor    │  │
│  │  Tool Runner    │  │  Adaptive Think  │  │ (Sonnet)   │  │
│  └────────┬────────┘  │  + Files API     │  └─────┬──────┘  │
│           │           └───────┬──────────┘        │         │
│  ┌────────┴──────────────────┐│                    │         │
│  │  Onboarding Agent         ││                    │         │
│  │  (Sonnet 4.6 + Files API) ││                    │         │
│  └───────────────────────────┘│                    │         │
│                               │                    │         │
├───────────────────────────────┴────────────────────┴─────────┤
│                    SHARED TOOLS LAYER                        │
│                                                              │
│  procurement.tools  │ invoice.tools │ inventory.tools        │
│  vendor.tools       │ commessa.tools│ notification.tools     │
│  budget.tools       │               │                        │
│                     │  All: betaZodTool + Zod v4             │
├──────────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE                            │
│                                                              │
│  claude-client.ts (singleton + retry)                        │
│  models.ts (SONNET / OPUS / HAIKU constants)                 │
│  schemas/*.schema.ts (Zod structured outputs)                │
│  Prisma ORM → PostgreSQL                                     │
└──────────────────────────────────────────────────────────────┘
```

## Sprint Timeline

| Sprint | Phase | Deliverable | Effort |
|--------|-------|-------------|--------|
| 1 | Phase 0 | Fix retired models + structured outputs | 1-2 giorni |
| 1 | Phase 1 | Procurement assistant con tool runner | 2-3 giorni |
| 2 | Phase 2 | Email intelligence agent | 3-4 giorni |
| 2 | Phase 3 | Invoice reconciliation agent | 2-3 giorni |
| 3 | Phase 4 | Smart reorder agent | 2-3 giorni |
| 3 | Phase 5 | Tender analysis agent (Opus) | 3-4 giorni |
| 4 | Phase 6 | Compliance monitor agent | 2-3 giorni |
| 4 | Phase 7 | Onboarding agent | 2-3 giorni |

**Totale stimato: ~4 sprint (8 settimane)**

## Cost Model (per PMI con ~50 operazioni/giorno)

| Agent | Model | Calls/day | Est. cost/month |
|-------|-------|-----------|----------------|
| Procurement Assistant | Sonnet 4.6 | ~30 | ~$15 |
| Email Intelligence | Sonnet 4.6 | ~20 | ~$10 |
| Invoice Reconciliation | Sonnet 4.6 | ~10 | ~$8 |
| Smart Reorder | Sonnet 4.6 | 1 (daily) | ~$2 |
| Tender Analysis | Opus 4.6 | ~2/week | ~$5 |
| Compliance Monitor | Sonnet 4.6 | 1 (daily) | ~$3 |
| Onboarding | Sonnet 4.6 | ~2/month | ~$1 |
| **TOTALE** | | | **~$44/month** |

Nota: con prompt caching (`cache_control: {type: "ephemeral"}`) sui system prompt, il costo scende del 30-40%.
