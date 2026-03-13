'use client'

import { SidebarProvider, useSidebar } from '@/components/layout/sidebar-context'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileDrawer } from '@/components/layout/mobile-drawer'
import { ModulesProvider } from '@/components/providers/modules-provider'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

function DashboardContent({ children }: { children: ReactNode }) {
  const { isCollapsed } = useSidebar()

  return (
    <div
      className={cn(
        'min-h-screen transition-all duration-300 ease-in-out',
        isCollapsed ? 'md:ml-16' : 'md:ml-[260px]',
      )}
    >
      <Header />
      <main className="mx-auto max-w-content p-4 md:p-6">{children}</main>
    </div>
  )
}

export function DashboardShell({
  enabledModules,
  children,
}: {
  readonly enabledModules: readonly string[]
  readonly children: ReactNode
}) {
  return (
    <ModulesProvider enabledModules={enabledModules}>
      <SidebarProvider>
        <Sidebar />
        <MobileDrawer />
        <DashboardContent>{children}</DashboardContent>
      </SidebarProvider>
    </ModulesProvider>
  )
}
