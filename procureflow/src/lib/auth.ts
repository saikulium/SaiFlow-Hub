import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { loginSchema } from '@/lib/validations/auth'
import { JWT_MAX_AGE_SECONDS } from '@/lib/constants/auth'

// NOTE: Heavy Node.js modules (bcrypt, prisma, crypto, otpauth, qrcode)
// are dynamically imported inside authorize()/callbacks to avoid breaking
// the Edge runtime used by Next.js middleware.

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: JWT_MAX_AGE_SECONDS },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: 'TOTP', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        // Dynamic imports — Node.js only (not Edge)
        const { prisma } = await import('@/lib/db')
        const bcrypt = (await import('bcryptjs')).default
        const { checkAccountLocked, recordFailedLogin, recordSuccessfulLogin } =
          await import('@/server/services/auth.service')
        const { createRefreshToken } =
          await import('@/server/services/refresh-token.service')

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            department: true,
            password_hash: true,
            failed_login_attempts: true,
            locked_until: true,
            totp_secret: true,
            totp_enabled: true,
            onboarding_completed: true,
          },
        })

        if (!user?.password_hash) return null

        // Check account lockout
        const lockStatus = checkAccountLocked(user)
        if (lockStatus.isLocked) {
          throw new Error(`ACCOUNT_LOCKED:${lockStatus.remainingMinutes}`)
        }

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.password_hash,
        )
        if (!valid) {
          await recordFailedLogin(user.id)
          throw new Error('INVALID_CREDENTIALS')
        }

        // Two-phase MFA: if TOTP is enabled, verify the code
        if (user.totp_enabled && user.totp_secret) {
          const totpCode = (credentials as { totpCode?: string }).totpCode
          if (!totpCode) {
            throw new Error('MFA_REQUIRED')
          }
          const { verifyTotpCode, consumeRecoveryCode } =
            await import('@/server/services/totp.service')
          // Try TOTP code first, then recovery code
          const totpValid = verifyTotpCode(user.totp_secret, totpCode)
          if (!totpValid) {
            const recoveryValid = await consumeRecoveryCode(user.id, totpCode)
            if (!recoveryValid) {
              throw new Error('INVALID_TOTP')
            }
          }
        }

        await recordSuccessfulLogin(user.id)

        const refreshTokenData = await createRefreshToken(user.id)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          refreshToken: refreshTokenData.token,
          tokenVersion: 0,
          totpEnabled: user.totp_enabled,
          onboardingCompleted: user.onboarding_completed,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Session update trigger (e.g. after MFA setup): refresh from DB
      if (trigger === 'update' && token.id) {
        try {
          const { prisma } = await import('@/lib/db')
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              totp_enabled: true,
              token_version: true,
              role: true,
              onboarding_completed: true,
            },
          })
          if (dbUser) {
            token.totpEnabled = dbUser.totp_enabled
            token.tokenVersion = dbUser.token_version
            token.role = dbUser.role
            token.onboardingCompleted = dbUser.onboarding_completed
          }
        } catch {
          // DB error — keep existing token data
        }
        return token
      }

      // Initial sign-in: persist user data + refresh token in JWT
      if (user) {
        const u = user as {
          id: string
          role: string
          department: string | null
          refreshToken: string
          tokenVersion: number
          totpEnabled?: boolean
          onboardingCompleted?: boolean
        }
        token.id = u.id
        token.role = u.role
        token.department = u.department
        token.refreshToken = u.refreshToken
        token.tokenVersion = u.tokenVersion
        token.totpEnabled = u.totpEnabled ?? false
        token.onboardingCompleted = u.onboardingCompleted ?? false
        token.issuedAt = Math.floor(Date.now() / 1000)
        token.lastVersionCheck = Math.floor(Date.now() / 1000)
        return token
      }

      const nowSec = Math.floor(Date.now() / 1000)
      const issuedAt = (token.issuedAt as number) ?? nowSec

      // Every 30 seconds: refresh token_version + totp_enabled from DB
      const lastCheck = (token.lastVersionCheck as number) ?? 0
      if (nowSec - lastCheck > 30) {
        try {
          const { prisma } = await import('@/lib/db')
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { token_version: true, totp_enabled: true },
          })
          if (
            !dbUser ||
            dbUser.token_version !== (token.tokenVersion as number)
          ) {
            token.error = 'RefreshTokenExpired'
            return token
          }
          token.totpEnabled = dbUser.totp_enabled
          token.lastVersionCheck = nowSec
        } catch {
          // DB error — don't invalidate, retry next time
        }
      }

      // If JWT is older than 4 hours, rotate the refresh token
      const jwtAgeSec = nowSec - issuedAt
      if (jwtAgeSec > 4 * 60 * 60 && token.refreshToken) {
        try {
          const { rotateRefreshToken } =
            await import('@/server/services/refresh-token.service')
          const rotated = await rotateRefreshToken(token.refreshToken as string)
          if (rotated) {
            token.refreshToken = rotated.token
            token.issuedAt = nowSec
          } else {
            // Refresh token invalid/expired — force re-login
            token.error = 'RefreshTokenExpired'
          }
        } catch {
          // Import/DB error in edge — skip rotation
        }
      }

      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = ((token.role as string) ??
        'VIEWER') as import('@prisma/client').UserRole
      session.user.department = (token.department as string | null) ?? null
      session.user.onboardingCompleted =
        (token.onboardingCompleted as boolean) ?? false

      // MFA enforcement: ADMIN/MANAGER must have TOTP enabled
      const role = token.role as string
      const totpEnabled = (token.totpEnabled as boolean) ?? false
      if ((role === 'ADMIN' || role === 'MANAGER') && !totpEnabled) {
        session.user.mfaSetupRequired = true
      } else {
        session.user.mfaSetupRequired = false
      }

      if (token.error) {
        session.error = token.error as string
      }
      return session
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
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Accesso non autorizzato' },
      },
      { status: 401 },
    )
  }
  return session.user as AuthUser
}

export async function requireRole(
  ...roles: UserRole[]
): Promise<AuthUser | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (!roles.includes(result.role)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Permessi insufficienti' },
      },
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
  const { prisma } = await import('@/lib/db')
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
