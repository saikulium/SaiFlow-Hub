import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { budgetCheckSchema } from '@/lib/validations/budget'
import { checkBudgetCapacity } from '@/server/services/budget.service'
import { requireModule } from '@/lib/modules/require-module'

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/budgets')
  if (blocked) return blocked
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const parsed = budgetCheckSchema.safeParse(body)
    if (!parsed.success) return validationErrorResponse(parsed.error)

    const result = await checkBudgetCapacity(
      parsed.data.cost_center,
      parsed.data.amount,
    )

    return successResponse(result)
  } catch (error) {
    console.error('POST /api/budgets/check error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore verifica capienza', 500)
  }
}
