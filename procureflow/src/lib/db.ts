import { PrismaClient } from '@prisma/client'
// NOTE: import directly from extension files (not the module barrel) to avoid
// a circular import through the audit-log barrel → audit.service.ts → db.ts.
import { auditExtension } from '@/modules/core/audit-log/server/audit.extension'
import { auditImmutableExtension } from '@/modules/core/audit-log/server/audit.immutable.extension'

function createExtendedClient() {
  return new PrismaClient()
    .$extends(auditImmutableExtension)
    .$extends(auditExtension)
}

type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>

export type TxClient = Parameters<
  Parameters<ExtendedPrismaClient['$transaction']>[0]
>[0]

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined
}

// Client bundles transitively pull this module via barrel re-exports
// (budgets/requests/... → db.ts). `new PrismaClient()` throws in the browser,
// so we only instantiate on the server. The client gets a stub: client code
// never actually calls prisma methods — all DB access goes through API routes.
export const prisma: ExtendedPrismaClient =
  typeof window === 'undefined'
    ? (globalForPrisma.prisma ?? createExtendedClient())
    : ({} as ExtendedPrismaClient)

if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
