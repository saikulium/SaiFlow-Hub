import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { companySetupSchema } from '@/lib/validations/onboarding'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'

export async function PATCH(req: Request) {
  try {
    const user = await requireRole('ADMIN')
    if (user instanceof NextResponse) return user

    const body = await req.json()
    const parsed = companySetupSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const { prisma } = await import('@/lib/db')

    const updateData: Record<string, unknown> = {}
    if (parsed.data.companyName)
      updateData.deploy_name = parsed.data.companyName
    if (parsed.data.categories) updateData.categories = parsed.data.categories
    if (parsed.data.approvalRules)
      updateData.approval_rules = parsed.data.approvalRules

    if (Object.keys(updateData).length > 0) {
      await prisma.deployConfig.upsert({
        where: { id: 'default' },
        update: updateData,
        create: { id: 'default', ...updateData, enabled_modules: ['core'] },
      })
    }

    return successResponse(null)
  } catch (error) {
    console.error('[api/onboarding/company] PATCH error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore aggiornamento configurazione',
      500,
    )
  }
}

export async function GET() {
  try {
    const user = await requireRole('ADMIN')
    if (user instanceof NextResponse) return user

    const { prisma } = await import('@/lib/db')

    const config = await prisma.deployConfig.findUnique({
      where: { id: 'default' },
    })
    const vendorCount = await prisma.vendor.count()

    return successResponse({
      companyName: config?.deploy_name ?? 'ProcureFlow',
      categories: config?.categories ?? [],
      approvalRules: config?.approval_rules ?? null,
      vendorCount,
    })
  } catch (error) {
    console.error('[api/onboarding/company] GET error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore recupero configurazione',
      500,
    )
  }
}
