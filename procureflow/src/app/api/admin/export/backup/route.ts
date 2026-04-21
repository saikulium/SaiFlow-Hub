import { NextResponse } from 'next/server'
import archiver from 'archiver'
import { Readable } from 'stream'
import { requireRole } from '@/lib/auth'
import { errorResponse } from '@/lib/api-response'
import {
  EXPORT_COLUMNS,
  toCsv,
  fetchEntityData,
} from '@/server/services/export.service'
import type { ExportEntity } from '@/server/services/export.service'

const ALL_ENTITIES: readonly ExportEntity[] = Object.freeze([
  'vendors',
  'materials',
  'requests',
  'invoices',
  'users',
  'budgets',
])

export async function GET() {
  try {
    const authResult = await requireRole('ADMIN')
    if (authResult instanceof NextResponse) return authResult

    // Fetch all entities in parallel
    const entityResults = await Promise.all(
      ALL_ENTITIES.map(async (entity) => {
        const rows = await fetchEntityData(entity)
        const columns = EXPORT_COLUMNS[entity]
        const csv = toCsv(rows, columns)
        return { entity, csv }
      }),
    )

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []

    const collectStream = new Promise<Buffer>((resolve, reject) => {
      archive.on('data', (chunk: Buffer) => chunks.push(chunk))
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', (err) => reject(err))
    })

    for (const { entity, csv } of entityResults) {
      archive.append(Readable.from([csv]), { name: `${entity}.csv` })
    }

    await archive.finalize()
    const zipBuffer = await collectStream

    const now = new Date().toISOString().slice(0, 10)
    const filename = `procureflow_backup_${now}.zip`

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('GET /api/admin/export/backup error:', error)
    return errorResponse('INTERNAL_ERROR', 'Errore generazione backup', 500)
  }
}
