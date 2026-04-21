# CLAUDE.md — Procurement Hub Project

## 🧭 Identità del Progetto

Questo è **ProcureFlow** — un hub centralizzato di procurement per PMI italiane.
Il sistema orchestra richieste di acquisto multi-vendor, automatizza il tracking
e fornisce visibilità totale sul ciclo di procurement tramite un'interfaccia moderna.

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Prisma + PostgreSQL + n8n**

---

## 📐 Architettura di Riferimento

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (Next.js)                │
│  Dashboard ← Requests ← Vendors ← Analytics        │
├─────────────────────────────────────────────────────┤
│                   API LAYER (tRPC / API Routes)     │
├─────────────────────────────────────────────────────┤
│  Prisma ORM  ←→  PostgreSQL                        │
├─────────────────────────────────────────────────────┤
│  n8n Workflows (webhook triggers + scheduled jobs)  │
│  ├── Email Ingestion (IMAP polling)                 │
│  ├── Vendor Portal Scraping / API polling           │
│  ├── Alert & Notification Engine                    │
│  ├── Approval Workflow Engine                       │
│  └── Reporting & Export                             │
└─────────────────────────────────────────────────────┘
```

---

## 🏗️ Convenzioni di Codice

### Struttura Directory

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── (auth)/             # Auth group layout
│   ├── (dashboard)/        # Main app group layout
│   └── api/                # API routes (webhook + REST)
├── components/
│   ├── ui/                 # Primitive UI components (shadcn/ui)
│   └── layout/             # Shell, sidebar, header
├── config/
│   ├── modules.ts          # Module registry (pack, alwaysOn, deps)
│   ├── packs.ts            # Commercial pack definitions
│   └── runtime.ts          # ENABLED_MODULES env loader + cache
├── lib/
│   ├── db.ts               # Prisma client singleton
│   ├── auth.ts             # Auth helpers
│   ├── module-guard.ts     # assertModuleEnabled() pack-level API guard
│   └── modules/            # DB-level module guard (runtime toggle)
├── modules/                # Modular monolith: one folder per business module
│   ├── core/
│   │   └── commesse/       # Example: services, components, validations, barrel
│   └── defense/            # Defense-pack modules (roadmap)
├── customers/              # Per-customer isolated customization
│   ├── _shared/
│   └── faleni/
├── server/                 # Cross-module server code (services, agents)
├── hooks/                  # Custom React hooks
└── types/                  # TypeScript type definitions
```

### Modular Monolith

ProcureFlow è organizzato come **modular monolith**. Ogni modulo business vive sotto `src/modules/<pack>/<name>/` con:

- `server/` — services, tools, business logic
- `components/` — UI components
- `validations/` — Zod schemas
- `index.ts` — barrel export (public API)
- `README.md` — contratto del modulo

Importa **sempre dal barrel** (`@/modules/<pack>/<name>`), mai da file interni.

Ogni modulo è registrato in `src/config/modules.ts` con pack, dipendenze, flag `alwaysOn`. Può essere abilitato/disabilitato per deploy via `ENABLED_MODULES` env var.

Due sistemi di gate coesistono (pack env-based + DB runtime), stratificati in `withApiHandler` e nelle route.

**Riferimenti in `procureflow/docs/internal/`**:
- `MODULE-SYSTEM.md` — developer guide (come aggiungere un modulo)
- `ARCHITECTURE-OVERVIEW.md` — overview per owner/stakeholder
- `MODULE-MIGRATION-GUIDE.md` — come migrare codice esistente in un modulo

### Naming Conventions

- **Files**: `kebab-case.tsx` per componenti, `camelCase.ts` per utility
- **Componenti**: `PascalCase` — un componente per file
- **Hooks**: `use` prefix → `useRequests.ts`, `useVendors.ts`
- **Types**: `PascalCase` con suffisso descrittivo → `RequestStatus`, `VendorCreateInput`
- **API Routes**: RESTful naming → `/api/requests`, `/api/vendors/:id`
- **Database**: `snake_case` per tabelle e colonne in Prisma schema

### Patterns Obbligatori

```typescript
// ✅ Server Components di default — client solo quando serve interattività
// ✅ Ogni pagina ha loading.tsx e error.tsx
// ✅ Form validation con Zod schemas condivisi client/server
// ✅ Optimistic updates sulle mutations
// ✅ Skeleton loaders per ogni data-fetching component
// ✅ Toast notifications per feedback utente
// ✅ Responsive: mobile-first, breakpoint sm → md → lg → xl
// ✅ Dark mode support nativo (next-themes)
// ✅ i18n ready: tutti i testi in italiano ma struttura pronta per multi-lingua
```

### Anti-Patterns da Evitare

```typescript
// ❌ NO "use client" su componenti che non ne hanno bisogno
// ❌ NO fetch() dirette — usare tRPC o server actions
// ❌ NO any type — TypeScript strict mode always
// ❌ NO inline styles — solo Tailwind classes
// ❌ NO prop drilling oltre 2 livelli — usare context o composition
// ❌ NO business logic nei componenti — estrarre in services/hooks
// ❌ NO hardcoded strings — usare constants
// ❌ NO console.log in production — usare logger strutturato
```

---

## 🎨 Design System — "ProcureFlow"

### Filosofia Estetica

**Industrial Luxe** — L'eleganza di un tool enterprise con il calore di un prodotto consumer.
Ispirazione: Linear, Vercel Dashboard, Raycast. Ma con personalità italiana: 
calore nei colori, generosità negli spazi, micro-animazioni che deliziano.

### Palette

```css
:root {
  /* Core */
  --pf-bg-primary: #0A0A0B;          /* Near-black canvas */
  --pf-bg-secondary: #141416;         /* Card backgrounds */
  --pf-bg-tertiary: #1C1C1F;          /* Elevated surfaces */
  --pf-bg-hover: #252528;             /* Hover states */
  
  /* Brand Accent */
  --pf-accent: #6366F1;               /* Indigo — primary actions */
  --pf-accent-hover: #818CF8;         /* Lighter indigo */
  --pf-accent-subtle: rgba(99,102,241,0.12); /* Ghost buttons, badges */
  
  /* Semantic */
  --pf-success: #22C55E;              /* Approved, delivered */
  --pf-warning: #F59E0B;              /* Pending, attention */
  --pf-danger: #EF4444;               /* Rejected, overdue */
  --pf-info: #3B82F6;                 /* Informational */
  
  /* Text */
  --pf-text-primary: #FAFAFA;         /* Headlines, primary content */
  --pf-text-secondary: #A1A1AA;       /* Descriptions, metadata */
  --pf-text-muted: #52525B;           /* Placeholders, disabled */
  
  /* Borders */
  --pf-border: rgba(255,255,255,0.06);
  --pf-border-hover: rgba(255,255,255,0.12);
}

/* Light mode overrides */
[data-theme="light"] {
  --pf-bg-primary: #FAFAFA;
  --pf-bg-secondary: #FFFFFF;
  --pf-bg-tertiary: #F4F4F5;
  --pf-text-primary: #09090B;
  --pf-text-secondary: #71717A;
  --pf-border: rgba(0,0,0,0.06);
}
```

### Typography

```css
/* Font Stack */
--font-display: 'Satoshi', 'SF Pro Display', system-ui;  /* Headlines */
--font-body: 'Inter', 'SF Pro Text', system-ui;           /* Body text */
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;      /* IDs, codes */

/* Scale */
--text-xs: 0.75rem;    /* 12px — metadata, badges */
--text-sm: 0.875rem;   /* 14px — body text, table cells */
--text-base: 1rem;     /* 16px — primary body */
--text-lg: 1.125rem;   /* 18px — card titles */
--text-xl: 1.25rem;    /* 20px — section headers */
--text-2xl: 1.5rem;    /* 24px — page titles */
--text-3xl: 1.875rem;  /* 30px — dashboard hero stats */
--text-4xl: 2.25rem;   /* 36px — landing hero */
```

### Spacing & Layout

```
/* Consistent spacing scale */
4px → 8px → 12px → 16px → 24px → 32px → 48px → 64px → 96px

/* Card anatomy */
- Border radius: 12px (cards), 8px (buttons, inputs), 6px (badges)
- Padding: 20px–24px internal
- Gap between cards: 16px
- Shadow (dark): 0 0 0 1px var(--pf-border)
- Shadow (light): 0 1px 3px rgba(0,0,0,0.08)

/* Sidebar: 260px fixed, collapsible to 64px icon-only */
/* Content max-width: 1280px centered */
/* Table row height: 52px minimum */
```

### Animazioni & Micro-interazioni

```css
/* Transitions di default */
transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);

/* Page transitions: fade + slide-up */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Skeleton pulse */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Regole:
   - Ogni card appare con staggered delay (index * 50ms)
   - Status badges pulsano al cambio stato
   - Numeri nelle stats fanno count-up animato
   - Sidebar icons ruotano/scalano sottilmente on hover
   - Toast entrano da destra con spring easing
   - Tabelle: row highlight con gradient sweep on hover
   - Modal: backdrop blur 8px + scale-in da 95%
*/
```

### Componenti UI — Specifica

**Status Badge System:**
```
DRAFT      → grigio, icona file-edit
SUBMITTED  → blu, icona send
PENDING    → ambra pulsante, icona clock
APPROVED   → verde, icona check-circle
REJECTED   → rosso, icona x-circle
ORDERED    → indigo, icona shopping-cart
SHIPPED    → cyan, icona truck
DELIVERED  → verde pieno, icona package-check
CANCELLED  → grigio barrato, icona ban
```

**Data Table Pattern:**
- Header sticky con blur backdrop
- Sortable columns con indicatore freccia
- Inline search + filter chips
- Bulk selection con floating action bar
- Empty state illustrato con CTA
- Infinite scroll O pagination (configurabile)
- Row expansion per dettagli inline

**Sidebar Navigation:**
- Logo + brand top
- Sezioni raggruppate con divider
- Active state: bg accent-subtle + left border accent
- Badge counter per items che richiedono attenzione (approval pending, overdue)
- Collapse animation smooth
- Keyboard shortcut hints (⌘K search, etc.)

---

## 🗄️ Database Schema — Guida

### Entità Core

```prisma
// schema.prisma — riferimento strutturale

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  role          UserRole  @default(REQUESTER)
  department    String?
  avatar_url    String?
  created_at    DateTime  @default(now())
  
  requests      PurchaseRequest[]
  approvals     Approval[]
  comments      Comment[]
  notifications Notification[]
}

enum UserRole {
  ADMIN
  MANAGER
  REQUESTER
  VIEWER
}

model Vendor {
  id              String    @id @default(cuid())
  name            String
  code            String    @unique          // Codice fornitore interno
  email           String?
  phone           String?
  website         String?
  portal_url      String?                    // URL portale fornitore
  portal_type     VendorPortalType?
  category        String[]                   // Categorie merceologiche
  payment_terms   String?                    // Es: "30gg DFFM"
  rating          Float?                     // Rating interno 1-5
  status          VendorStatus  @default(ACTIVE)
  notes           String?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  
  requests        PurchaseRequest[]
  contacts        VendorContact[]
}

enum VendorPortalType {
  WEBSITE
  EMAIL_ONLY
  API
  MARKETPLACE
  PHONE
}

enum VendorStatus {
  ACTIVE
  INACTIVE
  BLACKLISTED
  PENDING_REVIEW
}

model PurchaseRequest {
  id              String            @id @default(cuid())
  code            String            @unique    // PR-2025-00001
  title           String
  description     String?
  status          RequestStatus     @default(DRAFT)
  priority        Priority          @default(MEDIUM)
  
  // Relazioni
  requester_id    String
  requester       User              @relation(fields: [requester_id], references: [id])
  vendor_id       String?
  vendor          Vendor?           @relation(fields: [vendor_id], references: [id])
  
  // Importi
  estimated_amount  Decimal?        @db.Decimal(12,2)
  currency          String          @default("EUR")
  actual_amount     Decimal?        @db.Decimal(12,2)
  
  // Date
  needed_by       DateTime?         // Data necessità
  ordered_at      DateTime?
  expected_delivery DateTime?
  delivered_at    DateTime?
  
  // Tracking esterno
  external_ref    String?           // Riferimento ordine fornitore
  external_url    String?           // Link al portale fornitore
  tracking_number String?
  
  // Categorizzazione
  category        String?
  department      String?
  cost_center     String?
  budget_code     String?
  
  // Metadata
  tags            String[]
  created_at      DateTime          @default(now())
  updated_at      DateTime          @updatedAt
  
  items           RequestItem[]
  approvals       Approval[]
  comments        Comment[]
  attachments     Attachment[]
  timeline        TimelineEvent[]
}

enum RequestStatus {
  DRAFT
  SUBMITTED
  PENDING_APPROVAL
  APPROVED
  REJECTED
  ORDERED
  SHIPPED
  DELIVERED
  CANCELLED
  ON_HOLD
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model RequestItem {
  id              String    @id @default(cuid())
  request_id      String
  request         PurchaseRequest @relation(fields: [request_id], references: [id], onDelete: Cascade)
  
  name            String
  description     String?
  quantity        Int
  unit            String?           // pz, kg, m, etc.
  unit_price      Decimal?          @db.Decimal(12,2)
  total_price     Decimal?          @db.Decimal(12,2)
  sku             String?           // Codice articolo fornitore
}

model Approval {
  id              String          @id @default(cuid())
  request_id      String
  request         PurchaseRequest @relation(fields: [request_id], references: [id])
  approver_id     String
  approver        User            @relation(fields: [approver_id], references: [id])
  
  status          ApprovalStatus  @default(PENDING)
  decision_at     DateTime?
  notes           String?
  
  created_at      DateTime        @default(now())
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  DELEGATED
}

model TimelineEvent {
  id              String          @id @default(cuid())
  request_id      String
  request         PurchaseRequest @relation(fields: [request_id], references: [id])
  
  type            String          // status_change, comment, approval, email, etc.
  title           String
  description     String?
  metadata        Json?           // Dati extra strutturati
  actor           String?         // Chi ha causato l'evento
  
  created_at      DateTime        @default(now())
}

model Comment {
  id              String          @id @default(cuid())
  request_id      String
  request         PurchaseRequest @relation(fields: [request_id], references: [id])
  author_id       String
  author          User            @relation(fields: [author_id], references: [id])
  
  content         String
  is_internal     Boolean         @default(true)  // vs visibile al vendor
  
  created_at      DateTime        @default(now())
}

model Attachment {
  id              String          @id @default(cuid())
  request_id      String
  request         PurchaseRequest @relation(fields: [request_id], references: [id])
  
  filename        String
  file_url        String
  file_size       Int?
  mime_type       String?
  
  created_at      DateTime        @default(now())
}

model Notification {
  id              String          @id @default(cuid())
  user_id         String
  user            User            @relation(fields: [user_id], references: [id])
  
  title           String
  body            String
  type            String          // approval_required, delivery_overdue, etc.
  link            String?         // Deep link alla risorsa
  read            Boolean         @default(false)
  
  created_at      DateTime        @default(now())
}
```

### Indexing Strategy

```prisma
// Indici critici per performance
@@index([status, created_at])           // Dashboard filtering
@@index([requester_id, status])         // "Le mie richieste"
@@index([vendor_id, status])            // Richieste per fornitore
@@index([needed_by])                    // Scadenze
@@index([department, cost_center])      // Report per centro di costo
```

---

## ⚡ n8n Workflow Specifications

### Workflow 1: Email Ingestion Pipeline

```
Trigger: IMAP Email Polling (ogni 5 min)
→ Filter: solo email da domini vendor noti
→ AI Node (Claude/GPT): estrai {order_ref, status, expected_date, amount}
→ HTTP Request: POST /api/webhooks/email-ingestion
→ Prisma: upsert PurchaseRequest + crea TimelineEvent
→ IF status changed → Notification node
→ Error handler: log + alert admin
```

### Workflow 2: Approval Workflow

```
Trigger: Webhook da frontend (nuova richiesta submitted)
→ Lookup: regole approvazione per {amount, department, category}
→ IF amount < 500€ → auto-approve
→ IF amount < 5000€ → manager approval
→ IF amount >= 5000€ → director + CFO approval
→ Send: email/Slack notification ad approver
→ Wait: webhook callback da approval action
→ Update: request status + crea TimelineEvent
→ IF approved → trigger Workflow 3 (order placement)
```

### Workflow 3: Delivery Monitoring

```
Trigger: Cron ogni mattina alle 8:00
→ Query: richieste con status ORDERED/SHIPPED e expected_delivery <= oggi+3
→ Per ogni richiesta:
  → IF overdue → cambia priority a URGENT + notifica requester + manager
  → IF due in 3gg → reminder notification
  → IF vendor ha API → check status update automatico
→ Weekly: genera report richieste aperte per department
```

### Workflow 4: Vendor Sync (per portali con API)

```
Trigger: Cron ogni 30 min
→ Per ogni vendor con portal_type=API:
  → HTTP Request: fetch order status dal portale
  → Compare: stato attuale vs stato in DB
  → IF changed → update DB + crea TimelineEvent + notifica
  → Rate limiting: max 60 req/min per vendor
```

### Webhook Endpoints (da esporre in Next.js)

```
POST /api/webhooks/email-ingestion     → Riceve dati parsati da n8n
POST /api/webhooks/approval-response   → Callback approvazione
POST /api/webhooks/vendor-update       → Status update da vendor
POST /api/webhooks/n8n-health          → Health check n8n → app
```

---

## 🔒 Sicurezza & Compliance

```
- RBAC: 4 ruoli (Admin, Manager, Requester, Viewer)
- Ogni API route verifica ruolo utente
- Webhook endpoints autenticati con HMAC signature
- File upload: max 10MB, solo PDF/DOCX/XLSX/IMG
- Audit log: ogni azione CRUD loggata con actor + timestamp
- GDPR: soft delete, data export, retention policy
- Rate limiting: 100 req/min per utente
- CSP headers + CORS policy restrittiva
```

---

## 🧪 Testing Strategy

```
- Unit test: business logic in services/ (Vitest)
- Integration test: API routes con supertest
- E2E: flussi critici con Playwright
  → Crea richiesta → Approva → Marca come ordinato → Delivery
- Coverage target: 80% su services/, 60% su components/
- CI: lint + type-check + test su ogni PR
```

---

## 📦 Deployment

```
- Frontend: Vercel (o Docker)
- Database: PostgreSQL su Supabase / Railway / self-hosted
- n8n: Docker self-hosted (o n8n cloud)
- File storage: S3 / MinIO
- Monitoring: Sentry per errori, Posthog per analytics prodotto
```

---

## 🚀 Ordine di Implementazione

### Fase 1 — Foundation (Sprint 1-2)
1. Setup progetto Next.js + Prisma + DB
2. Schema database + seed data
3. Auth (NextAuth.js con credentials o OAuth)
4. Layout shell: sidebar + header + theme switcher
5. CRUD Vendors (pagina lista + dettaglio + form)
6. CRUD Purchase Requests (pagina lista + dettaglio + form)

### Fase 2 — Core Features (Sprint 3-4)
7. Dashboard con KPI cards + charts
8. Sistema di status tracking con timeline
9. Approval workflow (frontend)
10. Commenti su richieste
11. File upload allegati
12. Notifiche in-app

### Fase 3 — Automazione (Sprint 5-6)
13. Webhook endpoints per n8n
14. Template n8n: email ingestion
15. Template n8n: approval automation
16. Template n8n: delivery monitoring
17. Template n8n: weekly report

### Fase 4 — Polish & Analytics (Sprint 7-8)
18. Analytics dashboard (spend by vendor, by category, trend)
19. Export CSV/Excel
20. Filtri avanzati + saved views
21. Keyboard shortcuts (⌘K command palette)
22. Onboarding flow per nuovi utenti
23. Performance optimization + caching