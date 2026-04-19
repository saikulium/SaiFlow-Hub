import { PageTransition } from '@/components/shared/page-transition'
import { CommessePageContent } from '@/modules/core/commesse'

export default function CommessePage() {
  return (
    <PageTransition>
      <CommessePageContent />
    </PageTransition>
  )
}
