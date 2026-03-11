import { PageTransition } from '@/components/shared/page-transition'
import { RequestForm } from '@/components/requests/request-form'

export default function NewRequestPage() {
  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            Nuova Richiesta di Acquisto
          </h1>
          <p className="mt-1 text-sm text-pf-text-secondary">
            Compila i dettagli per creare una nuova richiesta
          </p>
        </div>
        <RequestForm />
      </div>
    </PageTransition>
  )
}
