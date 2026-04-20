import { Prisma } from '@prisma/client'

const BLOCKED_OPS = new Set([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
])

export const auditImmutableExtension = Prisma.defineExtension({
  name: 'audit-log-immutable',
  query: {
    auditLog: {
      async $allOperations({ operation, args, query }) {
        if (BLOCKED_OPS.has(operation)) {
          throw new Error(
            `AuditLog is immutable (${operation} blocked at application layer)`,
          )
        }
        return query(args)
      },
    },
  },
})
