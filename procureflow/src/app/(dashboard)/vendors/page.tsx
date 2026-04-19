import { PageTransition } from '@/components/shared/page-transition'
import { VendorsPageContent } from '@/modules/core/vendors'

export default function VendorsPage() {
  return (
    <PageTransition>
      <VendorsPageContent />
    </PageTransition>
  )
}
