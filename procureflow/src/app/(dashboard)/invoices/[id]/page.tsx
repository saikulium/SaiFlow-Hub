'use client'

import { useParams } from 'next/navigation'
import { InvoiceDetailContent } from '@/modules/core/invoicing'

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>()
  return <InvoiceDetailContent invoiceId={params.id} />
}
