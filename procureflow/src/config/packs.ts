import { getModulesByPack, type PackName } from './modules'

/**
 * Un "pack" è un raggruppamento commerciale di moduli venduto come unità.
 * Questo file descrive quali moduli fanno parte di quale pack a fini commerciali
 * e di pricing. Per l'attivazione tecnica per-cliente, vedi ENABLED_MODULES.
 */

export interface PackDefinition {
  name: PackName
  displayName: string
  description: string
  /** Nomi dei moduli inclusi in questo pack (derivati dal registry). */
  modules: string[]
}

export const PACKS: Record<PackName, PackDefinition> = {
  core: {
    name: 'core',
    displayName: 'ProcureFlow Core',
    description:
      "Hub di procurement per PMI italiane: richieste d'acquisto, fornitori, commesse, fatturazione SDI, magazzino.",
    modules: getModulesByPack('core').map((m) => m.name),
  },
  defense: {
    name: 'defense',
    displayName: 'ProcureFlow Defense Pack',
    description:
      'Estensione verticale per subfornitori Tier 2/3 difesa e aerospazio: offerte, NC, firma digitale, tracciabilità lotti, multi-valuta, connettori piattaforme committenti.',
    modules: getModulesByPack('defense').map((m) => m.name),
  },
}
