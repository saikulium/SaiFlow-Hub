import { getEnabledModules } from '@/server/services/module.service'
import { isApiPrefixEnabled } from './helpers'
import { notFoundResponse } from '@/lib/api-response'

/**
 * API route guard: returns a 404 response if the module owning
 * the given pathname is disabled. Returns null if access is allowed.
 *
 * Usage in route handlers:
 *   const blocked = await requireModule('/api/invoices')
 *   if (blocked) return blocked
 */
export async function requireModule(pathname: string) {
  const modules = await getEnabledModules()
  if (!isApiPrefixEnabled(modules, pathname)) {
    return notFoundResponse()
  }
  return null
}
