import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { processVendorImport } from '@/server/agents/onboarding.agent'

// ---------------------------------------------------------------------------
// POST /api/agents/onboarding — Import vendors from CSV/text file
//
// Requires authenticated ADMIN user.
// Accepts multipart form data with a `file` field (text/csv or text/plain).
// Calls the onboarding agent to parse, normalise, and import vendors.
// ---------------------------------------------------------------------------

const SUPPORTED_MIME_TYPES = new Set(['text/csv', 'text/plain'])

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(request: Request) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse(
      'INVALID_FORM_DATA',
      'La richiesta deve contenere dati multipart/form-data',
      400,
    )
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return errorResponse('MISSING_FILE', 'Il campo "file" e obbligatorio', 400)
  }

  // Validate MIME type
  const mimeType = file.type || 'text/plain'
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    const isExcel =
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')

    const message = isExcel
      ? "Converti il file in CSV prima dell'importazione"
      : `Tipo file non supportato: ${mimeType}. Formati accettati: CSV, testo semplice`

    return errorResponse('UNSUPPORTED_FILE_TYPE', message, 400)
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return errorResponse(
      'FILE_TOO_LARGE',
      `File troppo grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Massimo consentito: 5 MB`,
      400,
    )
  }

  // Read file content as Buffer for the Files API
  let fileBuffer: Buffer
  try {
    const arrayBuffer = await file.arrayBuffer()
    fileBuffer = Buffer.from(arrayBuffer)
  } catch {
    return errorResponse(
      'FILE_READ_ERROR',
      'Impossibile leggere il contenuto del file',
      400,
    )
  }

  if (fileBuffer.length === 0) {
    return errorResponse('EMPTY_FILE', 'Il file e vuoto', 400)
  }

  try {
    const result = await processVendorImport(fileBuffer, file.name, mimeType)

    return successResponse(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    return errorResponse(
      'ONBOARDING_IMPORT_ERROR',
      `Errore nell'importazione fornitori: ${message}`,
      500,
    )
  }
}
