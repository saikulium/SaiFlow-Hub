// ---------------------------------------------------------------------------
// Template digest — riassume N notifiche accumulate in una singola email.
// Usato dalla cron processDigests().
// ---------------------------------------------------------------------------

import * as React from 'react'
import { Button, Heading, Link, Section, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'
import { EMAIL_CONFIG } from '../server/email-config'

export interface DigestNotification {
  title: string
  body: string
  type: string
  link: string | null
  created_at: Date
}

export interface DigestProps {
  recipientName: string
  notifications: DigestNotification[]
}

export function DigestEmail(props: DigestProps) {
  const count = props.notifications.length
  const url = `${EMAIL_CONFIG.appBaseUrl}/`
  const previewText = `Hai ${count} ${
    count === 1 ? 'notifica' : 'notifiche'
  } da rivedere`

  return (
    <BaseLayout previewText={previewText}>
      <Heading as="h1" style={headingStyle}>
        Ciao {props.recipientName},
      </Heading>

      <Text style={paragraphStyle}>
        Hai <strong>{count}</strong>{' '}
        {count === 1 ? 'nuova notifica' : 'nuove notifiche'} in ProcureFlow.
      </Text>

      <Section style={listStyle}>
        {props.notifications.map((n, i) => (
          <NotificationRow
            key={i}
            notification={n}
            isLast={i === props.notifications.length - 1}
          />
        ))}
      </Section>

      <Section style={{ textAlign: 'center', marginTop: '24px' }}>
        <Button href={url} style={buttonStyle}>
          Apri ProcureFlow
        </Button>
      </Section>
    </BaseLayout>
  )
}

function NotificationRow({
  notification,
  isLast,
}: {
  notification: DigestNotification
  isLast: boolean
}) {
  const url = notification.link
    ? `${EMAIL_CONFIG.appBaseUrl}${notification.link}`
    : null
  const rowStyle = {
    padding: '12px 0',
    borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)',
  }

  return (
    <div style={rowStyle}>
      <Text style={titleStyle}>
        {url ? (
          <Link href={url} style={linkTitleStyle}>
            {notification.title}
          </Link>
        ) : (
          notification.title
        )}
      </Text>
      <Text style={bodyTextStyle}>{notification.body}</Text>
    </div>
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

const listStyle = {
  backgroundColor: '#1C1C1F',
  borderRadius: '8px',
  padding: '8px 20px',
  border: '1px solid rgba(255,255,255,0.06)',
}

const titleStyle = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#FAFAFA',
  margin: '0 0 4px',
}

const linkTitleStyle = {
  color: '#FAFAFA',
  textDecoration: 'none',
}

const bodyTextStyle = {
  fontSize: '13px',
  color: '#A1A1AA',
  margin: 0,
  lineHeight: '1.5',
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
