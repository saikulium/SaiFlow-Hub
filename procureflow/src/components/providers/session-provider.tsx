'use client'

import {
  SessionProvider as NextAuthSessionProvider,
  signOut,
  useSession,
} from 'next-auth/react'
import { useEffect, type ReactNode } from 'react'

function SessionGuard({ children }: { children: ReactNode }) {
  const { data: session } = useSession()

  useEffect(() => {
    if (session && session.error === 'RefreshTokenExpired') {
      signOut({ redirect: true, callbackUrl: '/login' })
    }
  }, [session])

  return <>{children}</>
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <SessionGuard>{children}</SessionGuard>
    </NextAuthSessionProvider>
  )
}
