// ---------------------------------------------------------------------------
// Template renderer — mappa NotificationTypeKey → React Email template,
// renderizza in HTML + fallback plain-text.
//
// Nei CP1 coperti: APPROVAL_REQUESTED, APPROVAL_DECIDED.
// Gli altri tipi caderebbero sul render generico (title+body nel base layout)
// o skipperebbero l'email: il call-site esplicita la scelta passando i
// metadata o omettendo 'email' dai canali.
// ---------------------------------------------------------------------------

import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import {
  RequestApprovedEmail,
  type RequestApprovedProps,
} from '../templates/request-approved'
import {
  RequestSubmittedEmail,
  type RequestSubmittedProps,
} from '../templates/request-submitted'
import { DigestEmail, type DigestProps } from '../templates/digest'
import { BaseLayout } from '../templates/base-layout'
import type { NotificationTypeKey } from './notification.types'

export interface RenderedEmail {
  html: string
  text: string
}

type TemplateFn = (props: unknown) => ReactElement

/** Mappa tipo → componente template. */
const TEMPLATE_MAP: Partial<Record<NotificationTypeKey, TemplateFn>> = {
  APPROVAL_REQUESTED: (p) =>
    RequestSubmittedEmail(p as RequestSubmittedProps),
  APPROVAL_DECIDED: (p) => RequestApprovedEmail(p as RequestApprovedProps),
}

/**
 * Fallback generico: usa il base layout con title+body della notifica.
 * Accetta { title, body } come props minime.
 */
function GenericEmail(props: { title: string; body: string }) {
  // Lazy-import React perché questo file è importato in contesti server-only
  // dove l'overhead di React è comunque presente via React Email.
  const React = require('react') as typeof import('react')
  return BaseLayout({
    previewText: props.title,
    children: [
      React.createElement(
        'h1',
        {
          key: 'h',
          style: {
            fontSize: '20px',
            color: '#FAFAFA',
            marginTop: 0,
            marginBottom: '16px',
          },
        },
        props.title,
      ),
      React.createElement(
        'p',
        {
          key: 'p',
          style: {
            fontSize: '14px',
            color: '#A1A1AA',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
          },
        },
        props.body,
      ),
    ],
  })
}

/**
 * Renderizza un template in HTML e plain-text.
 * @param type NotificationTypeKey (es. 'APPROVAL_DECIDED')
 * @param props props del template
 */
export async function renderTemplate(
  type: NotificationTypeKey | string,
  props: unknown,
): Promise<RenderedEmail> {
  const Template = TEMPLATE_MAP[type as NotificationTypeKey]
  const element = Template
    ? Template(props)
    : GenericEmail(props as { title: string; body: string })

  const html = await render(element)
  const text = await render(element, { plainText: true })
  return { html, text }
}

/**
 * Renderizza l'email digest.
 */
export async function renderDigest(props: DigestProps): Promise<RenderedEmail> {
  const element = DigestEmail(props)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  return { html, text }
}

/** Test-only: verifica se esiste un template dedicato per un tipo. */
export function hasTemplateFor(type: NotificationTypeKey | string): boolean {
  return type in TEMPLATE_MAP
}
