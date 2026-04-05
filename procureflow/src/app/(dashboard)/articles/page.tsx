import { PageTransition } from '@/components/shared/page-transition'
import { ArticlesPageContent } from '@/components/articles/articles-page-content'

export default function ArticlesPage() {
  return (
    <PageTransition>
      <ArticlesPageContent />
    </PageTransition>
  )
}
