import { TenderDetailContent } from '@/modules/core/tenders'

export default function TenderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <TenderDetailContent id={params.id} />
}
