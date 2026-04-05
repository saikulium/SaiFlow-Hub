import { PageTransition } from '@/components/shared/page-transition'
import { CommessaDetail } from '@/components/commesse/commessa-detail'

interface CommessaDetailPageProps {
  params: { code: string }
}

export default function CommessaDetailPage({ params }: CommessaDetailPageProps) {
  return (
    <PageTransition>
      <CommessaDetail code={params.code} />
    </PageTransition>
  )
}
