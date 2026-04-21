# Admin Panel + Import/Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/admin/config` panel for ADMIN users to manage modules, approval thresholds, categories, departments, cost centers, integrations, and CSV import/export.

**Architecture:** Expand `DeployConfig` model with `departments[]` and `cost_centers[]`. Add `IntegrationConfig` model for encrypted credentials. REST API routes with `requireRole('ADMIN')`. Client-side CSV export per entity + server-side ZIP backup. CSV import with upsert logic.

**Tech Stack:** Next.js 14 App Router, Prisma, PostgreSQL, Node.js `crypto` (AES-256-GCM), `csv-parse`, `archiver`, React Hook Form + Zod, `@tanstack/react-query`.

**Spec:** `docs/superpowers/specs/2026-03-30-admin-panel-import-export-design.md`

---

## Chunk 1: Foundation (Schema, Crypto, Validation, Dependencies)

### Task 1: Install Dependencies

**Files:**
- Modify: `procureflow/package.json`

- [ ] **Step 1: Install csv-parse and archiver**

```bash
cd procureflow && npm install csv-parse archiver && npm install -D @types/archiver
```

- [ ] **Step 2: Verify installation**

```bash
cd procureflow && node -e "require('csv-parse'); require('archiver'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add procureflow/package.json procureflow/package-lock.json
git commit -m "chore: add csv-parse and archiver dependencies"
```

---

### Task 2: Schema Migration

**Files:**
- Modify: `procureflow/prisma/schema.prisma` (lines 566-577: DeployConfig model)

- [ ] **Step 1: Add fields to DeployConfig and create IntegrationConfig model**

In `procureflow/prisma/schema.prisma`, add two fields to the existing `DeployConfig` model (after `approval_rules`):

```prisma
  departments      String[]
  cost_centers     String[]
```

Then add a new model at the end of the file:

```prisma
model IntegrationConfig {
  id           String    @id @default(cuid())
  type         String    @unique // "imap", "sdi", "vendor_api"
  label        String
  enabled      Boolean   @default(false)
  config       String    // AES-256-GCM encrypted JSON
  status       String    @default("disconnected") // "connected", "disconnected", "error"
  last_sync_at DateTime?
  last_error   String?
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt

  @@map("integration_configs")
}
```

- [ ] **Step 2: Generate and apply migration**

```bash
cd procureflow && npx prisma migrate dev --name add_departments_costcenters_integrations
```

- [ ] **Step 3: Generate Prisma client**

```bash
cd procureflow && npx prisma generate
```

- [ ] **Step 4: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors (or only pre-existing errors)

- [ ] **Step 5: Commit**

```bash
git add procureflow/prisma/
git commit -m "feat: add departments, cost_centers to DeployConfig and IntegrationConfig model"
```

---

### Task 3: Encryption Utility

**Files:**
- Create: `procureflow/src/lib/crypto.ts`
- Create: `procureflow/tests/crypto.test.ts`

- [ ] **Step 1: Write the test**

Create `procureflow/tests/crypto.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

// Set a test encryption key (32 bytes = 64 hex chars)
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
})

describe('crypto', () => {
  it('encrypts and decrypts a string', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto')
    const plaintext = '{"host":"mail.example.com","password":"secret123"}'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toContain(':') // format: iv:authTag:ciphertext
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext for same input (random IV)', async () => {
    const { encrypt } = await import('@/lib/crypto')
    const plaintext = 'test'
    const a = encrypt(plaintext)
    const b = encrypt(plaintext)
    expect(a).not.toBe(b)
  })

  it('throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto')
    const encrypted = encrypt('test')
    const tampered = encrypted.slice(0, -2) + 'XX'
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws if ENCRYPTION_KEY is missing', () => {
    const saved = process.env.ENCRYPTION_KEY
    delete process.env.ENCRYPTION_KEY
    // getKey() is called inside encrypt(), reads env at call time
    const { encrypt } = require('@/lib/crypto')
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY')
    process.env.ENCRYPTION_KEY = saved
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd procureflow && npx vitest run tests/crypto.test.ts 2>&1 | tail -10
```
Expected: FAIL (module not found)

- [ ] **Step 3: Implement crypto utility**

Create `procureflow/src/lib/crypto.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be set as a 64-character hex string (32 bytes)',
    )
  }
  return Buffer.from(hex, 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decrypt(encrypted: string): string {
  const key = getKey()
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(':')
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted format — expected iv:authTag:ciphertext')
  }
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  })
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd procureflow && npx vitest run tests/crypto.test.ts 2>&1 | tail -10
```
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add procureflow/src/lib/crypto.ts procureflow/tests/crypto.test.ts
git commit -m "feat: add AES-256-GCM encryption utility for integration credentials"
```

---

### Task 4: Zod Validation Schemas

**Files:**
- Create: `procureflow/src/lib/validations/admin.ts`

- [ ] **Step 1: Create admin validation schemas**

Create `procureflow/src/lib/validations/admin.ts`:

```typescript
import { z } from 'zod'

// --- DeployConfig update ---

export const updateConfigSchema = z.object({
  deploy_name: z.string().min(1).max(100).optional(),
  company_logo_url: z.string().max(500_000).nullable().optional(), // base64 data URI, ~375KB max image
  enabled_modules: z.array(z.string()).optional(),
  categories: z.array(z.string().min(1).max(100)).optional(),
  departments: z.array(z.string().min(1).max(100)).optional(),
  cost_centers: z.array(z.string().min(1).max(100)).optional(),
  approval_rules: z
    .object({
      autoApproveMax: z.number().min(0).max(1_000_000),
      managerApproveMax: z.number().min(0).max(10_000_000),
    })
    .optional(),
})

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>

// --- Integration config ---

const imapConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  protocol: z.enum(['imap', 'imaps']),
  email: z.string().email(),
  password: z.string().min(1),
  folder: z.string().default('INBOX'),
})

const sdiConfigSchema = z.object({
  endpoint_url: z.string().url(),
  codice_destinatario: z.string().min(1).max(7),
  certificate_base64: z.string().optional(),
  certificate_password: z.string().optional(),
})

const vendorApiConfigSchema = z.object({
  vendor_name: z.string().min(1),
  base_url: z.string().url(),
  api_key: z.string().min(1),
  custom_headers: z.record(z.string()).optional(),
})

export const integrationTypeSchema = z.enum(['imap', 'sdi', 'vendor_api'])

export const upsertIntegrationSchema = z.object({
  label: z.string().min(1).max(100),
  enabled: z.boolean(),
  config: z.union([imapConfigSchema, sdiConfigSchema, vendorApiConfigSchema]),
})

export type IntegrationType = z.infer<typeof integrationTypeSchema>
export type UpsertIntegrationInput = z.infer<typeof upsertIntegrationSchema>
```

- [ ] **Step 2: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add procureflow/src/lib/validations/admin.ts
git commit -m "feat: add Zod validation schemas for admin config and integrations"
```

---

### Task 5: Add ENCRYPTION_KEY to .env.example

**Files:**
- Modify: `procureflow/.env.example`

- [ ] **Step 1: Add ENCRYPTION_KEY entry**

Append to `procureflow/.env.example`:

```
# Encryption key for integration credentials (32 bytes = 64 hex chars)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add procureflow/.env.example
git commit -m "chore: add ENCRYPTION_KEY to .env.example"
```

---

## Chunk 2: API Routes & Services

### Task 6: Admin Config API (GET/PATCH)

**Files:**
- Create: `procureflow/src/app/api/admin/config/route.ts`

- [ ] **Step 1: Create admin config route**

Create `procureflow/src/app/api/admin/config/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateConfigSchema } from '@/lib/validations/admin'

export async function GET() {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const config = await prisma.deployConfig.findUnique({
    where: { id: 'default' },
  })

  if (!config) {
    return NextResponse.json({
      success: true,
      data: {
        deploy_name: 'ProcureFlow',
        enabled_modules: ['core'],
        categories: [],
        departments: [],
        cost_centers: [],
        approval_rules: null,
        company_logo_url: null,
      },
    })
  }

  return NextResponse.json({ success: true, data: config })
}

export async function PATCH(request: Request) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json()
  const parsed = updateConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        },
      },
      { status: 400 },
    )
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.deploy_name !== undefined)
    data.deploy_name = parsed.data.deploy_name
  if (parsed.data.company_logo_url !== undefined)
    data.company_logo_url = parsed.data.company_logo_url
  if (parsed.data.enabled_modules !== undefined)
    data.enabled_modules = parsed.data.enabled_modules
  if (parsed.data.categories !== undefined)
    data.categories = parsed.data.categories
  if (parsed.data.departments !== undefined)
    data.departments = parsed.data.departments
  if (parsed.data.cost_centers !== undefined)
    data.cost_centers = parsed.data.cost_centers
  if (parsed.data.approval_rules !== undefined)
    data.approval_rules = parsed.data.approval_rules

  const updated = await prisma.deployConfig.upsert({
    where: { id: 'default' },
    update: data,
    create: {
      id: 'default',
      deploy_name: parsed.data.deploy_name ?? 'ProcureFlow',
      enabled_modules: parsed.data.enabled_modules ?? ['core'],
      categories: parsed.data.categories ?? [],
      departments: parsed.data.departments ?? [],
      cost_centers: parsed.data.cost_centers ?? [],
      approval_rules: parsed.data.approval_rules ?? null,
      company_logo_url: parsed.data.company_logo_url ?? null,
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add procureflow/src/app/api/admin/config/route.ts
git commit -m "feat: add GET/PATCH /api/admin/config route"
```

---

### Task 7: Integrations API (CRUD + Test Connection)

**Files:**
- Create: `procureflow/src/app/api/admin/integrations/route.ts`
- Create: `procureflow/src/app/api/admin/integrations/[type]/route.ts`
- Create: `procureflow/src/app/api/admin/integrations/[type]/test/route.ts`

- [ ] **Step 1: Create integrations list route**

Create `procureflow/src/app/api/admin/integrations/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

function maskPasswords(config: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...config }
  for (const key of Object.keys(masked)) {
    if (key.toLowerCase().includes('password') || key.toLowerCase().includes('api_key')) {
      masked[key] = '****'
    }
  }
  return masked
}

export async function GET() {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const integrations = await prisma.integrationConfig.findMany({
    orderBy: { type: 'asc' },
  })

  const result = integrations.map((integ) => {
    let decryptedConfig: Record<string, unknown> = {}
    try {
      decryptedConfig = JSON.parse(decrypt(integ.config)) as Record<string, unknown>
    } catch {
      // If decryption fails, return empty config
    }
    return {
      ...integ,
      config: maskPasswords(decryptedConfig),
    }
  })

  return NextResponse.json({ success: true, data: result })
}
```

- [ ] **Step 2: Create single integration PUT/DELETE route**

Create `procureflow/src/app/api/admin/integrations/[type]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import {
  integrationTypeSchema,
  upsertIntegrationSchema,
} from '@/lib/validations/admin'

const INTEGRATION_LABELS: Record<string, string> = {
  imap: 'Email Ingestion (IMAP)',
  sdi: 'SDI Fatturazione Elettronica',
  vendor_api: 'API Fornitore',
}

interface RouteParams {
  params: Promise<{ type: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { type } = await params
  const typeParsed = integrationTypeSchema.safeParse(type)
  if (!typeParsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_TYPE', message: 'Tipo integrazione non valido' } },
      { status: 400 },
    )
  }

  const body = await request.json()
  const parsed = upsertIntegrationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } },
      { status: 400 },
    )
  }

  const encryptedConfig = encrypt(JSON.stringify(parsed.data.config))

  const result = await prisma.integrationConfig.upsert({
    where: { type: typeParsed.data },
    update: {
      label: parsed.data.label,
      enabled: parsed.data.enabled,
      config: encryptedConfig,
    },
    create: {
      type: typeParsed.data,
      label: parsed.data.label ?? INTEGRATION_LABELS[typeParsed.data] ?? typeParsed.data,
      enabled: parsed.data.enabled,
      config: encryptedConfig,
    },
  })

  return NextResponse.json({ success: true, data: { id: result.id, type: result.type, enabled: result.enabled } })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { type } = await params
  const typeParsed = integrationTypeSchema.safeParse(type)
  if (!typeParsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_TYPE', message: 'Tipo integrazione non valido' } },
      { status: 400 },
    )
  }

  await prisma.integrationConfig.deleteMany({ where: { type: typeParsed.data } })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create test connection route**

Create `procureflow/src/app/api/admin/integrations/[type]/test/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { integrationTypeSchema } from '@/lib/validations/admin'

interface RouteParams {
  params: Promise<{ type: string }>
}

async function testImap(config: { host: string; port: number; protocol: string; email: string; password: string }): Promise<{ success: boolean; message: string }> {
  // Basic connectivity test via TCP socket
  const net = await import('net')
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve({ success: false, message: `Timeout connessione a ${config.host}:${config.port}` })
    }, 10_000)

    socket.connect(config.port, config.host, () => {
      clearTimeout(timeout)
      socket.destroy()
      resolve({ success: true, message: `Connessione riuscita a ${config.host}:${config.port}` })
    })

    socket.on('error', (err) => {
      clearTimeout(timeout)
      resolve({ success: false, message: `Errore: ${err.message}` })
    })
  })
}

async function testHttpEndpoint(url: string, headers?: Record<string, string>): Promise<{ success: boolean; message: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const response = await fetch(url, {
      method: 'GET',
      headers: headers ?? {},
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return {
      success: response.ok,
      message: response.ok
        ? `Connessione riuscita (HTTP ${response.status})`
        : `Errore HTTP ${response.status}: ${response.statusText}`,
    }
  } catch (error) {
    return { success: false, message: `Errore: ${(error as Error).message}` }
  }
}

export async function POST(_request: Request, { params }: RouteParams) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { type } = await params
  const typeParsed = integrationTypeSchema.safeParse(type)
  if (!typeParsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_TYPE', message: 'Tipo non valido' } },
      { status: 400 },
    )
  }

  const integration = await prisma.integrationConfig.findUnique({
    where: { type: typeParsed.data },
  })

  if (!integration) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Integrazione non configurata' } },
      { status: 404 },
    )
  }

  let config: Record<string, unknown>
  try {
    config = JSON.parse(decrypt(integration.config)) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'DECRYPT_ERROR', message: 'Impossibile decifrare la configurazione' } },
      { status: 500 },
    )
  }

  const start = Date.now()
  let result: { success: boolean; message: string }

  switch (typeParsed.data) {
    case 'imap':
      result = await testImap(config as { host: string; port: number; protocol: string; email: string; password: string })
      break
    case 'sdi':
      result = await testHttpEndpoint(config.endpoint_url as string)
      break
    case 'vendor_api': {
      const headers = (config.custom_headers as Record<string, string>) ?? {}
      if (config.api_key) {
        headers['Authorization'] = `Bearer ${config.api_key as string}`
      }
      result = await testHttpEndpoint(config.base_url as string, headers)
      break
    }
    default:
      result = { success: false, message: 'Tipo non supportato' }
  }

  const latencyMs = Date.now() - start

  // Update status in DB
  await prisma.integrationConfig.update({
    where: { type: typeParsed.data },
    data: {
      status: result.success ? 'connected' : 'error',
      last_sync_at: result.success ? new Date() : undefined,
      last_error: result.success ? null : result.message,
    },
  })

  return NextResponse.json({
    success: true,
    data: { ...result, latency_ms: latencyMs },
  })
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add procureflow/src/app/api/admin/integrations/
git commit -m "feat: add integrations CRUD and test connection API routes"
```

---

### Task 8: CSV Import Service + API Routes

**Files:**
- Create: `procureflow/src/server/services/import.service.ts`
- Create: `procureflow/src/app/api/admin/import/vendors/route.ts`
- Create: `procureflow/src/app/api/admin/import/materials/route.ts`
- Create: `procureflow/tests/import-service.test.ts`

- [ ] **Step 1: Write import service test**

Create `procureflow/tests/import-service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseCsvRows, detectSeparator } from '@/server/services/import.service'

describe('import.service', () => {
  describe('detectSeparator', () => {
    it('detects comma separator', () => {
      expect(detectSeparator('a,b,c\n1,2,3')).toBe(',')
    })

    it('detects semicolon separator (Italian Excel)', () => {
      expect(detectSeparator('a;b;c\n1;2;3')).toBe(';')
    })

    it('prefers semicolon when both present but semicolon dominates', () => {
      expect(detectSeparator('nome;email;note\nFoo;a@b.com;qualcosa, altro')).toBe(';')
    })
  })

  describe('parseCsvRows', () => {
    it('parses comma-separated CSV', async () => {
      const csv = 'codice,nome,email\nFORN-001,Test Srl,test@test.it\nFORN-002,Foo Spa,foo@bar.it'
      const rows = await parseCsvRows(csv)
      expect(rows).toHaveLength(2)
      expect(rows[0]).toEqual({ codice: 'FORN-001', nome: 'Test Srl', email: 'test@test.it' })
    })

    it('parses semicolon-separated CSV', async () => {
      const csv = 'codice;nome;email\nFORN-001;Test Srl;test@test.it'
      const rows = await parseCsvRows(csv)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.codice).toBe('FORN-001')
    })

    it('strips BOM', async () => {
      const csv = '\uFEFFcodice,nome\nFORN-001,Test'
      const rows = await parseCsvRows(csv)
      expect(rows[0]).toHaveProperty('codice')
    })

    it('trims whitespace from values', async () => {
      const csv = 'codice,nome\n  FORN-001 , Test Srl  '
      const rows = await parseCsvRows(csv)
      expect(rows[0]?.codice).toBe('FORN-001')
      expect(rows[0]?.nome).toBe('Test Srl')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd procureflow && npx vitest run tests/import-service.test.ts 2>&1 | tail -10
```
Expected: FAIL

- [ ] **Step 3: Create import service**

Create `procureflow/src/server/services/import.service.ts`:

```typescript
import { parse } from 'csv-parse/sync'
import { prisma } from '@/lib/db'

// ---------------------------------------------------------------------------
// CSV Parsing Utilities
// ---------------------------------------------------------------------------

const MAX_ROWS = 10_000

export function detectSeparator(text: string): ',' | ';' {
  const firstLine = text.split('\n')[0] ?? ''
  const commas = (firstLine.match(/,/g) ?? []).length
  const semicolons = (firstLine.match(/;/g) ?? []).length
  return semicolons > commas ? ';' : ','
}

export async function parseCsvRows(
  text: string,
): Promise<readonly Record<string, string>[]> {
  // Strip BOM
  const cleaned = text.replace(/^\uFEFF/, '')
  const separator = detectSeparator(cleaned)

  const records = parse(cleaned, {
    columns: true,
    skip_empty_lines: true,
    delimiter: separator,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[]

  if (records.length > MAX_ROWS) {
    throw new Error(`Troppe righe: ${records.length} (massimo ${MAX_ROWS})`)
  }

  return records
}

// ---------------------------------------------------------------------------
// Import Result
// ---------------------------------------------------------------------------

interface ImportError {
  readonly row: number
  readonly message: string
}

export interface ImportResult {
  readonly created: number
  readonly updated: number
  readonly errors: readonly ImportError[]
}

// ---------------------------------------------------------------------------
// Vendor Import
// ---------------------------------------------------------------------------

export async function importVendors(csvText: string): Promise<ImportResult> {
  const rows = await parseCsvRows(csvText)
  let created = 0
  let updated = 0
  const errors: ImportError[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2 // +1 for header, +1 for 1-based

    const code = row['codice']?.trim()
    const name = row['nome']?.trim()

    if (!code) {
      errors.push({ row: rowNum, message: 'Campo "codice" mancante' })
      continue
    }
    if (!name) {
      errors.push({ row: rowNum, message: 'Campo "nome" mancante' })
      continue
    }

    const categories = row['categorie']
      ? row['categorie'].split(/[,;]/).map((c) => c.trim()).filter(Boolean)
      : []

    try {
      const existing = await prisma.vendor.findUnique({ where: { code } })

      if (existing) {
        await prisma.vendor.update({
          where: { code },
          data: {
            name,
            email: row['email'] || existing.email,
            phone: row['telefono'] || existing.phone,
            website: row['sito_web'] || existing.website,
            category: categories.length > 0 ? categories : existing.category,
            payment_terms: row['termini_pagamento'] || existing.payment_terms,
            notes: row['note'] || existing.notes,
          },
        })
        updated++
      } else {
        await prisma.vendor.create({
          data: {
            code,
            name,
            email: row['email'] || null,
            phone: row['telefono'] || null,
            website: row['sito_web'] || null,
            category: categories,
            payment_terms: row['termini_pagamento'] || null,
            notes: row['note'] || null,
          },
        })
        created++
      }
    } catch (error) {
      errors.push({ row: rowNum, message: (error as Error).message })
    }
  }

  return Object.freeze({ created, updated, errors })
}

// ---------------------------------------------------------------------------
// Material Import
// ---------------------------------------------------------------------------

export async function importMaterials(csvText: string): Promise<ImportResult> {
  const rows = await parseCsvRows(csvText)
  let created = 0
  let updated = 0
  const errors: ImportError[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const rowNum = i + 2

    const code = row['codice']?.trim()
    const name = row['nome']?.trim()

    if (!code) {
      errors.push({ row: rowNum, message: 'Campo "codice" mancante' })
      continue
    }
    if (!name) {
      errors.push({ row: rowNum, message: 'Campo "nome" mancante' })
      continue
    }

    // Resolve vendor if provided
    let vendorId: string | null = null
    const vendorCode = row['fornitore_codice']?.trim()
    if (vendorCode) {
      const vendor = await prisma.vendor.findUnique({
        where: { code: vendorCode },
        select: { id: true },
      })
      if (!vendor) {
        errors.push({ row: rowNum, message: `Fornitore "${vendorCode}" non trovato` })
        continue
      }
      vendorId = vendor.id
    }

    const minStock = row['livello_minimo'] ? parseFloat(row['livello_minimo']) : null

    try {
      const existing = await prisma.material.findUnique({ where: { code } })

      if (existing) {
        await prisma.material.update({
          where: { code },
          data: {
            name,
            unit_primary: row['unita'] || existing.unit_primary,
            min_stock_level: minStock ?? existing.min_stock_level,
            preferred_vendor_id: vendorId ?? existing.preferred_vendor_id,
            category: row['categoria'] || existing.category,
          },
        })
        updated++
      } else {
        await prisma.material.create({
          data: {
            code,
            name,
            unit_primary: row['unita'] || 'pz',
            min_stock_level: minStock,
            preferred_vendor_id: vendorId,
            category: row['categoria'] || null,
          },
        })
        created++
      }
    } catch (error) {
      errors.push({ row: rowNum, message: (error as Error).message })
    }
  }

  return Object.freeze({ created, updated, errors })
}
```

- [ ] **Step 4: Run test to verify parsing tests pass**

```bash
cd procureflow && npx vitest run tests/import-service.test.ts 2>&1 | tail -10
```
Expected: All PASS

- [ ] **Step 5: Create vendor import API route**

Create `procureflow/src/app/api/admin/import/vendors/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { importVendors } from '@/server/services/import.service'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: Request) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_FILE', message: 'Nessun file caricato' } },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: { code: 'FILE_TOO_LARGE', message: 'File troppo grande (max 5MB)' } },
      { status: 400 },
    )
  }

  try {
    const text = await file.text()
    const result = await importVendors(text)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'IMPORT_ERROR', message: (error as Error).message } },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 6: Create material import API route**

Create `procureflow/src/app/api/admin/import/materials/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { importMaterials } from '@/server/services/import.service'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: Request) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_FILE', message: 'Nessun file caricato' } },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: { code: 'FILE_TOO_LARGE', message: 'File troppo grande (max 5MB)' } },
      { status: 400 },
    )
  }

  try {
    const text = await file.text()
    const result = await importMaterials(text)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'IMPORT_ERROR', message: (error as Error).message } },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 7: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 8: Commit**

```bash
git add procureflow/src/server/services/import.service.ts procureflow/src/app/api/admin/import/ procureflow/tests/import-service.test.ts
git commit -m "feat: add CSV import service and API routes for vendors and materials"
```

---

### Task 9: Export Service + API Routes

**Files:**
- Create: `procureflow/src/server/services/export.service.ts`
- Create: `procureflow/src/app/api/admin/export/[entity]/route.ts`
- Create: `procureflow/src/app/api/admin/export/backup/route.ts`

- [ ] **Step 1: Create export service**

Create `procureflow/src/server/services/export.service.ts`:

```typescript
import { prisma } from '@/lib/db'

// ---------------------------------------------------------------------------
// Column Definitions (shared between client-side ExportCsvButton and backup)
// ---------------------------------------------------------------------------

export interface CsvColumn {
  readonly key: string
  readonly label: string
}

export const EXPORT_COLUMNS: Record<string, readonly CsvColumn[]> = {
  vendors: [
    { key: 'code', label: 'codice' },
    { key: 'name', label: 'nome' },
    { key: 'email', label: 'email' },
    { key: 'phone', label: 'telefono' },
    { key: 'website', label: 'sito_web' },
    { key: 'category', label: 'categorie' },
    { key: 'payment_terms', label: 'termini_pagamento' },
    { key: 'rating', label: 'rating' },
    { key: 'status', label: 'stato' },
    { key: 'notes', label: 'note' },
  ],
  materials: [
    { key: 'code', label: 'codice' },
    { key: 'name', label: 'nome' },
    { key: 'unit_primary', label: 'unita' },
    { key: 'min_stock_level', label: 'livello_minimo' },
    { key: 'preferred_vendor_code', label: 'fornitore_codice' },
    { key: 'category', label: 'categoria' },
    { key: 'is_active', label: 'attivo' },
  ],
  requests: [
    { key: 'code', label: 'codice' },
    { key: 'title', label: 'titolo' },
    { key: 'status', label: 'stato' },
    { key: 'priority', label: 'priorita' },
    { key: 'requester_name', label: 'richiedente_nome' },
    { key: 'vendor_name', label: 'fornitore_nome' },
    { key: 'estimated_amount', label: 'importo_stimato' },
    { key: 'actual_amount', label: 'importo_effettivo' },
    { key: 'currency', label: 'valuta' },
    { key: 'created_at', label: 'data_creazione' },
    { key: 'delivered_at', label: 'data_consegna' },
  ],
  invoices: [
    { key: 'invoice_number', label: 'numero' },
    { key: 'vendor_name', label: 'fornitore_nome' },
    { key: 'total_amount', label: 'importo' },
    { key: 'currency', label: 'valuta' },
    { key: 'received_at', label: 'data_ricezione' },
    { key: 'reconciliation_status', label: 'stato_riconciliazione' },
    { key: 'sdi_id', label: 'sdi_id' },
  ],
  users: [
    { key: 'name', label: 'nome' },
    { key: 'email', label: 'email' },
    { key: 'role', label: 'ruolo' },
    { key: 'department', label: 'dipartimento' },
    { key: 'created_at', label: 'data_creazione' },
  ],
  budgets: [
    { key: 'cost_center', label: 'centro_costo' },
    { key: 'department', label: 'dipartimento' },
    { key: 'allocated_amount', label: 'importo_allocato' },
    { key: 'spent', label: 'speso' },
    { key: 'committed', label: 'impegnato' },
    { key: 'available', label: 'disponibile' },
    { key: 'period_start', label: 'periodo_inizio' },
    { key: 'period_end', label: 'periodo_fine' },
  ],
} as const

// ---------------------------------------------------------------------------
// CSV Generation
// ---------------------------------------------------------------------------

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv(
  rows: readonly Record<string, unknown>[],
  columns: readonly CsvColumn[],
): string {
  const header = columns.map((c) => c.label).join(',')
  const lines = rows.map((row) =>
    columns.map((col) => escapeCell(row[col.key])).join(','),
  )
  return [header, ...lines].join('\n')
}

// ---------------------------------------------------------------------------
// Entity Data Fetchers
// ---------------------------------------------------------------------------

type EntityName = 'vendors' | 'materials' | 'requests' | 'invoices' | 'users' | 'budgets'

export const VALID_ENTITIES: readonly EntityName[] = [
  'vendors', 'materials', 'requests', 'invoices', 'users', 'budgets',
]

export async function fetchEntityData(
  entity: EntityName,
): Promise<readonly Record<string, unknown>[]> {
  switch (entity) {
    case 'vendors':
      return prisma.vendor.findMany({
        select: {
          code: true, name: true, email: true, phone: true, website: true,
          category: true, payment_terms: true, rating: true, status: true, notes: true,
        },
        orderBy: { code: 'asc' },
      }).then((rows) =>
        rows.map((r) => ({ ...r, category: (r.category ?? []).join(';') })),
      )

    case 'materials':
      return prisma.material.findMany({
        select: {
          code: true, name: true, unit_primary: true, min_stock_level: true,
          category: true, is_active: true,
          preferred_vendor: { select: { code: true } },
        },
        orderBy: { code: 'asc' },
      }).then((rows) =>
        rows.map((r) => ({
          ...r,
          preferred_vendor_code: r.preferred_vendor?.code ?? '',
          min_stock_level: r.min_stock_level?.toString() ?? '',
        })),
      )

    case 'requests':
      return prisma.purchaseRequest.findMany({
        select: {
          code: true, title: true, status: true, priority: true,
          estimated_amount: true, actual_amount: true, currency: true,
          created_at: true, delivered_at: true,
          requester: { select: { name: true } },
          vendor: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
      }).then((rows) =>
        rows.map((r) => ({
          ...r,
          requester_name: r.requester?.name ?? '',
          vendor_name: r.vendor?.name ?? '',
          estimated_amount: r.estimated_amount?.toString() ?? '',
          actual_amount: r.actual_amount?.toString() ?? '',
          created_at: r.created_at?.toISOString() ?? '',
          delivered_at: r.delivered_at?.toISOString() ?? '',
        })),
      )

    case 'invoices':
      return prisma.invoice.findMany({
        select: {
          invoice_number: true, total_amount: true, currency: true,
          received_at: true, reconciliation_status: true, sdi_id: true,
          vendor: { select: { name: true } },
        },
        orderBy: { received_at: 'desc' },
      }).then((rows) =>
        rows.map((r) => ({
          ...r,
          vendor_name: r.vendor?.name ?? '',
          total_amount: r.total_amount?.toString() ?? '',
          received_at: r.received_at?.toISOString() ?? '',
        })),
      )

    case 'users':
      return prisma.user.findMany({
        select: {
          name: true, email: true, role: true, department: true, created_at: true,
        },
        orderBy: { name: 'asc' },
      }).then((rows) =>
        rows.map((r) => ({ ...r, created_at: r.created_at?.toISOString() ?? '' })),
      )

    case 'budgets':
      return prisma.budget.findMany({
        select: {
          cost_center: true, department: true, allocated_amount: true,
          period_start: true, period_end: true,
          snapshots: {
            orderBy: { computed_at: 'desc' },
            take: 1,
            select: { spent: true, committed: true, available: true },
          },
        },
        orderBy: { cost_center: 'asc' },
      }).then((rows) =>
        rows.map((r) => ({
          ...r,
          allocated_amount: r.allocated_amount?.toString() ?? '',
          spent: r.snapshots[0]?.spent?.toString() ?? '0',
          committed: r.snapshots[0]?.committed?.toString() ?? '0',
          available: r.snapshots[0]?.available?.toString() ?? '0',
          period_start: r.period_start?.toISOString() ?? '',
          period_end: r.period_end?.toISOString() ?? '',
        })),
      )

    default:
      throw new Error(`Entity "${entity}" non valida`)
  }
}
```

- [ ] **Step 2: Create single entity export route**

Create `procureflow/src/app/api/admin/export/[entity]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  VALID_ENTITIES,
  EXPORT_COLUMNS,
  fetchEntityData,
  toCsv,
} from '@/server/services/export.service'

interface RouteParams {
  params: Promise<{ entity: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { entity } = await params

  if (!VALID_ENTITIES.includes(entity as typeof VALID_ENTITIES[number])) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ENTITY', message: `Entita "${entity}" non valida` } },
      { status: 400 },
    )
  }

  const entityName = entity as typeof VALID_ENTITIES[number]
  const data = await fetchEntityData(entityName)
  const columns = EXPORT_COLUMNS[entityName]!
  const csv = toCsv(data, columns)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${entity}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
```

- [ ] **Step 3: Create backup ZIP route**

Create `procureflow/src/app/api/admin/export/backup/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import archiver from 'archiver'
import { Readable } from 'stream'
import {
  VALID_ENTITIES,
  EXPORT_COLUMNS,
  fetchEntityData,
  toCsv,
} from '@/server/services/export.service'

export async function GET() {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const archive = archiver('zip', { zlib: { level: 9 } })
  const chunks: Buffer[] = []

  archive.on('data', (chunk: Buffer) => chunks.push(chunk))

  // Generate CSV for each entity in parallel
  const csvPromises = VALID_ENTITIES.map(async (entity) => {
    const data = await fetchEntityData(entity)
    const columns = EXPORT_COLUMNS[entity]!
    return { entity, csv: toCsv(data, columns) }
  })

  const csvResults = await Promise.all(csvPromises)

  for (const { entity, csv } of csvResults) {
    archive.append(Readable.from(csv), { name: `${entity}.csv` })
  }

  await archive.finalize()

  const buffer = Buffer.concat(chunks)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="procureflow-backup-${date}.zip"`,
    },
  })
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add procureflow/src/server/services/export.service.ts procureflow/src/app/api/admin/export/
git commit -m "feat: add export service with per-entity CSV and full backup ZIP"
```

---

### Task 10: Approval Service (DB-backed thresholds)

**Files:**
- Modify: `procureflow/src/server/services/approval.service.ts` (file already exists with `initiateApprovalWorkflow` — append new functions)
- Modify: `procureflow/src/lib/constants/approval-thresholds.ts`

- [ ] **Step 1: Add DB-backed threshold functions to existing approval service**

The file `procureflow/src/server/services/approval.service.ts` already exists. **Append** the following functions at the end of the file (do NOT overwrite existing code):

```typescript
import { prisma } from '@/lib/db'
import { APPROVAL_THRESHOLDS } from '@/lib/constants/approval-thresholds'

interface ApprovalRules {
  readonly autoApproveMax: number
  readonly managerApproveMax: number
}

export async function getApprovalThresholds(): Promise<ApprovalRules> {
  try {
    const config = await prisma.deployConfig.findUnique({
      where: { id: 'default' },
      select: { approval_rules: true },
    })

    if (config?.approval_rules && typeof config.approval_rules === 'object') {
      const rules = config.approval_rules as Record<string, unknown>
      const autoMax = typeof rules.autoApproveMax === 'number' ? rules.autoApproveMax : null
      const managerMax = typeof rules.managerApproveMax === 'number' ? rules.managerApproveMax : null

      if (autoMax !== null && managerMax !== null) {
        return Object.freeze({ autoApproveMax: autoMax, managerApproveMax: managerMax })
      }
    }
  } catch {
    // DB error — fall back to constants
  }

  return Object.freeze({
    autoApproveMax: APPROVAL_THRESHOLDS.AUTO_APPROVE_MAX,
    managerApproveMax: APPROVAL_THRESHOLDS.MANAGER_APPROVE_MAX,
  })
}

export async function getApprovalTierFromDb(
  amount: number,
): Promise<'auto' | 'manager' | 'director'> {
  const thresholds = await getApprovalThresholds()
  if (amount <= thresholds.autoApproveMax) return 'auto'
  if (amount <= thresholds.managerApproveMax) return 'manager'
  return 'director'
}
```

- [ ] **Step 2: Find and update callers of old getApprovalTier**

Search for all usages of `getApprovalTier` in the codebase:

```bash
cd procureflow && grep -rn "getApprovalTier" src/ --include="*.ts" --include="*.tsx"
```

For each caller found, update the import to use `getApprovalTierFromDb` from `@/server/services/approval.service` instead of the old function from `@/lib/constants/approval-thresholds`. Since the new function is async, wrap the call in `await`. If no callers exist yet (thresholds only used in n8n workflows), skip this step.

- [ ] **Step 3: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add procureflow/src/server/services/approval.service.ts procureflow/src/
git commit -m "feat: add DB-backed approval thresholds service with fallback to constants"
```

---

## Chunk 3: UI Components

### Task 11: Admin Panel Layout & Navigation

**Files:**
- Create: `procureflow/src/app/admin/config/layout.tsx`
- Create: `procureflow/src/app/admin/config/page.tsx`
- Create: `procureflow/src/components/admin/admin-panel.tsx`
- Modify: `procureflow/src/lib/constants.ts` (add admin nav item)
- Modify: `procureflow/src/components/layout/sidebar.tsx` (role-gate admin item)

- [ ] **Step 1: Create admin layout**

Create `procureflow/src/app/admin/config/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  readonly children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/')
  }
  return <>{children}</>
}
```

- [ ] **Step 2: Create admin page**

Create `procureflow/src/app/admin/config/page.tsx`:

```typescript
import { AdminPanel } from '@/components/admin/admin-panel'

export default function AdminConfigPage() {
  return <AdminPanel />
}
```

- [ ] **Step 3: Create AdminPanel client component (tab navigation shell)**

Create `procureflow/src/components/admin/admin-panel.tsx`:

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Settings2,
  ShieldCheck,
  Tag,
  Building2,
  Plug,
  FileUp,
} from 'lucide-react'
import { GeneralTab } from './general-tab'
import { ApprovalsTab } from './approvals-tab'
import { CategoriesTab } from './categories-tab'
import { DepartmentsTab } from './departments-tab'
import { IntegrationsTab } from './integrations-tab'
import { ImportExportTab } from './import-export-tab'

type AdminTabKey =
  | 'generale'
  | 'approvazioni'
  | 'categorie'
  | 'dipartimenti'
  | 'integrazioni'
  | 'import-export'

const TABS: readonly {
  readonly key: AdminTabKey
  readonly label: string
  readonly icon: typeof Settings2
}[] = [
  { key: 'generale', label: 'Generale', icon: Settings2 },
  { key: 'approvazioni', label: 'Approvazioni', icon: ShieldCheck },
  { key: 'categorie', label: 'Categorie', icon: Tag },
  { key: 'dipartimenti', label: 'Dip & Costi', icon: Building2 },
  { key: 'integrazioni', label: 'Integrazioni', icon: Plug },
  { key: 'import-export', label: 'Import/Export', icon: FileUp },
]

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTabKey>('generale')

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg p-2 text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-pf-text-secondary">
            Configurazione sistema
          </p>
        </div>
      </div>

      {/* Layout: sidebar tabs + content */}
      <div className="flex gap-6">
        {/* Tab sidebar */}
        <nav className="w-48 shrink-0 space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-pf-accent/10 font-medium text-pf-accent'
                    : 'text-pf-text-secondary hover:bg-pf-bg-hover hover:text-pf-text-primary'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Content area */}
        <div className="min-w-0 flex-1 rounded-xl border border-pf-border bg-pf-bg-secondary p-6">
          {activeTab === 'generale' && <GeneralTab />}
          {activeTab === 'approvazioni' && <ApprovalsTab />}
          {activeTab === 'categorie' && <CategoriesTab />}
          {activeTab === 'dipartimenti' && <DepartmentsTab />}
          {activeTab === 'integrazioni' && <IntegrationsTab />}
          {activeTab === 'import-export' && <ImportExportTab />}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add admin nav item to constants.ts**

In `procureflow/src/lib/constants.ts`, find the `NAV_ITEMS` array. Add `adminOnly?: boolean` to the nav item type/interface. Then add this entry as the second-to-last item (just before the Settings entry which has `href: '/settings'`):

```typescript
import { Shield } from 'lucide-react' // add to existing lucide imports

// Add to NAV_ITEMS array, before the Settings entry:
{
  label: 'Admin',
  href: '/admin/config',
  icon: Shield,
  adminOnly: true,
},
```

- [ ] **Step 5: Add role-gate in sidebar.tsx**

In `procureflow/src/components/layout/sidebar.tsx`, after the `filterNavItems` call, add a filter to exclude `adminOnly` items for non-ADMIN users:

```typescript
// After: const visibleItems = filterNavItems(enabledModules, NAV_ITEMS)
// Add session-based filtering:
import { useSession } from 'next-auth/react'

const { data: session } = useSession()
const finalItems = visibleItems.filter(
  (item) => !item.adminOnly || session?.user?.role === 'ADMIN',
)
// Use finalItems instead of visibleItems in the map()
```

- [ ] **Step 6: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add procureflow/src/app/admin/ procureflow/src/components/admin/admin-panel.tsx procureflow/src/lib/constants.ts procureflow/src/components/layout/sidebar.tsx
git commit -m "feat: add admin panel layout, page, navigation with role-gate"
```

---

### Task 12: Admin Tab Components (General + Approvals + Categories + Departments)

**Files:**
- Create: `procureflow/src/hooks/use-admin-config.ts`
- Create: `procureflow/src/components/admin/general-tab.tsx`
- Create: `procureflow/src/components/admin/approvals-tab.tsx`
- Create: `procureflow/src/components/admin/categories-tab.tsx`
- Create: `procureflow/src/components/admin/departments-tab.tsx`

- [ ] **Step 1: Create useAdminConfig hook**

Create `procureflow/src/hooks/use-admin-config.ts`:

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateConfigInput } from '@/lib/validations/admin'

interface DeployConfigData {
  readonly deploy_name: string
  readonly company_logo_url: string | null
  readonly enabled_modules: readonly string[]
  readonly categories: readonly string[]
  readonly departments: readonly string[]
  readonly cost_centers: readonly string[]
  readonly approval_rules: {
    readonly autoApproveMax: number
    readonly managerApproveMax: number
  } | null
}

async function fetchConfig(): Promise<DeployConfigData> {
  const res = await fetch('/api/admin/config')
  const json = (await res.json()) as { success: boolean; data: DeployConfigData }
  if (!json.success) throw new Error('Errore caricamento configurazione')
  return json.data
}

async function updateConfig(data: UpdateConfigInput): Promise<DeployConfigData> {
  const res = await fetch('/api/admin/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = (await res.json()) as { success: boolean; data: DeployConfigData }
  if (!json.success) throw new Error('Errore salvataggio configurazione')
  return json.data
}

export function useAdminConfig() {
  return useQuery({
    queryKey: ['admin-config'],
    queryFn: fetchConfig,
  })
}

export function useUpdateAdminConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config'] })
    },
  })
}
```

- [ ] **Step 2: Create GeneralTab**

Create `procureflow/src/components/admin/general-tab.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useAdminConfig, useUpdateAdminConfig } from '@/hooks/use-admin-config'
import { MODULE_REGISTRY } from '@/lib/modules/registry'
import { toast } from 'sonner'

export function GeneralTab() {
  const { data: config, isLoading } = useAdminConfig()
  const updateConfig = useUpdateAdminConfig()

  const [deployName, setDeployName] = useState('')
  const [enabledModules, setEnabledModules] = useState<string[]>([])
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  useEffect(() => {
    if (config) {
      setDeployName(config.deploy_name)
      setEnabledModules([...config.enabled_modules])
      setLogoPreview(config.company_logo_url)
    }
  }, [config])

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-10 rounded bg-pf-bg-tertiary" />
      <div className="h-10 rounded bg-pf-bg-tertiary" />
    </div>
  }

  const handleModuleToggle = (moduleId: string) => {
    if (moduleId === 'core') return
    setEnabledModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((m) => m !== moduleId)
        : [...prev, moduleId],
    )
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    updateConfig.mutate(
      {
        deploy_name: deployName,
        company_logo_url: logoPreview,
        enabled_modules: enabledModules,
      },
      {
        onSuccess: () => toast.success('Configurazione salvata'),
        onError: () => toast.error('Errore nel salvataggio'),
      },
    )
  }

  const modules = Array.from(MODULE_REGISTRY.values())

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Generale</h2>

      {/* Company Name */}
      <div>
        <label htmlFor="deploy_name" className="mb-1 block text-sm font-medium">
          Nome Azienda
        </label>
        <input
          id="deploy_name"
          type="text"
          value={deployName}
          onChange={(e) => setDeployName(e.target.value)}
          className="w-full rounded-lg border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm"
        />
      </div>

      {/* Logo */}
      <div>
        <label className="mb-1 block text-sm font-medium">Logo Aziendale</label>
        <div className="flex items-center gap-4">
          {logoPreview && (
            <img
              src={logoPreview}
              alt="Logo"
              className="h-12 w-12 rounded-lg object-contain"
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="text-sm text-pf-text-secondary"
          />
        </div>
      </div>

      {/* Module Toggles */}
      <div>
        <label className="mb-2 block text-sm font-medium">Moduli Attivi</label>
        <div className="space-y-2">
          {modules.map((mod) => (
            <label
              key={mod.id}
              className="flex items-center justify-between rounded-lg border border-pf-border p-3"
            >
              <div>
                <span className="text-sm font-medium">{mod.label}</span>
                <p className="text-xs text-pf-text-secondary">{mod.description}</p>
              </div>
              <input
                type="checkbox"
                checked={enabledModules.includes(mod.id)}
                onChange={() => handleModuleToggle(mod.id)}
                disabled={mod.id === 'core'}
                className="h-4 w-4 rounded accent-pf-accent"
              />
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={updateConfig.isPending}
        className="rounded-lg bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
      >
        {updateConfig.isPending ? 'Salvataggio...' : 'Salva'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create ApprovalsTab**

Create `procureflow/src/components/admin/approvals-tab.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useAdminConfig, useUpdateAdminConfig } from '@/hooks/use-admin-config'
import { toast } from 'sonner'

export function ApprovalsTab() {
  const { data: config, isLoading } = useAdminConfig()
  const updateConfig = useUpdateAdminConfig()

  const [autoApproveMax, setAutoApproveMax] = useState(500)
  const [managerApproveMax, setManagerApproveMax] = useState(5000)

  useEffect(() => {
    if (config?.approval_rules) {
      setAutoApproveMax(config.approval_rules.autoApproveMax)
      setManagerApproveMax(config.approval_rules.managerApproveMax)
    }
  }, [config])

  if (isLoading) {
    return <div className="animate-pulse h-40 rounded bg-pf-bg-tertiary" />
  }

  const handleSave = () => {
    updateConfig.mutate(
      { approval_rules: { autoApproveMax, managerApproveMax } },
      {
        onSuccess: () => toast.success('Soglie aggiornate'),
        onError: () => toast.error('Errore nel salvataggio'),
      },
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Soglie Approvazione</h2>

      <div>
        <label htmlFor="auto_approve" className="mb-1 block text-sm font-medium">
          Auto-approvazione fino a (EUR)
        </label>
        <input
          id="auto_approve"
          type="number"
          min={0}
          value={autoApproveMax}
          onChange={(e) => setAutoApproveMax(Number(e.target.value))}
          className="w-full rounded-lg border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-pf-text-secondary">
          Richieste sotto questa soglia vengono approvate automaticamente
        </p>
      </div>

      <div>
        <label htmlFor="manager_approve" className="mb-1 block text-sm font-medium">
          Approvazione Manager fino a (EUR)
        </label>
        <input
          id="manager_approve"
          type="number"
          min={0}
          value={managerApproveMax}
          onChange={(e) => setManagerApproveMax(Number(e.target.value))}
          className="w-full rounded-lg border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-pf-text-secondary">
          Sopra questa soglia serve approvazione Director + CFO
        </p>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={updateConfig.isPending}
        className="rounded-lg bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
      >
        {updateConfig.isPending ? 'Salvataggio...' : 'Salva'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create CategoriesTab**

Create `procureflow/src/components/admin/categories-tab.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useAdminConfig, useUpdateAdminConfig } from '@/hooks/use-admin-config'
import { X, Plus } from 'lucide-react'
import { toast } from 'sonner'

export function CategoriesTab() {
  const { data: config, isLoading } = useAdminConfig()
  const updateConfig = useUpdateAdminConfig()

  const [categories, setCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    if (config) setCategories([...config.categories])
  }, [config])

  if (isLoading) {
    return <div className="animate-pulse h-40 rounded bg-pf-bg-tertiary" />
  }

  const handleAdd = () => {
    const trimmed = newCategory.trim()
    if (!trimmed || categories.includes(trimmed)) return
    setCategories((prev) => [...prev, trimmed])
    setNewCategory('')
  }

  const handleRemove = (cat: string) => {
    setCategories((prev) => prev.filter((c) => c !== cat))
  }

  const handleSave = () => {
    updateConfig.mutate(
      { categories },
      {
        onSuccess: () => toast.success('Categorie aggiornate'),
        onError: () => toast.error('Errore nel salvataggio'),
      },
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Categorie Merceologiche</h2>

      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat}
            className="flex items-center justify-between rounded-lg border border-pf-border px-3 py-2"
          >
            <span className="text-sm">{cat}</span>
            <button
              type="button"
              onClick={() => handleRemove(cat)}
              className="text-pf-text-muted transition-colors hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Nuova categoria"
          className="flex-1 rounded-lg border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-lg bg-pf-bg-tertiary px-3 py-2 text-sm transition-colors hover:bg-pf-bg-hover"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={updateConfig.isPending}
        className="rounded-lg bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
      >
        {updateConfig.isPending ? 'Salvataggio...' : 'Salva'}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Create DepartmentsTab**

Create `procureflow/src/components/admin/departments-tab.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useAdminConfig, useUpdateAdminConfig } from '@/hooks/use-admin-config'
import { X, Plus } from 'lucide-react'
import { toast } from 'sonner'

function ListEditor({
  label,
  items,
  placeholder,
  onChange,
}: {
  readonly label: string
  readonly items: readonly string[]
  readonly placeholder: string
  readonly onChange: (items: string[]) => void
}) {
  const [newItem, setNewItem] = useState('')

  const handleAdd = () => {
    const trimmed = newItem.trim()
    if (!trimmed || items.includes(trimmed)) return
    onChange([...items, trimmed])
    setNewItem('')
  }

  const handleRemove = (item: string) => {
    onChange(items.filter((i) => i !== item))
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{label}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center justify-between rounded-lg border border-pf-border px-3 py-2"
          >
            <span className="text-sm">{item}</span>
            <button
              type="button"
              onClick={() => handleRemove(item)}
              className="text-pf-text-muted transition-colors hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-lg bg-pf-bg-tertiary px-3 py-2 text-sm transition-colors hover:bg-pf-bg-hover"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function DepartmentsTab() {
  const { data: config, isLoading } = useAdminConfig()
  const updateConfig = useUpdateAdminConfig()

  const [departments, setDepartments] = useState<string[]>([])
  const [costCenters, setCostCenters] = useState<string[]>([])

  useEffect(() => {
    if (config) {
      setDepartments([...config.departments])
      setCostCenters([...config.cost_centers])
    }
  }, [config])

  if (isLoading) {
    return <div className="animate-pulse h-40 rounded bg-pf-bg-tertiary" />
  }

  const handleSave = () => {
    updateConfig.mutate(
      { departments, cost_centers: costCenters },
      {
        onSuccess: () => toast.success('Configurazione aggiornata'),
        onError: () => toast.error('Errore nel salvataggio'),
      },
    )
  }

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">Dipartimenti & Centri di Costo</h2>

      <ListEditor
        label="Dipartimenti"
        items={departments}
        placeholder="es. IT, Produzione, Marketing"
        onChange={setDepartments}
      />

      <ListEditor
        label="Centri di Costo"
        items={costCenters}
        placeholder="es. CC-001 Sede Principale"
        onChange={setCostCenters}
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={updateConfig.isPending}
        className="rounded-lg bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
      >
        {updateConfig.isPending ? 'Salvataggio...' : 'Salva'}
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add procureflow/src/hooks/use-admin-config.ts procureflow/src/components/admin/general-tab.tsx procureflow/src/components/admin/approvals-tab.tsx procureflow/src/components/admin/categories-tab.tsx procureflow/src/components/admin/departments-tab.tsx
git commit -m "feat: add admin config tabs (general, approvals, categories, departments)"
```

---

### Task 13: Integrations Tab

**Files:**
- Create: `procureflow/src/components/admin/integrations-tab.tsx`

- [ ] **Step 1: Create IntegrationsTab**

Create `procureflow/src/components/admin/integrations-tab.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plug, Wifi, WifiOff, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { IntegrationType } from '@/lib/validations/admin'

interface IntegrationData {
  readonly id: string
  readonly type: string
  readonly label: string
  readonly enabled: boolean
  readonly config: Record<string, unknown>
  readonly status: string
  readonly last_sync_at: string | null
  readonly last_error: string | null
}

interface TestResult {
  readonly success: boolean
  readonly message: string
  readonly latency_ms: number
}

// --- Config form field definitions ---

interface FieldDef {
  readonly key: string
  readonly label: string
  readonly type: 'text' | 'number' | 'email' | 'password' | 'select'
  readonly options?: readonly string[]
  readonly defaultValue?: string | number
}

const INTEGRATION_FIELDS: Record<IntegrationType, readonly FieldDef[]> = {
  imap: [
    { key: 'host', label: 'Host', type: 'text' },
    { key: 'port', label: 'Porta', type: 'number', defaultValue: 993 },
    { key: 'protocol', label: 'Protocollo', type: 'select', options: ['imap', 'imaps'] },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'folder', label: 'Cartella', type: 'text', defaultValue: 'INBOX' },
  ],
  sdi: [
    { key: 'endpoint_url', label: 'Endpoint URL', type: 'text' },
    { key: 'codice_destinatario', label: 'Codice Destinatario', type: 'text' },
    { key: 'certificate_base64', label: 'Certificato (Base64)', type: 'text' },
    { key: 'certificate_password', label: 'Password Certificato', type: 'password' },
  ],
  vendor_api: [
    { key: 'vendor_name', label: 'Nome Fornitore', type: 'text' },
    { key: 'base_url', label: 'Base URL', type: 'text' },
    { key: 'api_key', label: 'API Key', type: 'password' },
  ],
}

const INTEGRATION_TYPES: readonly { type: IntegrationType; label: string }[] = [
  { type: 'imap', label: 'Email Ingestion (IMAP)' },
  { type: 'sdi', label: 'SDI Fatturazione Elettronica' },
  { type: 'vendor_api', label: 'API Fornitore' },
]

// --- Status badge ---

function StatusBadge({ status }: { readonly status: string }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
        <Wifi className="h-3 w-3" /> Connesso
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
        <AlertTriangle className="h-3 w-3" /> Errore
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2 py-0.5 text-xs font-medium text-pf-text-secondary">
      <WifiOff className="h-3 w-3" /> Disconnesso
    </span>
  )
}

// --- Single Integration Card ---

function IntegrationCard({
  type,
  label,
  existing,
}: {
  readonly type: IntegrationType
  readonly label: string
  readonly existing?: IntegrationData
}) {
  const queryClient = useQueryClient()
  const fields = INTEGRATION_FIELDS[type]

  const [formData, setFormData] = useState<Record<string, string | number>>({})
  const [enabled, setEnabled] = useState(existing?.enabled ?? false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (existing?.config) {
      const initial: Record<string, string | number> = {}
      for (const field of fields) {
        const val = existing.config[field.key]
        initial[field.key] = val !== undefined && val !== '****'
          ? String(val)
          : (field.defaultValue ?? '')
      }
      setFormData(initial)
      setEnabled(existing.enabled)
    } else {
      const initial: Record<string, string | number> = {}
      for (const field of fields) {
        initial[field.key] = field.defaultValue ?? ''
      }
      setFormData(initial)
    }
  }, [existing, fields])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const config: Record<string, unknown> = {}
      for (const field of fields) {
        config[field.key] = field.type === 'number'
          ? Number(formData[field.key])
          : formData[field.key]
      }
      const res = await fetch(`/api/admin/integrations/${type}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, enabled, config }),
      })
      if (!res.ok) throw new Error('Errore salvataggio')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-integrations'] })
      toast.success('Integrazione salvata')
    },
    onError: () => toast.error('Errore nel salvataggio'),
  })

  const testMutation = useMutation({
    mutationFn: async (): Promise<TestResult> => {
      const res = await fetch(`/api/admin/integrations/${type}/test`, { method: 'POST' })
      const json = (await res.json()) as { success: boolean; data: TestResult }
      return json.data
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-integrations'] })
      if (result.success) {
        toast.success(`${result.message} (${result.latency_ms}ms)`)
      } else {
        toast.error(result.message)
      }
    },
    onError: () => toast.error('Errore nel test'),
  })

  return (
    <div className="rounded-xl border border-pf-border bg-pf-bg-primary p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Plug className="h-5 w-5 text-pf-text-secondary" />
          <div>
            <span className="text-sm font-medium">{label}</span>
            <div className="mt-0.5">
              <StatusBadge status={existing?.status ?? 'disconnected'} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded accent-pf-accent"
          />
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-pf-accent hover:underline"
          >
            {expanded ? 'Chiudi' : 'Configura'}
          </button>
        </div>
      </div>

      {existing?.last_error && (
        <p className="mt-2 text-xs text-red-400">{existing.last_error}</p>
      )}
      {existing?.last_sync_at && (
        <p className="mt-1 text-xs text-pf-text-muted">
          Ultimo sync: {new Date(existing.last_sync_at).toLocaleString('it-IT')}
        </p>
      )}

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-pf-border pt-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-xs font-medium">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  value={String(formData[field.key] ?? '')}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-pf-border bg-pf-bg-secondary px-3 py-1.5 text-sm"
                >
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={String(formData[field.key] ?? '')}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="w-full rounded-lg border border-pf-border bg-pf-bg-secondary px-3 py-1.5 text-sm"
                />
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="rounded-lg bg-pf-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-pf-accent-hover disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Salvataggio...' : 'Salva'}
            </button>
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending || !existing}
              className="rounded-lg border border-pf-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-pf-bg-hover disabled:opacity-50"
            >
              {testMutation.isPending ? (
                <Loader2 className="inline h-3 w-3 animate-spin" />
              ) : (
                'Test Connessione'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Main Tab ---

export function IntegrationsTab() {
  const { data: integrations, isLoading } = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: async () => {
      const res = await fetch('/api/admin/integrations')
      const json = (await res.json()) as { success: boolean; data: IntegrationData[] }
      return json.data
    },
  })

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-24 rounded bg-pf-bg-tertiary" />
      <div className="h-24 rounded bg-pf-bg-tertiary" />
    </div>
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Integrazioni</h2>
      <div className="space-y-4">
        {INTEGRATION_TYPES.map(({ type, label }) => (
          <IntegrationCard
            key={type}
            type={type}
            label={label}
            existing={integrations?.find((i) => i.type === type)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add procureflow/src/components/admin/integrations-tab.tsx
git commit -m "feat: add integrations tab with config forms and connection testing"
```

---

### Task 14: Import/Export Tab

**Files:**
- Create: `procureflow/src/components/admin/import-export-tab.tsx`

- [ ] **Step 1: Create ImportExportTab**

Create `procureflow/src/components/admin/import-export-tab.tsx`:

```typescript
'use client'

import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Upload,
  Download,
  FileArchive,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ImportResult } from '@/server/services/import.service'

// --- Import Zone ---

function ImportZone({
  label,
  endpoint,
}: {
  readonly label: string
  readonly endpoint: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const importMutation = useMutation({
    mutationFn: async (file: File): Promise<ImportResult> => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(endpoint, { method: 'POST', body: formData })
      const json = (await res.json()) as { success: boolean; data: ImportResult; error?: { message: string } }
      if (!json.success) throw new Error(json.error?.message ?? 'Errore import')
      return json.data
    },
    onSuccess: (data) => {
      setResult(data)
      toast.success(`Import completato: ${data.created} creati, ${data.updated} aggiornati`)
    },
    onError: (error) => {
      toast.error((error as Error).message)
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setResult(null)
      importMutation.mutate(file)
    }
  }

  return (
    <div className="rounded-xl border border-pf-border p-4">
      <h3 className="mb-3 text-sm font-medium">{label}</h3>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={importMutation.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-pf-border py-6 text-sm text-pf-text-secondary transition-colors hover:border-pf-accent hover:text-pf-accent disabled:opacity-50"
      >
        {importMutation.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
        {importMutation.isPending ? 'Importazione in corso...' : 'Clicca o trascina un file CSV'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-500">
              <CheckCircle2 className="h-4 w-4" /> {result.created} creati
            </span>
            <span className="flex items-center gap-1 text-blue-400">
              <CheckCircle2 className="h-4 w-4" /> {result.updated} aggiornati
            </span>
            {result.errors.length > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="h-4 w-4" /> {result.errors.length} errori
              </span>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-lg bg-red-500/5 p-2">
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-400">
                  Riga {err.row}: {err.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Export Links ---

const EXPORT_ENTITIES = [
  { key: 'vendors', label: 'Fornitori' },
  { key: 'materials', label: 'Materiali' },
  { key: 'requests', label: 'Richieste' },
  { key: 'invoices', label: 'Fatture' },
  { key: 'users', label: 'Utenti' },
  { key: 'budgets', label: 'Budget' },
] as const

export function ImportExportTab() {
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleExport = async (entity: string) => {
    setDownloading(entity)
    try {
      const res = await fetch(`/api/admin/export/${entity}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${entity}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Errore nel download')
    } finally {
      setDownloading(null)
    }
  }

  const handleBackup = async () => {
    setDownloading('backup')
    try {
      const res = await fetch('/api/admin/export/backup')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `procureflow-backup-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup scaricato')
    } catch {
      toast.error('Errore nel backup')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">Import / Export</h2>

      {/* Import Section */}
      <div>
        <h3 className="mb-3 font-medium">Import CSV</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <ImportZone label="Import Fornitori" endpoint="/api/admin/import/vendors" />
          <ImportZone label="Import Materiali" endpoint="/api/admin/import/materials" />
        </div>
      </div>

      {/* Export Section */}
      <div>
        <h3 className="mb-3 font-medium">Export Dati</h3>

        {/* Backup button */}
        <button
          type="button"
          onClick={handleBackup}
          disabled={downloading === 'backup'}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-pf-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
        >
          {downloading === 'backup' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileArchive className="h-4 w-4" />
          )}
          Backup Completo (ZIP)
        </button>

        {/* Individual exports */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXPORT_ENTITIES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleExport(key)}
              disabled={downloading === key}
              className="flex items-center gap-2 rounded-lg border border-pf-border px-3 py-2 text-sm transition-colors hover:bg-pf-bg-hover disabled:opacity-50"
            >
              {downloading === key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4 text-pf-text-secondary" />
              )}
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add procureflow/src/components/admin/import-export-tab.tsx
git commit -m "feat: add import/export tab with CSV upload and backup download"
```

---

### Task 15: ExportCsvButton + Add to List Pages

**Files:**
- Create: `procureflow/src/components/shared/export-csv-button.tsx`
- Modify: `procureflow/src/components/vendors/vendors-page-content.tsx`
- Modify: `procureflow/src/components/inventory/materials-page-content.tsx`
- Modify: `procureflow/src/components/invoices/invoices-page-content.tsx`
- Modify: `procureflow/src/components/requests/requests-page-content.tsx`

- [ ] **Step 1: Create ExportCsvButton component**

Create `procureflow/src/components/shared/export-csv-button.tsx`:

```typescript
'use client'

import { Download } from 'lucide-react'

interface CsvColumn {
  readonly key: string
  readonly label: string
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function generateCsv(
  data: readonly Record<string, unknown>[],
  columns: readonly CsvColumn[],
): string {
  const header = columns.map((c) => c.label).join(',')
  const rows = data.map((row) =>
    columns.map((col) => escapeCell(row[col.key])).join(','),
  )
  return [header, ...rows].join('\n')
}

export function ExportCsvButton({
  data,
  columns,
  filename,
}: {
  readonly data: readonly Record<string, unknown>[]
  readonly columns: readonly CsvColumn[]
  readonly filename: string
}) {
  const handleExport = () => {
    const csv = generateCsv(data, columns)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={data.length === 0}
      title="Esporta CSV"
      className="inline-flex items-center gap-1.5 rounded-lg border border-pf-border px-3 py-2 text-sm text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      Esporta
    </button>
  )
}
```

- [ ] **Step 2: Add ExportCsvButton to vendors page**

In `procureflow/src/components/vendors/vendors-page-content.tsx`, in the header area (around line 81-103), add the ExportCsvButton next to the "Nuovo Fornitore" button:

```typescript
import { ExportCsvButton } from '@/components/shared/export-csv-button'

// In the header div, add alongside the existing button:
<div className="flex items-center gap-2">
  <ExportCsvButton
    data={(vendors ?? []) as unknown as Record<string, unknown>[]}
    columns={[
      { key: 'code', label: 'codice' },
      { key: 'name', label: 'nome' },
      { key: 'email', label: 'email' },
      { key: 'phone', label: 'telefono' },
      { key: 'status', label: 'stato' },
    ]}
    filename="fornitori"
  />
  {/* existing Nuovo Fornitore button */}
</div>
```

- [ ] **Step 3: Add ExportCsvButton to materials page**

In `procureflow/src/components/inventory/materials-page-content.tsx`, same pattern — add next to "Nuovo Materiale" button:

```typescript
import { ExportCsvButton } from '@/components/shared/export-csv-button'

<ExportCsvButton
  data={(materials ?? []) as unknown as Record<string, unknown>[]}
  columns={[
    { key: 'code', label: 'codice' },
    { key: 'name', label: 'nome' },
    { key: 'category', label: 'categoria' },
    { key: 'unit_primary', label: 'unita' },
  ]}
  filename="materiali"
/>
```

- [ ] **Step 4: Add ExportCsvButton to invoices page**

In `procureflow/src/components/invoices/invoices-page-content.tsx`, add next to the header buttons:

```typescript
import { ExportCsvButton } from '@/components/shared/export-csv-button'

<ExportCsvButton
  data={(invoices ?? []) as unknown as Record<string, unknown>[]}
  columns={[
    { key: 'invoice_number', label: 'numero' },
    { key: 'vendor_name', label: 'fornitore_nome' },
    { key: 'total_amount', label: 'importo' },
    { key: 'currency', label: 'valuta' },
    { key: 'received_at', label: 'data_ricezione' },
    { key: 'reconciliation_status', label: 'stato_riconciliazione' },
    { key: 'sdi_id', label: 'sdi_id' },
  ]}
  filename="fatture"
/>
```

- [ ] **Step 5: Add ExportCsvButton to requests page**

In `procureflow/src/components/requests/requests-page-content.tsx`, add next to the header buttons:

```typescript
import { ExportCsvButton } from '@/components/shared/export-csv-button'

<ExportCsvButton
  data={(requests ?? []) as unknown as Record<string, unknown>[]}
  columns={[
    { key: 'code', label: 'codice' },
    { key: 'title', label: 'titolo' },
    { key: 'status', label: 'stato' },
    { key: 'priority', label: 'priorita' },
    { key: 'estimated_amount', label: 'importo_stimato' },
    { key: 'currency', label: 'valuta' },
    { key: 'created_at', label: 'data_creazione' },
  ]}
  filename="richieste"
/>
```

- [ ] **Step 6: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add procureflow/src/components/shared/export-csv-button.tsx procureflow/src/components/vendors/ procureflow/src/components/inventory/ procureflow/src/components/invoices/ procureflow/src/components/requests/
git commit -m "feat: add ExportCsvButton to vendors, materials, invoices, and requests pages"
```

---

### Task 16: Update Request Form Dropdowns

**Files:**
- Modify: `procureflow/src/components/requests/request-form.tsx` (lines 567-608)

- [ ] **Step 1: Fetch config and convert free-text fields to dropdowns**

In `procureflow/src/components/requests/request-form.tsx`:

1. Add import: `import { useAdminConfig } from '@/hooks/use-admin-config'`
2. Inside the component, add: `const { data: adminConfig } = useAdminConfig()`
3. Replace the department `<input>` (around line 567) with:

```typescript
<select id="department" {...register('department')} className="...existing classes...">
  <option value="">Seleziona dipartimento</option>
  {(adminConfig?.departments ?? []).map((dept) => (
    <option key={dept} value={dept}>{dept}</option>
  ))}
</select>
```

4. Replace the cost_center `<input>` (around line 579) with:

```typescript
<select id="cost_center" {...register('cost_center')} className="...existing classes...">
  <option value="">Seleziona centro di costo</option>
  {(adminConfig?.cost_centers ?? []).map((cc) => (
    <option key={cc} value={cc}>{cc}</option>
  ))}
</select>
```

5. Also update the category field to use config categories instead of hardcoded ones:

```typescript
// Replace CATEGORY_OPTIONS with adminConfig?.categories
{(adminConfig?.categories ?? []).map((cat) => (
  <option key={cat} value={cat}>{cat}</option>
))}
```

- [ ] **Step 2: Verify types compile**

```bash
cd procureflow && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add procureflow/src/components/requests/request-form.tsx
git commit -m "feat: convert department, cost_center, and category to managed dropdowns"
```

---

### Task 17: Final Verification

- [ ] **Step 1: Full type check**

```bash
cd procureflow && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 2: Run all tests**

```bash
cd procureflow && npx vitest run 2>&1 | tail -20
```
Expected: All tests pass

- [ ] **Step 3: Build check**

```bash
cd procureflow && npm run build 2>&1 | tail -20
```
Expected: Build succeeds

- [ ] **Step 4: Final commit if any fixes needed**

If any files were changed to fix errors, add only the specific fixed files:

```bash
git add procureflow/src/ procureflow/prisma/ && git commit -m "fix: resolve build/type errors from admin panel implementation"
```
