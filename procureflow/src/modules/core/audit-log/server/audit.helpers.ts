import { getCurrentAuditContext } from '@/lib/audit-context'
import { ENTITY_LABEL_FIELD, USER_AUDITED_FIELDS } from './audit.constants'
import type { AuditChanges, AuditContext } from './audit.types'

export function resolveContext(): AuditContext | undefined {
  const ctx = getCurrentAuditContext()
  if (ctx) return ctx

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Missing audit context in production — setAuditContext must wrap audited mutations',
    )
  }

  console.warn(
    '[audit] Missing audit context in non-production — recording as actor=UNKNOWN',
  )
  return { actorType: 'USER', actorLabel: 'UNKNOWN' }
}

export function entityLabel(
  model: string,
  record: Record<string, unknown> | null | undefined,
): string | null {
  if (!record) return null
  const field = ENTITY_LABEL_FIELD[model]
  if (!field) return null
  const value = record[field]
  return typeof value === 'string' ? value : null
}

export function diffRecords(
  model: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AuditChanges {
  const changes: AuditChanges = {}
  const allowed = model === 'User' ? USER_AUDITED_FIELDS : null

  for (const key of Object.keys({ ...before, ...after })) {
    if (allowed && !allowed.has(key)) continue
    const oldVal = before[key] ?? null
    const newVal = after[key] ?? null
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal }
    }
  }
  return changes
}

export function createChanges(
  model: string,
  record: Record<string, unknown>,
): AuditChanges {
  const changes: AuditChanges = {}
  const allowed = model === 'User' ? USER_AUDITED_FIELDS : null

  for (const key of Object.keys(record)) {
    if (allowed && !allowed.has(key)) continue
    if (record[key] === null || record[key] === undefined) continue
    changes[key] = { old: null, new: record[key] }
  }
  return changes
}
