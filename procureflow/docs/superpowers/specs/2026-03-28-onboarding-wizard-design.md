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

Two new fields on the existing `User` model:

```prisma
model User {
  // ... existing fields ...
  onboarding_completed  Boolean   @default(false)
  onboarding_data       Json?     // { completedSteps: string[], dismissedUntil?: string }
}
```

- `onboarding_completed = false` → wizard appears on login
- `onboarding_completed = true` → wizard dismissed
- `onboarding_data.completedSteps` tracks which admin steps were completed
- `onboarding_data.dismissedUntil` tracks banner dismissal timestamp

### Logic

- New user → `onboarding_completed = false` → wizard on first login
- User finishes wizard → `onboarding_completed = true`
- Admin skips optional steps → `completedSteps` excludes them → banner visible
- Relaunch from Settings → `onboarding_completed = false`

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

- Input: company name, logo upload (optional)
- Saved in `onboarding_data`

### Step 2 — Primo Fornitore (mandatory)

- Inline form to create a vendor: name, email, category
- Reuses existing vendor creation logic
- Validation: at least 1 vendor created to proceed
- Auto-skip option if seed vendors already exist

### Step 3 — Invita Team (mandatory)

- Email + role selector (REQUESTER/MANAGER/VIEWER)
- "Aggiungi" button for multiple rows
- Creates users with temporary password
- Minimum 1 invite to proceed, or "Sono solo per ora" to skip

### Step 4 — Categorie & Budget (optional)

- 6 pre-configured categories with checkboxes (IT, Ufficio, Marketing, Produzione, Servizi, Altro)
- Option to add custom categories
- Optional budget per category (amount + period)
- "Configura dopo" to skip

### Step 5 — Regole Approvazione (optional)

- Simplified thresholds: below X€ auto-approval, above Y€ requires manager
- Visual preview of the approval chain
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
| `prisma/schema.prisma` | +2 fields on User |
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

---

## Non-Goals

- No email-based invite flow (users are created directly)
- No onboarding analytics/tracking
- No A/B testing of wizard variations
- No multi-language support (Italian only for now)
- No changes to existing seed data flow
