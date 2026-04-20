import { describe, it, expect } from 'vitest'
import {
  renderTemplate,
  renderDigest,
  hasTemplateFor,
} from '../server/template-renderer'

describe('template-renderer', () => {
  describe('renderTemplate', () => {
    it('renderizza APPROVAL_DECIDED con HTML + plain-text', async () => {
      const result = await renderTemplate('APPROVAL_DECIDED', {
        recipientName: 'Mario',
        requestCode: 'PR-2026-00001',
        requestTitle: 'Carta A4',
        approverName: 'Giulia',
        amount: '€ 180,00',
        approved: true,
        notes: null,
      })
      expect(result.html).toMatch(/<html/i)
      expect(result.html).toContain('PR-2026-00001')
      expect(result.html).toContain('approvata')
      expect(result.text).toContain('PR-2026-00001')
      expect(result.text).toContain('Carta A4')
    })

    it('renderizza APPROVAL_DECIDED in modalità rejected', async () => {
      const result = await renderTemplate('APPROVAL_DECIDED', {
        recipientName: 'Mario',
        requestCode: 'PR-2026-00002',
        requestTitle: 'Laptop',
        approverName: 'Giulia',
        amount: '€ 1.200,00',
        approved: false,
        notes: 'Budget esaurito',
      })
      expect(result.html).toContain('rifiutata')
      expect(result.html).toContain('Budget esaurito')
    })

    it('renderizza APPROVAL_REQUESTED per approver', async () => {
      const result = await renderTemplate('APPROVAL_REQUESTED', {
        approverName: 'Giulia',
        requesterName: 'Mario',
        requestCode: 'PR-2026-00003',
        requestTitle: 'Toner HP',
        amount: '€ 90,00',
        neededBy: '2026-05-01',
        priority: 'MEDIUM',
      })
      expect(result.html).toContain('PR-2026-00003')
      expect(result.html).toContain('Toner HP')
      expect(result.html).toContain('Giulia')
    })

    it('fallback generico per tipi senza template dedicato', async () => {
      const result = await renderTemplate('COMMENT_ADDED', {
        title: 'Nuovo commento',
        body: 'Luca ha commentato: grazie!',
      })
      expect(result.html).toContain('Nuovo commento')
      expect(result.html).toContain('grazie')
    })
  })

  describe('renderDigest', () => {
    it('renderizza digest con multiple notifiche', async () => {
      const result = await renderDigest({
        recipientName: 'Mario',
        notifications: [
          {
            title: 'Approvazione necessaria',
            body: 'PR-2026-00010 — €500',
            type: 'approval_required',
            link: '/requests/PR-2026-00010',
            created_at: new Date(),
          },
          {
            title: 'Commento aggiunto',
            body: 'Luca ha risposto',
            type: 'new_comment',
            link: null,
            created_at: new Date(),
          },
        ],
      })
      expect(result.html).toContain('Mario')
      expect(result.html).toContain('PR-2026-00010')
      expect(result.html).toContain('Commento aggiunto')
    })

    it('gestisce singolare vs plurale nel preview text', async () => {
      const singolo = await renderDigest({
        recipientName: 'Mario',
        notifications: [
          {
            title: 'Una notifica',
            body: 'bla',
            type: 'status_changed',
            link: null,
            created_at: new Date(),
          },
        ],
      })
      expect(singolo.html).toMatch(/1.*nuova notifica|1\s*<\/strong>\s*nuova/i)
    })
  })

  describe('hasTemplateFor', () => {
    it('ritorna true per tipi noti', () => {
      expect(hasTemplateFor('APPROVAL_DECIDED')).toBe(true)
      expect(hasTemplateFor('APPROVAL_REQUESTED')).toBe(true)
    })

    it('ritorna false per tipi non coperti in CP1', () => {
      expect(hasTemplateFor('COMMENT_ADDED')).toBe(false)
      expect(hasTemplateFor('INVOICE_DISCREPANCY')).toBe(false)
    })
  })
})
