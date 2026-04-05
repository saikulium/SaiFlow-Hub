import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth, requireRole } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { updateConfigSchema } from '@/lib/validations/admin'

export async function GET() {
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const config = await prisma.deployConfig.findUnique({
      where: { id: 'default' },
    })

    if (!config) {
      return successResponse(
        Object.freeze({
          deploy_name: 'ProcureFlow',
          enabled_modules: ['core'],
          categories: [],
          departments: [],
          cost_centers: [],
          approval_rules: null,
          company_logo_url: null,
        }),
      )
    }

    return successResponse(config)
  } catch (error) {
    console.error('[admin/config] GET error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore caricamento configurazione',
      500,
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const body = await request.json()
    const parsed = updateConfigSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
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
      data.approval_rules =
        parsed.data.approval_rules === null
          ? Prisma.JsonNull
          : parsed.data.approval_rules

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
        approval_rules: parsed.data.approval_rules
          ? parsed.data.approval_rules
          : Prisma.JsonNull,
        company_logo_url: parsed.data.company_logo_url ?? null,
      },
    })

    return successResponse(updated)
  } catch (error) {
    console.error('[admin/config] PATCH error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'Errore salvataggio configurazione',
      500,
    )
  }
}
