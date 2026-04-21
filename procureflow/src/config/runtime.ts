import { MODULE_REGISTRY, getAlwaysOnModules, isKnownModule } from './modules'

/**
 * Configurazione runtime calcolata all'avvio dell'applicazione dalla
 * variabile d'ambiente ENABLED_MODULES (comma-separated list).
 *
 * Se ENABLED_MODULES non è impostata, tutti i moduli registrati sono attivi
 * (comportamento backward-compatible per deploy esistenti).
 *
 * Questa funzione VALIDA la configurazione e LANCIA se ci sono errori
 * (dipendenze mancanti, moduli sconosciuti, ecc.). È meglio fallire al
 * boot con errore chiaro che avere comportamenti strani a runtime.
 */

export interface RuntimeConfig {
  customerCode: string | null
  enabledModules: Set<string>
  /** Pack attivo principale per questa istanza (per display/branding). */
  primaryPack: 'core' | 'defense'
}

let cachedConfig: RuntimeConfig | null = null

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) return cachedConfig

  const customerCode = process.env.CUSTOMER_CODE?.trim() || null
  const enabledModulesEnv = process.env.ENABLED_MODULES?.trim()

  let enabledModules: Set<string>

  if (!enabledModulesEnv) {
    // Backward compat: se ENABLED_MODULES non impostata, attiva tutti i moduli core.
    // Questo è il comportamento di deploy esistenti prima del refactoring.
    enabledModules = new Set(
      Object.values(MODULE_REGISTRY)
        .filter((m) => m.pack === 'core')
        .map((m) => m.name),
    )
  } else {
    const requested = enabledModulesEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    enabledModules = new Set(requested)
  }

  // Aggiungi sempre i moduli alwaysOn
  for (const m of getAlwaysOnModules()) {
    enabledModules.add(m.name)
  }

  // Validazione 1: tutti i moduli richiesti devono esistere
  for (const name of Array.from(enabledModules)) {
    if (!isKnownModule(name)) {
      throw new Error(
        `[MODULE SYSTEM] Modulo sconosciuto in ENABLED_MODULES: "${name}". ` +
          `Moduli registrati: ${Object.keys(MODULE_REGISTRY).join(', ')}`,
      )
    }
  }

  // Validazione 2: dipendenze transitive soddisfatte
  for (const name of Array.from(enabledModules)) {
    const def = MODULE_REGISTRY[name]!
    for (const dep of def.dependencies) {
      if (!enabledModules.has(dep)) {
        throw new Error(
          `[MODULE SYSTEM] Il modulo "${name}" richiede "${dep}" che non è attivo. ` +
            `Aggiungi "${dep}" a ENABLED_MODULES o disattiva "${name}".`,
        )
      }
    }
  }

  // Determina pack primario
  const hasDefense = Array.from(enabledModules).some(
    (name) => MODULE_REGISTRY[name]?.pack === 'defense',
  )
  const primaryPack = hasDefense ? 'defense' : 'core'

  cachedConfig = {
    customerCode,
    enabledModules,
    primaryPack,
  }

  return cachedConfig
}

/**
 * Verifica se un modulo è attivo nella configurazione corrente.
 * Uso: `if (isModuleEnabled('invoicing')) { ... }`
 */
export function isModuleEnabled(moduleName: string): boolean {
  return getRuntimeConfig().enabledModules.has(moduleName)
}

/**
 * Ritorna la lista dei moduli attivi come array.
 */
export function getEnabledModules(): string[] {
  return Array.from(getRuntimeConfig().enabledModules)
}

/**
 * Reset della cache. Uso solo nei test.
 */
export function __resetConfigCache() {
  cachedConfig = null
}
