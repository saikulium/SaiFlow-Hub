import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'

/**
 * Fetch enabled modules from DB, cached across requests for 60s.
 * unstable_cache persists the result in Next.js Data Cache.
 */
const fetchEnabledModules = unstable_cache(
  async (): Promise<readonly string[]> => {
    try {
      const config = await prisma.deployConfig.findUnique({
        where: { id: 'default' },
        select: { enabled_modules: true },
      })
      return config?.enabled_modules ?? ['core']
    } catch {
      return ['core']
    }
  },
  ['enabled-modules'],
  { revalidate: 60 },
)

/**
 * Get enabled modules for the current deploy.
 * - unstable_cache: shared across requests, revalidates every 60s
 * - React cache(): deduped within a single request (multiple server components)
 */
export const getEnabledModules = cache(fetchEnabledModules)
