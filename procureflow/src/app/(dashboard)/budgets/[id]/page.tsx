import { BudgetDetailContent } from '@/modules/core/budgets'

export default function BudgetDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return <BudgetDetailContent id={params.id} />
}
