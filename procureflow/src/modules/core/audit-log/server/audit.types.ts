import type { AuditAction, AuditActorType } from '@prisma/client'

export type { AuditAction, AuditActorType }

export interface AuditContext {
  actorId?: string
  actorType: AuditActorType
  actorLabel?: string
  ipAddress?: string
  userAgent?: string
  correlationId?: string
}

export interface AuditChange {
  old: unknown
  new: unknown
}

export interface AuditChanges {
  [field: string]: AuditChange
}

export interface WriteAuditLogParams {
  actorId?: string | null
  actorType: AuditActorType
  actorLabel?: string | null
  action: AuditAction
  entityType: string
  entityId: string
  entityLabel?: string | null
  changes?: AuditChanges | null
  metadata?: Record<string, unknown> | null
  correlationId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface SearchAuditLogsFilters {
  actorId?: string
  actorType?: AuditActorType
  entityType?: string
  entityId?: string
  action?: AuditAction
  correlationId?: string
  from?: Date
  to?: Date
  cursor?: string
  limit?: number
}
