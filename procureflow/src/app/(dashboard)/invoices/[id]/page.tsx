'use client'

import { useParams } from 'next/navigation'
import { InvoiceDetailContent } from '@/components/invoices/invoice-detail-content'

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>()
  return <InvoiceDetailContent invoiceId={params.id} />
}
