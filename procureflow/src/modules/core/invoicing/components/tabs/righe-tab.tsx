import type { InvoiceLineItemDetail } from '../../hooks/use-invoice'
import { formatCurrency } from '@/lib/utils'
import { List } from 'lucide-react'

interface RigheTabProps {
  lineItems: InvoiceLineItemDetail[]
}

export function RigheTab({ lineItems }: RigheTabProps) {
  if (lineItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pf-bg-tertiary">
          <List className="h-6 w-6 text-pf-text-secondary" />
        </div>
        <p className="text-sm font-medium text-pf-text-primary">Nessuna riga</p>
        <p className="mt-1 text-xs text-pf-text-secondary">
          Questa fattura non contiene righe di dettaglio.
        </p>
      </div>
    )
  }

  const totalAmount = lineItems.reduce(
    (sum, item) => sum + (item.total_price ?? 0),
    0,
  )

  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pf-border text-left text-xs text-pf-text-secondary">
              <th className="pb-2 pr-4 font-medium">#</th>
              <th className="pb-2 pr-4 font-medium">Descrizione</th>
              <th className="pb-2 pr-4 text-right font-medium">Qtà</th>
              <th className="pb-2 pr-4 text-right font-medium">
                Prezzo Unitario
              </th>
              <th className="pb-2 pr-4 text-right font-medium">Totale</th>
              <th className="pb-2 text-right font-medium">IVA %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pf-border">
            {lineItems.map((item) => (
              <tr key={item.id} className="text-pf-text-primary">
                <td className="py-2.5 pr-4 font-mono text-pf-text-secondary">
                  {item.line_number}
                </td>
                <td className="py-2.5 pr-4">{item.description || '—'}</td>
                <td className="py-2.5 pr-4 text-right font-mono">
                  {item.quantity}
                  {item.unit_of_measure ? ` ${item.unit_of_measure}` : ''}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono">
                  {item.unit_price !== null
                    ? formatCurrency(item.unit_price)
                    : '—'}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono font-medium">
                  {item.total_price !== null
                    ? formatCurrency(item.total_price)
                    : '—'}
                </td>
                <td className="py-2.5 text-right font-mono">
                  {item.vat_rate !== null ? `${item.vat_rate}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-pf-border">
              <td
                colSpan={4}
                className="py-3 pr-4 text-right text-xs font-medium uppercase tracking-wider text-pf-text-secondary"
              >
                Totale
              </td>
              <td className="py-3 pr-4 text-right font-mono text-sm font-semibold text-pf-text-primary">
                {formatCurrency(totalAmount)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
