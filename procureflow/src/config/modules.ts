/**
 * Registro formale di tutti i moduli di ProcureFlow.
 *
 * Un modulo è un'unità atomica di funzionalità che può essere attivata
 * o disattivata per un'istanza cliente tramite la variabile d'ambiente
 * ENABLED_MODULES.
 *
 * Regole:
 * - Ogni modulo appartiene a UN pack (core | defense).
 * - Un modulo può dichiarare dipendenze su altri moduli. Se le dipendenze
 *   non sono attive, il modulo stesso non può essere attivato (errore al boot).
 * - I moduli con `alwaysOn: true` sono sempre attivi e non possono essere
 *   disattivati (core essenziali).
 */

export type PackName = 'core' | 'defense'

export interface ModuleDefinition {
  /** Nome univoco del modulo (kebab-case). Per moduli defense, prefissato con "defense-". */
  name: string
  /** Pack a cui il modulo appartiene. */
  pack: PackName
  /** Se true, il modulo è sempre attivo (non può essere disattivato). */
  alwaysOn: boolean
  /** Elenco dei moduli da cui questo modulo dipende. */
  dependencies: string[]
  /** Descrizione human-readable del modulo. */
  description: string
}

export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  // ============ CORE (sempre attivi o quasi) ============
  core: {
    name: 'core',
    pack: 'core',
    alwaysOn: true,
    dependencies: [],
    description: 'Autenticazione, utenti, ruoli, infrastruttura base.',
  },
  requests: {
    name: 'requests',
    pack: 'core',
    alwaysOn: true,
    dependencies: ['core'],
    description: 'Purchase Request, approvazioni, state machine.',
  },
  vendors: {
    name: 'vendors',
    pack: 'core',
    alwaysOn: true,
    dependencies: ['core'],
    description: 'Anagrafica fornitori.',
  },
  clients: {
    name: 'clients',
    pack: 'core',
    alwaysOn: true,
    dependencies: ['core'],
    description: 'Anagrafica clienti.',
  },
  articles: {
    name: 'articles',
    pack: 'core',
    alwaysOn: true,
    dependencies: ['core'],
    description: 'Catalogo articoli con alias VENDOR/CLIENT/STANDARD.',
  },
  commesse: {
    name: 'commesse',
    pack: 'core',
    alwaysOn: true,
    dependencies: ['core', 'clients', 'requests'],
    description: 'Commesse cliente con margine, timeline, collegamento RDA.',
  },

  // ============ CORE OPZIONALI (attivabili per cliente) ============
  invoicing: {
    name: 'invoicing',
    pack: 'core',
    alwaysOn: false,
    dependencies: ['core', 'requests', 'vendors'],
    description:
      'Fatture passive FatturaPA XML, three-way matching, riconciliazione.',
  },
  budgets: {
    name: 'budgets',
    pack: 'core',
    alwaysOn: false,
    dependencies: ['core', 'requests'],
    description: 'Budget per centro di costo con snapshot e enforcement.',
  },
  tenders: {
    name: 'tenders',
    pack: 'core',
    alwaysOn: false,
    dependencies: ['core'],
    description: "Gare d'appalto con Go/No-Go e analisi AI.",
  },
  inventory: {
    name: 'inventory',
    pack: 'core',
    alwaysOn: false,
    dependencies: ['core', 'articles'],
    description:
      'Magazzino: materiali, lotti, movimenti, forecast, alert.',
  },
  analytics: {
    name: 'analytics',
    pack: 'core',
    alwaysOn: false,
    dependencies: ['core'],
    description: 'Dashboard KPI, ROI, spend analysis.',
  },
  chatbot: {
    name: 'chatbot',
    pack: 'core',
    alwaysOn: false,
    dependencies: ['core'],
    description: 'Procurement assistant AI conversazionale.',
  },
  smartfill: {
    name: 'smartfill',
    pack: 'core',
    alwaysOn: false,
    dependencies: ['core', 'requests'],
    description: 'Auto-compilazione campi PR via AI.',
  },
  'email-intelligence': {
    name: 'email-intelligence',
    pack: 'core',
    alwaysOn: false,
    dependencies: ['core', 'commesse', 'requests'],
    description:
      'Email classification e azioni automatiche (crea commesse, RDA).',
  },

  // ============ DEFENSE PACK (attivabile tutto insieme) ============
  // Nota: questi moduli NON esistono ancora nel codice. Sono registrati
  // qui come placeholder della roadmap. Il loro alwaysOn è false e le
  // loro dipendenze dichiarano il prerequisito core.
  // Quando verranno implementati, ognuno avrà la sua cartella in
  // src/modules/defense/<name>/.
  //
  // Esempio placeholder, decommentare quando si implementerà:
  // 'defense-nc': {
  //   name: 'defense-nc',
  //   pack: 'defense',
  //   alwaysOn: false,
  //   dependencies: ['core', 'commesse', 'vendors'],
  //   description: 'Non Conformità con workflow contraddittorio.',
  // },
}

/**
 * Ritorna tutti i moduli di un pack specifico.
 */
export function getModulesByPack(pack: PackName): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter((m) => m.pack === pack)
}

/**
 * Ritorna tutti i moduli sempre attivi.
 */
export function getAlwaysOnModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter((m) => m.alwaysOn)
}

/**
 * Verifica che un modulo esista nel registro.
 */
export function isKnownModule(name: string): boolean {
  return name in MODULE_REGISTRY
}
