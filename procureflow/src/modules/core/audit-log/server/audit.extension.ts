import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { AUDITED_MODELS } from './audit.constants'
import {
  resolveContext,
  entityLabel,
  diffRecords,
  createChanges,
} from './audit.helpers'
import { writeAuditLog } from './audit.service'

type Args = Record<string, unknown>

async function safeWrite(
  params: Parameters<typeof writeAuditLog>[0],
): Promise<void> {
  try {
    await writeAuditLog(params)
  } catch (err) {
    console.error('[audit] Failed to write audit log (op continues):', err)
  }
}

export const auditExtension = Prisma.defineExtension({
  name: 'audit-log',
  query: {
    $allModels: {
      async create({ model, args, query }) {
        if (!AUDITED_MODELS.has(model)) return query(args)

        const result = await query(args)
        const record = result as Record<string, unknown>
        const ctx = resolveContext()
        if (!ctx) return result

        await safeWrite({
          actorId: ctx.actorId,
          actorType: ctx.actorType,
          actorLabel: ctx.actorLabel,
          action: 'CREATE',
          entityType: model,
          entityId: String(record.id ?? ''),
          entityLabel: entityLabel(model, record),
          changes: createChanges(model, record),
          correlationId: ctx.correlationId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        })
        return result
      },

      async update({ model, args, query }) {
        if (!AUDITED_MODELS.has(model)) return query(args)

        const ctx = resolveContext()
        if (!ctx) return query(args)

        const a = args as Args
        const where = a.where as Record<string, unknown> | undefined
        const before = where
          ? ((
              (await (
                await import('@/lib/db')
              ).prisma[
                (model.charAt(0).toLowerCase() +
                  model.slice(1)) as keyof (typeof import('@/lib/db'))['prisma']
              ]) as unknown as {
                findUnique: (arg: unknown) => Promise<unknown>
              }
            ).findUnique({ where }) as Promise<Record<string, unknown> | null>)
          : null

        const beforeRec = (await before) ?? {}
        const result = await query(args)
        const after = result as Record<string, unknown>

        const changes = diffRecords(model, beforeRec, after)
        if (Object.keys(changes).length === 0) return result

        await safeWrite({
          actorId: ctx.actorId,
          actorType: ctx.actorType,
          actorLabel: ctx.actorLabel,
          action: 'UPDATE',
          entityType: model,
          entityId: String(after.id ?? beforeRec.id ?? ''),
          entityLabel:
            entityLabel(model, after) ?? entityLabel(model, beforeRec),
          changes,
          correlationId: ctx.correlationId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        })
        return result
      },

      async delete({ model, args, query }) {
        if (!AUDITED_MODELS.has(model)) return query(args)

        const ctx = resolveContext()
        if (!ctx) return query(args)

        const a = args as Args
        const where = a.where as Record<string, unknown> | undefined
        const db = (await import('@/lib/db')).prisma
        const before = where
          ? ((
              db[
                (model.charAt(0).toLowerCase() +
                  model.slice(1)) as keyof typeof db
              ] as unknown as {
                findUnique: (arg: unknown) => Promise<unknown>
              }
            ).findUnique({ where }) as Promise<Record<string, unknown> | null>)
          : null

        const beforeRec = (await before) ?? {}
        const result = await query(args)

        await safeWrite({
          actorId: ctx.actorId,
          actorType: ctx.actorType,
          actorLabel: ctx.actorLabel,
          action: 'DELETE',
          entityType: model,
          entityId: String(beforeRec.id ?? ''),
          entityLabel: entityLabel(model, beforeRec),
          changes: null,
          metadata: { oldState: beforeRec },
          correlationId: ctx.correlationId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        })
        return result
      },

      async upsert({ model, args, query }) {
        if (!AUDITED_MODELS.has(model)) return query(args)

        const ctx = resolveContext()
        if (!ctx) return query(args)

        const a = args as Args
        const where = a.where as Record<string, unknown> | undefined
        const db = (await import('@/lib/db')).prisma
        const existing = where
          ? ((
              db[
                (model.charAt(0).toLowerCase() +
                  model.slice(1)) as keyof typeof db
              ] as unknown as {
                findUnique: (arg: unknown) => Promise<unknown>
              }
            ).findUnique({ where }) as Promise<Record<string, unknown> | null>)
          : null

        const beforeRec = await existing
        const result = await query(args)
        const after = result as Record<string, unknown>

        if (beforeRec) {
          const changes = diffRecords(model, beforeRec, after)
          if (Object.keys(changes).length === 0) return result
          await safeWrite({
            actorId: ctx.actorId,
            actorType: ctx.actorType,
            actorLabel: ctx.actorLabel,
            action: 'UPDATE',
            entityType: model,
            entityId: String(after.id ?? ''),
            entityLabel: entityLabel(model, after),
            changes,
            correlationId: ctx.correlationId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          })
        } else {
          await safeWrite({
            actorId: ctx.actorId,
            actorType: ctx.actorType,
            actorLabel: ctx.actorLabel,
            action: 'CREATE',
            entityType: model,
            entityId: String(after.id ?? ''),
            entityLabel: entityLabel(model, after),
            changes: createChanges(model, after),
            correlationId: ctx.correlationId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          })
        }
        return result
      },

      async updateMany({ model, args, query }) {
        if (!AUDITED_MODELS.has(model)) return query(args)

        const ctx = resolveContext()
        if (!ctx) return query(args)

        const a = args as Args
        const where = a.where as Record<string, unknown> | undefined
        const db = (await import('@/lib/db')).prisma
        const modelClient = db[
          (model.charAt(0).toLowerCase() + model.slice(1)) as keyof typeof db
        ] as unknown as {
          findMany: (arg: unknown) => Promise<Array<Record<string, unknown>>>
        }

        const before = await modelClient.findMany({ where })
        const result = await query(args)
        const ids = before.map((r) => r.id as string).filter(Boolean)
        const after = ids.length
          ? await modelClient.findMany({ where: { id: { in: ids } } })
          : []

        const correlationId = ctx.correlationId ?? randomUUID()

        for (const afterRec of after) {
          const beforeRec = before.find((b) => b.id === afterRec.id)
          if (!beforeRec) continue
          const changes = diffRecords(model, beforeRec, afterRec)
          if (Object.keys(changes).length === 0) continue
          await safeWrite({
            actorId: ctx.actorId,
            actorType: ctx.actorType,
            actorLabel: ctx.actorLabel,
            action: 'UPDATE',
            entityType: model,
            entityId: String(afterRec.id),
            entityLabel: entityLabel(model, afterRec),
            changes,
            metadata: { bulk: 'updateMany' },
            correlationId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          })
        }
        return result
      },

      async deleteMany({ model, args, query }) {
        if (!AUDITED_MODELS.has(model)) return query(args)

        const ctx = resolveContext()
        if (!ctx) return query(args)

        const a = args as Args
        const where = a.where as Record<string, unknown> | undefined
        const db = (await import('@/lib/db')).prisma
        const modelClient = db[
          (model.charAt(0).toLowerCase() + model.slice(1)) as keyof typeof db
        ] as unknown as {
          findMany: (arg: unknown) => Promise<Array<Record<string, unknown>>>
        }

        const before = await modelClient.findMany({ where })
        const result = await query(args)

        const correlationId = ctx.correlationId ?? randomUUID()

        for (const rec of before) {
          await safeWrite({
            actorId: ctx.actorId,
            actorType: ctx.actorType,
            actorLabel: ctx.actorLabel,
            action: 'DELETE',
            entityType: model,
            entityId: String(rec.id),
            entityLabel: entityLabel(model, rec),
            changes: null,
            metadata: { bulk: 'deleteMany', oldState: rec },
            correlationId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          })
        }
        return result
      },

      async createMany({ model, args, query }) {
        if (!AUDITED_MODELS.has(model)) return query(args)

        const result = await query(args)
        const ctx = resolveContext()
        if (!ctx) return result

        const a = args as Args
        const data = (Array.isArray(a.data) ? a.data : [a.data]) as Array<
          Record<string, unknown>
        >
        const correlationId = ctx.correlationId ?? randomUUID()

        for (const row of data) {
          await safeWrite({
            actorId: ctx.actorId,
            actorType: ctx.actorType,
            actorLabel: ctx.actorLabel,
            action: 'CREATE',
            entityType: model,
            entityId: String(row.id ?? ''),
            entityLabel: entityLabel(model, row),
            changes: createChanges(model, row),
            metadata: { bulk: 'createMany' },
            correlationId,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          })
        }
        return result
      },
    },
  },
})
