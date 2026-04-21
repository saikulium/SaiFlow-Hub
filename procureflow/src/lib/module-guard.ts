import { NextResponse } from 'next/server'
import { isModuleEnabled } from '@/config/runtime'

/**
 * Guard da usare in API route per rifiutare richieste a moduli non attivi.
 *
 * Uso:
 *   export async function GET(req: Request) {
 *     const guard = assertModuleEnabled('invoicing')
 *     if (guard) return guard
 *     // ... logica route
 *   }
 */
export function assertModuleEnabled(moduleName: string): NextResponse | null {
  if (!isModuleEnabled(moduleName)) {
    return NextResponse.json(
      {
        error: 'MODULE_DISABLED',
        message: `Il modulo "${moduleName}" non è attivo per questa istanza.`,
      },
      { status: 404 },
    )
  }
  return null
}

/**
 * Helper per componenti React/server che renderizzano in base al modulo.
 */
export function withModuleCheck<T>(moduleName: string, value: T): T | null {
  return isModuleEnabled(moduleName) ? value : null
}
