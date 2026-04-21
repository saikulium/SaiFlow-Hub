'use client'

import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

const SECURITY_PATH = '/settings/security'

export function MfaGuard({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  const mfaSetupRequired = session?.user?.mfaSetupRequired ?? false
  const isOnSecurityPage = pathname === SECURITY_PATH

  useEffect(() => {
    if (mfaSetupRequired && !isOnSecurityPage) {
      router.replace(SECURITY_PATH)
    }
  }, [mfaSetupRequired, isOnSecurityPage, router])

  if (mfaSetupRequired && !isOnSecurityPage) {
    return null // Will redirect
  }

  return <>{children}</>
}
