import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { importMaterials } from '@/server/services/import.service'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: Request) {
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return errorResponse('MISSING_FILE', 'File CSV mancante nel campo "file"', 400)
    }

    const ALLOWED_TYPES = new Set([
      'text/csv',
      'text/plain',
      'application/csv',
      'application/vnd.ms-excel',
    ])
    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      return errorResponse('INVALID_FILE_TYPE', 'Sono accettati solo file CSV', 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        'FILE_TOO_LARGE',
        `Il file supera la dimensione massima di 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        400,
      )
    }

    const csvText = await file.text()
    const result = await importMaterials(csvText)
    return successResponse(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore sconosciuto'
    console.error('POST /api/admin/import/materials error:', error)
    return errorResponse('IMPORT_ERROR', message, 400)
  }
}
