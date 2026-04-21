import type { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: UserRole
      department: string | null
      mfaSetupRequired?: boolean
      onboardingCompleted?: boolean
    }
    error?: string
  }

  interface User {
    role: UserRole
    department: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    department: string | null
    refreshToken?: string
    tokenVersion?: number
    totpEnabled?: boolean
    onboardingCompleted?: boolean
    issuedAt?: number
    lastVersionCheck?: number
    error?: string
  }
}
