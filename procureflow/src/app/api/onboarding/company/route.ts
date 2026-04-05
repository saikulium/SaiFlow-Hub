import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { companySetupSchema } from '@/lib/validations/onboarding'

export async function PATCH(req: Request) {
  const user = await requireRole('ADMIN')
  if (user instanceof NextResponse) return user

  const body = await req.json()
  const parsed = companySetupSchema.safeParse(body)
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

  const updateData: Record<string, unknown> = {}
  if (parsed.data.companyName) updateData.deploy_name = parsed.data.companyName
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

  return NextResponse.json({ success: true })
}

export async function GET() {
  const user = await requireRole('ADMIN')
  if (user instanceof NextResponse) return user

  const { prisma } = await import('@/lib/db')

  const config = await prisma.deployConfig.findUnique({
    where: { id: 'default' },
  })
  const vendorCount = await prisma.vendor.count()

  return NextResponse.json({
    success: true,
    data: {
      companyName: config?.deploy_name ?? 'ProcureFlow',
      categories: config?.categories ?? [],
      approvalRules: config?.approval_rules ?? null,
      vendorCount,
    },
  })
}
