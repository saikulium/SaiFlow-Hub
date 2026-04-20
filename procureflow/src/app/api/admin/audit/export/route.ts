import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { searchAuditLogs, auditQuerySchema } from '@/modules/core/audit-log'

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str =
    typeof value === 'string' ? value : JSON.stringify(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const HEADER = [
  'id',
  'timestamp',
  'actor_id',
  'actor_type',
  'actor_label',
  'action',
  'entity_type',
  'entity_id',
  'entity_label',
  'changes',
  'correlation_id',
  'ip_address',
  'user_agent',
]

export async function GET(req: Request) {
  const authResult = await requireRole('ADMIN')
  if (authResult instanceof NextResponse) return authResult

  const url = new URL(req.url)
  const raw = Object.fromEntries(url.searchParams)
  const parsed = auditQuerySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { items } = await searchAuditLogs({ ...parsed.data, limit: 200 })
  const lines = [HEADER.join(',')]
  for (const row of items) {
    lines.push(
      [
        row.id,
        row.timestamp.toISOString(),
        row.actor_id,
        row.actor_type,
        row.actor_label,
        row.action,
        row.entity_type,
        row.entity_id,
        row.entity_label,
        row.changes,
        row.correlation_id,
        row.ip_address,
        row.user_agent,
      ]
        .map(csvEscape)
        .join(','),
    )
  }

  const body = lines.join('\n')
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-log-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  })
}
