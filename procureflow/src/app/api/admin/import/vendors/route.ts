import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { importVendors } from '@/server/services/import.service'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: Request) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const formData = await request.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MISSING_FILE',
          message: 'File CSV mancante nel campo "file"',
        },
      },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `Il file supera la dimensione massima di 5MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        },
      },
      { status: 400 },
    )
  }

  const csvText = await file.text()

  try {
    const result = await importVendors(csvText)
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json(
      {
        success: false,
        error: { code: 'IMPORT_ERROR', message },
      },
      { status: 400 },
    )
  }
}
