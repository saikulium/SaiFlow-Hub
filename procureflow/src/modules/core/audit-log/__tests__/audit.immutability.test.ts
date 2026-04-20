import { describe, it, expect } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { auditImmutableExtension } from '../server/audit.immutable.extension'

const extended = new PrismaClient().$extends(auditImmutableExtension)

describe('auditImmutableExtension — application-layer immutability', () => {
  it('blocks auditLog.update at ORM layer before reaching DB', async () => {
    await expect(
      extended.auditLog.update({
        where: { id: 'any' },
        data: { entity_id: 'tampered' },
      }),
    ).rejects.toThrow(/AuditLog is immutable/)
  })

  it('blocks auditLog.delete', async () => {
    await expect(
      extended.auditLog.delete({ where: { id: 'any' } }),
    ).rejects.toThrow(/AuditLog is immutable/)
  })

  it('blocks auditLog.deleteMany', async () => {
    await expect(extended.auditLog.deleteMany({})).rejects.toThrow(
      /AuditLog is immutable/,
    )
  })

  it('blocks auditLog.updateMany', async () => {
    await expect(
      extended.auditLog.updateMany({ data: { entity_id: 'x' } }),
    ).rejects.toThrow(/AuditLog is immutable/)
  })

  it('blocks auditLog.upsert', async () => {
    await expect(
      extended.auditLog.upsert({
        where: { id: 'x' },
        create: {
          action: 'CREATE',
          entity_type: 'X',
          entity_id: 'y',
        },
        update: { entity_id: 'z' },
      }),
    ).rejects.toThrow(/AuditLog is immutable/)
  })
})
