import { Prisma } from '@prisma/client'

const BLOCKED_OPS = new Set([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
])

// Prisma.defineExtension throws in a browser environment. Client bundles
// transitively import this module via the db.ts → audit chain through module
// barrels, so guard the top-level call. Client code never invokes this.
export const auditImmutableExtension =
  typeof window === 'undefined'
    ? Prisma.defineExtension({
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
    : // Client stub: never reached at runtime (guarded by typeof window).
      (undefined as unknown as ReturnType<typeof Prisma.defineExtension>)
