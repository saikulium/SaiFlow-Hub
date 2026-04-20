import { PrismaClient } from '@prisma/client'
import {
  auditExtension,
  auditImmutableExtension,
} from '@/modules/core/audit-log'

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

export const prisma: ExtendedPrismaClient =
  globalForPrisma.prisma ?? createExtendedClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
