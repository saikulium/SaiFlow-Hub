/** Valid module identifiers */
export type ModuleId =
  | 'core'
  | 'invoicing'
  | 'budgets'
  | 'analytics'
  | 'tenders'
  | 'inventory'
  | 'chatbot'
  | 'smartfill'
  | 'commesse'
  | 'articles'

export interface ModuleDefinition {
  readonly id: ModuleId
  readonly label: string
  readonly description: string
  readonly navPaths: readonly string[]
  readonly dashboardTabs: readonly string[]
  readonly apiPrefixes: readonly string[]
}

/**
 * Single source of truth: maps each module to the resources it controls.
 * Used by helpers to filter nav items, dashboard tabs, and API routes.
 */
export const MODULE_REGISTRY: ReadonlyMap<ModuleId, ModuleDefinition> = new Map(
  [
    [
      'core',
      {
        id: 'core',
        label: 'Core',
        description: 'Richieste, fornitori, approvazioni, utenti',
        navPaths: [
          '/',
          '/requests',
          '/vendors',
          '/approvals',
          '/users',
          '/settings',
        ],
        dashboardTabs: ['panoramica'],
        apiPrefixes: [
          '/api/requests',
          '/api/vendors',
          '/api/approvals',
          '/api/users',
          '/api/notifications',
          '/api/auth',
          '/api/webhooks',
          '/api/deploy-config',
        ],
      },
    ],
    [
      'invoicing',
      {
        id: 'invoicing',
        label: 'Fatturazione',
        description: 'Fatture elettroniche SDI, riconciliazione',
        navPaths: ['/invoices'],
        dashboardTabs: ['fatture'],
        apiPrefixes: ['/api/invoices'],
      },
    ],
    [
      'budgets',
      {
        id: 'budgets',
        label: 'Budget',
        description: 'Plafond per centro di costo, controllo spesa',
        navPaths: ['/budgets'],
        dashboardTabs: ['budget'],
        apiPrefixes: ['/api/budgets'],
      },
    ],
    [
      'analytics',
      {
        id: 'analytics',
        label: 'Analytics',
        description: 'Dashboard avanzata, report',
        navPaths: ['/analytics'],
        dashboardTabs: ['analisi'],
        apiPrefixes: ['/api/analytics'],
      },
    ],
    [
      'tenders',
      {
        id: 'tenders',
        label: 'Gare',
        description: "Gare d'appalto",
        navPaths: ['/tenders'],
        dashboardTabs: ['gare'],
        apiPrefixes: ['/api/tenders'],
      },
    ],
    [
      'inventory',
      {
        id: 'inventory',
        label: 'Magazzino',
        description: 'Gestione materiali, lotti, movimenti, inventario',
        navPaths: ['/inventory'],
        dashboardTabs: ['magazzino'],
        apiPrefixes: ['/api/inventory'],
      },
    ],
    [
      'chatbot',
      {
        id: 'chatbot',
        label: 'Assistente AI',
        description: 'Chatbot conversazionale per query rapide sui dati',
        navPaths: [],
        dashboardTabs: [],
        apiPrefixes: ['/api/chat'],
      },
    ],
    [
      'smartfill',
      {
        id: 'smartfill',
        label: 'Auto-compilazione AI',
        description:
          'Suggerimenti automatici per richieste basati su storico e AI',
        navPaths: [],
        dashboardTabs: [],
        apiPrefixes: ['/api/requests/suggest'],
      },
    ],
    [
      'commesse',
      {
        id: 'commesse',
        label: 'Commesse',
        description:
          'Gestione commesse cliente, tracciamento margine, suggerimenti AI',
        navPaths: ['/commesse', '/clients'],
        dashboardTabs: ['commesse'],
        apiPrefixes: ['/api/commesse', '/api/clients'],
      },
    ],
    [
      'articles',
      {
        id: 'articles',
        label: 'Anagrafica Articoli',
        description: 'Codici interni, alias fornitori/clienti, cross-reference',
        navPaths: ['/articles'],
        dashboardTabs: [],
        apiPrefixes: ['/api/articles'],
      },
    ],
  ],
)
