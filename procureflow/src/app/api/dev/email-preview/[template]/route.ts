// ---------------------------------------------------------------------------
// GET /api/dev/email-preview/[template]
//
// Dev-only: renderizza un template email con props mock per preview in browser.
// Restituisce 404 in produzione.
//
// Template disponibili:
//   - request-approved
//   - request-rejected (stesso template, flag approved=false)
//   - request-submitted
//   - digest
//   - generic
// ---------------------------------------------------------------------------

import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import { RequestApprovedEmail } from '@/modules/core/notifications/templates/request-approved'
import { RequestSubmittedEmail } from '@/modules/core/notifications/templates/request-submitted'
import { DigestEmail } from '@/modules/core/notifications/templates/digest'

const MOCK_PROPS = {
  'request-approved': {
    recipientName: 'Mario Rossi',
    requestCode: 'PR-2026-00042',
    requestTitle: 'Carta A4 per ufficio amministrativo',
    approverName: 'Giulia Bianchi',
    amount: '€ 180,00',
    approved: true,
    notes: null,
  },
  'request-rejected': {
    recipientName: 'Mario Rossi',
    requestCode: 'PR-2026-00042',
    requestTitle: 'Carta A4 per ufficio amministrativo',
    approverName: 'Giulia Bianchi',
    amount: '€ 180,00',
    approved: false,
    notes: 'Budget ufficio esaurito per il mese corrente.',
  },
  'request-submitted': {
    approverName: 'Giulia Bianchi',
    requesterName: 'Mario Rossi',
    requestCode: 'PR-2026-00042',
    requestTitle: 'Carta A4 per ufficio amministrativo',
    amount: '€ 180,00',
    neededBy: '2026-04-30',
    priority: 'MEDIUM',
  },
  digest: {
    recipientName: 'Mario Rossi',
    notifications: [
      {
        title: 'Nuova richiesta da approvare',
        body: 'PR-2026-00041 — Materiali elettrici, € 2.450',
        type: 'approval_required',
        link: '/requests/PR-2026-00041',
        created_at: new Date(),
      },
      {
        title: 'Commento aggiunto',
        body: 'Luca ha commentato su PR-2026-00038.',
        type: 'new_comment',
        link: '/requests/PR-2026-00038',
        created_at: new Date(),
      },
      {
        title: 'Stato cambiato',
        body: 'PR-2026-00030 è passata a ORDERED.',
        type: 'status_changed',
        link: '/requests/PR-2026-00030',
        created_at: new Date(),
      },
    ],
  },
} as const

const TEMPLATE_MAP: Record<string, (props: unknown) => ReactElement> = {
  'request-approved': (p) =>
    RequestApprovedEmail(p as (typeof MOCK_PROPS)['request-approved']),
  'request-rejected': (p) =>
    RequestApprovedEmail(p as (typeof MOCK_PROPS)['request-rejected']),
  'request-submitted': (p) =>
    RequestSubmittedEmail(p as (typeof MOCK_PROPS)['request-submitted']),
  digest: (p) => {
    const src = p as (typeof MOCK_PROPS)['digest']
    return DigestEmail({
      recipientName: src.recipientName,
      notifications: src.notifications.map((n) => ({ ...n })),
    })
  },
}

export async function GET(
  _req: Request,
  { params }: { params: { template: string } },
) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 })
  }

  const { template } = params
  const Template = TEMPLATE_MAP[template]
  const props = MOCK_PROPS[template as keyof typeof MOCK_PROPS]

  if (!Template || !props) {
    const available = Object.keys(TEMPLATE_MAP).join(', ')
    return new Response(
      `Unknown template "${template}". Available: ${available}`,
      { status: 404 },
    )
  }

  const html = await render(Template(props))
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
