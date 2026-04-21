import { PageTransition } from '@/components/shared/page-transition'
import { RequestDetailContent } from '@/modules/core/requests'

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
