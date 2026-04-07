import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { teamInviteSchema } from '@/lib/validations/onboarding'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import type { TeamInviteResult } from '@/types/onboarding'

export async function POST(req: Request) {
  try {
    const user = await requireRole('ADMIN')
    if (user instanceof NextResponse) return user

    const body = await req.json()
    const parsed = teamInviteSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
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

    return successResponse(results)
  } catch (error) {
    console.error('[api/onboarding/team] POST error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore invito team', 500)
  }
}
