import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  NoopTransport,
  getEmailTransport,
  __setTransportForTest,
  __resetTransport,
  type EmailMessage,
} from '../server/email-transport'

describe('email-transport', () => {
  afterEach(() => {
    __resetTransport()
  })

  describe('NoopTransport', () => {
    let transport: NoopTransport

    beforeEach(() => {
      transport = new NoopTransport()
    })

    it('accumula i messaggi inviati', async () => {
      const msg: EmailMessage = {
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Ciao</p>',
      }

      await transport.send(msg)
      await transport.send({ ...msg, subject: 'Second' })

      expect(transport.sent).toHaveLength(2)
      expect(transport.sent[0]?.subject).toBe('Hello')
      expect(transport.sent[1]?.subject).toBe('Second')
    })

    it('ritorna success:true con id generato', async () => {
      const result = await transport.send({
        to: 'a@b.com',
        subject: 's',
        html: 'h',
      })
      expect(result.success).toBe(true)
      expect(result.id).toMatch(/^noop-/)
    })

    it('reset() svuota la lista', async () => {
      await transport.send({ to: 'x@y.com', subject: 's', html: 'h' })
      expect(transport.sent).toHaveLength(1)
      transport.reset()
      expect(transport.sent).toHaveLength(0)
    })
  })

  describe('getEmailTransport factory', () => {
    it('ritorna NoopTransport in ambiente test', () => {
      const t = getEmailTransport()
      expect(t).toBeInstanceOf(NoopTransport)
    })

    it('cacha la stessa istanza tra chiamate consecutive', () => {
      const a = getEmailTransport()
      const b = getEmailTransport()
      expect(a).toBe(b)
    })
  })

  describe('__setTransportForTest', () => {
    it('sostituisce il singleton con l istanza fornita', () => {
      const custom = new NoopTransport()
      __setTransportForTest(custom)
      expect(getEmailTransport()).toBe(custom)
    })

    it('__resetTransport resetta la cache e la factory ricostruisce', () => {
      const first = getEmailTransport()
      __resetTransport()
      const second = getEmailTransport()
      expect(first).not.toBe(second)
    })
  })
})
