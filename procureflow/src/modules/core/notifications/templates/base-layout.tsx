// ---------------------------------------------------------------------------
// Base layout per tutte le email transazionali ProcureFlow.
// Header brand, preview text, corpo configurabile, footer con link
// a preferenze notifiche e unsubscribe.
// ---------------------------------------------------------------------------

import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { EMAIL_CONFIG } from '../server/email-config'
import type { ReactNode } from 'react'

interface BaseLayoutProps {
  previewText: string
  children: ReactNode
}

export function BaseLayout({ previewText, children }: BaseLayoutProps) {
  const preferencesUrl = `${EMAIL_CONFIG.appBaseUrl}/settings/notifications`

  return (
    <Html lang="it">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={brandStyle}>ProcureFlow</Text>
          </Section>

          <Section style={contentStyle}>{children}</Section>

          <Hr style={dividerStyle} />

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Stai ricevendo questa email perché hai abilitato le notifiche per
              questo tipo di evento.{' '}
              <Link href={preferencesUrl} style={linkStyle}>
                Gestisci preferenze
              </Link>
            </Text>
            <Text style={footerSmallStyle}>
              ProcureFlow · Hub procurement per PMI
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const bodyStyle = {
  backgroundColor: '#0A0A0B',
  fontFamily:
    "'Inter', 'SF Pro Text', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  margin: 0,
  padding: '32px 16px',
  color: '#FAFAFA',
}

const containerStyle = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#141416',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.06)',
  overflow: 'hidden',
}

const headerStyle = {
  padding: '24px 32px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

const brandStyle = {
  fontSize: '18px',
  fontWeight: 700,
  margin: 0,
  color: '#6366F1',
  letterSpacing: '-0.01em',
}

const contentStyle = {
  padding: '32px',
}

const dividerStyle = {
  borderColor: 'rgba(255,255,255,0.06)',
  margin: 0,
}

const footerStyle = {
  padding: '20px 32px',
  textAlign: 'center' as const,
}

const footerTextStyle = {
  fontSize: '12px',
  color: '#A1A1AA',
  margin: '0 0 8px',
  lineHeight: '1.5',
}

const footerSmallStyle = {
  fontSize: '11px',
  color: '#52525B',
  margin: 0,
}

const linkStyle = {
  color: '#818CF8',
  textDecoration: 'underline',
}
