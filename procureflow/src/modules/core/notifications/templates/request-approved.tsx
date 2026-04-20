// ---------------------------------------------------------------------------
// Template email — esito approvazione richiesta di acquisto (APPROVED/REJECTED)
// Usato per NotificationType APPROVAL_DECIDED.
// ---------------------------------------------------------------------------

import * as React from 'react'
import { Button, Heading, Section, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'
import { EMAIL_CONFIG } from '../server/email-config'

export interface RequestApprovedProps {
  recipientName: string
  requestCode: string
  requestTitle: string
  approverName: string
  amount?: string | null
  approved: boolean
  /** Eventuali note dell'approver (es. motivo del rifiuto) */
  notes?: string | null
}

export function RequestApprovedEmail(props: RequestApprovedProps) {
  const url = `${EMAIL_CONFIG.appBaseUrl}/requests/${props.requestCode}`
  const statusWord = props.approved ? 'approvata' : 'rifiutata'
  const heading = props.approved ? 'Richiesta approvata' : 'Richiesta rifiutata'
  const accentColor = props.approved ? '#22C55E' : '#EF4444'

  return (
    <BaseLayout
      previewText={`${heading}: ${props.requestCode} — ${props.requestTitle}`}
    >
      <Heading as="h1" style={headingStyle}>
        Ciao {props.recipientName},
      </Heading>

      <Text style={paragraphStyle}>
        La tua richiesta <strong>{props.requestCode}</strong> è stata{' '}
        <strong style={{ color: accentColor }}>{statusWord}</strong> da{' '}
        {props.approverName}.
      </Text>

      <Section style={cardStyle}>
        <Text style={labelStyle}>Richiesta</Text>
        <Text style={valueStyle}>{props.requestTitle}</Text>
        {props.amount && (
          <>
            <Text style={labelStyle}>Importo</Text>
            <Text style={valueStyle}>{props.amount}</Text>
          </>
        )}
        {props.notes && (
          <>
            <Text style={labelStyle}>Note dell'approvatore</Text>
            <Text style={valueStyle}>{props.notes}</Text>
          </>
        )}
      </Section>

      <Section style={{ textAlign: 'center', marginTop: '24px' }}>
        <Button href={url} style={buttonStyle}>
          Apri richiesta
        </Button>
      </Section>
    </BaseLayout>
  )
}

const headingStyle = {
  fontSize: '22px',
  fontWeight: 600,
  color: '#FAFAFA',
  margin: '0 0 16px',
  letterSpacing: '-0.01em',
}

const paragraphStyle = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#A1A1AA',
  margin: '0 0 24px',
}

const cardStyle = {
  backgroundColor: '#1C1C1F',
  borderRadius: '8px',
  padding: '20px',
  border: '1px solid rgba(255,255,255,0.06)',
}

const labelStyle = {
  fontSize: '11px',
  color: '#52525B',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  fontWeight: 600,
}

const valueStyle = {
  fontSize: '14px',
  color: '#FAFAFA',
  margin: '0 0 16px',
}

const buttonStyle = {
  backgroundColor: '#6366F1',
  color: '#FFFFFF',
  padding: '12px 24px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  display: 'inline-block',
}
