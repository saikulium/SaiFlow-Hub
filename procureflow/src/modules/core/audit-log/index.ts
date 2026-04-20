// Public API for the audit-log module.
// Importa sempre da qui, mai dai file interni.

export {
  writeAuditLog,
  searchAuditLogs,
  getEntityAuditHistory,
} from './server/audit.service'

export { auditExtension } from './server/audit.extension'
export { auditImmutableExtension } from './server/audit.immutable.extension'

export {
  AUDITED_MODELS,
  USER_AUDITED_FIELDS,
  ENTITY_LABEL_FIELD,
} from './server/audit.constants'

export type {
  AuditContext,
  AuditChange,
  AuditChanges,
  WriteAuditLogParams,
  SearchAuditLogsFilters,
  AuditAction,
  AuditActorType,
} from './server/audit.types'

export { auditQuerySchema, type AuditQuery } from './validations/audit'

export { AuditLogViewer } from './components/audit-log-viewer'
