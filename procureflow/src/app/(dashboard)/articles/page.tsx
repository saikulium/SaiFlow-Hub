import { PageTransition } from '@/components/shared/page-transition'
import { ArticlesPageContent } from '@/modules/core/articles'

export default function ArticlesPage() {
  return (
    <PageTransition>
      <ArticlesPageContent />
    </PageTransition>
  )
}
