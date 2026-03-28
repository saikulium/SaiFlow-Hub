# Onboarding Wizard — Design Spec

## Overview

Guided onboarding system for ProcureFlow with two distinct flows:

1. **Admin Wizard** — 5-step progressive setup (3 mandatory + 2 optional)
2. **User Wizard** — 3-step informational tour (modal)

The team does the initial base setup; the admin can relaunch the wizard at any time to complete or modify configuration.

## Decisions

| Question | Answer |
|----------|--------|
| Who is it for? | Both admin and end users |
| Who does the setup? | Mix — team does base, admin can relaunch |
| End user experience | Modal wizard, 3 informational steps, zero input |
| Admin wizard | Progressive: 3 mandatory + 2 optional steps |
| Architecture | State machine with DB flag on User model |

---

## Data Model

### Consolidated Prisma Migration

All schema changes in a single migration:

```prisma
// User model — add 2 fields
model User {
  // ... existing fields ...
  onboarding_completed  Boolean   @default(false)
  onboarding_data       Json?     // OnboardingData (see TypeScript type below)
}

// DeployConfig model — add 3 fields
model DeployConfig {
  // ... existing fields ...
  company_logo_url  String?       // URL to uploaded logo
  categories        String[]      // e.g. ["IT", "Ufficio", "Marketing", ...]
  approval_rules    Json?         // ApprovalRules (see TypeScript type below)
}
```

### TypeScript types

```typescript
interface OnboardingData {
  completedSteps: string[]           // e.g. ["company", "vendor", "team", "categories", "approvals"]
  dismissedUntil?: string            // ISO 8601 timestamp for banner dismiss
  companyName?: string               // from admin step 1 (also saved to DeployConfig)
}
```

### DeployConfig changes

Company-level info from admin step 1 is persisted in the existing `DeployConfig` model (tenant-scoped, not per-user):

```prisma
model DeployConfig {
  // ... existing fields ...
  company_logo_url  String?          // URL to uploaded logo (local /uploads or S3)
}
```

`deploy_name` (already exists) stores the company name. `company_logo_url` is a new field for the logo. Logo upload is served via an API route (`/api/uploads/logo`) that stores the file in a `data/uploads/` directory outside `/public` (avoids Next.js static build issues). Max 2MB, formats: PNG/JPG/SVG.

### Session/JWT integration

`onboarding_completed` is added to the JWT token and session object to avoid an extra API call on every page load:

- In `auth.ts` jwt callback: persist `token.onboardingCompleted = user.onboarding_completed` on sign-in
- In `auth.ts` session callback: expose `session.user.onboardingCompleted`
- After wizard completion: call `session.update()` to refresh the JWT via `trigger: 'update'`
- Types: extend `next-auth.d.ts` with `onboardingCompleted: boolean`

### Logic

- New user → `onboarding_completed = false` → wizard appears on first page load
- User finishes wizard → API PATCH sets `onboarding_completed = true` → `session.update()` refreshes JWT
- Admin skips optional steps → `completedSteps` excludes them → banner visible
- Relaunch from Settings → resets `onboarding_completed = false` → `session.update()`

---

## User Wizard (REQUESTER / VIEWER / MANAGER)

Full-screen modal, 3 informational steps, no input required.

### Step 1 — Benvenuto

- Title: "Benvenuto in ProcureFlow"
- Subtitle personalized with user name and role
- Hero illustration/icon
- Brief text: "Il tuo hub centralizzato per il procurement"

### Step 2 — Come Funziona

- Visual diagram of the cycle: Richiesta → Approvazione → Ordine → Consegna
- 4 icons with labels showing the flow
- Text: "Ogni richiesta segue questo percorso. Tu puoi seguirla in tempo reale."

### Step 3 — Inizia

- 3 mini-cards: Sidebar navigation, Notifiche, Ricerca (⌘K)
- CTA: "Inizia ad esplorare" → closes wizard, marks completed

### Behavior

- Progress bar at top (1/3, 2/3, 3/3)
- "Avanti" / "Indietro" buttons
- "Salta" always visible → closes and marks completed
- Fade animation between steps (framer-motion)
- Backdrop blur, not closable by clicking outside

---

## Admin Wizard (5 progressive steps)

Full-screen modal. Steps 1-3 mandatory, steps 4-5 optional.

### Step 1 — Info Azienda (mandatory)

- Input: company name (pre-filled from `DeployConfig.deploy_name`), logo upload (optional, max 2MB PNG/JPG/SVG)
- Company name saved to `DeployConfig.deploy_name`, logo to `DeployConfig.company_logo_url`
- Step marked in `onboarding_data.completedSteps` as `"company"`

### Step 2 — Primo Fornitore (mandatory)

- Inline form to create a vendor: name, email, category
- Reuses existing vendor creation logic
- Validation: at least 1 vendor created to proceed
- Auto-skip detection: if `Vendor.count() > 0`, show "Hai già N fornitori — vuoi aggiungerne altri?" with option to skip

### Step 3 — Invita Team (mandatory)

- Email + name + role selector (REQUESTER/MANAGER/VIEWER)
- "Aggiungi" button for multiple rows
- Creates users via API with auto-generated password (16-char random via `crypto.randomBytes`)
- Password generated via `crypto.randomBytes(12).toString('base64url')` (16 chars, URL-safe)
- Password is shown once in a copyable card after creation — admin must share it manually (no email flow)
- Created users have `onboarding_completed = false` so they see the user wizard on first login
- No forced password change for MVP (listed as future enhancement)
- Minimum 1 invite to proceed, or "Sono solo per ora" to skip

### Step 4 — Categorie & Budget (optional)

- 6 pre-configured categories with checkboxes (IT, Ufficio, Marketing, Produzione, Servizi, Altro)
- Option to add custom categories
- Categories are stored in `DeployConfig` as a new `categories String[]` field — these become the dropdown options in request forms (maps to `PurchaseRequest.category`)
- Optional budget per category: creates `Budget` records using `cost_center = category name` as the mapping key, with `period_start`/`period_end` set to current fiscal year
- "Configura dopo" to skip

### Step 5 — Regole Approvazione (optional)

- Simplified thresholds: below X€ auto-approval, above Y€ requires manager
- Rules stored in `DeployConfig` as a new `approval_rules Json?` field:
  ```typescript
  interface ApprovalRules {
    autoApproveThreshold: number    // e.g. 500 — below this, auto-approve
    managerThreshold: number        // e.g. 5000 — above this, requires manager
  }
  ```
- Visual preview of the approval chain
- These rules are read by the approval webhook (`/api/webhooks/approval-response`) to determine routing
- "Configura dopo" to skip

### Behavior

- Progress bar with 5 dots, last 2 with "opzionale" badge
- After step 3: button changes from "Avanti" to "Completa setup" + "Continua configurazione" link
- Skipped optional steps → `onboarding_data.completedSteps` excludes them

---

## Setup Banner

Persistent banner for ADMIN when optional steps are incomplete.

- **Position**: top of dashboard, below header
- **Style**: `pf-accent-subtle` background, `pf-accent` border, info icon
- **Text**: "Completa la configurazione — Categorie e regole approvazione non ancora configurate"
- **CTA**: "Completa ora" → reopens wizard at step 4
- **Dismiss**: "Nascondi per oggi" → saves timestamp in `onboarding_data.dismissedUntil`
- **Disappears**: permanently when all steps completed

---

## Relaunch from Settings

- Settings page → "Onboarding" section
- "Rilancia wizard" button → resets `onboarding_completed = false`
- Only ADMIN can relaunch for themselves

---

## File Map

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | +2 fields on User, +2 fields on DeployConfig (see Data Model section) |
| `src/components/onboarding/onboarding-wizard.tsx` | Wizard container with step logic and role routing |
| `src/components/onboarding/steps/welcome-step.tsx` | User step 1 — welcome |
| `src/components/onboarding/steps/how-it-works-step.tsx` | User step 2 — how it works |
| `src/components/onboarding/steps/get-started-step.tsx` | User step 3 — get started |
| `src/components/onboarding/steps/admin-company-step.tsx` | Admin step 1 — company info |
| `src/components/onboarding/steps/admin-vendor-step.tsx` | Admin step 2 — first vendor |
| `src/components/onboarding/steps/admin-team-step.tsx` | Admin step 3 — invite team |
| `src/components/onboarding/steps/admin-categories-step.tsx` | Admin step 4 — categories & budget (optional) |
| `src/components/onboarding/steps/admin-approvals-step.tsx` | Admin step 5 — approval rules (optional) |
| `src/components/onboarding/setup-banner.tsx` | Dashboard banner for incomplete setup |
| `src/app/api/onboarding/route.ts` | API PATCH to save onboarding state |
| `src/hooks/use-onboarding.ts` | Client hook for state + mutations |
| `src/app/(dashboard)/layout.tsx` | Mount wizard + banner |
| `src/app/(dashboard)/settings/page.tsx` | Add "Rilancia wizard" button in settings |
| `src/types/next-auth.d.ts` | Add `onboardingCompleted` to session types |
| `src/lib/auth.ts` | Add `onboardingCompleted` to JWT/session callbacks |

---

## Non-Goals

- No email-based invite flow (users are created directly, password shared manually)
- No forced password change on first login (future enhancement)
- No onboarding analytics/tracking
- No A/B testing of wizard variations
- No multi-language support (Italian only for now)
- No changes to existing seed data flow
- No S3/external storage for logo (uses local `data/uploads/` served via API route for MVP)
