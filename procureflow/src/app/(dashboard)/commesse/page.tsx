import { PageTransition } from '@/components/shared/page-transition'
import { CommessePageContent } from '@/components/commesse/commesse-page-content'

export default function CommessePage() {
  return (
    <PageTransition>
      <CommessePageContent />
    </PageTransition>
  )
}
