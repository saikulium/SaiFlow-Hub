import { AsyncLocalStorage } from 'async_hooks'
import type { AuditContext } from '@/modules/core/audit-log'

const storage = new AsyncLocalStorage<AuditContext>()

export function setAuditContext<T>(
  ctx: AuditContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn)
}

export function getCurrentAuditContext(): AuditContext | undefined {
  return storage.getStore()
}

export type { AuditContext }
