// ---------------------------------------------------------------------------
// Template email — nuova richiesta sottomessa, serve approvazione.
// Usato per NotificationType APPROVAL_REQUESTED (destinatario: approver).
// ---------------------------------------------------------------------------

import * as React from 'react'
import { Button, Heading, Section, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'
import { EMAIL_CONFIG } from '../server/email-config'

export interface RequestSubmittedProps {
  approverName: string
  requesterName: string
  requestCode: string
  requestTitle: string
  amount?: string | null
  neededBy?: string | null
  priority?: string | null
}

export function RequestSubmittedEmail(props: RequestSubmittedProps) {
  const url = `${EMAIL_CONFIG.appBaseUrl}/requests/${props.requestCode}`

  return (
    <BaseLayout
      previewText={`Nuova richiesta da approvare: ${props.requestCode}`}
    >
      <Heading as="h1" style={headingStyle}>
        Ciao {props.approverName},
      </Heading>

      <Text style={paragraphStyle}>
        {props.requesterName} ha sottomesso una nuova richiesta di acquisto che
        richiede la tua approvazione.
      </Text>

      <Section style={cardStyle}>
        <Text style={labelStyle}>Codice</Text>
        <Text style={valueStyle}>{props.requestCode}</Text>

        <Text style={labelStyle}>Descrizione</Text>
        <Text style={valueStyle}>{props.requestTitle}</Text>

        {props.amount && (
          <>
            <Text style={labelStyle}>Importo stimato</Text>
            <Text style={valueStyle}>{props.amount}</Text>
          </>
        )}

        {props.neededBy && (
          <>
            <Text style={labelStyle}>Data necessità</Text>
            <Text style={valueStyle}>{props.neededBy}</Text>
          </>
        )}

        {props.priority && (
          <>
            <Text style={labelStyle}>Priorità</Text>
            <Text style={valueStyle}>{props.priority}</Text>
          </>
        )}
      </Section>

      <Section style={{ textAlign: 'center', marginTop: '24px' }}>
        <Button href={url} style={buttonStyle}>
          Rivedi richiesta
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
