import { MaterialDetailContent } from '@/modules/core/inventory'

export default function MaterialDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <MaterialDetailContent id={params.id} />
}
