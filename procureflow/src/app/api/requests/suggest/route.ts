import { NextRequest } from 'next/server'
import { requireModule } from '@/lib/modules/require-module'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { suggestRequestSchema } from '@/lib/validations/suggest'
import { getSuggestions } from '@/server/services/suggest.service'

export async function POST(req: NextRequest) {
  const blocked = await requireModule('/api/requests/suggest')
  if (blocked) return blocked

  try {
    const body = await req.json()
    const parsed = suggestRequestSchema.safeParse(body)

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.flatten())
    }

    const suggestion = await getSuggestions(parsed.data.title)

    return successResponse(suggestion)
  } catch (error) {
    console.error('POST /api/requests/suggest error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore nel suggerimento', 500)
  }
}
