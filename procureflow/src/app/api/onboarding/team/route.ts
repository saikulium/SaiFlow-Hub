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
      {
        success: false,
        error: { code: 'VALIDATION', message: parsed.error.message },
      },
      { status: 400 },
    )
  }

  const { prisma } = await import('@/lib/db')
  const bcrypt = (await import('bcryptjs')).default
  const { randomBytes } = await import('crypto')

  const results: TeamInviteResult[] = []

  for (const invite of parsed.data.invites) {
    try {
      const exists = await prisma.user.findUnique({
        where: { email: invite.email },
      })
      if (exists) {
        results.push({
          email: invite.email,
          password: '',
          success: false,
          error: 'Email già registrata',
        })
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
      results.push({
        email: invite.email,
        password: '',
        success: false,
        error: 'Errore creazione utente',
      })
    }
  }

  return NextResponse.json({ success: true, data: results })
}
