'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { ModuleId } from '@/lib/modules/registry'

interface ModulesContextValue {
  readonly enabledModules: readonly string[]
  readonly isModuleEnabled: (id: ModuleId) => boolean
}

const ModulesContext = createContext<ModulesContextValue | null>(null)

export function ModulesProvider({
  enabledModules,
  children,
}: {
  readonly enabledModules: readonly string[]
  readonly children: ReactNode
}) {
  const isModuleEnabled = (id: ModuleId) =>
    id === 'core' || enabledModules.includes(id)

  return (
    <ModulesContext.Provider value={{ enabledModules, isModuleEnabled }}>
      {children}
    </ModulesContext.Provider>
  )
}

export function useModules() {
  const ctx = useContext(ModulesContext)
  if (!ctx) throw new Error('useModules must be used within ModulesProvider')
  return ctx
}
