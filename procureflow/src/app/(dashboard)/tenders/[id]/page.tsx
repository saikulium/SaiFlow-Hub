import { TenderDetailContent } from '@/components/tenders/tender-detail-content'


export default function TenderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <TenderDetailContent id={params.id} />
}
