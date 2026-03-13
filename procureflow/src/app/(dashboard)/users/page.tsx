import { UsersPageContent } from '@/components/users/users-page-content'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Utenti',
}


export default function UsersPage() {
  return <UsersPageContent />
}
