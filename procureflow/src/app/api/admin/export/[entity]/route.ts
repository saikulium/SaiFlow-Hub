import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  isValidEntity,
  EXPORT_COLUMNS,
  toCsv,
  fetchEntityData,
} from '@/server/services/export.service'
import type { ExportEntity } from '@/server/services/export.service'

interface RouteParams {
  params: Promise<{ entity: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const { entity } = await params

  if (!isValidEntity(entity)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Entità non valida: "${entity}". Valori ammessi: vendors, materials, requests, invoices, users, budgets`,
        },
      },
      { status: 400 },
    )
  }

  const typedEntity = entity as ExportEntity
  const columns = EXPORT_COLUMNS[typedEntity]
  const rows = await fetchEntityData(typedEntity)
  const csv = toCsv(rows, columns)

  const now = new Date().toISOString().slice(0, 10)
  const filename = `${entity}_${now}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
