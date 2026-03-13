import type { InvoiceDetail } from '@/hooks/use-invoice'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

function InfoField({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-pf-text-secondary">
        {label}
      </dt>
      <dd className={cn('mt-1 text-sm text-pf-text-primary', mono && 'font-mono')}>
        {value ?? '—'}
      </dd>
    </div>
  )
}

interface DettagliTabProps {
  invoice: InvoiceDetail
}

export function DettagliTab({ invoice }: DettagliTabProps) {
  return (
    <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
      <h3 className="mb-4 text-sm font-semibold text-pf-text-primary">
        Dati Fattura
      </h3>
      <dl className="grid grid-cols-2 gap-6 md:grid-cols-3">
        <InfoField
          label="Numero Fattura"
          value={invoice.invoice_number}
          mono
        />
        <InfoField
          label="Data Fattura"
          value={invoice.invoice_date ? formatDate(invoice.invoice_date) : null}
        />
        <InfoField label="Tipo Documento" value={invoice.document_type} />
        <InfoField label="Fornitore" value={invoice.supplier_name} />
        <InfoField
          label="P.IVA Fornitore"
          value={invoice.supplier_vat_id}
          mono
        />
        <InfoField
          label="P.IVA Cliente"
          value={invoice.customer_vat_id}
          mono
        />
        <InfoField
          label="Imponibile"
          value={
            invoice.total_taxable !== null
              ? formatCurrency(invoice.total_taxable)
              : null
          }
          mono
        />
        <InfoField
          label="Imposta"
          value={
            invoice.total_tax !== null
              ? formatCurrency(invoice.total_tax)
              : null
          }
          mono
        />
        <InfoField
          label="Totale"
          value={formatCurrency(invoice.total_amount)}
          mono
        />
        <InfoField label="Valuta" value={invoice.currency} />
        <InfoField label="Metodo Pagamento" value={invoice.payment_method} />
        <InfoField
          label="Scadenza Pagamento"
          value={
            invoice.payment_due_date
              ? formatDate(invoice.payment_due_date)
              : null
          }
        />
        <InfoField label="IBAN" value={invoice.iban} mono />
        <InfoField label="SDI ID" value={invoice.sdi_id} mono />
        <InfoField label="Nome File SDI" value={invoice.sdi_filename} mono />
        <InfoField label="Stato SDI" value={invoice.sdi_status} />
        <div className="col-span-2 md:col-span-3">
          <InfoField label="Causale" value={invoice.causale} />
        </div>
        <InfoField
          label="Codice PR Estratto"
          value={invoice.pr_code_extracted}
          mono
        />
      </dl>
    </div>
  )
}
