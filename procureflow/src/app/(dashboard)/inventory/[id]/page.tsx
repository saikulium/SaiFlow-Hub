import { MaterialDetailContent } from '@/components/inventory/material-detail-content'

export default function MaterialDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <MaterialDetailContent id={params.id} />
}
