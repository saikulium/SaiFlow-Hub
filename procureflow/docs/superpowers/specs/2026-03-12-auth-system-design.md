# Auth System Design — ProcureFlow

**Date:** 2026-03-12
**Status:** Approved

## Summary

Credentials-based authentication (email + password) for ProcureFlow using NextAuth v5 with Prisma adapter and database sessions. Admin-only user creation, minimal user management page.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth method | Credentials (email + password) | Pragmatic for internal PMI team, no external deps, `password_hash` already in schema |
| Session strategy | Database | Revocable, traceable, no JWT secret rotation concerns |
| Registration | Admin-only invite | Internal procurement tool, no public registration |
| User management | Minimal page | Create user + change role, accessible to ADMIN only |
| Password hashing | bcrypt via `bcryptjs` | Industry standard, already common in Next.js ecosystem |

## Architecture

```
Browser → Login Page → POST /api/auth/callback/credentials
  → NextAuth verifies email+password (bcrypt.compare)
  → Creates Session row in PostgreSQL
  → Sets session cookie → redirect to /dashboard

Subsequent requests:
  Browser (cookie) → middleware.ts → checks session
    → Valid → continue
    → Invalid → redirect /login

API routes:
  Request → requireAuth() → session or 401
  Request → requireRole('ADMIN') → role check or 403
```

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/app/(auth)/login/page.tsx` | Login page |
| `src/app/(auth)/layout.tsx` | Auth layout (centered, no sidebar) |
| `src/app/(dashboard)/users/page.tsx` | User management page (ADMIN) |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler |
| `src/app/api/users/route.ts` | Users API (GET list, POST create) |
| `src/app/api/users/[id]/route.ts` | User API (PATCH role) |
| `src/components/auth/login-form.tsx` | Login form component |
| `src/components/users/users-page-content.tsx` | Users list + create |
| `src/components/users/create-user-dialog.tsx` | Create user dialog |
| `src/hooks/use-users.ts` | Users CRUD hook |
| `src/lib/validations/auth.ts` | Zod schemas for login + create user |
| `middleware.ts` | Route protection middleware |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/auth.ts` | Replace demo mode with NextAuth config + helpers |
| `src/app/layout.tsx` | Wrap app in SessionProvider |
| `src/components/layout/header.tsx` | Use useSession() for real user data |
| `src/components/layout/sidebar-nav-item.tsx` | Show "Utenti" badge for ADMIN |
| `src/lib/constants.ts` | Add "Utenti" nav item |
| `prisma/seed.ts` | Seed users with hashed passwords |
| `.env.example` | Document NEXTAUTH_SECRET, NEXTAUTH_URL |

## Security

- Generic error messages on login ("Credenziali non valide")
- bcrypt password hashing with salt rounds = 12
- Database sessions (revocable)
- middleware.ts protects all routes except: `/login`, `/api/auth/*`, `/api/webhooks/*`, static assets
- API routes enforce RBAC via `requireAuth()` and `requireRole()`
- No user deletion — future deactivation only

## RBAC Matrix

| Action | ADMIN | MANAGER | REQUESTER | VIEWER |
|--------|-------|---------|-----------|--------|
| Create users | Y | N | N | N |
| Change roles | Y | N | N | N |
| Approve requests | Y | Y | N | N |
| Create requests | Y | Y | Y | N |
| View requests | Y | Y | Y | Y |
| View dashboard | Y | Y | Y | Y |

## User Flows

### Login
1. User navigates to any protected route
2. middleware.ts redirects to `/login`
3. User enters email + password
4. NextAuth validates credentials
5. Session created → redirect to dashboard

### Admin Creates User
1. Admin navigates to `/users`
2. Clicks "Nuovo Utente"
3. Fills: nome, email, password temporanea, ruolo
4. System creates user with hashed password
5. Admin shares credentials out-of-band

## Seed Data

- `admin@procureflow.it` / `admin123` (ADMIN)
- Demo users with hashed passwords for all roles
