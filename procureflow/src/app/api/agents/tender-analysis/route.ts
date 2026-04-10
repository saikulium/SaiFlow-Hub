import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { successResponse, errorResponse } from '@/lib/api-response'
import { analyzeTender } from '@/server/agents/tender-analysis.agent'

// ---------------------------------------------------------------------------
// POST /api/agents/tender-analysis — Trigger tender analysis agent
//
// Requires authenticated user.
// Accepts multipart form data with:
//   - tender_id (required): the ID of the tender to analyze
//   - pdf (optional): a PDF file of the tender document
//
// Analyzes a tender using Opus with adaptive thinking and returns a
// structured go/no-go recommendation.
// ---------------------------------------------------------------------------

const MAX_PDF_SIZE_BYTES = 32 * 1024 * 1024 // 32 MB

export async function POST(request: Request) {
  const authResult = await requireAuth()
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

  // Validate tender_id
  const tenderId = formData.get('tender_id')
  if (
    !tenderId ||
    typeof tenderId !== 'string' ||
    tenderId.trim().length === 0
  ) {
    return errorResponse('VALIDATION_ERROR', 'tender_id is required', 400)
  }

  // Extract optional PDF file
  let pdfBuffer: Buffer | undefined
  let pdfFilename: string | undefined

  const pdfFile = formData.get('pdf')
  if (pdfFile && pdfFile instanceof File) {
    // Validate MIME type
    const mimeType = pdfFile.type || ''
    if (mimeType !== 'application/pdf' && !pdfFile.name.endsWith('.pdf')) {
      return errorResponse(
        'INVALID_FILE_TYPE',
        'Il file deve essere un PDF',
        400,
      )
    }

    // Validate file size
    if (pdfFile.size > MAX_PDF_SIZE_BYTES) {
      return errorResponse(
        'FILE_TOO_LARGE',
        `File troppo grande (${(pdfFile.size / 1024 / 1024).toFixed(1)} MB). Massimo consentito: 32 MB`,
        400,
      )
    }

    pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
    pdfFilename = pdfFile.name
  }

  try {
    const result = await analyzeTender(tenderId, pdfBuffer, pdfFilename)

    return successResponse(result)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : ''
    const isNotFound = errMsg.includes('non trovata')

    if (isNotFound) {
      return errorResponse('TENDER_NOT_FOUND', 'Gara non trovata', 404)
    }
    return errorResponse(
      'TENDER_ANALYSIS_ERROR',
      "Errore nell'analisi della gara",
      500,
    )
  }
}
