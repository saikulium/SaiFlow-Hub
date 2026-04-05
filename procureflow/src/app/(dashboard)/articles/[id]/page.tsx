import { PageTransition } from '@/components/shared/page-transition'
import { ArticleDetailView } from '@/components/articles/article-detail'

export default function ArticleDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <PageTransition>
      <ArticleDetailView articleId={params.id} />
    </PageTransition>
  )
}
