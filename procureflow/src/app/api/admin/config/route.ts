import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { updateConfigSchema } from '@/lib/validations/admin'

export async function GET() {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const config = await prisma.deployConfig.findUnique({
    where: { id: 'default' },
  })

  if (!config) {
    return NextResponse.json({
      success: true,
      data: Object.freeze({
        deploy_name: 'ProcureFlow',
        enabled_modules: ['core'],
        categories: [],
        departments: [],
        cost_centers: [],
        approval_rules: null,
        company_logo_url: null,
      }),
    })
  }

  return NextResponse.json({ success: true, data: config })
}

export async function PATCH(request: Request) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const body = await request.json()
  const parsed = updateConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        },
      },
      { status: 400 },
    )
  }

  const data: Record<string, unknown> = {}
  if (parsed.data.deploy_name !== undefined)
    data.deploy_name = parsed.data.deploy_name
  if (parsed.data.company_logo_url !== undefined)
    data.company_logo_url = parsed.data.company_logo_url
  if (parsed.data.enabled_modules !== undefined)
    data.enabled_modules = parsed.data.enabled_modules
  if (parsed.data.categories !== undefined)
    data.categories = parsed.data.categories
  if (parsed.data.departments !== undefined)
    data.departments = parsed.data.departments
  if (parsed.data.cost_centers !== undefined)
    data.cost_centers = parsed.data.cost_centers
  if (parsed.data.approval_rules !== undefined)
    data.approval_rules = parsed.data.approval_rules

  const updated = await prisma.deployConfig.upsert({
    where: { id: 'default' },
    update: data,
    create: {
      id: 'default',
      deploy_name: parsed.data.deploy_name ?? 'ProcureFlow',
      enabled_modules: parsed.data.enabled_modules ?? ['core'],
      categories: parsed.data.categories ?? [],
      departments: parsed.data.departments ?? [],
      cost_centers: parsed.data.cost_centers ?? [],
      approval_rules: parsed.data.approval_rules ?? Prisma.JsonNull,
      company_logo_url: parsed.data.company_logo_url ?? null,
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
