import { PageTransition } from '@/components/shared/page-transition'
import { ClientsPageContent } from '@/modules/core/clients'

export default function ClientsPage() {
  return (
    <PageTransition>
      <ClientsPageContent />
    </PageTransition>
  )
}
