import { prisma } from '@/lib/db'

/**
 * Helper per ottenere l'utente corrente.
 *
 * In demo mode cerca il primo utente ADMIN nel database.
 * In produzione, qui si userebbe getServerSession(authOptions).
 */
export async function getCurrentUser(): Promise<{
  id: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'REQUESTER' | 'VIEWER'
  department: string | null
}> {
  // TODO: Sostituire con getServerSession(authOptions) quando NextAuth è configurato
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    select: { id: true, name: true, role: true, department: true },
  })

  if (!admin) {
    throw new Error(
      'Nessun utente ADMIN trovato nel sistema. Eseguire il seed del database.',
    )
  }

  return admin
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser()
  return user.id
}
