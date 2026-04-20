import { AuditLogViewer } from '@/modules/core/audit-log'

export default function AdminAuditPage() {
  return (
    <div className="mx-auto w-full max-w-content space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-pf-text-primary">Audit Trail</h1>
        <p className="mt-1 text-sm text-pf-text-secondary">
          Storico immutabile delle modifiche ai dati critici. Ogni CREATE / UPDATE
          / DELETE è registrato con attore, timestamp e diff.
        </p>
      </div>
      <AuditLogViewer />
    </div>
  )
}
