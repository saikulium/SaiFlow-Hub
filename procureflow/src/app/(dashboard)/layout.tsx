'use client'

import { SidebarProvider, useSidebar } from '@/components/layout/sidebar-context'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MobileDrawer } from '@/components/layout/mobile-drawer'
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

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <SidebarProvider>
      <Sidebar />
      <MobileDrawer />
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  )
}
