import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  readonly children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/')
  }
  return <>{children}</>
}
