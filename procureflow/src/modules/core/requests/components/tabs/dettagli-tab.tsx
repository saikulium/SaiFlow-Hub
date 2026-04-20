import { formatCurrency, formatDate } from '@/lib/utils'
import type { RequestDetail } from '../../hooks/use-request'

function InfoField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-pf-text-secondary">{label}</dt>
      <dd className="text-sm text-pf-text-primary">
        {value || <span className="text-pf-text-secondary">—</span>}
      </dd>
    </div>
  )
}

export function DettagliTab({ request }: { readonly request: RequestDetail }) {
  return (
    <div className="space-y-6">
      {/* Info Grid */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
          Informazioni Generali
        </h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField
            label="Fornitore"
            value={request.vendor ? request.vendor.name : null}
          />
          <InfoField label="Richiedente" value={request.requester.name} />
          <InfoField
            label="Importo Stimato"
            value={
              request.estimated_amount !== null
                ? formatCurrency(request.estimated_amount)
                : null
            }
          />
          <InfoField
            label="Importo Effettivo"
            value={
              request.actual_amount !== null
                ? formatCurrency(request.actual_amount)
                : null
            }
          />
          <InfoField
            label="Data Necessità"
            value={request.needed_by ? formatDate(request.needed_by) : null}
          />
          <InfoField label="Categoria" value={request.category} />
          <InfoField label="Dipartimento" value={request.department} />
          <InfoField label="Centro Costo" value={request.cost_center} />
          <InfoField label="Codice Budget" value={request.budget_code} />
          <InfoField label="Riferimento Esterno" value={request.external_ref} />
          <InfoField label="Tracking" value={request.tracking_number} />
        </dl>
      </div>

      {/* Compliance */}
      {(request.cig || request.cup || request.is_mepa) && (
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
          <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
            Compliance
          </h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField
              label="CIG"
              value={
                request.cig ? (
                  <span className="font-mono">{request.cig}</span>
                ) : null
              }
            />
            <InfoField
              label="CUP"
              value={
                request.cup ? (
                  <span className="font-mono">{request.cup}</span>
                ) : null
              }
            />
            <InfoField label="MEPA" value={request.is_mepa ? 'Si' : 'No'} />
            {request.is_mepa && (
              <InfoField
                label="Numero ODA MEPA"
                value={request.mepa_oda_number}
              />
            )}
          </dl>
        </div>
      )}

      {/* Description */}
      {request.description && (
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
          <h3 className="mb-2 text-sm font-semibold text-pf-text-primary">
            Descrizione
          </h3>
          <p className="whitespace-pre-wrap text-sm text-pf-text-secondary">
            {request.description}
          </p>
        </div>
      )}

      {/* Items Table */}
      {request.items.length > 0 && (
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
          <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
            Articoli ({request.items.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pf-border text-left text-xs text-pf-text-secondary">
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 font-medium">Descrizione</th>
                  <th className="pb-2 pr-4 text-right font-medium">Quantità</th>
                  <th className="pb-2 pr-4 font-medium">Unità</th>
                  <th className="pb-2 pr-4 text-right font-medium">
                    Prezzo Unit.
                  </th>
                  <th className="pb-2 text-right font-medium">Totale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pf-border">
                {request.items.map((item) => (
                  <tr key={item.id} className="text-pf-text-primary">
                    <td className="py-2.5 pr-4 font-medium">{item.name}</td>
                    <td className="py-2.5 pr-4 text-pf-text-secondary">
                      {item.description || '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right">{item.quantity}</td>
                    <td className="py-2.5 pr-4 text-pf-text-secondary">
                      {item.unit || '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {item.unit_price !== null
                        ? formatCurrency(item.unit_price)
                        : '—'}
                    </td>
                    <td className="py-2.5 text-right font-medium">
                      {item.total_price !== null
                        ? formatCurrency(item.total_price)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tags */}
      {request.tags.length > 0 && (
        <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
          <h3 className="mb-3 text-sm font-semibold text-pf-text-primary">
            Tag
          </h3>
          <div className="flex flex-wrap gap-2">
            {request.tags.map((tag) => (
              <span
                key={tag}
                className="bg-pf-accent/10 rounded-badge px-2.5 py-0.5 text-xs font-medium text-pf-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
