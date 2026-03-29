# AI Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three AI features to ProcureFlow: Procurement Intelligence (insight cards), AI Agent with actions (RBAC + confirmation), and Inventory Forecasting (WMA + Claude on-demand + auto-reorder).

**Architecture:** Feature-specific services (`insight.service.ts`, `agent.service.ts`, `forecast.service.ts`) sharing a lightweight toolkit (`lib/ai/`). Each feature has its own API routes, hooks, and UI components. The existing `chat.service.ts` is replaced by `agent.service.ts` as a superset.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma/PostgreSQL, Anthropic SDK (Claude), Vitest, Tailwind CSS with ProcureFlow design tokens.

**Spec:** `docs/superpowers/specs/2026-03-29-ai-enhancements-design.md`

---

## File Map

### New Files

| File | Responsibility | ~Lines |
|------|---------------|--------|
| `src/lib/ai/claude-client.ts` | Anthropic SDK singleton, retry, rate-limit, logging | 80 |
| `src/lib/ai/tool-registry.ts` | READ + WRITE tool definitions with handlers | 350 |
| `src/lib/ai/prompts.ts` | Shared system prompt fragments | 50 |
| `src/lib/ai/pending-actions.ts` | In-memory store for pending WRITE confirmations | 60 |
| `src/lib/constants/agent.ts` | Pending action TTL | 10 |
| `src/lib/constants/forecast.ts` | WMA weights, rate-limit configs | 35 |
| `src/lib/constants/insights.ts` | Insight TTL per type, severity colors | 30 |
| `src/server/services/insight.service.ts` | Generate + fetch + dismiss insights | 250 |
| `src/server/services/agent.service.ts` | AI agent with tool-use streaming + RBAC | 300 |
| `src/server/services/forecast.service.ts` | WMA + AI forecast + reorder alerts | 250 |
| `src/app/api/ai/insights/route.ts` | POST (n8n) + GET (dashboard) | 80 |
| `src/app/api/ai/insights/[id]/route.ts` | PATCH (dismiss) | 40 |
| `src/app/api/ai/forecast/[materialId]/route.ts` | GET (WMA) + POST (AI) | 80 |
| `src/app/api/ai/forecast/alerts/route.ts` | GET (list alerts) | 50 |
| `src/app/api/ai/forecast/alerts/[id]/route.ts` | PATCH (dismiss/resolve) | 40 |
| `src/app/api/ai/forecast/check/route.ts` | POST (n8n cron) | 50 |
| `src/app/api/chat/confirm/route.ts` | POST (confirm/cancel agent action) | 50 |
| `src/components/dashboard/insight-cards.tsx` | Insight cards widget | 120 |
| `src/components/chat/action-confirmation.tsx` | Confirmation dialog for agent WRITE actions | 100 |
| `src/components/inventory/forecast-panel.tsx` | Forecast chart + reorder banner | 150 |
| `src/hooks/use-insights.ts` | Fetch + dismiss insights hook | 50 |
| `src/hooks/use-forecast.ts` | Fetch forecast + alerts hook | 70 |
| `src/types/ai.ts` | AI-specific types (InsightCard, ForecastResult, ActionPreview, etc.) | 80 |
| `tests/claude-client.test.ts` | Claude client retry/rate-limit tests | 80 |
| `tests/tool-registry.test.ts` | Tool definitions + RBAC filtering tests | 100 |
| `tests/pending-actions.test.ts` | Pending action store TTL tests | 60 |
| `tests/insight.service.test.ts` | Insight generation + dedup tests | 150 |
| `tests/agent.service.test.ts` | Agent tool-use + RBAC tests | 150 |
| `tests/forecast.service.test.ts` | WMA calculation + reorder alert tests | 150 |

### Modified Files

| File | Change | Lines Changed |
|------|--------|--------------|
| `prisma/schema.prisma` | Add AiInsight, MaterialAlert models + enums + reverse relations | +60 |
| `src/types/index.ts` | Re-export from `types/ai.ts` | +2 |
| `src/app/api/chat/route.ts` | Replace `chat.service` import with `agent.service` | ~5 |
| `src/hooks/use-chat.ts` | Handle new SSE events (action_request, confirmed, cancelled) | +30 |
| `src/components/chat/chat-panel.tsx` | Render ActionConfirmationDialog when action_request received | +15 |
| `src/components/dashboard/dashboard-tabs.tsx` | Add InsightCards to panoramica tab | +10 |
| `src/components/inventory/materials-page-content.tsx` | Add ForecastPanel + reorder banner | +15 |

### Deleted Files

| File | Reason |
|------|--------|
| `src/server/services/chat.service.ts` | Replaced by `agent.service.ts` (superset) |

---

## Chunk 1: Foundation — Shared Toolkit + Prisma Schema

### Task 1: Prisma Schema — AiInsight + MaterialAlert

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums to schema**

Add after the existing enums section:

```prisma
enum InsightType {
  SPEND_ANOMALY
  VENDOR_RISK
  SAVINGS
  BOTTLENECK
  BUDGET_ALERT
}

enum InsightSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum AlertType {
  REORDER_SUGGESTED
  LOW_STOCK
  OUT_OF_STOCK
}
```

- [ ] **Step 2: Add AiInsight model**

```prisma
model AiInsight {
  id           String          @id @default(cuid())
  type         InsightType
  severity     InsightSeverity
  title        String
  description  String
  action_label String?
  action_url   String?
  metadata     Json?
  dismissed    Boolean         @default(false)
  expires_at   DateTime
  created_at   DateTime        @default(now())

  @@index([dismissed, expires_at])
  @@index([type, severity])
  @@map("ai_insights")
}
```

- [ ] **Step 3: Add MaterialAlert model**

```prisma
model MaterialAlert {
  id                  String    @id @default(cuid())
  material_id         String
  material            Material  @relation(fields: [material_id], references: [id])
  type                AlertType
  suggested_qty       Int?
  suggested_vendor_id String?
  suggested_vendor    Vendor?   @relation("MaterialAlertVendor", fields: [suggested_vendor_id], references: [id])
  days_remaining      Float?
  dismissed           Boolean   @default(false)
  resolved_by         String?
  created_at          DateTime  @default(now())

  @@index([material_id, dismissed])
  @@map("material_alerts")
}
```

- [ ] **Step 4: Add reverse relations to Material and Vendor**

In the `Material` model, add:
```prisma
  alerts  MaterialAlert[]
```

In the `Vendor` model, add:
```prisma
  material_alerts  MaterialAlert[]  @relation("MaterialAlertVendor")
```

- [ ] **Step 5: Generate Prisma client**

Run: `cd procureflow && npx prisma generate`
Expected: "Generated Prisma Client"

- [ ] **Step 6: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Create Prisma migration**

Run: `cd procureflow && npx prisma migrate dev --name add-ai-insights-and-material-alerts`
Expected: Migration created and applied successfully.

Run: `cd procureflow && npx prisma migrate status`
Expected: All migrations applied.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add AiInsight and MaterialAlert prisma models with migration"
```

---

### Task 2: Types — AI Type Definitions

**Files:**
- Create: `src/types/ai.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create AI types file**

Create `src/types/ai.ts`:

```typescript
// ---------------------------------------------------------------------------
// AI Feature Types
// ---------------------------------------------------------------------------

// --- Insight Cards (Procurement Intelligence) ---

export interface InsightCard {
  readonly id: string
  readonly type: 'SPEND_ANOMALY' | 'VENDOR_RISK' | 'SAVINGS' | 'BOTTLENECK' | 'BUDGET_ALERT'
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  readonly title: string
  readonly description: string
  readonly actionLabel: string | null
  readonly actionUrl: string | null
  readonly metadata: Record<string, unknown> | null
  readonly dismissed: boolean
  readonly expiresAt: string
  readonly createdAt: string
}

export interface GenerateInsightsResult {
  readonly generated: number
  readonly expired_cleaned: number
  readonly error?: string
}

// --- AI Agent (Action Confirmation) ---

export interface ActionPreview {
  readonly label: string
  readonly fields: ReadonlyArray<{ readonly key: string; readonly value: string }>
}

export interface PendingAction {
  readonly tool: string
  readonly params: Record<string, unknown>
  readonly userId: string
  readonly preview: ActionPreview
  readonly expiresAt: number
}

export type AgentStreamEvent =
  | { readonly type: 'text'; readonly content: string }
  | { readonly type: 'tool_start'; readonly name: string }
  | { readonly type: 'tool_end'; readonly name: string }
  | { readonly type: 'action_request'; readonly actionId: string; readonly tool: string; readonly params: Record<string, unknown>; readonly preview: ActionPreview }
  | { readonly type: 'action_confirmed'; readonly actionId: string; readonly result: unknown }
  | { readonly type: 'action_cancelled'; readonly actionId: string }
  | { readonly type: 'done' }
  | { readonly type: 'error'; readonly message: string }

// --- Inventory Forecasting ---

export interface BasicForecast {
  readonly materialId: string
  readonly materialName: string
  readonly currentStock: number
  readonly projected: readonly number[]  // next 3 months
  readonly daysRemaining: number
  readonly reorderNeeded: boolean
}

export interface AiForecast extends BasicForecast {
  readonly aiProjected: readonly number[]
  readonly confidence: number  // 0-1
  readonly reasoning: string
  readonly risks: readonly string[]
}

export interface MaterialAlertCard {
  readonly id: string
  readonly materialId: string
  readonly materialName: string
  readonly materialCode: string
  readonly type: 'REORDER_SUGGESTED' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  readonly suggestedQty: number | null
  readonly suggestedVendorId: string | null
  readonly suggestedVendorName: string | null
  readonly daysRemaining: number | null
  readonly dismissed: boolean
  readonly createdAt: string
}

export interface CheckReorderResult {
  readonly alerts_created: number
  readonly alerts_resolved: number
}

// --- Shared Tool Types ---

export type ToolPermissionLevel = 'READ' | 'WRITE'

export interface ToolDefinition {
  readonly name: string
  readonly description: string
  readonly input_schema: Record<string, unknown>
  readonly permission_level: ToolPermissionLevel
  readonly min_role: 'VIEWER' | 'REQUESTER' | 'MANAGER' | 'ADMIN'
}
```

- [ ] **Step 2: Re-export from index**

Add to the end of `src/types/index.ts`:
```typescript
export * from './ai'
```

- [ ] **Step 3: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/types/ai.ts src/types/index.ts
git commit -m "feat: add AI feature type definitions"
```

---

### Task 3: Constants — Insight TTLs + Forecast Config

**Files:**
- Create: `src/lib/constants/insights.ts`
- Create: `src/lib/constants/forecast.ts`

- [ ] **Step 1: Create insight constants**

Create `src/lib/constants/insights.ts`:

```typescript
// Default TTL per insight type in hours
export const INSIGHT_TTL_HOURS = {
  SPEND_ANOMALY: 72,
  VENDOR_RISK: 72,
  SAVINGS: 168,    // 1 week
  BOTTLENECK: 48,
  BUDGET_ALERT: 336, // 2 weeks
} as const

export const INSIGHT_SEVERITY_ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
} as const

export const MAX_ACTIVE_INSIGHTS = 6
```

- [ ] **Step 2: Create agent constants**

Create `src/lib/constants/agent.ts`:

```typescript
export const PENDING_ACTION_TTL_MS = 5 * 60 * 1000 // 5 minutes
```

- [ ] **Step 3: Create forecast constants**

Create `src/lib/constants/forecast.ts`:

```typescript
// Weighted Moving Average weights (most recent month = highest weight)
export const WMA_WEIGHTS = [3, 2.5, 2, 1.5, 1, 0.5] as const
export const WMA_MONTHS = WMA_WEIGHTS.length

// Projection horizon
export const FORECAST_MONTHS_AHEAD = 3

// AI forecast rate limiting
export const AI_FORECAST_RATE_LIMIT = {
  maxPerUser: 10,
  windowHours: 1,
} as const
```

- [ ] **Step 4: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants/insights.ts src/lib/constants/forecast.ts src/lib/constants/agent.ts
git commit -m "feat: add insight, forecast, and agent constants"
```

---

### Task 4: Claude Client — Shared Anthropic SDK Wrapper

**Files:**
- Create: `src/lib/ai/claude-client.ts`
- Test: `tests/claude-client.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/claude-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

describe('claude-client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports getClaudeClient that returns a singleton', async () => {
    const { getClaudeClient } = await import('@/lib/ai/claude-client')
    const a = getClaudeClient()
    const b = getClaudeClient()
    expect(a).toBe(b)
  })

  it('callClaude sends messages and returns response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })

    const { callClaude } = await import('@/lib/ai/claude-client')
    const result = await callClaude({
      system: 'You are helpful',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 1024,
    })

    expect(result.content).toEqual([{ type: 'text', text: 'Hello' }])
    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it('callClaude retries on transient errors', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('overloaded'))
      .mockResolvedValue({
        content: [{ type: 'text', text: 'OK' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      })

    const { callClaude } = await import('@/lib/ai/claude-client')
    const result = await callClaude({
      system: 'test',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 1024,
    })

    expect(result.content[0]).toEqual({ type: 'text', text: 'OK' })
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd procureflow && npx vitest run tests/claude-client.test.ts`
Expected: FAIL — module `@/lib/ai/claude-client` not found

- [ ] **Step 3: Implement claude-client.ts**

Create `src/lib/ai/claude-client.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Shared Claude client — singleton with retry and logging
// ---------------------------------------------------------------------------

let client: Anthropic | null = null

export function getClaudeClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

interface CallClaudeOptions {
  readonly system: string
  readonly messages: ReadonlyArray<{ readonly role: 'user' | 'assistant'; readonly content: string }>
  readonly maxTokens: number
  readonly tools?: ReadonlyArray<Anthropic.Tool>
  readonly model?: string
}

const DEFAULT_MODEL = 'claude-sonnet-4-6-20250514'
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

export async function callClaude(options: CallClaudeOptions): Promise<Anthropic.Message> {
  const anthropic = getClaudeClient()
  const model = options.model ?? DEFAULT_MODEL

  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const start = Date.now()
      const response = await anthropic.messages.create({
        model,
        system: options.system,
        messages: options.messages as Anthropic.MessageParam[],
        max_tokens: options.maxTokens,
        ...(options.tools ? { tools: options.tools as Anthropic.Tool[] } : {}),
      })

      console.log(
        `[claude-client] model=${model} tokens_in=${response.usage.input_tokens}` +
          ` tokens_out=${response.usage.output_tokens} latency_ms=${Date.now() - start}`,
      )

      return response
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt)
        console.warn(`[claude-client] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`, error)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd procureflow && npx vitest run tests/claude-client.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/claude-client.ts tests/claude-client.test.ts
git commit -m "feat: add shared Claude client with retry and logging"
```

---

### Task 5: Pending Actions Store

**Files:**
- Create: `src/lib/ai/pending-actions.ts`
- Test: `tests/pending-actions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/pending-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('pending-actions', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('storePendingAction stores and getPendingAction retrieves', async () => {
    const { storePendingAction, getPendingAction } = await import('@/lib/ai/pending-actions')
    const actionId = storePendingAction({
      tool: 'create_request',
      params: { title: 'Test' },
      userId: 'user1',
      preview: { label: 'Crea richiesta', fields: [] },
    })

    const action = getPendingAction(actionId, 'user1')
    expect(action).toBeTruthy()
    expect(action!.tool).toBe('create_request')
  })

  it('getPendingAction returns null for wrong userId', async () => {
    const { storePendingAction, getPendingAction } = await import('@/lib/ai/pending-actions')
    const actionId = storePendingAction({
      tool: 'create_request',
      params: {},
      userId: 'user1',
      preview: { label: 'Test', fields: [] },
    })

    const action = getPendingAction(actionId, 'user2')
    expect(action).toBeNull()
  })

  it('removePendingAction removes the action', async () => {
    const { storePendingAction, getPendingAction, removePendingAction } = await import(
      '@/lib/ai/pending-actions'
    )
    const actionId = storePendingAction({
      tool: 'create_request',
      params: {},
      userId: 'user1',
      preview: { label: 'Test', fields: [] },
    })

    removePendingAction(actionId)
    expect(getPendingAction(actionId, 'user1')).toBeNull()
  })

  it('expired actions are cleaned up on access', async () => {
    vi.useFakeTimers()
    const { storePendingAction, getPendingAction } = await import('@/lib/ai/pending-actions')

    const actionId = storePendingAction({
      tool: 'create_request',
      params: {},
      userId: 'user1',
      preview: { label: 'Test', fields: [] },
    })

    // Advance time beyond TTL (5 minutes)
    vi.advanceTimersByTime(6 * 60 * 1000)

    expect(getPendingAction(actionId, 'user1')).toBeNull()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd procureflow && npx vitest run tests/pending-actions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement pending-actions.ts**

Create `src/lib/ai/pending-actions.ts`:

```typescript
import { PENDING_ACTION_TTL_MS } from '@/lib/constants/agent'
import type { ActionPreview } from '@/types/ai'

// ---------------------------------------------------------------------------
// In-memory store for pending AI agent write actions
// ---------------------------------------------------------------------------

interface StoredAction {
  readonly tool: string
  readonly params: Record<string, unknown>
  readonly userId: string
  readonly preview: ActionPreview
  readonly expiresAt: number
}

const store = new Map<string, StoredAction>()

function cleanup(): void {
  const now = Date.now()
  for (const [id, action] of store) {
    if (action.expiresAt <= now) {
      store.delete(id)
    }
  }
}

export function storePendingAction(input: {
  readonly tool: string
  readonly params: Record<string, unknown>
  readonly userId: string
  readonly preview: ActionPreview
}): string {
  cleanup()
  const actionId = crypto.randomUUID()
  store.set(actionId, {
    ...input,
    expiresAt: Date.now() + PENDING_ACTION_TTL_MS,
  })
  return actionId
}

export function getPendingAction(actionId: string, userId: string): StoredAction | null {
  cleanup()
  const action = store.get(actionId)
  if (!action) return null
  if (action.userId !== userId) return null
  return action
}

export function removePendingAction(actionId: string): void {
  store.delete(actionId)
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd procureflow && npx vitest run tests/pending-actions.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/pending-actions.ts tests/pending-actions.test.ts
git commit -m "feat: add in-memory pending actions store with TTL"
```

---

### Task 6: Prompts — Shared System Prompt Fragments

**Files:**
- Create: `src/lib/ai/prompts.ts`

- [ ] **Step 1: Create prompts file**

Create `src/lib/ai/prompts.ts`:

```typescript
// ---------------------------------------------------------------------------
// Shared system prompt fragments for AI features
// ---------------------------------------------------------------------------

export const COMPANY_CONTEXT = `Sei un assistente AI per ProcureFlow, una piattaforma di procurement per PMI italiane.
Il sistema gestisce richieste d'acquisto, fornitori, fatture, budget, gare d'appalto e magazzino.
Rispondi sempre in italiano. Sii conciso e professionale.`

export const SAFETY_GUARDRAILS = `Regole di sicurezza:
- Non rivelare mai dati sensibili come password, token, o chiavi API.
- Non inventare dati: se non hai informazioni sufficienti, dichiaralo.
- Non eseguire azioni distruttive (cancellazioni, reset) senza conferma esplicita.
- Limita le risposte ai dati effettivamente presenti nel sistema.`

export const INSIGHT_SYSTEM_PROMPT = `${COMPANY_CONTEXT}

Sei un analista di procurement. Analizza i dati forniti e genera insight azionabili.
Per ogni insight, fornisci:
- type: uno tra SPEND_ANOMALY, VENDOR_RISK, SAVINGS, BOTTLENECK, BUDGET_ALERT
- severity: uno tra LOW, MEDIUM, HIGH, CRITICAL
- title: titolo breve in italiano (max 80 caratteri)
- description: descrizione dettagliata in italiano (max 200 caratteri)
- action_label: etichetta del pulsante azione (opzionale, es. "Vedi dettagli")
- action_url: URL relativo alla pagina rilevante (opzionale, es. "/vendors/cid123")

Rispondi SOLO con un array JSON valido. Nessun altro testo.

${SAFETY_GUARDRAILS}`

export const AGENT_SYSTEM_PROMPT = `${COMPANY_CONTEXT}

Sei un assistente AI con la capacità di eseguire azioni nel sistema.
Puoi cercare informazioni e, quando richiesto, creare o modificare risorse.

Per le azioni di modifica (WRITE), il sistema chiederà conferma all'utente prima di eseguire.
Descrivi sempre chiaramente cosa stai per fare prima di chiamare uno strumento di modifica.

Quando usi strumenti di lettura, integra i risultati nella tua risposta in modo naturale.
Non mostrare JSON grezzo all'utente — riassumi le informazioni in modo leggibile.

Fornisci link diretti alle risorse usando il formato: /requests/ID, /vendors/ID, ecc.

${SAFETY_GUARDRAILS}`

export const FORECAST_SYSTEM_PROMPT = `${COMPANY_CONTEXT}

Sei un analista di supply chain. Analizza i dati di consumo forniti e genera una previsione.
Considera: stagionalità, trend recenti, ordini aperti, affidabilità fornitore.

Rispondi con un JSON con questa struttura:
{
  "projected": [number, number, number],  // consumo previsto prossimi 3 mesi
  "confidence": number,                     // 0-1
  "reasoning": "spiegazione in italiano",
  "risks": ["rischio 1", "rischio 2"]
}

Rispondi SOLO con JSON valido. Nessun altro testo.

${SAFETY_GUARDRAILS}`
```

- [ ] **Step 2: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/prompts.ts
git commit -m "feat: add shared AI system prompt fragments"
```

---

### Task 7: Tool Registry — READ + WRITE Tool Definitions

**Files:**
- Create: `src/lib/ai/tool-registry.ts`
- Test: `tests/tool-registry.test.ts`

- [ ] **Step 1: Write failing tests for RBAC filtering**

Create `tests/tool-registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getToolsForRole, READ_TOOLS, WRITE_TOOLS, type UserRole } from '@/lib/ai/tool-registry'

describe('tool-registry', () => {
  it('READ_TOOLS has exactly 8 tools', () => {
    expect(READ_TOOLS).toHaveLength(8)
  })

  it('WRITE_TOOLS has exactly 6 tools', () => {
    expect(WRITE_TOOLS).toHaveLength(6)
  })

  it('each tool has required fields', () => {
    for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.input_schema).toBeTruthy()
      expect(tool.permission_level).toMatch(/^(READ|WRITE)$/)
      expect(tool.min_role).toMatch(/^(VIEWER|REQUESTER|MANAGER|ADMIN)$/)
    }
  })

  it('VIEWER gets only READ tools', () => {
    const tools = getToolsForRole('VIEWER')
    expect(tools.every((t) => t.permission_level === 'READ')).toBe(true)
    expect(tools).toHaveLength(8)
  })

  it('REQUESTER gets READ + REQUESTER-level WRITE tools', () => {
    const tools = getToolsForRole('REQUESTER')
    const writeTools = tools.filter((t) => t.permission_level === 'WRITE')
    expect(writeTools.length).toBeGreaterThan(0)
    // Should have create_request, update_request, submit_for_approval
    const writeNames = writeTools.map((t) => t.name)
    expect(writeNames).toContain('create_request')
    expect(writeNames).toContain('update_request')
    expect(writeNames).toContain('submit_for_approval')
    expect(writeNames).not.toContain('approve_request')
    expect(writeNames).not.toContain('bulk_update')
  })

  it('MANAGER gets READ + MANAGER-level WRITE tools', () => {
    const tools = getToolsForRole('MANAGER')
    const writeNames = tools.filter((t) => t.permission_level === 'WRITE').map((t) => t.name)
    expect(writeNames).toContain('approve_request')
    expect(writeNames).toContain('create_vendor')
    expect(writeNames).not.toContain('bulk_update')
  })

  it('ADMIN gets all tools', () => {
    const tools = getToolsForRole('ADMIN')
    const writeNames = tools.filter((t) => t.permission_level === 'WRITE').map((t) => t.name)
    expect(writeNames).toContain('bulk_update')
    expect(tools).toHaveLength(14) // 8 READ + 6 WRITE
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd procureflow && npx vitest run tests/tool-registry.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement tool-registry.ts**

Create `src/lib/ai/tool-registry.ts`. This file is large (~350 lines). Key structure:

```typescript
import type { ToolDefinition, ToolPermissionLevel } from '@/types/ai'

export type UserRole = 'VIEWER' | 'REQUESTER' | 'MANAGER' | 'ADMIN'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  VIEWER: 0,
  REQUESTER: 1,
  MANAGER: 2,
  ADMIN: 3,
}

// --- READ TOOLS (migrated 1:1 from chat.service.ts) ---
export const READ_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'search_requests',
    description: 'Cerca richieste d\'acquisto con filtri opzionali per stato, priorità, testo.',
    input_schema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Testo di ricerca' },
        status: { type: 'string', description: 'Filtra per stato' },
        priority: { type: 'string', description: 'Filtra per priorità' },
        limit: { type: 'number', description: 'Max risultati (default 10)' },
      },
    },
    permission_level: 'READ',
    min_role: 'VIEWER',
  },
  // ... remaining 7 READ tools with same structure as chat.service.ts ...
  // get_request_detail, search_vendors, get_budget_overview,
  // get_invoice_stats, search_invoices, get_inventory_stats, get_tender_stats
]

// --- WRITE TOOLS ---
export const WRITE_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'create_request',
    description: 'Crea una nuova richiesta d\'acquisto.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Titolo della richiesta' },
        description: { type: 'string', description: 'Descrizione dettagliata' },
        vendor_id: { type: 'string', description: 'ID del fornitore' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        needed_by: { type: 'string', description: 'Data necessità (ISO 8601)' },
        category: { type: 'string' },
        department: { type: 'string' },
        cost_center: { type: 'string' },
        budget_code: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number' },
              unit: { type: 'string' },
              unit_price: { type: 'number' },
            },
            required: ['name', 'quantity'],
          },
        },
      },
      required: ['title'],
    },
    permission_level: 'WRITE',
    min_role: 'REQUESTER',
  },
  {
    name: 'update_request',
    description: 'Aggiorna una richiesta d\'acquisto propria (titolo, descrizione, priorità, data necessità, fornitore, categoria).',
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'ID della richiesta' },
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        needed_by: { type: 'string' },
        vendor_id: { type: 'string' },
        category: { type: 'string' },
      },
      required: ['request_id'],
    },
    permission_level: 'WRITE',
    min_role: 'REQUESTER',
  },
  {
    name: 'submit_for_approval',
    description: 'Invia una richiesta per approvazione.',
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'ID della richiesta da inviare' },
      },
      required: ['request_id'],
    },
    permission_level: 'WRITE',
    min_role: 'REQUESTER',
  },
  {
    name: 'approve_request',
    description: 'Approva una richiesta in attesa di approvazione.',
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'ID della richiesta da approvare' },
        notes: { type: 'string', description: 'Note di approvazione opzionali' },
      },
      required: ['request_id'],
    },
    permission_level: 'WRITE',
    min_role: 'MANAGER',
  },
  {
    name: 'create_vendor',
    description: 'Crea un nuovo fornitore.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome del fornitore' },
        code: { type: 'string', description: 'Codice fornitore univoco' },
        email: { type: 'string' },
        phone: { type: 'string' },
        category: { type: 'array', items: { type: 'string' } },
        payment_terms: { type: 'string' },
      },
      required: ['name', 'code'],
    },
    permission_level: 'WRITE',
    min_role: 'MANAGER',
  },
  {
    name: 'bulk_update',
    description: 'Aggiornamento massivo di richieste (max 50, solo priorità/categoria/dipartimento).',
    input_schema: {
      type: 'object',
      properties: {
        request_ids: { type: 'array', items: { type: 'string' }, maxItems: 50 },
        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
        category: { type: 'string' },
        department: { type: 'string' },
      },
      required: ['request_ids'],
    },
    permission_level: 'WRITE',
    min_role: 'ADMIN',
  },
]

export function getToolsForRole(role: UserRole): readonly ToolDefinition[] {
  const roleLevel = ROLE_HIERARCHY[role]
  return [...READ_TOOLS, ...WRITE_TOOLS].filter(
    (tool) => ROLE_HIERARCHY[tool.min_role] <= roleLevel,
  )
}

export function isWriteTool(toolName: string): boolean {
  return WRITE_TOOLS.some((t) => t.name === toolName)
}
```

**Important:** Copy the exact tool `input_schema` definitions for the 8 READ tools from the existing `chat.service.ts` (lines 63-220). Keep names and schemas identical.

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd procureflow && npx vitest run tests/tool-registry.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/tool-registry.ts tests/tool-registry.test.ts
git commit -m "feat: add tool registry with RBAC filtering"
```

---

## Chunk 2: Procurement Intelligence (Insights)

### Task 8: Insight Service

**Files:**
- Create: `src/server/services/insight.service.ts`
- Test: `tests/insight.service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/insight.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  $transaction: vi.fn(),
  aiInsight: {
    findMany: vi.fn(),
    update: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  purchaseRequest: { groupBy: vi.fn(), findMany: vi.fn() },
  approval: { findMany: vi.fn() },
  invoice: { groupBy: vi.fn() },
  budget: { findMany: vi.fn() },
  requestItem: { groupBy: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/ai/claude-client', () => ({
  callClaude: vi.fn(),
}))

describe('insight.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getActiveInsights returns non-dismissed, non-expired insights', async () => {
    const mockInsights = [
      { id: '1', type: 'SPEND_ANOMALY', severity: 'HIGH', title: 'Test', dismissed: false },
    ]
    mockPrisma.aiInsight.findMany.mockResolvedValue(mockInsights)

    const { getActiveInsights } = await import('@/server/services/insight.service')
    const result = await getActiveInsights()

    expect(result).toEqual(mockInsights)
    expect(mockPrisma.aiInsight.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dismissed: false }),
        orderBy: expect.arrayContaining([{ severity: 'asc' }]),
        take: 6,
      }),
    )
  })

  it('dismissInsight updates dismissed field', async () => {
    mockPrisma.aiInsight.update.mockResolvedValue({ id: '1', dismissed: true })

    const { dismissInsight } = await import('@/server/services/insight.service')
    await dismissInsight('1')

    expect(mockPrisma.aiInsight.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { dismissed: true },
    })
  })

  it('generateInsights handles Claude API failure gracefully', async () => {
    const { callClaude } = await import('@/lib/ai/claude-client')
    vi.mocked(callClaude).mockRejectedValue(new Error('timeout'))

    // Mock the DB queries to return empty data
    mockPrisma.$transaction.mockResolvedValue([[], [], [], [], []])
    mockPrisma.aiInsight.findMany.mockResolvedValue([])
    mockPrisma.aiInsight.deleteMany.mockResolvedValue({ count: 0 })

    const { generateInsights } = await import('@/server/services/insight.service')
    const result = await generateInsights()

    expect(result.generated).toBe(0)
    expect(result.error).toBe('claude_unavailable')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd procureflow && npx vitest run tests/insight.service.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement insight.service.ts**

Create `src/server/services/insight.service.ts`:

Key functions:
- `generateInsights()` — runs 5 DB queries in a `$transaction`, sends aggregated data to Claude, parses structured JSON response, deduplicates against active insights, saves new ones, cleans up expired
- `getActiveInsights()` — `WHERE dismissed=false AND expires_at > now() ORDER BY severity ASC, created_at DESC LIMIT 6`
- `dismissInsight(id)` — `UPDATE SET dismissed=true`

**Severity ordering:** Prisma sorts enums alphabetically, which gives CRITICAL < HIGH < LOW < MEDIUM (wrong). Instead: fetch without ordering by severity, then sort in JS using `INSIGHT_SEVERITY_ORDER` constant. Order by `created_at DESC` in Prisma, then `Array.sort()` by severity weight in JS.

Handle Claude errors: wrap `callClaude` in try-catch, return `{ generated: 0, error: 'claude_unavailable' }` on failure.

Parse Claude response: extract text content, `JSON.parse`, validate each item has required fields, filter out invalid ones (partial results).

Use `INSIGHT_TTL_HOURS` to compute `expires_at` per insight type.

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd procureflow && npx vitest run tests/insight.service.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/server/services/insight.service.ts tests/insight.service.test.ts
git commit -m "feat: add insight generation service with Claude integration"
```

---

### Task 9: Insight API Routes

**Files:**
- Create: `src/app/api/ai/insights/route.ts`
- Create: `src/app/api/ai/insights/[id]/route.ts`

- [ ] **Step 1: Create main insights route**

Create `src/app/api/ai/insights/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { verifyWebhookAuth } from '@/lib/webhook-auth'
import { generateInsights, getActiveInsights } from '@/server/services/insight.service'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)
  }

  const insights = await getActiveInsights()
  return successResponse(insights)
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const isAuthed = verifyWebhookAuth(
      rawBody,
      req.headers.get('x-webhook-signature'),
      req.headers.get('authorization'),
      process.env.WEBHOOK_SECRET,
      req.headers.get('x-webhook-timestamp'),
    )

    if (!isAuthed) {
      return errorResponse('UNAUTHORIZED', 'Firma webhook non valida', 401)
    }

    const result = await generateInsights()
    return successResponse(result)
  } catch (error) {
    console.error('POST /api/ai/insights error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
```

- [ ] **Step 2: Create dismiss route**

Create `src/app/api/ai/insights/[id]/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { dismissInsight } from '@/server/services/insight.service'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)
  }

  const { id } = await params
  await dismissInsight(id)
  return successResponse({ dismissed: true })
}
```

- [ ] **Step 3: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/insights/
git commit -m "feat: add insight API routes (GET, POST, PATCH)"
```

---

### Task 10: Insights Hook + Dashboard Widget

**Files:**
- Create: `src/hooks/use-insights.ts`
- Create: `src/components/dashboard/insight-cards.tsx`
- Modify: `src/components/dashboard/dashboard-tabs.tsx`

- [ ] **Step 1: Create use-insights hook**

Create `src/hooks/use-insights.ts` following the existing hook pattern (useQuery + useMutation):

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { InsightCard } from '@/types/ai'

export function useInsights() {
  const queryClient = useQueryClient()

  const { data: insights = [], isLoading } = useQuery<InsightCard[]>({
    queryKey: ['insights'],
    queryFn: async () => {
      const res = await fetch('/api/ai/insights')
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/insights/${id}`, { method: 'PATCH' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] })
    },
    onError: () => {
      toast.error('Errore nel nascondere l\'insight')
    },
  })

  return { insights, isLoading, dismiss: dismissMutation.mutate }
}
```

- [ ] **Step 2: Create insight-cards component**

Create `src/components/dashboard/insight-cards.tsx`:

Build a `'use client'` component that:
- Uses `useInsights()` hook
- Renders a grid of up to 6 cards
- Each card has: colored left border by severity (CRITICAL=red, HIGH=orange, MEDIUM=blue, LOW=gray), title, description, action button (if `actionUrl`), dismiss X button
- Skeleton loader when loading
- Empty state when no insights

Follow the existing ProcureFlow design tokens (`pf-*` CSS variables, `border-pf-border`, etc.).

- [ ] **Step 3: Add InsightCards to dashboard**

Modify `src/components/dashboard/dashboard-tabs.tsx`:
- Import `InsightCards` component
- Add it to the Panoramica tab content, above the existing content

- [ ] **Step 4: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-insights.ts src/components/dashboard/insight-cards.tsx src/components/dashboard/dashboard-tabs.tsx
git commit -m "feat: add insight cards widget to dashboard"
```

---

## Chunk 3: AI Agent with Actions

### Task 11: Agent Service

**Files:**
- Create: `src/server/services/agent.service.ts`
- Test: `tests/agent.service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/agent.service.test.ts`:

Test cases:
1. `streamAgentResponse` yields text events for simple messages
2. READ tool calls are executed silently and result is fed back to Claude
3. WRITE tool calls yield `action_request` event and stop
4. RBAC: REQUESTER cannot use `approve_request` tool
5. Tool execution errors yield error events

Mock: Prisma, Claude client (mock the response to return tool_use content blocks), tool-registry handlers.

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd procureflow && npx vitest run tests/agent.service.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement agent.service.ts**

Create `src/server/services/agent.service.ts`:

Key structure:
- `streamAgentResponse(userId, role, messages)` — async generator yielding `AgentStreamEvent`
- Uses `getToolsForRole(role)` to build permitted tool set
- Converts tools to Anthropic format for `callClaude`
- Loop: call Claude → check response for tool_use → if READ, execute handler + loop → if WRITE, yield `action_request` + return → if text, yield text events → max 5 rounds
- Tool handlers: import the Prisma query logic from existing `chat.service.ts` for READ tools. For WRITE tools, create handlers that perform the actual DB mutations.
- Generate `ActionPreview` for WRITE tools based on tool name + params

**Important:** Copy the exact tool handler logic (Prisma queries) from `chat.service.ts` lines 228-500 for the 8 READ tools. Keep the query logic identical.

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd procureflow && npx vitest run tests/agent.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/agent.service.ts tests/agent.service.test.ts
git commit -m "feat: add AI agent service with tool-use streaming and RBAC"
```

---

### Task 12: Chat Route Migration + Confirm Endpoint

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Create: `src/app/api/chat/confirm/route.ts`

- [ ] **Step 1: Update chat route to use agent service**

Modify `src/app/api/chat/route.ts`:
- Replace `import { streamChatResponse } from '@/server/services/chat.service'` with `import { streamAgentResponse } from '@/server/services/agent.service'`
- Pass `session.user.id` and `session.user.role` to `streamAgentResponse`
- Keep `requireModule('/api/chat')` guard
- Keep existing SSE streaming infrastructure
- Handle new event types in the stream encoder

- [ ] **Step 2: Create confirm endpoint**

Create `src/app/api/chat/confirm/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getPendingAction, removePendingAction } from '@/lib/ai/pending-actions'
import { executeWriteTool } from '@/server/services/agent.service'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)
  }

  const body = await req.json()
  const { actionId, cancelled } = body as { actionId: string; cancelled?: boolean }

  if (!actionId) {
    return errorResponse('VALIDATION_ERROR', 'actionId richiesto', 400)
  }

  const action = getPendingAction(actionId, session.user.id)
  if (!action) {
    return errorResponse('NOT_FOUND', 'Azione non trovata o scaduta', 404)
  }

  removePendingAction(actionId)

  if (cancelled) {
    return successResponse({ status: 'cancelled' })
  }

  try {
    const result = await executeWriteTool(action.tool, action.params, session.user.id)
    return successResponse({ status: 'confirmed', result })
  } catch (error) {
    console.error('POST /api/chat/confirm error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nell\'esecuzione dell\'azione', 500)
  }
}
```

- [ ] **Step 3: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/route.ts src/app/api/chat/confirm/route.ts
git commit -m "feat: migrate chat route to agent service + add confirm endpoint"
```

---

### Task 13: Chat UI — Action Confirmation + SSE Handling

**Files:**
- Create: `src/components/chat/action-confirmation.tsx`
- Modify: `src/hooks/use-chat.ts`

- [ ] **Step 1: Create ActionConfirmationDialog**

Create `src/components/chat/action-confirmation.tsx`:

A `'use client'` dialog component that:
- Accepts props: `actionId`, `tool`, `preview: ActionPreview`, `onConfirm`, `onCancel`
- Renders a modal with: warning icon, action label, preview fields table, Annulla/Conferma buttons
- `onConfirm` calls `POST /api/chat/confirm` with `{ actionId }`
- `onCancel` calls `POST /api/chat/confirm` with `{ actionId, cancelled: true }`
- Shows loading state during confirmation

- [ ] **Step 2: Update use-chat hook for new events**

Modify `src/hooks/use-chat.ts`:
- Add `pendingAction` state: `{ actionId, tool, params, preview } | null`
- Handle `action_request` SSE event: set `pendingAction` state
- Handle `action_confirmed` / `action_cancelled` SSE events: clear `pendingAction`, update messages
- Add `confirmAction(actionId)` and `cancelAction(actionId)` methods
- Export `pendingAction` state

- [ ] **Step 3: Integrate dialog into chat panel**

Find the chat panel component (likely `src/components/chat/chat-panel.tsx` or similar):
- Import `ActionConfirmationDialog`
- Render it when `pendingAction` is not null
- Wire up confirm/cancel callbacks

- [ ] **Step 4: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/action-confirmation.tsx src/hooks/use-chat.ts
git commit -m "feat: add action confirmation dialog and SSE event handling"
```

---

### Task 14: Delete chat.service.ts

**Files:**
- Delete: `src/server/services/chat.service.ts`

- [ ] **Step 1: Verify no other imports**

Run: `cd procureflow && grep -r "chat.service" src/ --include="*.ts" --include="*.tsx"`

Expected: only `src/app/api/chat/route.ts` (already migrated). If other files reference it, update them first.

- [ ] **Step 2: Delete the file**

```bash
rm procureflow/src/server/services/chat.service.ts
```

- [ ] **Step 3: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove deprecated chat.service.ts (replaced by agent.service.ts)"
```

---

## Chunk 4: Inventory Forecasting

### Task 15: Forecast Service

**Files:**
- Create: `src/server/services/forecast.service.ts`
- Test: `tests/forecast.service.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/forecast.service.test.ts`:

Test cases:
1. `computeWMA` with known values returns correct weighted average
2. `computeWMA` with fewer than 6 months pads with zeros
3. `getBasicForecast` queries DB and returns forecast shape
4. `checkReorderAlerts` creates alert when stock <= min_stock_level
5. `checkReorderAlerts` skips materials with existing active alert
6. `checkReorderAlerts` does not create alert when stock > min_stock_level

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    stockMovement: { groupBy: vi.fn() },
    stockLot: { aggregate: vi.fn() },
    material: { findMany: vi.fn(), findUnique: vi.fn() },
    materialAlert: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  },
}))
vi.mock('@/lib/ai/claude-client', () => ({ callClaude: vi.fn() }))

describe('forecast.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computeWMA calculates weighted average correctly', async () => {
    const { computeWMA } = await import('@/server/services/forecast.service')
    // 6 months of data: [100, 80, 90, 70, 60, 50]
    // weights:          [3,   2.5, 2,  1.5, 1,  0.5]
    // weighted sum: 300 + 200 + 180 + 105 + 60 + 25 = 870
    // weight sum: 3 + 2.5 + 2 + 1.5 + 1 + 0.5 = 10.5
    // WMA = 870 / 10.5 ≈ 82.86
    const result = computeWMA([100, 80, 90, 70, 60, 50])
    expect(result).toBeCloseTo(82.86, 1)
  })

  it('computeWMA pads short arrays with zeros', async () => {
    const { computeWMA } = await import('@/server/services/forecast.service')
    // Only 3 months: [100, 80, 60] → padded to [100, 80, 60, 0, 0, 0]
    const result = computeWMA([100, 80, 60])
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(100)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd procureflow && npx vitest run tests/forecast.service.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement forecast.service.ts**

Create `src/server/services/forecast.service.ts`:

Key functions:
- `computeWMA(monthlyConsumption: number[]): number` — pure function, exported for testing
- `getBasicForecast(materialId)` — query `StockMovement` grouped by month for OUTBOUND movements, compute WMA, compute `daysRemaining` from current stock / daily rate, set `reorderNeeded = currentStock <= min_stock_level`
- `getAiForecast(materialId)` — calls basic + additional context queries + Claude
- `checkReorderAlerts()` — fetch all materials with `min_stock_level` set, compute current stock via `SUM(StockLot.current_quantity WHERE status=AVAILABLE)`, compare, create `MaterialAlert` records
- `getActiveAlerts()` — `WHERE dismissed=false ORDER BY created_at DESC`
- `dismissAlert(id)` / `resolveAlert(id, requestId)` — update alert

Current stock computation:
```typescript
const stockResult = await prisma.stockLot.aggregate({
  where: { material_id: materialId, status: 'AVAILABLE' },
  _sum: { current_quantity: true },
})
const currentStock = stockResult._sum.current_quantity?.toNumber() ?? 0
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd procureflow && npx vitest run tests/forecast.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/services/forecast.service.ts tests/forecast.service.test.ts
git commit -m "feat: add inventory forecast service with WMA and reorder alerts"
```

---

### Task 16: Forecast API Routes

**Files:**
- Create: `src/app/api/ai/forecast/[materialId]/route.ts`
- Create: `src/app/api/ai/forecast/alerts/route.ts`
- Create: `src/app/api/ai/forecast/alerts/[id]/route.ts`
- Create: `src/app/api/ai/forecast/check/route.ts`

- [ ] **Step 1: Create forecast route (GET basic + POST AI)**

Create `src/app/api/ai/forecast/[materialId]/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { getBasicForecast, getAiForecast } from '@/server/services/forecast.service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> },
) {
  const session = await auth()
  if (!session?.user) return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)

  const { materialId } = await params
  const forecast = await getBasicForecast(materialId)
  return successResponse(forecast)
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ materialId: string }> },
) {
  const session = await auth()
  if (!session?.user) return errorResponse('UNAUTHORIZED', 'Non autorizzato', 401)

  // Rate limiting: 10 AI forecasts per user per hour (in-memory counter)
  // Use a simple Map<userId, { count, windowStart }> — reset when windowStart > 1 hour ago
  // If exceeded, return errorResponse('RATE_LIMITED', 'Max 10 previsioni AI per ora', 429)
  const { materialId } = await params
  const forecast = await getAiForecast(materialId)
  return successResponse(forecast)
}
```

- [ ] **Step 2: Create alerts routes**

Create `src/app/api/ai/forecast/alerts/route.ts` (GET: list active alerts).
Create `src/app/api/ai/forecast/alerts/[id]/route.ts` (PATCH: dismiss/resolve).

- [ ] **Step 3: Create check route (n8n cron)**

Create `src/app/api/ai/forecast/check/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/api-response'
import { verifyWebhookAuth } from '@/lib/webhook-auth'
import { checkReorderAlerts } from '@/server/services/forecast.service'

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const isAuthed = verifyWebhookAuth(
      rawBody,
      req.headers.get('x-webhook-signature'),
      req.headers.get('authorization'),
      process.env.WEBHOOK_SECRET,
      req.headers.get('x-webhook-timestamp'),
    )

    if (!isAuthed) return errorResponse('UNAUTHORIZED', 'Firma webhook non valida', 401)

    const result = await checkReorderAlerts()
    return successResponse(result)
  } catch (error) {
    console.error('POST /api/ai/forecast/check error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore interno del server', 500)
  }
}
```

- [ ] **Step 4: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ai/forecast/
git commit -m "feat: add forecast API routes (WMA, AI, alerts, cron check)"
```

---

### Task 17: Forecast UI — Hook + Panel + Reorder Banner

**Files:**
- Create: `src/hooks/use-forecast.ts`
- Create: `src/components/inventory/forecast-panel.tsx`
- Modify: `src/components/inventory/materials-page-content.tsx`

- [ ] **Step 1: Create use-forecast hook**

Create `src/hooks/use-forecast.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { BasicForecast, AiForecast, MaterialAlertCard } from '@/types/ai'

export function useForecast(materialId: string | null) {
  const { data: forecast, isLoading } = useQuery<BasicForecast>({
    queryKey: ['forecast', materialId],
    queryFn: async () => {
      const res = await fetch(`/api/ai/forecast/${materialId}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
    enabled: !!materialId,
  })

  return { forecast, isLoading }
}

export function useAiForecast() {
  return useMutation<AiForecast, Error, string>({
    mutationFn: async (materialId) => {
      const res = await fetch(`/api/ai/forecast/${materialId}`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
    onError: () => toast.error('Errore nella previsione AI'),
  })
}

export function useMaterialAlerts() {
  const queryClient = useQueryClient()

  const { data: alerts = [], isLoading } = useQuery<MaterialAlertCard[]>({
    queryKey: ['material-alerts'],
    queryFn: async () => {
      const res = await fetch('/api/ai/forecast/alerts')
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
      return json.data
    },
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/forecast/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['material-alerts'] }),
    onError: () => toast.error('Errore nel nascondere l\'alert'),
  })

  return { alerts, isLoading, dismiss: dismissMutation.mutate }
}
```

- [ ] **Step 2: Create forecast-panel component**

Create `src/components/inventory/forecast-panel.tsx`:

A `'use client'` component:
- Accepts `materialId` prop
- Uses `useForecast(materialId)` for WMA data
- Shows: current stock, projected 3 months (simple bar chart or numbers), days remaining
- "Analisi AI" button triggers `useAiForecast().mutate(materialId)`
- When AI forecast loaded: shows confidence, reasoning, risks

- [ ] **Step 3: Create reorder banner**

In `src/components/inventory/materials-page-content.tsx`:
- Import `useMaterialAlerts()`
- Render alert banners above the table when alerts exist
- Each banner: warning icon, material name, days remaining, suggested qty, "Crea richiesta →" button (links to `/requests/new?material=X&vendor=Y&qty=Z`), "Ignora" button (calls dismiss)

- [ ] **Step 4: Verify build**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-forecast.ts src/components/inventory/forecast-panel.tsx src/components/inventory/materials-page-content.tsx
git commit -m "feat: add forecast panel and reorder alert banners"
```

---

## Chunk 5: Final Integration + Verification

### Task 18: Full Build Verification

- [ ] **Step 1: Run type check**

Run: `cd procureflow && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run all tests**

Run: `cd procureflow && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run linter**

Run: `cd procureflow && npx next lint`
Expected: No errors

- [ ] **Step 4: Verify dev server starts**

Run: `cd procureflow && npx next build` (or dev server check)
Expected: Build succeeds

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix lint and build issues from AI enhancements"
```



> **Note:** Prisma migration was already created in Task 1, Step 7. No separate migration task needed.
