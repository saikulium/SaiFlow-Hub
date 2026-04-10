import { NextRequest, NextResponse } from 'next/server'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api-response'
import { requireRole } from '@/lib/auth'
import { csvRowSchema } from '@/lib/validations/article'
import {
  parseCsvRows,
  importArticles,
} from '@/server/services/article-import.service'

const MAX_ROWS = 10_000

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireRole('ADMIN', 'MANAGER')
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()

    if (!Array.isArray(body.rows)) {
      return errorResponse(
        'INVALID_FORMAT',
        'Body must contain a "rows" array',
        400,
      )
    }

    if (body.rows.length > MAX_ROWS) {
      return errorResponse(
        'TOO_MANY_ROWS',
        `Massimo ${MAX_ROWS} righe per import`,
        400,
      )
    }

    const validRows = []
    const validationErrors = []

    for (let i = 0; i < body.rows.length; i++) {
      const parsed = csvRowSchema.safeParse(body.rows[i])
      if (parsed.success) {
        validRows.push(parsed.data)
      } else {
        console.error(
          `Row ${i + 1} validation failed:`,
          JSON.stringify(body.rows[i]),
          parsed.error.flatten(),
        )
        validationErrors.push({
          row: i + 1,
          field:
            Object.keys(parsed.error.flatten().fieldErrors)[0] || 'unknown',
          message:
            Object.values(parsed.error.flatten().fieldErrors).flat()[0] ||
            'Dati non validi',
        })
      }
    }

    if (validationErrors.length > 0 && validRows.length === 0) {
      return validationErrorResponse(validationErrors)
    }

    const groups = parseCsvRows(validRows)
    const result = await importArticles(groups)

    const allErrors = [...validationErrors, ...result.errors]

    return successResponse({
      ...result,
      errors: allErrors,
    })
  } catch (error) {
    console.error('POST /api/articles/import error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore import', 500)
  }
}
