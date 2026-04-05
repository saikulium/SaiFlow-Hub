import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse, validationErrorResponse } from '@/lib/api-response'
import { completeOnboardingSchema } from '@/lib/validations/onboarding'

export async function PATCH(req: Request) {
  try {
    const user = await requireAuth()
    if (user instanceof NextResponse) return user

    const body = await req.json()
    const parsed = completeOnboardingSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
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
      const current =
        (existing?.onboarding_data as Record<string, unknown>) ?? {}
      updateData.onboarding_data = {
        ...current,
        ...(parsed.data.completedSteps && {
          completedSteps: parsed.data.completedSteps,
        }),
        ...(parsed.data.dismissedUntil && {
          dismissedUntil: parsed.data.dismissedUntil,
        }),
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    })

    return successResponse({ updated: true })
  } catch (error) {
    console.error('PATCH /api/onboarding error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore aggiornamento onboarding', 500)
  }
}

export async function GET() {
  try {
    const user = await requireAuth()
    if (user instanceof NextResponse) return user

    const { prisma } = await import('@/lib/db')
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        onboarding_completed: true,
        onboarding_data: true,
        role: true,
      },
    })

    if (!dbUser) {
      return errorResponse('NOT_FOUND', 'Utente non trovato', 404)
    }

    return successResponse({
      isComplete: dbUser.onboarding_completed,
      data: dbUser.onboarding_data,
      role: dbUser.role,
    })
  } catch (error) {
    console.error('GET /api/onboarding error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore caricamento onboarding', 500)
  }
}
