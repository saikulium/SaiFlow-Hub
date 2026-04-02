import { PageTransition } from '@/components/shared/page-transition'
import { ClientsPageContent } from '@/components/clients/clients-page-content'

export default function ClientsPage() {
  return (
    <PageTransition>
      <ClientsPageContent />
    </PageTransition>
  )
}
