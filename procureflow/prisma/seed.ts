import {
  PrismaClient,
  Prisma,
  RequestStatus,
  Priority,
  UserRole,
  VendorStatus,
  VendorPortalType,
  ApprovalStatus,
} from '@prisma/client'

const Decimal = Prisma.Decimal

const prisma = new PrismaClient()

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

async function main() {
  // Clean existing data
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.timelineEvent.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.requestItem.deleteMany(),
    prisma.purchaseRequest.deleteMany(),
    prisma.vendorContact.deleteMany(),
    prisma.vendor.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.user.deleteMany(),
  ])

  // --- Users ---
  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: 'user-marco',
        email: 'marco.rossi@procureflow.it',
        name: 'Marco Rossi',
        role: UserRole.ADMIN,
        department: 'Direzione',
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-laura',
        email: 'laura.bianchi@procureflow.it',
        name: 'Laura Bianchi',
        role: UserRole.MANAGER,
        department: 'Acquisti',
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-giuseppe',
        email: 'giuseppe.verde@procureflow.it',
        name: 'Giuseppe Verde',
        role: UserRole.REQUESTER,
        department: 'Produzione',
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-francesca',
        email: 'francesca.neri@procureflow.it',
        name: 'Francesca Neri',
        role: UserRole.REQUESTER,
        department: 'IT',
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-alessio',
        email: 'alessio.conti@procureflow.it',
        name: 'Alessio Conti',
        role: UserRole.VIEWER,
        department: 'Contabilità',
      },
    }),
  ])

  const [marco, laura, giuseppe, francesca, alessio] = users

  // --- Vendors ---
  const vendors = await Promise.all([
    prisma.vendor.create({
      data: {
        id: 'vendor-ferramenta',
        name: 'Ferramenta Industriale Milano Srl',
        code: 'FIM-001',
        email: 'ordini@ferramentamilano.it',
        phone: '+39 02 1234567',
        website: 'https://ferramentamilano.it',
        portal_type: VendorPortalType.WEBSITE,
        category: ['Ferramenta', 'Utensileria'],
        payment_terms: '30gg DFFM',
        rating: 4.5,
        status: VendorStatus.ACTIVE,
      },
    }),
    prisma.vendor.create({
      data: {
        id: 'vendor-techparts',
        name: 'TechParts Europe GmbH',
        code: 'TPE-002',
        email: 'orders@techparts.eu',
        phone: '+49 89 9876543',
        website: 'https://techparts.eu',
        portal_type: VendorPortalType.API,
        category: ['Componenti Elettronici', 'Hardware'],
        payment_terms: '60gg DFFM',
        rating: 4.2,
        status: VendorStatus.ACTIVE,
      },
    }),
    prisma.vendor.create({
      data: {
        id: 'vendor-cartaria',
        name: 'Cartaria del Veneto SpA',
        code: 'CDV-003',
        email: 'vendite@cartariaveneto.it',
        phone: '+39 041 5551234',
        portal_type: VendorPortalType.EMAIL_ONLY,
        category: ['Cancelleria', 'Carta', 'Imballaggi'],
        payment_terms: '30gg FM',
        rating: 3.8,
        status: VendorStatus.ACTIVE,
      },
    }),
    prisma.vendor.create({
      data: {
        id: 'vendor-safety',
        name: 'SafetyPro Italia Srl',
        code: 'SPI-004',
        email: 'info@safetypro.it',
        phone: '+39 011 7778899',
        website: 'https://safetypro.it',
        portal_type: VendorPortalType.WEBSITE,
        category: ['DPI', 'Sicurezza', 'Antinfortunistica'],
        payment_terms: '30gg DFFM',
        rating: 4.8,
        status: VendorStatus.ACTIVE,
      },
    }),
    prisma.vendor.create({
      data: {
        id: 'vendor-elettronica',
        name: 'Elettronica Napoli Srl',
        code: 'ENA-005',
        email: 'ordini@elettronicanapoli.it',
        phone: '+39 081 3334455',
        portal_type: VendorPortalType.PHONE,
        category: ['Elettronica', 'Componenti', 'Cavi'],
        payment_terms: '60gg DFFM',
        rating: 3.5,
        status: VendorStatus.ACTIVE,
      },
    }),
    prisma.vendor.create({
      data: {
        id: 'vendor-packaging',
        name: 'Packaging Solutions Srl',
        code: 'PKS-006',
        email: 'sales@packagingsolutions.it',
        phone: '+39 02 8889900',
        website: 'https://packagingsolutions.it',
        portal_type: VendorPortalType.MARKETPLACE,
        category: ['Imballaggi', 'Packaging', 'Nastri'],
        payment_terms: '30gg FM',
        rating: 4.0,
        status: VendorStatus.ACTIVE,
      },
    }),
    prisma.vendor.create({
      data: {
        id: 'vendor-chemsupply',
        name: 'ChemSupply SpA',
        code: 'CHS-007',
        email: 'procurement@chemsupply.it',
        phone: '+39 055 6667788',
        website: 'https://chemsupply.it',
        portal_type: VendorPortalType.API,
        category: ['Prodotti Chimici', 'Detergenti', 'Lubrificanti'],
        payment_terms: '90gg DFFM',
        rating: 4.1,
        status: VendorStatus.ACTIVE,
      },
    }),
    prisma.vendor.create({
      data: {
        id: 'vendor-office',
        name: 'Office Depot Italia',
        code: 'ODI-008',
        email: 'business@officedepot.it',
        phone: '+39 06 1112233',
        website: 'https://officedepot.it',
        portal_type: VendorPortalType.WEBSITE,
        category: ['Ufficio', 'Cancelleria', 'Arredamento'],
        payment_terms: '30gg FM',
        rating: 4.3,
        status: VendorStatus.ACTIVE,
      },
    }),
  ])

  const [
    ferramenta,
    techparts,
    cartaria,
    safety,
    elettronica,
    packaging,
    chemsupply,
    office,
  ] = vendors

  // --- Purchase Requests ---
  const requestsData = [
    // DELIVERED
    {
      code: 'PR-2026-00001',
      title: 'Bulloni M10 inox per linea assemblaggio',
      status: RequestStatus.DELIVERED,
      priority: Priority.HIGH,
      requester: giuseppe!,
      vendor: ferramenta!,
      estimated: 1250.0,
      actual: 1180.5,
      category: 'Ferramenta',
      dept: 'Produzione',
      createdDays: 45,
      orderedDays: 40,
      deliveredDays: 30,
    },
    {
      code: 'PR-2026-00002',
      title: 'Toner stampanti ufficio Q1',
      status: RequestStatus.DELIVERED,
      priority: Priority.MEDIUM,
      requester: francesca!,
      vendor: cartaria!,
      estimated: 890.0,
      actual: 890.0,
      category: 'Cancelleria',
      dept: 'IT',
      createdDays: 60,
      orderedDays: 55,
      deliveredDays: 42,
    },
    {
      code: 'PR-2026-00003',
      title: 'Licenze Microsoft 365 rinnovo annuale',
      status: RequestStatus.DELIVERED,
      priority: Priority.HIGH,
      requester: francesca!,
      vendor: techparts!,
      estimated: 8400.0,
      actual: 8400.0,
      category: 'Software',
      dept: 'IT',
      createdDays: 90,
      orderedDays: 85,
      deliveredDays: 80,
    },

    // ORDERED + SHIPPED
    {
      code: 'PR-2026-00004',
      title: 'DPI - Guanti e occhiali protettivi',
      status: RequestStatus.SHIPPED,
      priority: Priority.URGENT,
      requester: giuseppe!,
      vendor: safety!,
      estimated: 2340.0,
      category: 'DPI',
      dept: 'Produzione',
      createdDays: 14,
      orderedDays: 10,
      expectedDays: 2,
    },
    {
      code: 'PR-2026-00005',
      title: 'Cavi ethernet Cat6 200m',
      status: RequestStatus.ORDERED,
      priority: Priority.MEDIUM,
      requester: francesca!,
      vendor: elettronica!,
      estimated: 450.0,
      category: 'Networking',
      dept: 'IT',
      createdDays: 7,
      orderedDays: 5,
      expectedDays: 8,
    },
    {
      code: 'PR-2026-00006',
      title: 'Scatole cartone per spedizioni 40x30x20',
      status: RequestStatus.ORDERED,
      priority: Priority.LOW,
      requester: giuseppe!,
      vendor: packaging!,
      estimated: 380.0,
      category: 'Imballaggi',
      dept: 'Produzione',
      createdDays: 10,
      orderedDays: 7,
      expectedDays: 5,
    },
    {
      code: 'PR-2026-00007',
      title: 'Detergente industriale multiuso 50L',
      status: RequestStatus.SHIPPED,
      priority: Priority.MEDIUM,
      requester: giuseppe!,
      vendor: chemsupply!,
      estimated: 720.0,
      category: 'Pulizia',
      dept: 'Produzione',
      createdDays: 12,
      orderedDays: 9,
      expectedDays: 1,
    },

    // APPROVED (waiting to be ordered)
    {
      code: 'PR-2026-00008',
      title: 'Monitor 27" 4K per ufficio design',
      status: RequestStatus.APPROVED,
      priority: Priority.MEDIUM,
      requester: francesca!,
      vendor: techparts!,
      estimated: 3200.0,
      category: 'Hardware',
      dept: 'IT',
      createdDays: 5,
    },
    {
      code: 'PR-2026-00009',
      title: 'Sedie ergonomiche x4',
      status: RequestStatus.APPROVED,
      priority: Priority.LOW,
      requester: laura!,
      vendor: office!,
      estimated: 1960.0,
      category: 'Arredamento',
      dept: 'Acquisti',
      createdDays: 8,
    },

    // PENDING_APPROVAL
    {
      code: 'PR-2026-00010',
      title: 'Server rack 42U + accessori',
      status: RequestStatus.PENDING_APPROVAL,
      priority: Priority.HIGH,
      requester: francesca!,
      vendor: techparts!,
      estimated: 12500.0,
      category: 'Infrastruttura',
      dept: 'IT',
      createdDays: 2,
    },
    {
      code: 'PR-2026-00011',
      title: 'Kit primo soccorso reparti',
      status: RequestStatus.PENDING_APPROVAL,
      priority: Priority.MEDIUM,
      requester: giuseppe!,
      vendor: safety!,
      estimated: 680.0,
      category: 'Sicurezza',
      dept: 'Produzione',
      createdDays: 1,
    },
    {
      code: 'PR-2026-00012',
      title: 'Lubrificante macchinari CNC 200L',
      status: RequestStatus.PENDING_APPROVAL,
      priority: Priority.HIGH,
      requester: giuseppe!,
      vendor: chemsupply!,
      estimated: 4200.0,
      category: 'Manutenzione',
      dept: 'Produzione',
      createdDays: 3,
    },

    // SUBMITTED
    {
      code: 'PR-2026-00013',
      title: 'Carta A4 80g casse x20',
      status: RequestStatus.SUBMITTED,
      priority: Priority.LOW,
      requester: laura!,
      vendor: cartaria!,
      estimated: 320.0,
      category: 'Cancelleria',
      dept: 'Acquisti',
      createdDays: 1,
    },
    {
      code: 'PR-2026-00014',
      title: 'Nastro adesivo industriale 100 rotoli',
      status: RequestStatus.SUBMITTED,
      priority: Priority.MEDIUM,
      requester: giuseppe!,
      vendor: packaging!,
      estimated: 250.0,
      category: 'Imballaggi',
      dept: 'Produzione',
      createdDays: 0,
    },

    // DRAFT
    {
      code: 'PR-2026-00015',
      title: 'Upgrade RAM server principale',
      status: RequestStatus.DRAFT,
      priority: Priority.HIGH,
      requester: francesca!,
      vendor: techparts!,
      estimated: 1800.0,
      category: 'Hardware',
      dept: 'IT',
      createdDays: 0,
    },
    {
      code: 'PR-2026-00016',
      title: 'Scaffalature metalliche magazzino',
      status: RequestStatus.DRAFT,
      priority: Priority.MEDIUM,
      requester: giuseppe!,
      vendor: ferramenta!,
      estimated: 5600.0,
      category: 'Arredamento',
      dept: 'Produzione',
      createdDays: 1,
    },

    // REJECTED
    {
      code: 'PR-2026-00017',
      title: 'MacBook Pro 16" M3 Max',
      status: RequestStatus.REJECTED,
      priority: Priority.MEDIUM,
      requester: francesca!,
      vendor: techparts!,
      estimated: 4200.0,
      category: 'Hardware',
      dept: 'IT',
      createdDays: 20,
    },

    // CANCELLED
    {
      code: 'PR-2026-00018',
      title: 'Stampante 3D industriale',
      status: RequestStatus.CANCELLED,
      priority: Priority.LOW,
      requester: giuseppe!,
      vendor: techparts!,
      estimated: 15000.0,
      category: 'Macchinari',
      dept: 'Produzione',
      createdDays: 35,
    },

    // ON_HOLD
    {
      code: 'PR-2026-00019',
      title: 'Climatizzatori uffici piano 2',
      status: RequestStatus.ON_HOLD,
      priority: Priority.MEDIUM,
      requester: laura!,
      vendor: null,
      estimated: 8900.0,
      category: 'Impianti',
      dept: 'Acquisti',
      createdDays: 15,
    },

    // More ORDERED with different delivery statuses
    {
      code: 'PR-2026-00020',
      title: 'Guanti latex monouso 10.000pz',
      status: RequestStatus.ORDERED,
      priority: Priority.MEDIUM,
      requester: giuseppe!,
      vendor: safety!,
      estimated: 560.0,
      category: 'DPI',
      dept: 'Produzione',
      createdDays: 20,
      orderedDays: 15,
      expectedDays: -3,
    }, // OVERDUE
    {
      code: 'PR-2026-00021',
      title: 'Switch PoE 24 porte',
      status: RequestStatus.ORDERED,
      priority: Priority.HIGH,
      requester: francesca!,
      vendor: elettronica!,
      estimated: 890.0,
      category: 'Networking',
      dept: 'IT',
      createdDays: 8,
      orderedDays: 6,
      expectedDays: -1,
    }, // OVERDUE
    {
      code: 'PR-2026-00022',
      title: 'Ripiani scaffale magazzino B',
      status: RequestStatus.ORDERED,
      priority: Priority.LOW,
      requester: giuseppe!,
      vendor: ferramenta!,
      estimated: 420.0,
      category: 'Arredamento',
      dept: 'Produzione',
      createdDays: 12,
      orderedDays: 9,
      expectedDays: 4,
    },
    {
      code: 'PR-2026-00023',
      title: 'Risma carta fotografica A3',
      status: RequestStatus.SHIPPED,
      priority: Priority.LOW,
      requester: laura!,
      vendor: cartaria!,
      estimated: 180.0,
      category: 'Cancelleria',
      dept: 'Acquisti',
      createdDays: 6,
      orderedDays: 4,
      expectedDays: 3,
    },

    // Additional PENDING
    {
      code: 'PR-2026-00024',
      title: 'Abbonamento Adobe Creative Cloud x3',
      status: RequestStatus.PENDING_APPROVAL,
      priority: Priority.MEDIUM,
      requester: francesca!,
      vendor: null,
      estimated: 2160.0,
      category: 'Software',
      dept: 'IT',
      createdDays: 1,
    },
    {
      code: 'PR-2026-00025',
      title: 'Materiale pulizia trimestrale',
      status: RequestStatus.SUBMITTED,
      priority: Priority.LOW,
      requester: laura!,
      vendor: chemsupply!,
      estimated: 450.0,
      category: 'Pulizia',
      dept: 'Acquisti',
      createdDays: 0,
    },
  ]

  for (const r of requestsData) {
    const request = await prisma.purchaseRequest.create({
      data: {
        code: r.code,
        title: r.title,
        status: r.status,
        priority: r.priority,
        requester_id: r.requester.id,
        vendor_id: r.vendor?.id ?? null,
        estimated_amount: new Decimal(r.estimated),
        actual_amount: r.actual ? new Decimal(r.actual) : null,
        category: r.category,
        department: r.dept,
        cost_center: `CC-${r.dept.substring(0, 3).toUpperCase()}`,
        created_at: daysAgo(r.createdDays),
        ordered_at: r.orderedDays !== undefined ? daysAgo(r.orderedDays) : null,
        expected_delivery:
          r.expectedDays !== undefined
            ? r.expectedDays >= 0
              ? daysFromNow(r.expectedDays)
              : daysAgo(Math.abs(r.expectedDays))
            : null,
        delivered_at:
          r.deliveredDays !== undefined ? daysAgo(r.deliveredDays) : null,
        needed_by: daysFromNow(r.createdDays + 14),
      },
    })

    // Create items for each request
    const itemSets: Record<
      string,
      Array<{ name: string; qty: number; unit: string; price: number }>
    > = {
      Ferramenta: [
        { name: 'Bulloni M10x30 inox A2', qty: 500, unit: 'pz', price: 0.45 },
        { name: 'Dadi M10 autobloccanti', qty: 500, unit: 'pz', price: 0.25 },
        { name: 'Rondelle piane M10', qty: 1000, unit: 'pz', price: 0.08 },
      ],
      Cancelleria: [
        { name: 'Toner HP 26A nero', qty: 5, unit: 'pz', price: 89.0 },
        { name: 'Toner HP 201A colori set', qty: 3, unit: 'set', price: 135.0 },
      ],
      Software: [
        {
          name: 'Microsoft 365 Business Standard',
          qty: 20,
          unit: 'licenze',
          price: 420.0,
        },
      ],
      DPI: [
        { name: 'Guanti nitrile tg. M', qty: 100, unit: 'paia', price: 8.5 },
        { name: 'Occhiali protettivi EN166', qty: 30, unit: 'pz', price: 24.8 },
      ],
      Networking: [
        {
          name: 'Cavo Cat6 UTP 305m bobina',
          qty: 1,
          unit: 'bobina',
          price: 450.0,
        },
      ],
      Hardware: [
        {
          name: 'Monitor Dell U2723QE 27" 4K',
          qty: 4,
          unit: 'pz',
          price: 800.0,
        },
      ],
    }

    const items = itemSets[r.category]
    if (items) {
      for (const item of items) {
        await prisma.requestItem.create({
          data: {
            request_id: request.id,
            name: item.name,
            quantity: item.qty,
            unit: item.unit,
            unit_price: new Decimal(item.price),
            total_price: new Decimal(item.qty * item.price),
          },
        })
      }
    }

    // Create timeline events
    await prisma.timelineEvent.create({
      data: {
        request_id: request.id,
        type: 'created',
        title: 'Richiesta creata',
        description: `${r.requester.name} ha creato la richiesta`,
        actor: r.requester.name,
        created_at: daysAgo(r.createdDays),
      },
    })

    if (r.status !== RequestStatus.DRAFT) {
      await prisma.timelineEvent.create({
        data: {
          request_id: request.id,
          type: 'status_change',
          title: 'Inviata per approvazione',
          description: 'Stato cambiato da Bozza a Inviata',
          actor: r.requester.name,
          created_at: daysAgo(r.createdDays - 0.5),
        },
      })
    }

    if (
      (
        [
          RequestStatus.APPROVED,
          RequestStatus.ORDERED,
          RequestStatus.SHIPPED,
          RequestStatus.DELIVERED,
        ] as RequestStatus[]
      ).includes(r.status)
    ) {
      await prisma.timelineEvent.create({
        data: {
          request_id: request.id,
          type: 'approval',
          title: 'Approvata',
          description: `${laura!.name} ha approvato la richiesta`,
          actor: laura!.name,
          created_at: daysAgo(r.createdDays - 1),
        },
      })
    }

    if (r.status === RequestStatus.REJECTED) {
      await prisma.timelineEvent.create({
        data: {
          request_id: request.id,
          type: 'rejection',
          title: 'Rifiutata',
          description: `${marco!.name} ha rifiutato: "Budget insufficiente per questo trimestre"`,
          actor: marco!.name,
          created_at: daysAgo(r.createdDays - 2),
        },
      })
    }

    // Create approvals for PENDING_APPROVAL requests
    if (r.status === RequestStatus.PENDING_APPROVAL) {
      await prisma.approval.create({
        data: {
          request_id: request.id,
          approver_id: r.estimated >= 5000 ? marco!.id : laura!.id,
          status: ApprovalStatus.PENDING,
        },
      })
    }

    if (
      r.status === RequestStatus.APPROVED ||
      r.status === RequestStatus.ORDERED ||
      r.status === RequestStatus.SHIPPED ||
      r.status === RequestStatus.DELIVERED
    ) {
      await prisma.approval.create({
        data: {
          request_id: request.id,
          approver_id: r.estimated >= 5000 ? marco!.id : laura!.id,
          status: ApprovalStatus.APPROVED,
          decision_at: daysAgo(r.createdDays - 1),
          notes: 'Approvato — rientra nel budget trimestrale',
        },
      })
    }

    if (r.status === RequestStatus.REJECTED) {
      await prisma.approval.create({
        data: {
          request_id: request.id,
          approver_id: marco!.id,
          status: ApprovalStatus.REJECTED,
          decision_at: daysAgo(r.createdDays - 2),
          notes:
            'Budget insufficiente per questo trimestre. Ripresentare in Q2.',
        },
      })
    }
  }

  // --- Comments ---
  const allRequests = await prisma.purchaseRequest.findMany({
    take: 10,
    orderBy: { created_at: 'desc' },
  })
  for (let i = 0; i < Math.min(allRequests.length, 8); i++) {
    const req = allRequests[i]!
    await prisma.comment.create({
      data: {
        request_id: req.id,
        author_id: [laura!, giuseppe!, francesca!, marco!][i % 4]!.id,
        content: [
          'Ho contattato il fornitore, confermano disponibilità immediata.',
          'Verificare se esistono alternative più economiche.',
          'Urgente — la linea di produzione è ferma senza questo materiale.',
          'Prezzo confermato dal listino 2026. Procediamo.',
          'Attenzione: il fornitore ha aumentato i prezzi del 5% dal mese prossimo.',
          'Campione ricevuto e approvato dal reparto qualità.',
          'Richiesta preventivo alternativo a SafetyPro per confronto.',
          'Confermo la necessità, da ordinare entro fine settimana.',
        ][i]!,
        is_internal: i % 3 !== 0,
        created_at: daysAgo(i),
      },
    })
  }

  // --- Notifications ---
  const notificationsData = [
    {
      userId: laura!.id,
      title: 'Nuova richiesta da approvare',
      body: 'Server rack 42U + accessori — € 12.500,00',
      type: 'approval_required',
      link: '/requests/PR-2026-00010',
      read: false,
    },
    {
      userId: laura!.id,
      title: 'Nuova richiesta da approvare',
      body: 'Kit primo soccorso reparti — € 680,00',
      type: 'approval_required',
      link: '/requests/PR-2026-00011',
      read: false,
    },
    {
      userId: marco!.id,
      title: 'Approvazione richiesta',
      body: 'Lubrificante macchinari CNC — richiede approvazione direzione',
      type: 'approval_required',
      link: '/requests/PR-2026-00012',
      read: false,
    },
    {
      userId: giuseppe!.id,
      title: 'Consegna in ritardo',
      body: 'Guanti latex monouso — prevista 3 giorni fa',
      type: 'delivery_overdue',
      link: '/requests/PR-2026-00020',
      read: false,
    },
    {
      userId: francesca!.id,
      title: 'Consegna in ritardo',
      body: 'Switch PoE 24 porte — prevista ieri',
      type: 'delivery_overdue',
      link: '/requests/PR-2026-00021',
      read: false,
    },
    {
      userId: francesca!.id,
      title: 'Richiesta approvata',
      body: 'Monitor 27" 4K approvati — puoi procedere con l\'ordine',
      type: 'request_approved',
      link: '/requests/PR-2026-00008',
      read: true,
    },
    {
      userId: giuseppe!.id,
      title: 'Spedizione in arrivo',
      body: 'DPI Guanti e occhiali — tracking: IT12345678',
      type: 'shipment_update',
      link: '/requests/PR-2026-00004',
      read: true,
    },
    {
      userId: laura!.id,
      title: 'Report settimanale disponibile',
      body: 'Riepilogo acquisti settimana 10/2026',
      type: 'weekly_report',
      link: '/analytics',
      read: true,
    },
    {
      userId: francesca!.id,
      title: 'Richiesta rifiutata',
      body: 'MacBook Pro 16" — budget insufficiente',
      type: 'request_rejected',
      link: '/requests/PR-2026-00017',
      read: true,
    },
    {
      userId: marco!.id,
      title: 'Nuovo commento',
      body: 'Laura ha commentato su PR-2026-00010',
      type: 'new_comment',
      link: '/requests/PR-2026-00010',
      read: false,
    },
    {
      userId: giuseppe!.id,
      title: 'Consegna confermata',
      body: 'Toner stampanti Q1 — consegnato',
      type: 'delivery_confirmed',
      link: '/requests/PR-2026-00002',
      read: true,
    },
    {
      userId: laura!.id,
      title: 'Nuovo fornitore registrato',
      body: 'ChemSupply SpA aggiunto al sistema',
      type: 'vendor_added',
      link: '/vendors/vendor-chemsupply',
      read: true,
    },
  ]

  for (let i = 0; i < notificationsData.length; i++) {
    const n = notificationsData[i]!
    await prisma.notification.create({
      data: {
        user_id: n.userId,
        title: n.title,
        body: n.body,
        type: n.type,
        link: n.link,
        read: n.read,
        created_at: daysAgo(i * 0.5),
      },
    })
  }

  console.log('✅ Seed completato con successo!')
  console.log(`   👤 ${users.length} utenti`)
  console.log(`   🏢 ${vendors.length} fornitori`)
  console.log(`   📋 ${requestsData.length} richieste`)
  console.log(`   🔔 ${notificationsData.length} notifiche`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
