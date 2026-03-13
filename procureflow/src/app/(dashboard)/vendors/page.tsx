import { PageTransition } from '@/components/shared/page-transition'
import { VendorsPageContent } from '@/components/vendors/vendors-page-content'


export default function VendorsPage() {
  return (
    <PageTransition>
      <VendorsPageContent />
    </PageTransition>
  )
}
