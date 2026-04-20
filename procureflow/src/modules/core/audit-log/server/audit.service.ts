import { prisma } from '@/lib/db'
import type {
  AuditAction,
  AuditActorType,
  SearchAuditLogsFilters,
  WriteAuditLogParams,
} from './audit.types'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actor_id: params.actorId ?? null,
      actor_type: params.actorType,
      actor_label: params.actorLabel ?? null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      entity_label: params.entityLabel ?? null,
      changes: (params.changes ?? undefined) as never,
      metadata: (params.metadata ?? undefined) as never,
      correlation_id: params.correlationId ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    },
  })
}

export async function searchAuditLogs(filters: SearchAuditLogsFilters) {
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT)

  const where: Record<string, unknown> = {}
  if (filters.actorId) where.actor_id = filters.actorId
  if (filters.actorType) where.actor_type = filters.actorType
  if (filters.entityType) where.entity_type = filters.entityType
  if (filters.entityId) where.entity_id = filters.entityId
  if (filters.action) where.action = filters.action
  if (filters.correlationId) where.correlation_id = filters.correlationId
  if (filters.from || filters.to) {
    where.timestamp = {
      ...(filters.from && { gte: filters.from }),
      ...(filters.to && { lte: filters.to }),
    }
  }

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(filters.cursor && { cursor: { id: filters.cursor }, skip: 1 }),
  })

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? items[items.length - 1]!.id : null

  return { items, nextCursor, hasMore }
}

export async function getEntityAuditHistory(
  entityType: string,
  entityId: string,
  limit = 100,
) {
  return prisma.auditLog.findMany({
    where: { entity_type: entityType, entity_id: entityId },
    orderBy: { timestamp: 'desc' },
    take: Math.min(limit, MAX_LIMIT),
  })
}

export type { AuditAction, AuditActorType }
