import { MODULE_REGISTRY, type ModuleId } from './registry'

const REGISTRY_ENTRIES = Array.from(MODULE_REGISTRY.values())

/** Check if a module is enabled. Core is always enabled. */
export function isModuleEnabled(
  enabledModules: readonly string[],
  moduleId: ModuleId,
): boolean {
  if (moduleId === 'core') return true
  return enabledModules.includes(moduleId)
}

/** Check if a nav/page path belongs to an enabled module. */
export function isPathEnabled(
  enabledModules: readonly string[],
  path: string,
): boolean {
  for (const def of REGISTRY_ENTRIES) {
    if (
      def.navPaths.some(
        (p: string) => path === p || path.startsWith(p + '/'),
      )
    ) {
      if (!isModuleEnabled(enabledModules, def.id)) return false
    }
  }
  return true
}

/** Check if an API route prefix belongs to an enabled module. */
export function isApiPrefixEnabled(
  enabledModules: readonly string[],
  pathname: string,
): boolean {
  for (const def of REGISTRY_ENTRIES) {
    if (
      def.apiPrefixes.some(
        (p: string) => pathname === p || pathname.startsWith(p + '/'),
      )
    ) {
      if (!isModuleEnabled(enabledModules, def.id)) return false
    }
  }
  return true
}

/**
 * Filter nav items to only include those belonging to enabled modules.
 * Items without a matching module path are included by default (fail-open for unknown paths).
 */
export function filterNavItems<T extends { href: string }>(
  enabledModules: readonly string[],
  items: readonly T[],
): T[] {
  return items.filter((item) => isPathEnabled(enabledModules, item.href))
}

/** Filter dashboard tabs by module. Tab IDs must match dashboardTabs in registry. */
export function filterDashboardTabs<T extends { id: string }>(
  enabledModules: readonly string[],
  tabs: readonly T[],
): T[] {
  return tabs.filter((tab) => {
    for (const def of REGISTRY_ENTRIES) {
      if (def.dashboardTabs.includes(tab.id)) {
        return isModuleEnabled(enabledModules, def.id)
      }
    }
    return true
  })
}
