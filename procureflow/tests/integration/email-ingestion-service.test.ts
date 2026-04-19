import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted() per garantire che i mock siano pronti prima degli import
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockGenerateNextCode,
  mockInitiateApprovalWorkflow,
  mockCreateNotification,
} = vi.hoisted(() => {
  const mockPrisma = {
    purchaseRequest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    requestItem: {
      createMany: vi.fn(),
    },
    timelineEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    vendor: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    commessa: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    commessaTimeline: {
      create: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  const mockGenerateNextCode = vi.fn()
  const mockInitiateApprovalWorkflow = vi.fn()
  const mockCreateNotification = vi.fn()
  return {
    mockPrisma,
    mockGenerateNextCode,
    mockInitiateApprovalWorkflow,
    mockCreateNotification,
  }
})

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('@/server/services/code-generator.service', () => ({
  generateNextCodeAtomic: mockGenerateNextCode,
}))

vi.mock('@/server/services/approval.service', () => ({
  initiateApprovalWorkflow: mockInitiateApprovalWorkflow,
}))

vi.mock('@/server/services/notification.service', () => ({
  createNotification: mockCreateNotification,
  NOTIFICATION_TYPES: {
    STATUS_CHANGED: 'STATUS_CHANGED',
    COMMESSA_CREATED: 'COMMESSA_CREATED',
    EMAIL_INGESTION: 'EMAIL_INGESTION',
    INVOICE_RECONCILED: 'INVOICE_RECONCILED',
    INVOICE_DISCREPANCY: 'INVOICE_DISCREPANCY',
  },
}))

// ---------------------------------------------------------------------------
// Import del service dopo i mock
// ---------------------------------------------------------------------------

import {
  processEmailIngestion,
  type EmailIngestionPayload,
} from '@/modules/core/email-intelligence'

// ---------------------------------------------------------------------------
// Fixture di base
// ---------------------------------------------------------------------------

const baseNewRequest: EmailIngestionPayload = {
  email_from: 'vendor@acme.it',
  email_subject: 'Offerta materiali ufficio',
  email_body: 'Gentili signori, alleghiamo la nostra offerta.',
  action: 'new_request',
  ai_title: 'Materiali ufficio',
  ai_currency: 'EUR',
  ai_items: [
    {
      name: 'Carta A4',
      quantity: 10,
      unit: 'risma',
      description: undefined,
      unit_price: undefined,
      total_price: undefined,
      sku: undefined,
    },
  ],
  ai_tags: [],
  attachments: [],
  email_to: undefined,
  email_date: undefined,
  email_message_id: undefined,
  ai_matched_request_code: undefined,
  ai_matched_external_ref: undefined,
  ai_vendor_code: undefined,
  ai_vendor_name: undefined,
  ai_description: undefined,
  ai_priority: undefined,
  ai_category: undefined,
  ai_department: undefined,
  ai_needed_by: undefined,
  ai_estimated_amount: undefined,
  ai_actual_amount: undefined,
  ai_status_update: undefined,
  ai_tracking_number: undefined,
  ai_external_ref: undefined,
  ai_external_url: undefined,
  ai_expected_delivery: undefined,
  ai_summary: undefined,
  ai_confidence: undefined,
  ai_client_name: undefined,
  ai_client_code: undefined,
  ai_client_order_items: undefined,
  ai_client_deadline: undefined,
  ai_client_value: undefined,
}

const baseUpdateExisting: EmailIngestionPayload = {
  email_from: 'vendor@acme.it',
  email_subject: 'Conferma ordine',
  email_body: 'Confermiamo la ricezione del vostro ordine.',
  action: 'update_existing',
  ai_matched_request_code: 'PR-2026-00001',
  ai_status_update: 'ORDERED',
  ai_currency: 'EUR',
  ai_items: [],
  ai_tags: [],
  attachments: [],
  email_to: undefined,
  email_date: undefined,
  email_message_id: undefined,
  ai_matched_external_ref: undefined,
  ai_vendor_code: undefined,
  ai_vendor_name: undefined,
  ai_title: undefined,
  ai_description: undefined,
  ai_priority: undefined,
  ai_category: undefined,
  ai_department: undefined,
  ai_needed_by: undefined,
  ai_estimated_amount: undefined,
  ai_actual_amount: undefined,
  ai_tracking_number: undefined,
  ai_external_ref: undefined,
  ai_external_url: undefined,
  ai_expected_delivery: undefined,
  ai_summary: undefined,
  ai_confidence: undefined,
  ai_client_name: undefined,
  ai_client_code: undefined,
  ai_client_order_items: undefined,
  ai_client_deadline: undefined,
  ai_client_value: undefined,
}

const baseCommessa: EmailIngestionPayload = {
  email_from: 'client@bigcorp.it',
  email_subject: 'Ordine forniture Q2 2026',
  email_body: 'Vi trasmettiamo il nostro ordine trimestrale.',
  action: 'create_commessa',
  ai_client_name: 'BigCorp Srl',
  ai_client_code: 'BIGCORP-001',
  ai_client_order_items: [
    { description: 'Sedie ergonomiche', quantity: 50, unit: 'pz' },
    { description: 'Tavoli da ufficio', quantity: 10, unit: 'pz' },
  ],
  ai_currency: 'EUR',
  ai_items: [],
  ai_tags: ['ai-created'],
  attachments: [],
  email_to: undefined,
  email_date: undefined,
  email_message_id: undefined,
  ai_matched_request_code: undefined,
  ai_matched_external_ref: undefined,
  ai_vendor_code: undefined,
  ai_vendor_name: undefined,
  ai_title: undefined,
  ai_description: undefined,
  ai_priority: undefined,
  ai_category: undefined,
  ai_department: undefined,
  ai_needed_by: undefined,
  ai_estimated_amount: undefined,
  ai_actual_amount: undefined,
  ai_status_update: undefined,
  ai_tracking_number: undefined,
  ai_external_ref: undefined,
  ai_external_url: undefined,
  ai_expected_delivery: undefined,
  ai_summary: undefined,
  ai_confidence: undefined,
  ai_client_deadline: undefined,
  ai_client_value: undefined,
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('processEmailIngestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Simula $transaction eseguendo la callback con mockPrisma come tx
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
  })

  // =========================================================================
  // new_request
  // =========================================================================

  describe('new_request', () => {
    it('crea PR con items e timeline event', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue(null)
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        role: 'REQUESTER',
      })
      mockPrisma.vendor.findUnique.mockResolvedValue({ id: 'vendor-1' })
      mockGenerateNextCode.mockResolvedValue('PR-2026-00001')
      mockPrisma.purchaseRequest.create.mockResolvedValue({
        id: 'req-1',
        code: 'PR-2026-00001',
      })
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }])
      mockCreateNotification.mockResolvedValue(undefined)

      const result = await processEmailIngestion(baseNewRequest)

      expect(result.action).toBe('new_request')
      expect((result as any).request_code).toBe('PR-2026-00001')
      expect((result as any).items_created).toBe(1)
      expect((result as any).status_updated).toBe(false)
      expect(result.deduplicated).toBe(false)
      expect(mockPrisma.purchaseRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'PR-2026-00001',
            status: 'DRAFT',
            requester_id: 'user-1',
          }),
        }),
      )
    })

    it('ritorna deduplicated=true se email_message_id già processato', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'req-existing',
        code: 'PR-2026-00000',
      })

      const result = await processEmailIngestion({
        ...baseNewRequest,
        email_message_id: 'msg-già-processato',
      })

      expect(result.deduplicated).toBe(true)
      expect((result as any).request_code).toBe('PR-2026-00000')
      expect(mockPrisma.purchaseRequest.create).not.toHaveBeenCalled()
    })

    it('auto-crea il vendor quando non trovato né per codice né per nome', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue(null)
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        role: 'REQUESTER',
      })
      mockPrisma.vendor.findUnique.mockResolvedValue(null)
      mockPrisma.vendor.findFirst.mockResolvedValue(null)
      mockPrisma.vendor.create.mockResolvedValue({ id: 'vendor-new' })
      mockGenerateNextCode.mockResolvedValue('PR-2026-00002')
      mockPrisma.purchaseRequest.create.mockResolvedValue({
        id: 'req-2',
        code: 'PR-2026-00002',
      })
      mockPrisma.user.findMany.mockResolvedValue([])
      mockCreateNotification.mockResolvedValue(undefined)

      await processEmailIngestion({
        ...baseNewRequest,
        ai_vendor_name: 'Nuovo Fornitore Srl',
      })

      expect(mockPrisma.vendor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING_REVIEW' }),
        }),
      )
    })

    it('usa ADMIN come requester fallback quando il mittente è sconosciuto', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue(null)
      // Prima chiamata: cerca per email → null; seconda: fallback admin → { id: 'admin-1' }
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'admin-1' })
      mockPrisma.vendor.findUnique.mockResolvedValue(null)
      mockPrisma.vendor.findFirst.mockResolvedValue(null)
      mockPrisma.vendor.create.mockResolvedValue({ id: 'v-1' })
      mockGenerateNextCode.mockResolvedValue('PR-2026-00003')
      mockPrisma.purchaseRequest.create.mockResolvedValue({
        id: 'req-3',
        code: 'PR-2026-00003',
      })
      mockPrisma.user.findMany.mockResolvedValue([])
      mockCreateNotification.mockResolvedValue(undefined)

      await processEmailIngestion({
        ...baseNewRequest,
        email_from: 'unknown@external.com',
      })

      expect(mockPrisma.purchaseRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ requester_id: 'admin-1' }),
        }),
      )
    })

    it('auto-approva e chiama initiateApprovalWorkflow per un requester MANAGER', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue(null)
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'manager-1',
        role: 'MANAGER',
      })
      mockPrisma.vendor.findFirst.mockResolvedValue({ id: 'vendor-1' })
      mockGenerateNextCode.mockResolvedValue('PR-2026-00004')
      mockPrisma.purchaseRequest.create.mockResolvedValue({
        id: 'req-4',
        code: 'PR-2026-00004',
      })
      mockInitiateApprovalWorkflow.mockResolvedValue(undefined)

      const result = await processEmailIngestion(baseNewRequest)

      expect((result as any).status_updated).toBe(true)
      expect(mockInitiateApprovalWorkflow).toHaveBeenCalledWith(
        'req-4',
        expect.any(Number),
        'MANAGER',
      )
    })

    it('notifica gli admin e resta in DRAFT per un requester REQUESTER', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue(null)
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        role: 'REQUESTER',
      })
      mockPrisma.vendor.findFirst.mockResolvedValue({ id: 'vendor-1' })
      mockGenerateNextCode.mockResolvedValue('PR-2026-00005')
      mockPrisma.purchaseRequest.create.mockResolvedValue({
        id: 'req-5',
        code: 'PR-2026-00005',
      })
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ])
      mockCreateNotification.mockResolvedValue(undefined)

      const result = await processEmailIngestion(baseNewRequest)

      expect((result as any).status_updated).toBe(false)
      expect(mockInitiateApprovalWorkflow).not.toHaveBeenCalled()
      expect(mockCreateNotification).toHaveBeenCalledTimes(2)
    })
  })

  // =========================================================================
  // update_existing
  // =========================================================================

  describe('update_existing', () => {
    it('trova PR per codice e aggiorna lo stato', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        code: 'PR-2026-00001',
        requester_id: 'user-1',
        status: 'APPROVED',
      })
      mockPrisma.timelineEvent.findFirst.mockResolvedValue(null)
      mockPrisma.purchaseRequest.update.mockResolvedValue({})
      mockPrisma.requestItem.createMany.mockResolvedValue({ count: 0 })
      mockPrisma.timelineEvent.create.mockResolvedValue({ id: 'tl-1' })
      mockCreateNotification.mockResolvedValue(undefined)

      const result = await processEmailIngestion(baseUpdateExisting)

      expect(result.action).toBe('update_existing')
      expect((result as any).status_updated).toBe(true)
      expect(result.deduplicated).toBe(false)
      expect(mockPrisma.purchaseRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1' },
          data: expect.objectContaining({ status: 'ORDERED' }),
        }),
      )
    })

    it('estrae codice PR dal subject quando ai_matched_request_code è assente', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'req-42',
        code: 'PR-2026-00042',
        requester_id: 'user-1',
        status: 'APPROVED',
      })
      mockPrisma.timelineEvent.findFirst.mockResolvedValue(null)
      mockPrisma.purchaseRequest.update.mockResolvedValue({})
      mockPrisma.requestItem.createMany.mockResolvedValue({ count: 0 })
      mockPrisma.timelineEvent.create.mockResolvedValue({ id: 'tl-2' })
      mockCreateNotification.mockResolvedValue(undefined)

      const result = await processEmailIngestion({
        ...baseUpdateExisting,
        ai_matched_request_code: undefined,
        email_subject: '[PR-2026-00042] Conferma spedizione',
      })

      expect(result.action).toBe('update_existing')
      expect((result as any).request_code).toBe('PR-2026-00042')
    })

    it('fa fallback a new_request con tag "match-non-trovato" se la PR non esiste', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue(null)
      mockPrisma.purchaseRequest.findFirst.mockResolvedValue(null)
      // Mocks per il path new_request di fallback
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        role: 'REQUESTER',
      })
      mockPrisma.vendor.findFirst.mockResolvedValue(null)
      mockPrisma.vendor.create.mockResolvedValue({ id: 'v-1' })
      mockGenerateNextCode.mockResolvedValue('PR-2026-00099')
      mockPrisma.purchaseRequest.create.mockResolvedValue({
        id: 'req-new',
        code: 'PR-2026-00099',
      })
      mockPrisma.user.findMany.mockResolvedValue([])
      mockCreateNotification.mockResolvedValue(undefined)

      const result = await processEmailIngestion({
        ...baseUpdateExisting,
        ai_matched_request_code: 'PR-NON-ESISTENTE',
      })

      expect(result.action).toBe('new_request')
      expect(mockPrisma.purchaseRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: expect.arrayContaining(['match-non-trovato']),
          }),
        }),
      )
    })

    it('ritorna deduplicated=true se email_message_id è già in timeline', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        code: 'PR-2026-00001',
        requester_id: 'user-1',
        status: 'APPROVED',
      })
      mockPrisma.timelineEvent.findFirst.mockResolvedValue({
        id: 'tl-esistente',
      })

      const result = await processEmailIngestion({
        ...baseUpdateExisting,
        email_message_id: 'msg-già-in-timeline',
      })

      expect(result.deduplicated).toBe(true)
      expect(mockPrisma.purchaseRequest.update).not.toHaveBeenCalled()
    })

    it('salta la transizione di stato non valida senza sollevare eccezioni', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        code: 'PR-2026-00001',
        requester_id: 'user-1',
        status: 'DRAFT', // DRAFT → DELIVERED: transizione non valida
      })
      mockPrisma.timelineEvent.findFirst.mockResolvedValue(null)
      mockPrisma.requestItem.createMany.mockResolvedValue({ count: 0 })
      mockPrisma.timelineEvent.create.mockResolvedValue({ id: 'tl-3' })
      mockCreateNotification.mockResolvedValue(undefined)

      const result = await processEmailIngestion({
        ...baseUpdateExisting,
        ai_status_update: 'DELIVERED',
      })

      expect((result as any).status_updated).toBe(false)
      // update non deve essere chiamato per il campo status
      const updateCall = mockPrisma.purchaseRequest.update.mock.calls[0]
      if (updateCall) {
        expect(updateCall[0].data).not.toHaveProperty('status')
      }
    })

    it('aggiunge nuovi items in append senza sovrascrivere quelli esistenti', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        code: 'PR-2026-00001',
        requester_id: 'user-1',
        status: 'ORDERED',
      })
      mockPrisma.timelineEvent.findFirst.mockResolvedValue(null)
      mockPrisma.purchaseRequest.update.mockResolvedValue({})
      mockPrisma.requestItem.createMany.mockResolvedValue({ count: 2 })
      mockPrisma.timelineEvent.create.mockResolvedValue({ id: 'tl-4' })
      mockCreateNotification.mockResolvedValue(undefined)

      const result = await processEmailIngestion({
        ...baseUpdateExisting,
        ai_status_update: undefined,
        ai_items: [
          {
            name: 'Nuovo articolo A',
            quantity: 5,
            description: undefined,
            unit: undefined,
            unit_price: undefined,
            total_price: undefined,
            sku: undefined,
          },
          {
            name: 'Nuovo articolo B',
            quantity: 3,
            description: undefined,
            unit: undefined,
            unit_price: undefined,
            total_price: undefined,
            sku: undefined,
          },
        ],
      })

      expect((result as any).items_created).toBe(2)
      expect(mockPrisma.requestItem.createMany).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // info_only
  // =========================================================================

  describe('info_only', () => {
    it('crea solo un TimelineEvent quando la PR è trovata', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        code: 'PR-2026-00001',
        requester_id: 'user-1',
        status: 'ORDERED',
      })
      mockPrisma.timelineEvent.create.mockResolvedValue({ id: 'tl-1' })

      const result = await processEmailIngestion({
        ...baseNewRequest,
        action: 'info_only',
        email_from: 'vendor@acme.it',
        email_subject: 'Info spedizione PR-2026-00001',
        email_body: 'Il corriere passerà domani mattina.',
        ai_matched_request_code: 'PR-2026-00001',
        ai_currency: 'EUR',
        ai_items: [],
        ai_tags: [],
        attachments: [],
      })

      expect(result.action).toBe('info_only')
      expect((result as any).items_created).toBe(0)
      expect((result as any).status_updated).toBe(false)
      expect(mockPrisma.timelineEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'email_info' }),
        }),
      )
      expect(mockPrisma.purchaseRequest.update).not.toHaveBeenCalled()
    })

    it('fa fallback a new_request con tag "info-only" quando non trova la PR', async () => {
      mockPrisma.purchaseRequest.findUnique.mockResolvedValue(null)
      mockPrisma.purchaseRequest.findFirst.mockResolvedValue(null)
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        role: 'REQUESTER',
      })
      mockPrisma.vendor.findFirst.mockResolvedValue(null)
      mockPrisma.vendor.create.mockResolvedValue({ id: 'v-1' })
      mockGenerateNextCode.mockResolvedValue('PR-2026-00099')
      mockPrisma.purchaseRequest.create.mockResolvedValue({
        id: 'req-new',
        code: 'PR-2026-00099',
      })
      mockPrisma.user.findMany.mockResolvedValue([])
      mockCreateNotification.mockResolvedValue(undefined)

      const result = await processEmailIngestion({
        ...baseNewRequest,
        action: 'info_only',
        email_from: 'vendor@acme.it',
        email_subject: 'Notizia generica senza riferimento',
        email_body: 'Solo per informazione.',
        ai_currency: 'EUR',
        ai_items: [],
        ai_tags: [],
        attachments: [],
      })

      expect(result.action).toBe('new_request')
      expect(mockPrisma.purchaseRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: expect.arrayContaining(['info-only']),
          }),
        }),
      )
    })
  })

  // =========================================================================
  // create_commessa
  // =========================================================================

  describe('create_commessa', () => {
    it('crea commessa, client auto, e PR suggerite in numero corretto', async () => {
      mockPrisma.commessa.findUnique.mockResolvedValue(null)
      mockPrisma.client.findUnique.mockResolvedValue(null)
      mockPrisma.client.findFirst.mockResolvedValue(null)
      mockPrisma.client.create.mockResolvedValue({ id: 'cl-1' })
      mockGenerateNextCode
        .mockResolvedValueOnce('COM-2026-00001')
        .mockResolvedValueOnce('PR-2026-00010')
        .mockResolvedValueOnce('PR-2026-00011')
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        role: 'REQUESTER',
      })
      mockPrisma.commessa.create.mockResolvedValue({
        id: 'com-1',
        code: 'COM-2026-00001',
      })
      mockPrisma.purchaseRequest.create.mockResolvedValue({})
      mockPrisma.commessaTimeline.create.mockResolvedValue({ id: 'tl-1' })
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 })

      const result = await processEmailIngestion(baseCommessa)

      expect(result.action).toBe('create_commessa')
      expect((result as any).commessa_code).toBe('COM-2026-00001')
      expect((result as any).suggested_prs_created).toBe(2)
      expect(result.deduplicated).toBe(false)
      expect(mockPrisma.purchaseRequest.create).toHaveBeenCalledTimes(2)
      expect(mockPrisma.client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING_REVIEW' }),
        }),
      )
    })

    it('riusa il client esistente quando trovato per codice', async () => {
      mockPrisma.commessa.findUnique.mockResolvedValue(null)
      mockPrisma.client.findUnique.mockResolvedValue({ id: 'cl-esistente' })
      mockGenerateNextCode.mockResolvedValue('CODE-001')
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        role: 'REQUESTER',
      })
      mockPrisma.commessa.create.mockResolvedValue({
        id: 'com-2',
        code: 'COM-2026-00002',
      })
      mockPrisma.purchaseRequest.create.mockResolvedValue({})
      mockPrisma.commessaTimeline.create.mockResolvedValue({ id: 'tl-2' })
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 0 })

      await processEmailIngestion(baseCommessa)

      expect(mockPrisma.client.create).not.toHaveBeenCalled()
      expect(mockPrisma.commessa.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ client_id: 'cl-esistente' }),
        }),
      )
    })

    it('ritorna deduplicated=true quando email_message_id già processato', async () => {
      mockPrisma.commessa.findUnique.mockResolvedValue({
        id: 'com-esistente',
        code: 'COM-2026-00000',
      })

      const result = await processEmailIngestion({
        ...baseCommessa,
        email_message_id: 'msg-già-processato',
      })

      expect(result.deduplicated).toBe(true)
      expect((result as any).commessa_code).toBe('COM-2026-00000')
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('crea il numero corretto di PR in base agli order items', async () => {
      mockPrisma.commessa.findUnique.mockResolvedValue(null)
      mockPrisma.client.findUnique.mockResolvedValue({ id: 'cl-1' })
      mockGenerateNextCode.mockResolvedValue('CODE-X')
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        role: 'REQUESTER',
      })
      mockPrisma.commessa.create.mockResolvedValue({
        id: 'com-3',
        code: 'COM-2026-00003',
      })
      mockPrisma.purchaseRequest.create.mockResolvedValue({})
      mockPrisma.commessaTimeline.create.mockResolvedValue({ id: 'tl-3' })
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 0 })

      const result = await processEmailIngestion({
        ...baseCommessa,
        ai_client_order_items: [
          { description: 'Item 1', quantity: 5 },
          { description: 'Item 2', quantity: 3 },
          { description: 'Item 3', quantity: 1 },
        ],
      })

      expect((result as any).suggested_prs_created).toBe(3)
      expect(mockPrisma.purchaseRequest.create).toHaveBeenCalledTimes(3)
    })

    it('crea commessa senza PR suggerite se non ci sono order items', async () => {
      mockPrisma.commessa.findUnique.mockResolvedValue(null)
      mockPrisma.client.findUnique.mockResolvedValue({ id: 'cl-1' })
      mockGenerateNextCode.mockResolvedValueOnce('COM-2026-00004')
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        role: 'REQUESTER',
      })
      mockPrisma.commessa.create.mockResolvedValue({
        id: 'com-4',
        code: 'COM-2026-00004',
      })
      mockPrisma.commessaTimeline.create.mockResolvedValue({ id: 'tl-4' })
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 0 })

      const result = await processEmailIngestion({
        ...baseCommessa,
        ai_client_order_items: [],
      })

      expect((result as any).suggested_prs_created).toBe(0)
      expect(mockPrisma.purchaseRequest.create).not.toHaveBeenCalled()
    })
  })
})
