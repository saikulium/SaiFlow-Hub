# Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guided onboarding wizard with two flows — a 3-step informational tour for regular users and a 5-step progressive setup wizard for admins.

**Architecture:** State tracked via `onboarding_completed` boolean + `onboarding_data` JSON on the User model, exposed through the JWT/session. The wizard is a client-side modal mounted in the dashboard layout. Admin setup data persists to DeployConfig (tenant-scoped).

**Tech Stack:** Next.js 14 App Router, Prisma, PostgreSQL, React Query, framer-motion, Zod, NextAuth.js

**Spec:** `docs/superpowers/specs/2026-03-28-onboarding-wizard-design.md`

**Deferred to follow-up:** Logo upload in admin step 1 (requires file upload API route), budget-per-category input in admin step 4 (requires Budget record creation UI). Both are in the spec but deferred to keep this plan focused on the core wizard flow.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/types/onboarding.ts` | OnboardingData, OnboardingState, ApprovalRules, AdminStepId types |
| `src/lib/validations/onboarding.ts` | Zod schemas for onboarding API payloads |
| `src/app/api/onboarding/route.ts` | PATCH endpoint — update onboarding state |
| `src/app/api/onboarding/team/route.ts` | POST endpoint — create invited users |
| `src/app/api/onboarding/company/route.ts` | PATCH endpoint — update DeployConfig (company name, logo, categories, rules) |
| `src/hooks/use-onboarding.ts` | React Query hook for onboarding state + mutations |
| `src/components/onboarding/onboarding-wizard.tsx` | Wizard container — role routing, step state machine, progress bar |
| `src/components/onboarding/wizard-shell.tsx` | Shared modal shell — backdrop, progress dots, navigation buttons |
| `src/components/onboarding/steps/welcome-step.tsx` | User step 1 — welcome message |
| `src/components/onboarding/steps/how-it-works-step.tsx` | User step 2 — procurement cycle diagram |
| `src/components/onboarding/steps/get-started-step.tsx` | User step 3 — quick tips + CTA |
| `src/components/onboarding/steps/admin-company-step.tsx` | Admin step 1 — company name + logo |
| `src/components/onboarding/steps/admin-vendor-step.tsx` | Admin step 2 — create first vendor |
| `src/components/onboarding/steps/admin-team-step.tsx` | Admin step 3 — invite team members |
| `src/components/onboarding/steps/admin-categories-step.tsx` | Admin step 4 — categories & budget (optional) |
| `src/components/onboarding/steps/admin-approvals-step.tsx` | Admin step 5 — approval rules (optional) |
| `src/components/onboarding/setup-banner.tsx` | Dashboard banner for incomplete admin setup |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | +2 fields on User (lines 90-91), +3 fields on DeployConfig (lines 565-567) |
| `src/types/next-auth.d.ts` | Add `onboardingCompleted` to Session.user and JWT interfaces |
| `src/lib/auth.ts` | Add `onboardingCompleted` to JWT callback (sign-in + update trigger) and session callback |
| `src/components/layout/dashboard-shell.tsx` | Mount `<OnboardingWizard>` and `<SetupBanner>` |
| `src/app/(dashboard)/settings/page.tsx` | Replace stub with onboarding relaunch section |

---

## Chunk 1: Data Layer — Schema, Types, Auth, API

### Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma:68-104` (User model)
- Modify: `prisma/schema.prisma:561-569` (DeployConfig model)

- [ ] **Step 1: Add fields to User model**

In `prisma/schema.prisma`, add after `recovery_codes` (line 90), before the relations block:

```prisma
  onboarding_completed Boolean  @default(false)
  onboarding_data      Json?
```

- [ ] **Step 2: Add fields to DeployConfig model**

In `prisma/schema.prisma`, add after `enabled_modules` (line 564), before timestamps:

```prisma
  company_logo_url  String?
  categories        String[]
  approval_rules    Json?
```

- [ ] **Step 3: Generate and apply migration**

Run:
```bash
cd procureflow && npx prisma migrate dev --name add-onboarding-fields
```

Expected: Migration created and applied. Prisma Client regenerated.

- [ ] **Step 4: Verify migration**

Run:
```bash
cd procureflow && npx prisma migrate status
```

Expected: All migrations applied, no pending.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(onboarding): add schema fields for onboarding wizard"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/onboarding.ts`
- Modify: `src/types/next-auth.d.ts:4-14` (Session) and `src/types/next-auth.d.ts:23-34` (JWT)

- [ ] **Step 1: Create onboarding types**

Create `src/types/onboarding.ts`:

```typescript
export const ADMIN_STEPS = ['company', 'vendor', 'team', 'categories', 'approvals'] as const
export type AdminStepId = (typeof ADMIN_STEPS)[number]

export const REQUIRED_ADMIN_STEPS: readonly AdminStepId[] = ['company', 'vendor', 'team']
export const OPTIONAL_ADMIN_STEPS: readonly AdminStepId[] = ['categories', 'approvals']

export interface OnboardingData {
  readonly completedSteps: readonly string[]
  readonly dismissedUntil?: string  // ISO 8601
  readonly companyName?: string
}

export interface ApprovalRules {
  readonly autoApproveThreshold: number
  readonly managerThreshold: number
}

export interface OnboardingState {
  readonly isComplete: boolean
  readonly data: OnboardingData | null
  readonly role: string
}

export interface TeamInvite {
  readonly name: string
  readonly email: string
  readonly role: 'REQUESTER' | 'MANAGER' | 'VIEWER'
}

export interface TeamInviteResult {
  readonly email: string
  readonly password: string
  readonly success: boolean
  readonly error?: string
}
```

- [ ] **Step 2: Extend NextAuth types**

In `src/types/next-auth.d.ts`, add `onboardingCompleted?: boolean` to the Session.user interface (after `mfaSetupRequired`) and to the JWT interface (after `totpEnabled`):

```typescript
// In Session.user:
onboardingCompleted?: boolean

// In JWT:
onboardingCompleted?: boolean
```

- [ ] **Step 3: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/onboarding.ts src/types/next-auth.d.ts
git commit -m "feat(onboarding): add TypeScript types for onboarding wizard"
```

---

### Task 3: Auth Integration (JWT + Session)

**Files:**
- Modify: `src/lib/auth.ts:104-212`

- [ ] **Step 1: Add onboardingCompleted to initial sign-in (JWT callback)**

In the JWT callback, inside the `if (user)` block (around line 125-143), after `token.totpEnabled = u.totpEnabled ?? false` (line 139), add:

```typescript
token.onboardingCompleted = (user as { onboardingCompleted?: boolean }).onboardingCompleted ?? false
```

Also update the `authorize()` return object (around line 90-99) to include:

```typescript
onboardingCompleted: user.onboarding_completed,
```

And add `onboarding_completed: true` to the `select` query in authorize (around line 37-48).

- [ ] **Step 2: Add onboardingCompleted to update trigger**

In the JWT callback's `trigger === 'update'` block (around line 106-122), add `onboarding_completed: true` to the `select` query (line 111), and after the `if (dbUser)` block add:

```typescript
token.onboardingCompleted = dbUser.onboarding_completed
```

- [ ] **Step 3: Add onboardingCompleted to session callback**

In the session callback (around line 192-212), after the department assignment (line 196), add:

```typescript
session.user.onboardingCompleted = (token.onboardingCompleted as boolean) ?? false
```

- [ ] **Step 4: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(onboarding): expose onboardingCompleted in JWT and session"
```

---

### Task 4: Zod Validation Schemas

**Files:**
- Create: `src/lib/validations/onboarding.ts`

- [ ] **Step 1: Create validation schemas**

Create `src/lib/validations/onboarding.ts`:

```typescript
import { z } from 'zod'

export const completeOnboardingSchema = z.object({
  completed: z.boolean(),
  completedSteps: z.array(z.string()).optional(),
  dismissedUntil: z.string().datetime().optional(),
})

export const teamInviteSchema = z.object({
  invites: z.array(
    z.object({
      name: z.string().min(2, 'Nome richiesto'),
      email: z.string().email('Email non valida'),
      role: z.enum(['REQUESTER', 'MANAGER', 'VIEWER']),
    })
  ).min(1, 'Almeno un invito richiesto'),
})

export const companySetupSchema = z.object({
  companyName: z.string().min(2, 'Nome azienda richiesto').optional(),
  categories: z.array(z.string()).optional(),
  approvalRules: z.object({
    autoApproveThreshold: z.number().min(0),
    managerThreshold: z.number().min(0),
  }).optional(),
})

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>
export type TeamInviteInput = z.infer<typeof teamInviteSchema>
export type CompanySetupInput = z.infer<typeof companySetupSchema>
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/validations/onboarding.ts
git commit -m "feat(onboarding): add Zod validation schemas"
```

---

### Task 5: API Routes

**Files:**
- Create: `src/app/api/onboarding/route.ts`
- Create: `src/app/api/onboarding/team/route.ts`
- Create: `src/app/api/onboarding/company/route.ts`

- [ ] **Step 1: Create main onboarding PATCH endpoint**

Create `src/app/api/onboarding/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { completeOnboardingSchema } from '@/lib/validations/onboarding'

export async function PATCH(req: Request) {
  const user = await requireAuth()
  if (user instanceof NextResponse) return user

  const body = await req.json()
  const parsed = completeOnboardingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: parsed.error.message } },
      { status: 400 },
    )
  }

  const { prisma } = await import('@/lib/db')

  const updateData: Record<string, unknown> = {
    onboarding_completed: parsed.data.completed,
  }

  if (parsed.data.completedSteps || parsed.data.dismissedUntil) {
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { onboarding_data: true },
    })
    const current = (existing?.onboarding_data as Record<string, unknown>) ?? {}
    updateData.onboarding_data = {
      ...current,
      ...(parsed.data.completedSteps && { completedSteps: parsed.data.completedSteps }),
      ...(parsed.data.dismissedUntil && { dismissedUntil: parsed.data.dismissedUntil }),
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  })

  return NextResponse.json({ success: true })
}

export async function GET() {
  const user = await requireAuth()
  if (user instanceof NextResponse) return user

  const { prisma } = await import('@/lib/db')
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { onboarding_completed: true, onboarding_data: true, role: true },
  })

  if (!dbUser) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Utente non trovato' } },
      { status: 404 },
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      isComplete: dbUser.onboarding_completed,
      data: dbUser.onboarding_data,
      role: dbUser.role,
    },
  })
}
```

- [ ] **Step 2: Create team invite POST endpoint**

Create `src/app/api/onboarding/team/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { teamInviteSchema } from '@/lib/validations/onboarding'
import type { TeamInviteResult } from '@/types/onboarding'

export async function POST(req: Request) {
  const user = await requireRole('ADMIN')
  if (user instanceof NextResponse) return user

  const body = await req.json()
  const parsed = teamInviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: parsed.error.message } },
      { status: 400 },
    )
  }

  const { prisma } = await import('@/lib/db')
  const bcrypt = (await import('bcryptjs')).default
  const { randomBytes } = await import('crypto')

  const results: TeamInviteResult[] = []

  for (const invite of parsed.data.invites) {
    try {
      const exists = await prisma.user.findUnique({ where: { email: invite.email } })
      if (exists) {
        results.push({ email: invite.email, password: '', success: false, error: 'Email già registrata' })
        continue
      }

      const password = randomBytes(12).toString('base64url')
      const hash = await bcrypt.hash(password, 12)

      await prisma.user.create({
        data: {
          email: invite.email,
          name: invite.name,
          role: invite.role,
          password_hash: hash,
          onboarding_completed: false,
        },
      })

      results.push({ email: invite.email, password, success: true })
    } catch {
      results.push({ email: invite.email, password: '', success: false, error: 'Errore creazione utente' })
    }
  }

  return NextResponse.json({ success: true, data: results })
}
```

- [ ] **Step 3: Create company setup PATCH endpoint**

Create `src/app/api/onboarding/company/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { companySetupSchema } from '@/lib/validations/onboarding'

export async function PATCH(req: Request) {
  const user = await requireRole('ADMIN')
  if (user instanceof NextResponse) return user

  const body = await req.json()
  const parsed = companySetupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION', message: parsed.error.message } },
      { status: 400 },
    )
  }

  const { prisma } = await import('@/lib/db')

  const updateData: Record<string, unknown> = {}
  if (parsed.data.companyName) updateData.deploy_name = parsed.data.companyName
  if (parsed.data.categories) updateData.categories = parsed.data.categories
  if (parsed.data.approvalRules) updateData.approval_rules = parsed.data.approvalRules

  if (Object.keys(updateData).length > 0) {
    await prisma.deployConfig.upsert({
      where: { id: 'default' },
      update: updateData,
      create: { id: 'default', ...updateData, enabled_modules: ['core'] },
    })
  }

  return NextResponse.json({ success: true })
}

export async function GET() {
  const user = await requireRole('ADMIN')
  if (user instanceof NextResponse) return user

  const { prisma } = await import('@/lib/db')

  const config = await prisma.deployConfig.findUnique({ where: { id: 'default' } })
  const vendorCount = await prisma.vendor.count()

  return NextResponse.json({
    success: true,
    data: {
      companyName: config?.deploy_name ?? 'ProcureFlow',
      categories: config?.categories ?? [],
      approvalRules: config?.approval_rules ?? null,
      vendorCount,
    },
  })
}
```

- [ ] **Step 4: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/onboarding/ src/lib/validations/onboarding.ts
git commit -m "feat(onboarding): add API routes for onboarding, team invite, company setup"
```

---

### Task 6: React Query Hook

**Files:**
- Create: `src/hooks/use-onboarding.ts`

Reference the existing hook pattern in `src/hooks/use-vendors.ts`.

- [ ] **Step 1: Create the onboarding hook**

Create `src/hooks/use-onboarding.ts`:

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import type { OnboardingState, TeamInviteResult } from '@/types/onboarding'
import type { CompleteOnboardingInput, TeamInviteInput, CompanySetupInput } from '@/lib/validations/onboarding'

const ONBOARDING_KEY = ['onboarding'] as const
const COMPANY_KEY = ['onboarding', 'company'] as const

export function useOnboardingState() {
  return useQuery({
    queryKey: ONBOARDING_KEY,
    queryFn: async (): Promise<OnboardingState> => {
      const res = await fetch('/api/onboarding')
      if (!res.ok) throw new Error('Errore caricamento onboarding')
      const json = await res.json()
      return json.data
    },
  })
}

export function useCompanySetup() {
  return useQuery({
    queryKey: COMPANY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/onboarding/company')
      if (!res.ok) throw new Error('Errore caricamento setup azienda')
      const json = await res.json()
      return json.data as {
        companyName: string
        categories: string[]
        approvalRules: { autoApproveThreshold: number; managerThreshold: number } | null
        vendorCount: number
      }
    },
  })
}

export function useCompleteOnboarding() {
  const qc = useQueryClient()
  const { update } = useSession()

  return useMutation({
    mutationFn: async (input: CompleteOnboardingInput) => {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Errore aggiornamento onboarding')
      return res.json()
    },
    onSuccess: async () => {
      await update()  // refresh JWT with new onboardingCompleted value
      qc.invalidateQueries({ queryKey: ONBOARDING_KEY })
    },
  })
}

export function useInviteTeam() {
  return useMutation({
    mutationFn: async (input: TeamInviteInput): Promise<TeamInviteResult[]> => {
      const res = await fetch('/api/onboarding/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Errore invito team')
      const json = await res.json()
      return json.data
    },
  })
}

export function useUpdateCompanySetup() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CompanySetupInput) => {
      const res = await fetch('/api/onboarding/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Errore aggiornamento setup')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPANY_KEY })
    },
  })
}
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-onboarding.ts
git commit -m "feat(onboarding): add React Query hooks for onboarding state management"
```

---

## Chunk 2: User Wizard (3 informational steps)

### Task 7: Wizard Shell (shared modal)

**Files:**
- Create: `src/components/onboarding/wizard-shell.tsx`

This is the reusable modal wrapper used by both user and admin wizards.

- [ ] **Step 1: Create the wizard shell**

Create `src/components/onboarding/wizard-shell.tsx`:

```typescript
'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface WizardShellProps {
  readonly currentStep: number
  readonly totalSteps: number
  readonly onNext: () => void
  readonly onBack: () => void
  readonly onSkip: () => void
  readonly nextLabel?: string
  readonly showBack?: boolean
  readonly showSkip?: boolean
  readonly optionalFrom?: number  // step index from which steps are optional (for admin)
  readonly children: React.ReactNode
}

export function WizardShell({
  currentStep,
  totalSteps,
  onNext,
  onBack,
  onSkip,
  nextLabel = 'Avanti',
  showBack = true,
  showSkip = true,
  optionalFrom,
  children,
}: WizardShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-pf-border bg-pf-bg-secondary shadow-2xl"
      >
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 border-b border-pf-border px-6 py-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === currentStep
                    ? 'bg-pf-accent'
                    : i < currentStep
                      ? 'bg-pf-accent/50'
                      : 'bg-pf-text-muted/30'
                }`}
              />
              {optionalFrom !== undefined && i >= optionalFrom && (
                <span className="text-[10px] text-pf-text-muted">opz.</span>
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-pf-border px-6 py-4">
          <div>
            {showSkip && (
              <button
                onClick={onSkip}
                className="text-sm text-pf-text-muted transition-colors hover:text-pf-text-secondary"
              >
                Salta
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {showBack && currentStep > 0 && (
              <button
                onClick={onBack}
                className="rounded-lg border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:bg-pf-bg-hover"
              >
                Indietro
              </button>
            )}
            <button
              onClick={onNext}
              className="rounded-lg bg-pf-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/wizard-shell.tsx
git commit -m "feat(onboarding): add shared wizard shell modal component"
```

---

### Task 8: User Wizard Steps

**Files:**
- Create: `src/components/onboarding/steps/welcome-step.tsx`
- Create: `src/components/onboarding/steps/how-it-works-step.tsx`
- Create: `src/components/onboarding/steps/get-started-step.tsx`

- [ ] **Step 1: Create welcome step**

Create `src/components/onboarding/steps/welcome-step.tsx`:

```typescript
'use client'

import { Sparkles } from 'lucide-react'

interface WelcomeStepProps {
  readonly userName: string
  readonly userRole: string
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Amministratore',
  MANAGER: 'Manager',
  REQUESTER: 'Richiedente',
  VIEWER: 'Osservatore',
}

export function WelcomeStep({ userName, userRole }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-pf-accent-subtle">
        <Sparkles className="h-10 w-10 text-pf-accent" />
      </div>
      <h2 className="mt-6 font-display text-2xl font-bold text-pf-text-primary">
        Benvenuto in ProcureFlow
      </h2>
      <p className="mt-2 text-lg text-pf-text-secondary">
        Ciao <span className="font-semibold text-pf-text-primary">{userName}</span>
      </p>
      <p className="mt-1 text-sm text-pf-text-muted">
        Il tuo ruolo: {ROLE_LABELS[userRole] ?? userRole}
      </p>
      <p className="mt-6 max-w-md text-pf-text-secondary">
        Il tuo hub centralizzato per il procurement. Gestisci richieste di acquisto,
        monitora consegne e collabora con il team — tutto in un unico posto.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Create how-it-works step**

Create `src/components/onboarding/steps/how-it-works-step.tsx`:

```typescript
'use client'

import { FileText, CheckCircle, ShoppingCart, Package } from 'lucide-react'

const STEPS = [
  { icon: FileText, label: 'Richiesta', desc: 'Crea una richiesta di acquisto', color: 'text-blue-400' },
  { icon: CheckCircle, label: 'Approvazione', desc: 'Il manager approva', color: 'text-amber-400' },
  { icon: ShoppingCart, label: 'Ordine', desc: 'Ordine al fornitore', color: 'text-pf-accent' },
  { icon: Package, label: 'Consegna', desc: 'Ricevi e conferma', color: 'text-emerald-400' },
] as const

export function HowItWorksStep() {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="font-display text-xl font-bold text-pf-text-primary">
        Come Funziona
      </h2>
      <p className="mt-2 text-sm text-pf-text-secondary">
        Ogni richiesta segue questo percorso. Tu puoi seguirla in tempo reale.
      </p>

      <div className="mt-8 flex w-full items-start justify-center gap-4">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          return (
            <div key={step.label} className="flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-pf-bg-tertiary">
                <Icon className={`h-7 w-7 ${step.color}`} />
              </div>
              <p className="text-sm font-semibold text-pf-text-primary">{step.label}</p>
              <p className="max-w-[120px] text-xs text-pf-text-muted">{step.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Arrow connectors */}
      <div className="mt-4 flex w-full max-w-md justify-between px-12">
        {[0, 1, 2].map((i) => (
          <div key={i} className="text-pf-text-muted/40">→</div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create get-started step**

Create `src/components/onboarding/steps/get-started-step.tsx`:

```typescript
'use client'

import { LayoutDashboard, Bell, Search } from 'lucide-react'

const TIPS = [
  {
    icon: LayoutDashboard,
    title: 'Sidebar',
    desc: 'Naviga tra richieste, fornitori e analytics dal menu laterale',
  },
  {
    icon: Bell,
    title: 'Notifiche',
    desc: 'Ricevi aggiornamenti in tempo reale su approvazioni e consegne',
  },
  {
    icon: Search,
    title: 'Ricerca ⌘K',
    desc: 'Cerca qualsiasi cosa rapidamente con la scorciatoia da tastiera',
  },
] as const

export function GetStartedStep() {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="font-display text-xl font-bold text-pf-text-primary">
        Sei Pronto!
      </h2>
      <p className="mt-2 text-sm text-pf-text-secondary">
        Ecco 3 cose da sapere per iniziare subito
      </p>

      <div className="mt-6 grid w-full gap-3">
        {TIPS.map((tip) => {
          const Icon = tip.icon
          return (
            <div
              key={tip.title}
              className="flex items-center gap-4 rounded-xl border border-pf-border bg-pf-bg-tertiary p-4 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pf-accent-subtle">
                <Icon className="h-5 w-5 text-pf-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-pf-text-primary">{tip.title}</p>
                <p className="text-xs text-pf-text-muted">{tip.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/steps/welcome-step.tsx src/components/onboarding/steps/how-it-works-step.tsx src/components/onboarding/steps/get-started-step.tsx
git commit -m "feat(onboarding): add 3 user wizard step components"
```

---

## Chunk 3: Admin Wizard (5 progressive steps)

### Task 9: Admin Step 1 — Company Info

**Files:**
- Create: `src/components/onboarding/steps/admin-company-step.tsx`

- [ ] **Step 1: Create admin company step**

Create `src/components/onboarding/steps/admin-company-step.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Building2 } from 'lucide-react'

interface AdminCompanyStepProps {
  readonly initialName: string
  readonly onSave: (companyName: string) => void
}

export function AdminCompanyStep({ initialName, onSave }: AdminCompanyStepProps) {
  const [name, setName] = useState(initialName)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pf-accent-subtle">
          <Building2 className="h-8 w-8 text-pf-accent" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-pf-text-primary">
          Info Azienda
        </h2>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Come si chiama la tua azienda?
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="company-name" className="block text-sm font-medium text-pf-text-secondary">
            Nome azienda
          </label>
          <input
            id="company-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              onSave(e.target.value)
            }}
            placeholder="Es: Acme S.r.l."
            className="mt-1 w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/steps/admin-company-step.tsx
git commit -m "feat(onboarding): add admin company step component"
```

---

### Task 10: Admin Step 2 — First Vendor

**Files:**
- Create: `src/components/onboarding/steps/admin-vendor-step.tsx`

Reference the vendor creation pattern in `src/components/vendors/vendor-create-dialog.tsx`.

- [ ] **Step 1: Create admin vendor step**

Create `src/components/onboarding/steps/admin-vendor-step.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Store, Plus, Check } from 'lucide-react'
import { useCreateVendor } from '@/hooks/use-vendors'

interface AdminVendorStepProps {
  readonly existingVendorCount: number
  readonly onVendorCreated: () => void
}

interface VendorForm {
  name: string
  email: string
  category: string
}

const EMPTY_FORM: VendorForm = { name: '', email: '', category: '' }

export function AdminVendorStep({ existingVendorCount, onVendorCreated }: AdminVendorStepProps) {
  const [form, setForm] = useState<VendorForm>(EMPTY_FORM)
  const [created, setCreated] = useState<string[]>([])
  const createVendor = useCreateVendor()

  const hasVendors = existingVendorCount > 0 || created.length > 0

  async function handleAdd() {
    if (!form.name.trim()) return
    try {
      // Auto-generate vendor code: VND-<timestamp>
      const code = `VND-${Date.now().toString(36).toUpperCase()}`
      await createVendor.mutateAsync({
        name: form.name,
        code,
        email: form.email || undefined,
        category: form.category ? [form.category] : [],
      })
      setCreated((prev) => [...prev, form.name])
      setForm(EMPTY_FORM)
      onVendorCreated()
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pf-accent-subtle">
          <Store className="h-8 w-8 text-pf-accent" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-pf-text-primary">
          Primo Fornitore
        </h2>
        <p className="mt-1 text-sm text-pf-text-secondary">
          {existingVendorCount > 0
            ? `Hai già ${existingVendorCount} fornitori. Vuoi aggiungerne altri?`
            : 'Aggiungi almeno un fornitore per iniziare'}
        </p>
      </div>

      {/* Created vendors list */}
      {created.length > 0 && (
        <div className="space-y-2">
          {created.map((name) => (
            <div key={name} className="flex items-center gap-2 rounded-lg bg-pf-bg-tertiary px-3 py-2 text-sm">
              <Check className="h-4 w-4 text-pf-success" />
              <span className="text-pf-text-primary">{name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add vendor form */}
      <div className="space-y-3">
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Nome fornitore *"
          className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
        />
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Email (opzionale)"
          className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
        />
        <input
          type="text"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          placeholder="Categoria (es: IT, Ufficio)"
          className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
        />
        <button
          onClick={handleAdd}
          disabled={!form.name.trim() || createVendor.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-pf-border py-2.5 text-sm font-medium text-pf-text-secondary transition-colors hover:border-pf-accent hover:text-pf-accent disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {createVendor.isPending ? 'Creazione...' : 'Aggiungi fornitore'}
        </button>
        {createVendor.isError && (
          <p className="text-xs text-pf-danger">Errore nella creazione del fornitore</p>
        )}
      </div>

      {!hasVendors && (
        <p className="text-center text-xs text-pf-text-muted">
          Serve almeno un fornitore per continuare
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

Expected: 0 errors. If `useCreateVendor` has a different API shape, adjust the `mutateAsync` call accordingly.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/steps/admin-vendor-step.tsx
git commit -m "feat(onboarding): add admin vendor step component"
```

---

### Task 11: Admin Step 3 — Invite Team

**Files:**
- Create: `src/components/onboarding/steps/admin-team-step.tsx`

- [ ] **Step 1: Create admin team step**

Create `src/components/onboarding/steps/admin-team-step.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Users, Plus, X, Copy, Check } from 'lucide-react'
import { useInviteTeam } from '@/hooks/use-onboarding'
import type { TeamInviteResult } from '@/types/onboarding'

interface InviteRow {
  name: string
  email: string
  role: 'REQUESTER' | 'MANAGER' | 'VIEWER'
}

const EMPTY_ROW: InviteRow = { name: '', email: '', role: 'REQUESTER' }

export function AdminTeamStep() {
  const [rows, setRows] = useState<InviteRow[]>([{ ...EMPTY_ROW }])
  const [results, setResults] = useState<TeamInviteResult[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const inviteTeam = useInviteTeam()

  function updateRow(index: number, field: keyof InviteRow, value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  function addRow() {
    setRows((prev) => [...prev, { ...EMPTY_ROW }])
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleInvite() {
    const validRows = rows.filter((r) => r.name.trim() && r.email.trim())
    if (validRows.length === 0) return

    const data = await inviteTeam.mutateAsync({ invites: validRows })
    setResults(data)
  }

  function copyPassword(password: string, idx: number) {
    navigator.clipboard.writeText(password)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  // Show results after invite
  if (results.length > 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-xl font-bold text-pf-text-primary">
            Team Invitato
          </h2>
          <p className="mt-1 text-sm text-pf-text-secondary">
            Condividi le password con i tuoi colleghi — sono visibili solo ora
          </p>
        </div>

        <div className="space-y-3">
          {results.map((r, i) => (
            <div
              key={r.email}
              className={`rounded-lg border p-3 ${r.success ? 'border-pf-success/30 bg-pf-success/5' : 'border-pf-danger/30 bg-pf-danger/5'}`}
            >
              <p className="text-sm font-medium text-pf-text-primary">{r.email}</p>
              {r.success ? (
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded bg-pf-bg-tertiary px-2 py-1 font-mono text-xs text-pf-text-secondary">
                    {r.password}
                  </code>
                  <button
                    onClick={() => copyPassword(r.password, i)}
                    className="rounded p-1 text-pf-text-muted transition-colors hover:text-pf-text-primary"
                  >
                    {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-pf-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-pf-danger">{r.error}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pf-accent-subtle">
          <Users className="h-8 w-8 text-pf-accent" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-pf-text-primary">
          Invita il Team
        </h2>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Aggiungi i colleghi che useranno ProcureFlow
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={row.name}
                onChange={(e) => updateRow(i, 'name', e.target.value)}
                placeholder="Nome"
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
              />
              <input
                type="email"
                value={row.email}
                onChange={(e) => updateRow(i, 'email', e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
              />
            </div>
            <select
              value={row.role}
              onChange={(e) => updateRow(i, 'role', e.target.value)}
              className="rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
            >
              <option value="REQUESTER">Richiedente</option>
              <option value="MANAGER">Manager</option>
              <option value="VIEWER">Osservatore</option>
            </select>
            {rows.length > 1 && (
              <button
                onClick={() => removeRow(i)}
                className="mt-2 rounded p-1 text-pf-text-muted transition-colors hover:text-pf-danger"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={addRow}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-pf-border py-2 text-sm text-pf-text-secondary transition-colors hover:border-pf-accent hover:text-pf-accent"
        >
          <Plus className="h-4 w-4" />
          Aggiungi altro
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={handleInvite}
          disabled={inviteTeam.isPending || !rows.some((r) => r.name.trim() && r.email.trim())}
          className="rounded-lg bg-pf-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
        >
          {inviteTeam.isPending ? 'Invio...' : 'Invia inviti'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/steps/admin-team-step.tsx
git commit -m "feat(onboarding): add admin team invite step component"
```

---

### Task 12: Admin Step 4 — Categories & Budget (optional)

**Files:**
- Create: `src/components/onboarding/steps/admin-categories-step.tsx`

- [ ] **Step 1: Create admin categories step**

Create `src/components/onboarding/steps/admin-categories-step.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Tags, Plus, X } from 'lucide-react'

const DEFAULT_CATEGORIES = [
  'IT & Tecnologia',
  'Ufficio & Cancelleria',
  'Marketing & Comunicazione',
  'Produzione & Materiali',
  'Servizi Professionali',
  'Altro',
]

interface AdminCategoriesStepProps {
  readonly initialCategories: string[]
  readonly onSave: (categories: string[]) => void
}

export function AdminCategoriesStep({ initialCategories, onSave }: AdminCategoriesStepProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialCategories.length > 0 ? initialCategories : DEFAULT_CATEGORIES)
  )
  const [custom, setCustom] = useState('')

  function toggle(cat: string) {
    const next = new Set(selected)
    if (next.has(cat)) {
      next.delete(cat)
    } else {
      next.add(cat)
    }
    setSelected(next)
    onSave(Array.from(next))
  }

  function addCustom() {
    if (!custom.trim() || selected.has(custom.trim())) return
    const next = new Set(selected)
    next.add(custom.trim())
    setSelected(next)
    onSave(Array.from(next))
    setCustom('')
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pf-accent-subtle">
          <Tags className="h-8 w-8 text-pf-accent" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-pf-text-primary">
          Categorie Merceologiche
        </h2>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Seleziona le categorie che usi per classificare gli acquisti
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DEFAULT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => toggle(cat)}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              selected.has(cat)
                ? 'border-pf-accent bg-pf-accent-subtle text-pf-accent'
                : 'border-pf-border text-pf-text-muted hover:border-pf-border-hover'
            }`}
          >
            {cat}
          </button>
        ))}
        {/* Custom categories */}
        {Array.from(selected)
          .filter((c) => !DEFAULT_CATEGORIES.includes(c))
          .map((cat) => (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              className="flex items-center gap-1 rounded-full border border-pf-accent bg-pf-accent-subtle px-4 py-2 text-sm text-pf-accent"
            >
              {cat}
              <X className="h-3 w-3" />
            </button>
          ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          placeholder="Aggiungi categoria personalizzata"
          className="flex-1 rounded-lg border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
        />
        <button
          onClick={addCustom}
          disabled={!custom.trim()}
          className="rounded-lg border border-pf-border p-2 text-pf-text-secondary transition-colors hover:border-pf-accent hover:text-pf-accent disabled:opacity-50"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/steps/admin-categories-step.tsx
git commit -m "feat(onboarding): add admin categories step component"
```

---

### Task 13: Admin Step 5 — Approval Rules (optional)

**Files:**
- Create: `src/components/onboarding/steps/admin-approvals-step.tsx`

- [ ] **Step 1: Create admin approvals step**

Create `src/components/onboarding/steps/admin-approvals-step.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Shield, CheckCircle, UserCheck, Users } from 'lucide-react'
import type { ApprovalRules } from '@/types/onboarding'

interface AdminApprovalsStepProps {
  readonly initialRules: ApprovalRules | null
  readonly onSave: (rules: ApprovalRules) => void
}

export function AdminApprovalsStep({ initialRules, onSave }: AdminApprovalsStepProps) {
  const [rules, setRules] = useState<ApprovalRules>(
    initialRules ?? { autoApproveThreshold: 500, managerThreshold: 5000 }
  )

  function updateField(field: keyof ApprovalRules, value: string) {
    const num = Number(value) || 0
    const next = { ...rules, [field]: num }
    setRules(next)
    onSave(next)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pf-accent-subtle">
          <Shield className="h-8 w-8 text-pf-accent" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold text-pf-text-primary">
          Regole di Approvazione
        </h2>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Configura le soglie per l&apos;approvazione automatica
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-pf-text-secondary">
            Soglia auto-approvazione (EUR)
          </label>
          <p className="mb-2 text-xs text-pf-text-muted">
            Richieste sotto questo importo vengono approvate automaticamente
          </p>
          <input
            type="number"
            value={rules.autoApproveThreshold}
            onChange={(e) => updateField('autoApproveThreshold', e.target.value)}
            min={0}
            step={100}
            className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-pf-text-secondary">
            Soglia approvazione manager (EUR)
          </label>
          <p className="mb-2 text-xs text-pf-text-muted">
            Richieste sopra questo importo richiedono approvazione del manager
          </p>
          <input
            type="number"
            value={rules.managerThreshold}
            onChange={(e) => updateField('managerThreshold', e.target.value)}
            min={0}
            step={500}
            className="w-full rounded-lg border border-pf-border bg-pf-bg-tertiary px-4 py-2.5 text-sm text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-2 focus:ring-pf-accent/40"
          />
        </div>
      </div>

      {/* Visual preview */}
      <div className="rounded-xl border border-pf-border bg-pf-bg-tertiary p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-pf-text-muted">
          Anteprima catena approvativa
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm text-pf-text-primary">
                Sotto {rules.autoApproveThreshold.toLocaleString('it-IT')}€
              </p>
              <p className="text-xs text-pf-text-muted">Approvazione automatica</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-sm text-pf-text-primary">
                {rules.autoApproveThreshold.toLocaleString('it-IT')}€ — {rules.managerThreshold.toLocaleString('it-IT')}€
              </p>
              <p className="text-xs text-pf-text-muted">Richiede approvazione manager</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-sm text-pf-text-primary">
                Oltre {rules.managerThreshold.toLocaleString('it-IT')}€
              </p>
              <p className="text-xs text-pf-text-muted">Richiede approvazione direzione</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/steps/admin-approvals-step.tsx
git commit -m "feat(onboarding): add admin approval rules step component"
```

---

## Chunk 4: Wizard Container, Banner, Settings, Layout Integration

### Task 14: Onboarding Wizard Container

**Files:**
- Create: `src/components/onboarding/onboarding-wizard.tsx`

This is the main orchestrator: reads session role, shows user or admin wizard, manages step state machine, calls APIs.

- [ ] **Step 1: Create the onboarding wizard**

Create `src/components/onboarding/onboarding-wizard.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { WizardShell } from './wizard-shell'
import { WelcomeStep } from './steps/welcome-step'
import { HowItWorksStep } from './steps/how-it-works-step'
import { GetStartedStep } from './steps/get-started-step'
import { AdminCompanyStep } from './steps/admin-company-step'
import { AdminVendorStep } from './steps/admin-vendor-step'
import { AdminTeamStep } from './steps/admin-team-step'
import { AdminCategoriesStep } from './steps/admin-categories-step'
import { AdminApprovalsStep } from './steps/admin-approvals-step'
import { useCompleteOnboarding, useCompanySetup, useUpdateCompanySetup } from '@/hooks/use-onboarding'
import type { ApprovalRules } from '@/types/onboarding'
import type { CompanySetupInput } from '@/lib/validations/onboarding'
import { REQUIRED_ADMIN_STEPS } from '@/types/onboarding'

interface OnboardingWizardProps {
  /** If provided, start admin wizard at this step index (for banner "Completa ora") */
  readonly startAtStep?: number
}

export function OnboardingWizard({ startAtStep }: OnboardingWizardProps) {
  const { data: session } = useSession()
  const completeOnboarding = useCompleteOnboarding()
  const companySetup = useCompanySetup()
  const updateCompany = useUpdateCompanySetup()

  const isAdmin = session?.user?.role === 'ADMIN'
  const showWizard = session?.user?.onboardingCompleted === false

  const [step, setStep] = useState(startAtStep ?? 0)
  const [vendorAdded, setVendorAdded] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [approvalRules, setApprovalRules] = useState<ApprovalRules | null>(null)

  const totalSteps = isAdmin ? 5 : 3

  const handleComplete = useCallback(async (completedSteps?: string[]) => {
    // Save company setup if admin
    if (isAdmin) {
      const payload: CompanySetupInput = {
        ...(companyName ? { companyName } : {}),
        ...(categories.length > 0 ? { categories } : {}),
        ...(approvalRules ? { approvalRules } : {}),
      }
      if (companyName || categories.length > 0 || approvalRules) {
        await updateCompany.mutateAsync(payload)
      }
    }

    await completeOnboarding.mutateAsync({
      completed: true,
      completedSteps,
    })
  }, [isAdmin, companyName, categories, approvalRules, updateCompany, completeOnboarding])

  const handleNext = useCallback(async () => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1)
      return
    }

    // Last step — complete
    if (isAdmin) {
      const steps = [...REQUIRED_ADMIN_STEPS.filter((s) => {
        if (s === 'vendor') return vendorAdded || (companySetup.data?.vendorCount ?? 0) > 0
        return true
      })]
      if (categories.length > 0) steps.push('categories')
      if (approvalRules) steps.push('approvals')
      await handleComplete(steps)
    } else {
      await handleComplete()
    }
  }, [step, totalSteps, isAdmin, vendorAdded, companySetup.data, categories, approvalRules, handleComplete])

  const handleSkip = useCallback(async () => {
    if (isAdmin) {
      // If skipping from mandatory steps (0-2), complete with only done steps
      const steps = step >= 3
        ? [...REQUIRED_ADMIN_STEPS]
        : REQUIRED_ADMIN_STEPS.slice(0, step).filter(Boolean)
      await handleComplete(steps.length > 0 ? steps : undefined)
    } else {
      await handleComplete()
    }
  }, [isAdmin, step, handleComplete])

  const handleBack = useCallback(() => {
    if (step > 0) setStep((s) => s - 1)
  }, [step])

  if (!showWizard || !session?.user) return null

  // Determine next button label for admin wizard
  function getNextLabel(): string {
    if (!isAdmin) return step === totalSteps - 1 ? 'Inizia ad esplorare' : 'Avanti'
    if (step === 2) return 'Completa setup'
    if (step >= 3) return step === 4 ? 'Completa setup' : 'Avanti'
    return 'Avanti'
  }

  // Can proceed?
  function canProceed(): boolean {
    if (!isAdmin) return true
    if (step === 1) return vendorAdded || (companySetup.data?.vendorCount ?? 0) > 0
    return true
  }

  return (
    <WizardShell
      currentStep={step}
      totalSteps={totalSteps}
      onNext={canProceed() ? handleNext : () => {}}
      onBack={handleBack}
      onSkip={handleSkip}
      nextLabel={getNextLabel()}
      showBack={step > 0}
      showSkip
      optionalFrom={isAdmin ? 3 : undefined}
    >
      {/* User wizard steps */}
      {!isAdmin && step === 0 && (
        <WelcomeStep userName={session.user.name ?? ''} userRole={session.user.role ?? 'VIEWER'} />
      )}
      {!isAdmin && step === 1 && <HowItWorksStep />}
      {!isAdmin && step === 2 && <GetStartedStep />}

      {/* Admin wizard steps */}
      {isAdmin && step === 0 && (
        <AdminCompanyStep
          initialName={companySetup.data?.companyName ?? 'ProcureFlow'}
          onSave={setCompanyName}
        />
      )}
      {isAdmin && step === 1 && (
        <AdminVendorStep
          existingVendorCount={companySetup.data?.vendorCount ?? 0}
          onVendorCreated={() => setVendorAdded(true)}
        />
      )}
      {isAdmin && step === 2 && <AdminTeamStep />}
      {isAdmin && step === 3 && (
        <AdminCategoriesStep
          initialCategories={companySetup.data?.categories ?? []}
          onSave={setCategories}
        />
      )}
      {isAdmin && step === 4 && (
        <AdminApprovalsStep
          initialRules={companySetup.data?.approvalRules ?? null}
          onSave={setApprovalRules}
        />
      )}
    </WizardShell>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

Expected: 0 errors. May need minor adjustments based on actual type shapes from hooks.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/onboarding-wizard.tsx
git commit -m "feat(onboarding): add main wizard container with role routing and step state machine"
```

---

### Task 15: Setup Banner

**Files:**
- Create: `src/components/onboarding/setup-banner.tsx`

- [ ] **Step 1: Create the setup banner**

Create `src/components/onboarding/setup-banner.tsx`:

```typescript
'use client'

import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Info, X } from 'lucide-react'
import { useOnboardingState, useCompleteOnboarding } from '@/hooks/use-onboarding'
import { OPTIONAL_ADMIN_STEPS } from '@/types/onboarding'
import type { OnboardingData } from '@/types/onboarding'

interface SetupBannerProps {
  readonly onCompleteSetup?: () => void
}

export function SetupBanner({ onCompleteSetup }: SetupBannerProps) {
  const { data: session } = useSession()
  const { data: state } = useOnboardingState()
  const completeOnboarding = useCompleteOnboarding()
  const [dismissed, setDismissed] = useState(false)

  const isAdmin = session?.user?.role === 'ADMIN'
  const onboardingData = state?.data as OnboardingData | null
  const completedSteps = onboardingData?.completedSteps ?? []

  const missingOptional = useMemo(
    () => OPTIONAL_ADMIN_STEPS.filter((s) => !completedSteps.includes(s)),
    [completedSteps],
  )

  // Check if banner was dismissed today
  const isDismissedToday = useMemo(() => {
    if (!onboardingData?.dismissedUntil) return false
    return new Date(onboardingData.dismissedUntil) > new Date()
  }, [onboardingData?.dismissedUntil])

  // Only show for admins with incomplete optional steps
  if (!isAdmin || !state?.isComplete || missingOptional.length === 0 || dismissed || isDismissedToday) {
    return null
  }

  const STEP_LABELS: Record<string, string> = {
    categories: 'Categorie',
    approvals: 'Regole approvazione',
  }

  const missingLabels = missingOptional.map((s) => STEP_LABELS[s] ?? s).join(' e ')

  async function handleDismiss() {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)

    await completeOnboarding.mutateAsync({
      completed: true,
      completedSteps,
      dismissedUntil: tomorrow.toISOString(),
    })
    setDismissed(true)
  }

  return (
    <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl border border-pf-accent/30 bg-pf-accent-subtle px-4 py-3">
      <Info className="h-5 w-5 shrink-0 text-pf-accent" />
      <p className="flex-1 text-sm text-pf-text-secondary">
        Completa la configurazione — <span className="font-medium text-pf-text-primary">{missingLabels}</span> non ancora configurate
      </p>
      <button
        onClick={onCompleteSetup}
        className="shrink-0 rounded-lg bg-pf-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-pf-accent-hover"
      >
        Completa ora
      </button>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded p-1 text-pf-text-muted transition-colors hover:text-pf-text-secondary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/onboarding/setup-banner.tsx
git commit -m "feat(onboarding): add setup completion banner for admin dashboard"
```

---

### Task 16: Mount in Dashboard Layout

**Files:**
- Modify: `src/components/layout/dashboard-shell.tsx`

Read the file first to find exact insertion points.

- [ ] **Step 1: Read current dashboard-shell.tsx**

Read `src/components/layout/dashboard-shell.tsx` to understand the component tree. The wizard should be mounted after `<MfaGuard>` (security first), and the banner should appear at the top of the content area.

- [ ] **Step 2: Add imports**

Add to the imports section of `dashboard-shell.tsx`:

```typescript
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'
import { SetupBanner } from '@/components/onboarding/setup-banner'
```

- [ ] **Step 3: Mount wizard and banner**

Inside the component's JSX:
- Add `<OnboardingWizard />` as a sibling of `<MfaGuard>` (after it, inside the same container)
- Add `<SetupBanner />` above `{children}` inside the content area

The exact placement depends on the current JSX structure — adjust after reading the file.

- [ ] **Step 4: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/dashboard-shell.tsx
git commit -m "feat(onboarding): mount wizard and banner in dashboard layout"
```

---

### Task 17: Update Settings Page

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Replace settings page stub**

Replace the stub content in `src/app/(dashboard)/settings/page.tsx` with an onboarding section:

```typescript
'use client'

import { useSession } from 'next-auth/react'
import { RotateCcw } from 'lucide-react'
import { PageTransition } from '@/components/shared/page-transition'
import { useCompleteOnboarding } from '@/hooks/use-onboarding'

export default function SettingsPage() {
  const { data: session } = useSession()
  const completeOnboarding = useCompleteOnboarding()
  const isAdmin = session?.user?.role === 'ADMIN'

  async function handleRelaunchWizard() {
    await completeOnboarding.mutateAsync({
      completed: false,
    })
    // Page will re-render, wizard will appear since onboardingCompleted = false
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            Impostazioni
          </h1>
          <p className="mt-1 text-sm text-pf-text-secondary">
            Configura il tuo account e le preferenze
          </p>
        </div>

        {/* Onboarding section — admin only */}
        {isAdmin && (
          <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
            <h2 className="font-display text-lg font-semibold text-pf-text-primary">
              Onboarding
            </h2>
            <p className="mt-1 text-sm text-pf-text-secondary">
              Rilancia il wizard di configurazione iniziale
            </p>
            <button
              onClick={handleRelaunchWizard}
              disabled={completeOnboarding.isPending}
              className="mt-4 flex items-center gap-2 rounded-lg border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              {completeOnboarding.isPending ? 'Riavvio...' : 'Rilancia wizard'}
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx
git commit -m "feat(onboarding): add wizard relaunch to settings page"
```

---

### Task 18: Update Seed Data

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Set onboarding_completed for existing seed users**

In `prisma/seed.ts`, find the user creation calls and add `onboarding_completed: true` to all seeded users (they don't need onboarding since they're pre-configured demo data).

- [ ] **Step 2: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(onboarding): mark seed users as onboarding completed"
```

---

### Task 19: Final Verification

- [ ] **Step 1: Type check**

Run:
```bash
cd procureflow && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Build**

Run:
```bash
cd procureflow && npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Run migration and seed**

Run:
```bash
cd procureflow && npx prisma migrate dev && npx prisma db seed
```

Expected: Migration applied, seed data inserted.

- [ ] **Step 4: Manual smoke test**

Start the app (`npm run dev`) and verify:
1. Login as seed admin user → wizard should NOT appear (seeded user has `onboarding_completed: true`)
2. Go to Settings → "Rilancia wizard" button visible
3. Click "Rilancia wizard" → wizard appears with 5 admin steps
4. Complete wizard → wizard disappears
5. Create a new user via admin step 3 invite → login as that user → user wizard appears (3 steps)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(onboarding): final integration and verification"
```
