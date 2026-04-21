import { PageTransition } from '@/components/shared/page-transition'
import { CommessaDetail } from '@/modules/core/commesse'

interface CommessaDetailPageProps {
  params: { code: string }
}

export default function CommessaDetailPage({
  params,
}: CommessaDetailPageProps) {
  return (
    <PageTransition>
      <CommessaDetail code={params.code} />
    </PageTransition>
  )
}
