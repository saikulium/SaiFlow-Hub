import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
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
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_FORM_DATA',
          message: 'La richiesta deve contenere dati multipart/form-data',
        },
      },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MISSING_FILE',
          message: 'Il campo "file" e obbligatorio',
        },
      },
      { status: 400 },
    )
  }

  // Validate MIME type
  const mimeType = file.type || 'text/plain'
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    // Check for Excel-like MIME types and return a helpful message
    const isExcel =
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')

    const message = isExcel
      ? "Converti il file in CSV prima dell'importazione"
      : `Tipo file non supportato: ${mimeType}. Formati accettati: CSV, testo semplice`

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNSUPPORTED_FILE_TYPE',
          message,
        },
      },
      { status: 400 },
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File troppo grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Massimo consentito: 5 MB`,
        },
      },
      { status: 400 },
    )
  }

  // Read file content as Buffer for the Files API
  let fileBuffer: Buffer
  try {
    const arrayBuffer = await file.arrayBuffer()
    fileBuffer = Buffer.from(arrayBuffer)
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FILE_READ_ERROR',
          message: 'Impossibile leggere il contenuto del file',
        },
      },
      { status: 400 },
    )
  }

  if (fileBuffer.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'EMPTY_FILE',
          message: 'Il file e vuoto',
        },
      },
      { status: 400 },
    )
  }

  try {
    const result = await processVendorImport(fileBuffer, file.name, mimeType)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ONBOARDING_IMPORT_ERROR',
          message: `Errore nell'importazione fornitori: ${message}`,
        },
      },
      { status: 500 },
    )
  }
}
