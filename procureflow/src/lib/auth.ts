import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { loginSchema } from '@/lib/validations/auth'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
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

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.password_hash,
        )
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
        token.department = (user as { department: string | null }).department
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = ((token.role as string) ??
        'VIEWER') as import('@prisma/client').UserRole
      session.user.department = (token.department as string | null) ?? null
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
