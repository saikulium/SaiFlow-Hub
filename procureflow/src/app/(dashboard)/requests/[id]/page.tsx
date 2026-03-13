import { PageTransition } from '@/components/shared/page-transition'
import { RequestDetailContent } from '@/components/requests/request-detail-content'


export default function RequestDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <PageTransition>
      <RequestDetailContent requestId={params.id} />
    </PageTransition>
  )
}
