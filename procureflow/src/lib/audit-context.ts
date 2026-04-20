import type { AuditContext } from '@/modules/core/audit-log'

// async_hooks is a Node built-in. Client bundles transitively pull this file
// through barrel re-exports (Prisma extensions chain) even though client code
// never calls setAuditContext/getCurrentAuditContext. We therefore:
//  - avoid a top-level `import { AsyncLocalStorage } from 'async_hooks'`
//    (would crash on client load),
//  - lazy-require on first server call,
//  - no-op on the client.

type ALSType = InstanceType<
  typeof import('async_hooks').AsyncLocalStorage<AuditContext>
>

let storage: ALSType | null = null

function ensureStorage(): ALSType | null {
  if (storage) return storage
  if (typeof window !== 'undefined') return null
  // Conditional require keeps webpack from eagerly resolving async_hooks for
  // the browser bundle; combined with the resolve.fallback it stays server-only.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AsyncLocalStorage } =
    require('async_hooks') as typeof import('async_hooks')
  storage = new AsyncLocalStorage<AuditContext>()
  return storage
}

export function setAuditContext<T>(
  ctx: AuditContext,
  fn: () => Promise<T>,
): Promise<T> {
  const s = ensureStorage()
  if (!s) return fn()
  return s.run(ctx, fn)
}

// Non-wrapping variant: sets the context for the current async scope and all
// subsequent async operations on this chain. Use from places where we can't
// wrap the downstream handler (e.g. `requireRole()` returning a value instead
// of executing a callback). `setAuditContext.run()` takes precedence when both
// are used: the innermost `run` or `enterWith` wins.
export function enterAuditContext(ctx: AuditContext): void {
  const s = ensureStorage()
  if (!s) return
  s.enterWith(ctx)
}

export function getCurrentAuditContext(): AuditContext | undefined {
  return storage?.getStore() ?? undefined
}

export type { AuditContext }
