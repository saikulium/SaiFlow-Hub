# Auth System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add credentials-based authentication with database sessions, route protection, RBAC, and minimal admin user management to ProcureFlow.

**Architecture:** NextAuth v5 (already installed) with Credentials provider, Prisma adapter for database sessions, bcryptjs for password hashing. Middleware protects all dashboard/API routes. API helpers enforce role-based access.

**Tech Stack:** next-auth@5.0.0-beta.30, @auth/prisma-adapter, bcryptjs, zod, react-hook-form

---

## Chunk 1: Core Auth Backend

### Task 1: Install bcryptjs

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install bcryptjs with types**

```bash
cd /Users/kiraah/Downloads/SaiFlow\ Hub\ Centralizzato/procureflow && npm install bcryptjs && npm install -D @types/bcryptjs
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('bcryptjs')"
```
Expected: no error

---

### Task 2: Auth validation schemas

**Files:**
- Create: `src/lib/validations/auth.ts`

- [ ] **Step 1: Create auth validation schemas**

```typescript
// src/lib/validations/auth.ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria'),
})

export const createUserSchema = z.object({
  name: z.string().min(1, 'Nome obbligatorio').max(100),
  email: z.string().email('Email non valida'),
  password: z.string().min(8, 'Minimo 8 caratteri'),
  role: z.enum(['ADMIN', 'MANAGER', 'REQUESTER', 'VIEWER']).default('REQUESTER'),
  department: z.string().optional(),
})

export const updateUserRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'REQUESTER', 'VIEWER']),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>
```

---

### Task 3: NextAuth configuration + auth helpers

**Files:**
- Modify: `src/lib/auth.ts` (full rewrite, lines 1-34)

- [ ] **Step 1: Rewrite auth.ts with NextAuth v5 config**

Replace entire contents of `src/lib/auth.ts` with:

```typescript
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { loginSchema } from '@/lib/validations/auth'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            department: true,
            password_hash: true,
          },
        })

        if (!user?.password_hash) return null

        const valid = await bcrypt.compare(parsed.data.password, user.password_hash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, department: true },
      })
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          role: dbUser?.role ?? 'VIEWER',
          department: dbUser?.department ?? null,
        },
      }
    },
  },
})

// --- Auth helpers for API routes ---

import { NextResponse } from 'next/server'
import type { UserRole } from '@prisma/client'

interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  department: string | null
}

export async function requireAuth(): Promise<AuthUser | NextResponse> {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Accesso non autorizzato' } },
      { status: 401 },
    )
  }
  return session.user as AuthUser
}

export async function requireRole(...roles: UserRole[]): Promise<AuthUser | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (!roles.includes(result.role)) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Permessi insufficienti' } },
      { status: 403 },
    )
  }
  return result
}

// Backward-compatible helpers used by existing API routes
export async function getCurrentUser(): Promise<{
  id: string
  name: string
  role: UserRole
  department: string | null
}> {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Utente non autenticato')
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, role: true, department: true },
  })
  if (!user) {
    throw new Error('Utente non trovato')
  }
  return user
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser()
  return user.id
}
```

---

### Task 4: NextAuth route handler

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create the route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

---

### Task 5: NextAuth type augmentation

**Files:**
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: Extend NextAuth session types**

```typescript
// src/types/next-auth.d.ts
import type { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: UserRole
      department: string | null
    }
  }

  interface User {
    role: UserRole
    department: string | null
  }
}
```

---

### Task 6: Route protection middleware

**Files:**
- Create: `middleware.ts` (project root, next to `src/`)

- [ ] **Step 1: Create middleware**

```typescript
// middleware.ts
export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login
     * - /api/auth (NextAuth routes)
     * - /api/webhooks (authenticated via HMAC)
     * - _next/static, _next/image, favicon, public assets
     */
    '/((?!login|api/auth|api/webhooks|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

Note: NextAuth v5 middleware automatically redirects to `pages.signIn` when no session exists.

---

### Task 7: Update env files

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add auth env vars to .env.example**

Add these lines to `.env.example`:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here-generate-with-openssl-rand-base64-32
```

- [ ] **Step 2: Generate and set NEXTAUTH_SECRET in .env**

```bash
cd /Users/kiraah/Downloads/SaiFlow\ Hub\ Centralizzato/procureflow && echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env && echo "NEXTAUTH_URL=http://localhost:3000" >> .env
```

---

### Task 8: Update seed with hashed passwords

**Files:**
- Modify: `prisma/seed.ts` (lines 1-10 imports, lines 47-93 user creation)

- [ ] **Step 1: Add bcrypt import and hash passwords in seed**

Add at top of `prisma/seed.ts` after existing imports:

```typescript
import bcrypt from 'bcryptjs'
```

Inside `main()`, before user creation, add:

```typescript
const defaultPassword = await bcrypt.hash('password123', 12)
const adminPassword = await bcrypt.hash('admin123', 12)
```

Update each `prisma.user.create` call to include `password_hash`:
- Marco (ADMIN): `password_hash: adminPassword`
- All others: `password_hash: defaultPassword`

---

### Task 9: Commit core auth backend

- [ ] **Step 1: Commit**

```bash
git add src/lib/auth.ts src/lib/validations/auth.ts src/app/api/auth/ src/types/next-auth.d.ts middleware.ts .env.example prisma/seed.ts package.json package-lock.json
git commit -m "feat: NextAuth v5 credentials auth with database sessions"
```

---

## Chunk 2: Frontend Auth (Login + SessionProvider)

### Task 10: SessionProvider wrapper

**Files:**
- Create: `src/components/providers/session-provider.tsx`
- Modify: `src/app/layout.tsx` (lines 17-46)

- [ ] **Step 1: Create session provider component**

```typescript
// src/components/providers/session-provider.tsx
'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import type { ReactNode } from 'react'

export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
```

- [ ] **Step 2: Wrap app in SessionProvider**

In `src/app/layout.tsx`, add import:

```typescript
import { SessionProvider } from '@/components/providers/session-provider'
```

Wrap `<QueryProvider>` inside `<SessionProvider>`:

```tsx
<SessionProvider>
  <QueryProvider>
    {children}
    <Toaster ... />
  </QueryProvider>
</SessionProvider>
```

---

### Task 11: Auth layout

**Files:**
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Create centered auth layout**

```typescript
// src/app/(auth)/layout.tsx
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-pf-bg-primary p-4">
      {children}
    </div>
  )
}
```

---

### Task 12: Login form component

**Files:**
- Create: `src/components/auth/login-form.tsx`

- [ ] **Step 1: Create login form**

```typescript
// src/components/auth/login-form.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, LogIn } from 'lucide-react'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginInput) {
    setError(null)
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      setError('Credenziali non valide')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="font-display text-2xl font-bold text-pf-text-primary">
          ProcureFlow
        </h1>
        <p className="mt-2 text-sm text-pf-text-secondary">
          Accedi al tuo account
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-card border border-pf-border bg-pf-bg-secondary p-6 space-y-4"
      >
        {error && (
          <div className="rounded-badge bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-pf-text-primary">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            placeholder="nome@azienda.it"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-pf-text-primary">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-button bg-pf-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          Accedi
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-pf-text-muted">
        Contatta l'amministratore per ottenere le credenziali
      </p>
    </div>
  )
}
```

---

### Task 13: Login page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create login page**

```typescript
// src/app/(auth)/login/page.tsx
import { LoginForm } from '@/components/auth/login-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Accedi',
}

export default function LoginPage() {
  return <LoginForm />
}
```

---

### Task 14: Update header with real session

**Files:**
- Modify: `src/components/layout/header.tsx` (lines 1-17, line 54-56)

- [ ] **Step 1: Replace hardcoded user with useSession**

In `src/components/layout/header.tsx`:

Add imports:
```typescript
import { useSession, signOut } from 'next-auth/react'
```

Remove line 17 (`const user = { name: 'Marco Rossi', role: 'Admin' }`).

Replace with:
```typescript
const { data: session } = useSession()
const user = session?.user
```

Replace the avatar div (line 54-56) with:

```tsx
{user && (
  <button
    onClick={() => signOut({ callbackUrl: '/login' })}
    title="Esci"
    className="flex h-8 w-8 items-center justify-center rounded-full bg-pf-accent text-xs font-bold text-white transition-opacity hover:opacity-80"
  >
    {getInitials(user.name ?? '')}
  </button>
)}
```

---

### Task 15: Commit frontend auth

- [ ] **Step 1: Commit**

```bash
git add src/components/providers/session-provider.tsx src/app/layout.tsx src/app/\(auth\)/ src/components/auth/ src/components/layout/header.tsx
git commit -m "feat: login page, session provider, header with real user"
```

---

## Chunk 3: Users API + Admin Page

### Task 16: Users API routes

**Files:**
- Create: `src/app/api/users/route.ts`
- Create: `src/app/api/users/[id]/route.ts`

- [ ] **Step 1: Create users list + create API**

```typescript
// src/app/api/users/route.ts
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response'
import { createUserSchema } from '@/lib/validations/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  })

  return successResponse(users)
}

export async function POST(request: NextRequest) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.flatten().fieldErrors)
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })
  if (existing) {
    return errorResponse('DUPLICATE_EMAIL', 'Email già registrata', 409)
  }

  const password_hash = await bcrypt.hash(parsed.data.password, 12)

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      password_hash,
      role: parsed.data.role,
      department: parsed.data.department ?? null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      created_at: true,
    },
  })

  return successResponse(user)
}
```

- [ ] **Step 2: Create user role update API**

```typescript
// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { successResponse, notFoundResponse, validationErrorResponse } from '@/lib/api-response'
import { updateUserRoleSchema } from '@/lib/validations/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  const body = await request.json()
  const parsed = updateUserRoleSchema.safeParse(body)
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.flatten().fieldErrors)
  }

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    return notFoundResponse('Utente non trovato')
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      created_at: true,
    },
  })

  return successResponse(user)
}
```

---

### Task 17: Users hook

**Files:**
- Create: `src/hooks/use-users.ts`

- [ ] **Step 1: Create users hook**

```typescript
// src/hooks/use-users.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CreateUserInput, UpdateUserRoleInput } from '@/lib/validations/auth'
import type { UserRole } from '@prisma/client'

interface UserItem {
  id: string
  name: string
  email: string
  role: UserRole
  department: string | null
  created_at: string
}

export function useUsers() {
  return useQuery<UserItem[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users')
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Utente creato')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateUserRoleInput & { id: string }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Errore')
      return json.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Ruolo aggiornato')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
```

---

### Task 18: Create user dialog

**Files:**
- Create: `src/components/users/create-user-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

A modal dialog with form fields: nome, email, password, ruolo, dipartimento.
Uses react-hook-form + zodResolver(createUserSchema).
Calls useCreateUser() mutation on submit.
Closes dialog and resets form on success.
Follows ProcureFlow design system (pf-* classes, rounded-card, etc.)

---

### Task 19: Users page content

**Files:**
- Create: `src/components/users/users-page-content.tsx`

- [ ] **Step 1: Create users page content**

A client component that:
- Calls useUsers() to fetch user list
- Renders a table with columns: Nome, Email, Ruolo (with inline select for role change), Dipartimento, Data Creazione
- Has "Nuovo Utente" button that opens CreateUserDialog
- Shows skeleton loading state
- Role change calls useUpdateUserRole()
- Follows ProcureFlow table pattern (sticky header, hover states, pf-* classes)

---

### Task 20: Users page + nav item

**Files:**
- Create: `src/app/(dashboard)/users/page.tsx`
- Modify: `src/lib/constants.ts` (lines 220-243, NAV_ITEMS array)

- [ ] **Step 1: Create users page**

```typescript
// src/app/(dashboard)/users/page.tsx
import { UsersPageContent } from '@/components/users/users-page-content'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Utenti',
}

export const dynamic = 'force-dynamic'

export default function UsersPage() {
  return <UsersPageContent />
}
```

- [ ] **Step 2: Add users nav item**

In `src/lib/constants.ts`, add `Users` import from lucide-react, then add to NAV_ITEMS before 'Impostazioni':

```typescript
{ label: 'Utenti', href: '/users', icon: Users },
```

---

### Task 21: Commit users admin

- [ ] **Step 1: Commit**

```bash
git add src/app/api/users/ src/hooks/use-users.ts src/components/users/ src/app/\(dashboard\)/users/ src/lib/constants.ts
git commit -m "feat: admin user management page with RBAC"
```

---

## Chunk 4: Seed, Build Verification, Final Commit

### Task 22: Re-seed database with passwords

- [ ] **Step 1: Run prisma generate and seed**

```bash
cd /Users/kiraah/Downloads/SaiFlow\ Hub\ Centralizzato/procureflow && npx prisma generate && npx prisma db seed
```

Expected: seed completes with hashed passwords

---

### Task 23: Build verification

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 3: Dev server smoke test**

```bash
npm run dev
```

Manually verify:
- Navigating to `/` redirects to `/login`
- Login with `admin@procureflow.it` / `admin123` works
- After login, dashboard loads with real user in header
- `/users` page shows user list (admin only)
- Clicking avatar logs out

---

### Task 24: Final commit

- [ ] **Step 1: Commit any remaining changes**

```bash
git add -A
git commit -m "feat: complete auth system with credentials, RBAC, and user management"
```
