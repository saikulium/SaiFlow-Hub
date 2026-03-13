import { PageTransition } from '@/components/shared/page-transition'
import { VendorDetailContent } from '@/components/vendors/vendor-detail-content'


export default function VendorDetailPage({ params }: { params: { id: string } }) {
  return (
    <PageTransition>
      <VendorDetailContent vendorId={params.id} />
    </PageTransition>
  )
}
