import { BudgetDetailContent } from '@/components/budgets/budget-detail-content'

export default function BudgetDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <BudgetDetailContent id={params.id} />
}
