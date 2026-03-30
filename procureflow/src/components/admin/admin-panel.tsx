'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings2,
  ShieldCheck,
  Tag,
  Building2,
  Plug,
  FileUp,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { GeneralTab } from '@/components/admin/general-tab'
import { ApprovalsTab } from '@/components/admin/approvals-tab'
import { CategoriesTab } from '@/components/admin/categories-tab'
import { DepartmentsTab } from '@/components/admin/departments-tab'
import { IntegrationsTab } from '@/components/admin/integrations-tab'
import { ImportExportTab } from '@/components/admin/import-export-tab'

const TABS = [
  { id: 'general', label: 'Generale', icon: Settings2 },
  { id: 'approvals', label: 'Approvazioni', icon: ShieldCheck },
  { id: 'categories', label: 'Categorie', icon: Tag },
  { id: 'departments', label: 'Dip & Costi', icon: Building2 },
  { id: 'integrations', label: 'Integrazioni', icon: Plug },
  { id: 'import-export', label: 'Import/Export', icon: FileUp },
] as const

type TabId = (typeof TABS)[number]['id']

const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  general: GeneralTab,
  approvals: ApprovalsTab,
  categories: CategoriesTab,
  departments: DepartmentsTab,
  integrations: IntegrationsTab,
  'import-export': ImportExportTab,
}

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('general')

  const ActiveComponent = TAB_COMPONENTS[activeTab]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-button border border-pf-border text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-pf-text-primary">
            Pannello Admin
          </h1>
          <p className="mt-0.5 text-sm text-pf-text-secondary">
            Configurazione globale del sistema ProcureFlow
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar tabs */}
        <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-visible">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2.5 whitespace-nowrap rounded-button px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-pf-accent/10 text-pf-accent'
                    : 'text-pf-text-secondary hover:bg-pf-bg-hover hover:text-pf-text-primary',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="admin-tab-indicator"
                    className="absolute inset-0 rounded-button bg-pf-accent/10"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Icon className="relative z-10 h-4 w-4 shrink-0" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Tab content */}
        <div className="min-w-0 flex-1">
          <ActiveComponent />
        </div>
      </div>
    </div>
  )
}
