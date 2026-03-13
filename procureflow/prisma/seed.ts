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
import bcrypt from 'bcryptjs'

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
    prisma.tenderTimeline.deleteMany(),
    prisma.tenderDocument.deleteMany(),
    prisma.tender.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.timelineEvent.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.requestItem.deleteMany(),
    prisma.purchaseRequest.deleteMany(),
    prisma.vendorContact.deleteMany(),
    prisma.vendor.deleteMany(),
    prisma.budget.deleteMany(),
    prisma.deployConfig.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.user.deleteMany(),
  ])

  // --- Users ---
  const defaultPassword = await bcrypt.hash('password123', 12)
  const adminPassword = await bcrypt.hash('admin123', 12)

  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: 'user-marco',
        email: 'marco.rossi@procureflow.it',
        name: 'Marco Rossi',
        role: UserRole.ADMIN,
        department: 'Direzione',
        password_hash: adminPassword,
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-laura',
        email: 'laura.bianchi@procureflow.it',
        name: 'Laura Bianchi',
        role: UserRole.MANAGER,
        department: 'Acquisti',
        password_hash: defaultPassword,
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-giuseppe',
        email: 'giuseppe.verde@procureflow.it',
        name: 'Giuseppe Verde',
        role: UserRole.REQUESTER,
        department: 'Produzione',
        password_hash: defaultPassword,
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-francesca',
        email: 'francesca.neri@procureflow.it',
        name: 'Francesca Neri',
        role: UserRole.REQUESTER,
        department: 'IT',
        password_hash: defaultPassword,
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-alessio',
        email: 'alessio.conti@procureflow.it',
        name: 'Alessio Conti',
        role: UserRole.VIEWER,
        department: 'Contabilità',
        password_hash: defaultPassword,
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

  // --- Budget seed ---
  const budgetData = [
    {
      cost_center: 'CC-PRD',
      department: 'Produzione',
      period_type: 'QUARTERLY' as const,
      period_start: new Date(2026, 0, 1),
      period_end: new Date(2026, 2, 31),
      allocated_amount: 50000,
      alert_threshold_percent: 80,
      enforcement_mode: 'SOFT' as const,
    },
    {
      cost_center: 'CC-IT',
      department: 'IT',
      period_type: 'QUARTERLY' as const,
      period_start: new Date(2026, 0, 1),
      period_end: new Date(2026, 2, 31),
      allocated_amount: 30000,
      alert_threshold_percent: 75,
      enforcement_mode: 'HARD' as const,
    },
    {
      cost_center: 'CC-ACQ',
      department: 'Acquisti',
      period_type: 'ANNUAL' as const,
      period_start: new Date(2026, 0, 1),
      period_end: new Date(2026, 11, 31),
      allocated_amount: 200000,
      alert_threshold_percent: 85,
      enforcement_mode: 'SOFT' as const,
    },
  ]

  for (const b of budgetData) {
    await prisma.budget.create({
      data: {
        ...b,
        created_by: marco!.id,
      },
    })
  }
  console.log(`  ✓ ${budgetData.length} budget creati`)

  // --- Tender seed ---
  const tendersData = [
    {
      code: 'GARA-2026-00001',
      title: 'Fornitura cavi in fibra ottica - Lotto 1',
      description:
        'Fornitura e posa di cavi in fibra ottica per infrastruttura rete aziendale',
      status: 'PREPARING' as const,
      tender_type: 'OPEN' as const,
      cig: '1234567890',
      base_amount: 250000,
      our_offer_amount: 228000,
      submission_deadline: daysFromNow(34),
      publication_date: daysAgo(30),
      question_deadline: daysFromNow(20),
      go_no_go: 'GO' as const,
      go_no_go_score: 72,
      go_no_go_notes: 'Margine buono, esperienza nel settore',
      category: 'Infrastruttura',
      department: 'IT',
      contracting_authority_id: 'vendor-techparts',
    },
    {
      code: 'GARA-2026-00002',
      title: 'Servizio di manutenzione impianti elettrici',
      description:
        'Manutenzione ordinaria e straordinaria degli impianti elettrici aziendali',
      status: 'DISCOVERED' as const,
      tender_type: 'NEGOTIATED' as const,
      cig: '2345678901',
      base_amount: 180000,
      submission_deadline: daysFromNow(45),
      publication_date: daysAgo(5),
      go_no_go: 'PENDING' as const,
      category: 'Manutenzione',
      department: 'Produzione',
      contracting_authority_id: 'vendor-elettronica',
    },
    {
      code: 'GARA-2026-00003',
      title: 'Fornitura DPI per stabilimento produttivo',
      description:
        'Fornitura biennale di dispositivi di protezione individuale',
      status: 'EVALUATING' as const,
      tender_type: 'RESTRICTED' as const,
      cig: '3456789012',
      base_amount: 95000,
      submission_deadline: daysFromNow(12),
      publication_date: daysAgo(20),
      question_deadline: daysFromNow(5),
      go_no_go: 'PENDING' as const,
      go_no_go_score: 58,
      category: 'DPI',
      department: 'Produzione',
      contracting_authority_id: 'vendor-safety',
    },
    {
      code: 'GARA-2026-00004',
      title: 'Acquisto materiale di cancelleria - Accordo Quadro',
      description: 'Accordo quadro triennale per fornitura cancelleria uffici',
      status: 'SUBMITTED' as const,
      tender_type: 'FRAMEWORK' as const,
      cig: '4567890123',
      base_amount: 45000,
      our_offer_amount: 42500,
      submission_deadline: daysAgo(5),
      publication_date: daysAgo(60),
      opening_date: daysFromNow(7),
      go_no_go: 'GO' as const,
      go_no_go_score: 81,
      go_no_go_notes: 'Basso rischio, buon margine',
      category: 'Cancelleria',
      department: 'Acquisti',
      contracting_authority_id: 'vendor-cartaria',
    },
    {
      code: 'GARA-2026-00005',
      title: 'Fornitura prodotti chimici industriali',
      description:
        'Fornitura annuale di detergenti e lubrificanti per stabilimento',
      status: 'WON' as const,
      tender_type: 'OPEN' as const,
      cig: '5678901234',
      base_amount: 120000,
      our_offer_amount: 108000,
      awarded_amount: 108000,
      submission_deadline: daysAgo(45),
      publication_date: daysAgo(90),
      award_date: daysAgo(10),
      go_no_go: 'GO' as const,
      go_no_go_score: 85,
      our_technical_score: 78.5,
      our_economic_score: 92.0,
      our_total_score: 83.9,
      winner_name: 'SaiFlow Srl',
      winner_amount: 108000,
      participants_count: 4,
      category: 'Chimica',
      department: 'Produzione',
      contracting_authority_id: 'vendor-chemsupply',
    },
    {
      code: 'GARA-2026-00006',
      title: 'Servizio packaging e imballaggi speciali',
      description:
        'Servizio di confezionamento e imballaggio per spedizioni internazionali',
      status: 'LOST' as const,
      tender_type: 'MEPA' as const,
      cig: '6789012345',
      base_amount: 75000,
      our_offer_amount: 71000,
      submission_deadline: daysAgo(30),
      publication_date: daysAgo(75),
      award_date: daysAgo(5),
      go_no_go: 'GO' as const,
      go_no_go_score: 65,
      our_technical_score: 68.0,
      our_economic_score: 85.0,
      our_total_score: 74.8,
      winner_name: 'PackExpert SpA',
      winner_amount: 67500,
      participants_count: 6,
      category: 'Packaging',
      department: 'Produzione',
      contracting_authority_id: 'vendor-packaging',
    },
  ]

  for (const t of tendersData) {
    const tender = await prisma.tender.create({
      data: {
        code: t.code,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        tender_type: t.tender_type,
        cig: t.cig ?? null,
        base_amount: t.base_amount ? new Decimal(t.base_amount) : null,
        our_offer_amount: t.our_offer_amount
          ? new Decimal(t.our_offer_amount)
          : null,
        awarded_amount: t.awarded_amount ? new Decimal(t.awarded_amount) : null,
        submission_deadline: t.submission_deadline ?? null,
        publication_date: t.publication_date ?? null,
        question_deadline: t.question_deadline ?? null,
        opening_date: t.opening_date ?? null,
        award_date: t.award_date ?? null,
        go_no_go: t.go_no_go,
        go_no_go_score: t.go_no_go_score ?? null,
        go_no_go_notes: t.go_no_go_notes ?? null,
        our_technical_score: t.our_technical_score
          ? new Decimal(t.our_technical_score)
          : null,
        our_economic_score: t.our_economic_score
          ? new Decimal(t.our_economic_score)
          : null,
        our_total_score: t.our_total_score
          ? new Decimal(t.our_total_score)
          : null,
        winner_name: t.winner_name ?? null,
        winner_amount: t.winner_amount ? new Decimal(t.winner_amount) : null,
        participants_count: t.participants_count ?? null,
        category: t.category ?? null,
        department: t.department ?? null,
        contracting_authority_id: t.contracting_authority_id ?? null,
        created_by_id: marco!.id,
      },
    })

    // Create timeline events
    await prisma.tenderTimeline.create({
      data: {
        tender_id: tender.id,
        type: 'created',
        title: 'Gara creata',
        description: `${marco!.name} ha inserito la gara nel sistema`,
        actor: marco!.name,
        created_at: t.publication_date ?? daysAgo(10),
      },
    })

    if (t.status !== 'DISCOVERED') {
      await prisma.tenderTimeline.create({
        data: {
          tender_id: tender.id,
          type: 'status_change',
          title: 'Stato aggiornato',
          description: `Stato cambiato a ${t.status}`,
          actor: marco!.name,
          created_at: daysAgo(2),
        },
      })
    }
  }
  console.log(`  ✓ ${tendersData.length} gare create`)

  // --- Inventory seed ---

  // Clean inventory tables (in dependency order)
  await prisma.stockInventoryLine.deleteMany()
  await prisma.stockInventory.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.stockReservation.deleteMany()
  await prisma.stockLot.deleteMany()
  await prisma.warehouseZone.deleteMany()
  await prisma.warehouse.deleteMany()
  await prisma.material.deleteMany()

  // Warehouses
  const whPrin = await prisma.warehouse.create({
    data: {
      id: 'wh-prin',
      code: 'MAG-PRIN',
      name: 'Magazzino Principale',
      address: 'Via Roma 1, Milano',
    },
  })
  const whSec = await prisma.warehouse.create({
    data: {
      id: 'wh-sec',
      code: 'MAG-SEC',
      name: 'Magazzino Secondario',
      address: 'Via Torino 5, Milano',
    },
  })

  // Zones
  const zonaA = await prisma.warehouseZone.create({
    data: {
      id: 'zone-a',
      warehouse_id: whPrin.id,
      code: 'ZONA-A',
      name: 'Zona A - Cavi',
    },
  })
  const zonaB = await prisma.warehouseZone.create({
    data: {
      id: 'zone-b',
      warehouse_id: whPrin.id,
      code: 'ZONA-B',
      name: 'Zona B - Connettori',
    },
  })
  const zonaC = await prisma.warehouseZone.create({
    data: {
      id: 'zone-c',
      warehouse_id: whSec.id,
      code: 'ZONA-C',
      name: 'Zona C - Materie Prime',
    },
  })
  const zonaD = await prisma.warehouseZone.create({
    data: {
      id: 'zone-d',
      warehouse_id: whSec.id,
      code: 'ZONA-D',
      name: 'Zona D - Prodotti Finiti',
    },
  })

  console.log('  ✓ 2 magazzini e 4 zone creati')

  // Materials
  const materialsData = [
    {
      id: 'mat-cav-1',
      code: 'MAT-CAV-00001',
      name: 'Cavo RG59 Coassiale',
      category: 'Cavi',
      unit_primary: 'm',
      unit_secondary: 'kg',
      conversion_factor: 0.035,
      min_stock_level: 500,
      unit_cost: 0.5,
    },
    {
      id: 'mat-cav-2',
      code: 'MAT-CAV-00002',
      name: 'Cavo Cat6 UTP',
      category: 'Cavi',
      unit_primary: 'm',
      unit_secondary: 'kg',
      conversion_factor: 0.04,
      min_stock_level: 1000,
      unit_cost: 0.35,
    },
    {
      id: 'mat-cav-3',
      code: 'MAT-CAV-00003',
      name: 'Cavo Fibra Ottica OS2',
      category: 'Cavi',
      unit_primary: 'm',
      unit_secondary: 'kg',
      conversion_factor: 0.02,
      min_stock_level: 200,
      unit_cost: 1.2,
    },
    {
      id: 'mat-con-1',
      code: 'MAT-CON-00001',
      name: 'Connettore RJ45 Cat6',
      category: 'Connettori',
      unit_primary: 'pz',
      unit_secondary: null,
      conversion_factor: null,
      min_stock_level: 500,
      unit_cost: 0.15,
    },
    {
      id: 'mat-con-2',
      code: 'MAT-CON-00002',
      name: 'Connettore BNC Maschio',
      category: 'Connettori',
      unit_primary: 'pz',
      unit_secondary: null,
      conversion_factor: null,
      min_stock_level: 200,
      unit_cost: 0.8,
    },
    {
      id: 'mat-acc-1',
      code: 'MAT-ACC-00001',
      name: 'Guaina Termorestringente 6mm',
      category: 'Accessori',
      unit_primary: 'm',
      unit_secondary: null,
      conversion_factor: null,
      min_stock_level: 100,
      unit_cost: 0.25,
    },
    {
      id: 'mat-mpr-1',
      code: 'MAT-MPR-00001',
      name: 'Rame Elettrolitico',
      category: 'Materie Prime',
      unit_primary: 'kg',
      unit_secondary: null,
      conversion_factor: null,
      min_stock_level: 50,
      unit_cost: 8.5,
    },
    {
      id: 'mat-pf-1',
      code: 'MAT-PF-00001',
      name: 'Cablaggio Completo Quadro Elettrico',
      category: 'Prodotti Finiti',
      unit_primary: 'pz',
      unit_secondary: null,
      conversion_factor: null,
      min_stock_level: 5,
      unit_cost: 450.0,
    },
  ]

  for (const m of materialsData) {
    await prisma.material.create({
      data: {
        id: m.id,
        code: m.code,
        name: m.name,
        category: m.category,
        unit_primary: m.unit_primary,
        unit_secondary: m.unit_secondary,
        conversion_factor: m.conversion_factor,
        min_stock_level: m.min_stock_level,
        unit_cost: m.unit_cost,
      },
    })
  }
  console.log(`  ✓ ${materialsData.length} materiali creati`)

  // Stock Lots
  const lotsData = [
    {
      id: 'lot-01',
      lot_number: 'LOT-2026-00001',
      material_id: 'mat-cav-1',
      warehouse_id: whPrin.id,
      zone_id: zonaA.id,
      qty: 2000,
      cost: 0.48,
    },
    {
      id: 'lot-02',
      lot_number: 'LOT-2026-00002',
      material_id: 'mat-cav-1',
      warehouse_id: whPrin.id,
      zone_id: zonaA.id,
      qty: 1500,
      cost: 0.52,
    },
    {
      id: 'lot-03',
      lot_number: 'LOT-2026-00003',
      material_id: 'mat-cav-2',
      warehouse_id: whPrin.id,
      zone_id: zonaA.id,
      qty: 3000,
      cost: 0.35,
    },
    {
      id: 'lot-04',
      lot_number: 'LOT-2026-00004',
      material_id: 'mat-cav-3',
      warehouse_id: whSec.id,
      zone_id: zonaC.id,
      qty: 100,
      cost: 1.15,
    }, // LOW stock
    {
      id: 'lot-05',
      lot_number: 'LOT-2026-00005',
      material_id: 'mat-con-1',
      warehouse_id: whPrin.id,
      zone_id: zonaB.id,
      qty: 1000,
      cost: 0.14,
    },
    {
      id: 'lot-06',
      lot_number: 'LOT-2026-00006',
      material_id: 'mat-con-1',
      warehouse_id: whSec.id,
      zone_id: zonaD.id,
      qty: 500,
      cost: 0.16,
    },
    {
      id: 'lot-07',
      lot_number: 'LOT-2026-00007',
      material_id: 'mat-con-2',
      warehouse_id: whPrin.id,
      zone_id: zonaB.id,
      qty: 300,
      cost: 0.78,
    },
    {
      id: 'lot-08',
      lot_number: 'LOT-2026-00008',
      material_id: 'mat-acc-1',
      warehouse_id: whPrin.id,
      zone_id: zonaB.id,
      qty: 50,
      cost: 0.25,
    }, // LOW stock
    {
      id: 'lot-09',
      lot_number: 'LOT-2026-00009',
      material_id: 'mat-mpr-1',
      warehouse_id: whSec.id,
      zone_id: zonaC.id,
      qty: 200,
      cost: 8.3,
    },
    {
      id: 'lot-10',
      lot_number: 'LOT-2026-00010',
      material_id: 'mat-pf-1',
      warehouse_id: whSec.id,
      zone_id: zonaD.id,
      qty: 3,
      cost: 440.0,
    }, // LOW stock
    {
      id: 'lot-11',
      lot_number: 'LOT-2026-00011',
      material_id: 'mat-cav-2',
      warehouse_id: whSec.id,
      zone_id: zonaC.id,
      qty: 500,
      cost: 0.38,
    },
    {
      id: 'lot-12',
      lot_number: 'LOT-2026-00012',
      material_id: 'mat-con-2',
      warehouse_id: whSec.id,
      zone_id: zonaD.id,
      qty: 150,
      cost: 0.82,
    },
  ]

  for (const lot of lotsData) {
    await prisma.stockLot.create({
      data: {
        id: lot.id,
        lot_number: lot.lot_number,
        material_id: lot.material_id,
        warehouse_id: lot.warehouse_id,
        zone_id: lot.zone_id,
        initial_quantity: lot.qty,
        current_quantity: lot.qty,
        unit_cost: lot.cost,
        status: 'AVAILABLE',
      },
    })
  }
  console.log(`  ✓ ${lotsData.length} lotti creati`)

  // Stock Movements
  const movementsData = [
    // INBOUNDs corresponding to lots
    {
      code: 'MOV-2026-00001',
      material_id: 'mat-cav-1',
      lot_id: 'lot-01',
      warehouse_id: whPrin.id,
      zone_id: zonaA.id,
      type: 'INBOUND' as const,
      reason: 'ACQUISTO' as const,
      qty: 2000,
      cost: 0.48,
      actor: 'Marco Rossi',
      days_ago: 30,
    },
    {
      code: 'MOV-2026-00002',
      material_id: 'mat-cav-1',
      lot_id: 'lot-02',
      warehouse_id: whPrin.id,
      zone_id: zonaA.id,
      type: 'INBOUND' as const,
      reason: 'ACQUISTO' as const,
      qty: 1500,
      cost: 0.52,
      actor: 'Marco Rossi',
      days_ago: 25,
    },
    {
      code: 'MOV-2026-00003',
      material_id: 'mat-cav-2',
      lot_id: 'lot-03',
      warehouse_id: whPrin.id,
      zone_id: zonaA.id,
      type: 'INBOUND' as const,
      reason: 'ACQUISTO' as const,
      qty: 3000,
      cost: 0.35,
      actor: 'Giuseppe Verde',
      days_ago: 20,
    },
    {
      code: 'MOV-2026-00004',
      material_id: 'mat-cav-3',
      lot_id: 'lot-04',
      warehouse_id: whSec.id,
      zone_id: zonaC.id,
      type: 'INBOUND' as const,
      reason: 'ACQUISTO' as const,
      qty: 100,
      cost: 1.15,
      actor: 'Giuseppe Verde',
      days_ago: 15,
    },
    {
      code: 'MOV-2026-00005',
      material_id: 'mat-con-1',
      lot_id: 'lot-05',
      warehouse_id: whPrin.id,
      zone_id: zonaB.id,
      type: 'INBOUND' as const,
      reason: 'ACQUISTO' as const,
      qty: 1000,
      cost: 0.14,
      actor: 'Laura Bianchi',
      days_ago: 18,
    },
    {
      code: 'MOV-2026-00006',
      material_id: 'mat-con-1',
      lot_id: 'lot-06',
      warehouse_id: whSec.id,
      zone_id: zonaD.id,
      type: 'INBOUND' as const,
      reason: 'ACQUISTO' as const,
      qty: 500,
      cost: 0.16,
      actor: 'Laura Bianchi',
      days_ago: 12,
    },
    {
      code: 'MOV-2026-00007',
      material_id: 'mat-con-2',
      lot_id: 'lot-07',
      warehouse_id: whPrin.id,
      zone_id: zonaB.id,
      type: 'INBOUND' as const,
      reason: 'ACQUISTO' as const,
      qty: 300,
      cost: 0.78,
      actor: 'Giuseppe Verde',
      days_ago: 14,
    },
    {
      code: 'MOV-2026-00008',
      material_id: 'mat-acc-1',
      lot_id: 'lot-08',
      warehouse_id: whPrin.id,
      zone_id: zonaB.id,
      type: 'INBOUND' as const,
      reason: 'ACQUISTO' as const,
      qty: 50,
      cost: 0.25,
      actor: 'Marco Rossi',
      days_ago: 10,
    },
    {
      code: 'MOV-2026-00009',
      material_id: 'mat-mpr-1',
      lot_id: 'lot-09',
      warehouse_id: whSec.id,
      zone_id: zonaC.id,
      type: 'INBOUND' as const,
      reason: 'ACQUISTO' as const,
      qty: 200,
      cost: 8.3,
      actor: 'Giuseppe Verde',
      days_ago: 8,
    },
    {
      code: 'MOV-2026-00010',
      material_id: 'mat-pf-1',
      lot_id: 'lot-10',
      warehouse_id: whSec.id,
      zone_id: zonaD.id,
      type: 'INBOUND' as const,
      reason: 'PRODUZIONE' as const,
      qty: 3,
      cost: 440.0,
      actor: 'Giuseppe Verde',
      days_ago: 5,
    },
    {
      code: 'MOV-2026-00011',
      material_id: 'mat-cav-2',
      lot_id: 'lot-11',
      warehouse_id: whSec.id,
      zone_id: zonaC.id,
      type: 'INBOUND' as const,
      reason: 'ACQUISTO' as const,
      qty: 500,
      cost: 0.38,
      actor: 'Laura Bianchi',
      days_ago: 7,
    },
    {
      code: 'MOV-2026-00012',
      material_id: 'mat-con-2',
      lot_id: 'lot-12',
      warehouse_id: whSec.id,
      zone_id: zonaD.id,
      type: 'INBOUND' as const,
      reason: 'ACQUISTO' as const,
      qty: 150,
      cost: 0.82,
      actor: 'Laura Bianchi',
      days_ago: 3,
    },
    // OUTBOUNDs
    {
      code: 'MOV-2026-00013',
      material_id: 'mat-cav-1',
      lot_id: 'lot-01',
      warehouse_id: whPrin.id,
      zone_id: zonaA.id,
      type: 'OUTBOUND' as const,
      reason: 'VENDITA' as const,
      qty: -200,
      cost: null,
      actor: 'Giuseppe Verde',
      days_ago: 4,
    },
    {
      code: 'MOV-2026-00014',
      material_id: 'mat-con-1',
      lot_id: 'lot-05',
      warehouse_id: whPrin.id,
      zone_id: zonaB.id,
      type: 'OUTBOUND' as const,
      reason: 'VENDITA' as const,
      qty: -100,
      cost: null,
      actor: 'Giuseppe Verde',
      days_ago: 2,
    },
    {
      code: 'MOV-2026-00015',
      material_id: 'mat-mpr-1',
      lot_id: 'lot-09',
      warehouse_id: whSec.id,
      zone_id: zonaC.id,
      type: 'OUTBOUND' as const,
      reason: 'PRODUZIONE' as const,
      qty: -30,
      cost: null,
      actor: 'Giuseppe Verde',
      days_ago: 1,
    },
  ]

  for (const m of movementsData) {
    await prisma.stockMovement.create({
      data: {
        code: m.code,
        material_id: m.material_id,
        lot_id: m.lot_id,
        warehouse_id: m.warehouse_id,
        zone_id: m.zone_id,
        movement_type: m.type,
        reason: m.reason,
        quantity: m.qty,
        unit_cost: m.cost,
        actor: m.actor,
        created_at: daysAgo(m.days_ago),
      },
    })
  }
  console.log(`  ✓ ${movementsData.length} movimenti creati`)

  // --- Deploy Config ---
  await prisma.deployConfig.create({
    data: {
      id: 'default',
      deploy_name: 'ProcureFlow',
      enabled_modules: [
        'core',
        'invoicing',
        'budgets',
        'analytics',
        'tenders',
        'inventory',
      ],
    },
  })
  console.log('  ✓ deploy config creata')

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
