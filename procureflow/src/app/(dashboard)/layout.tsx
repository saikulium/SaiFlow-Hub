import { getEnabledModules } from '@/server/services/module.service'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import type { ReactNode } from 'react'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const enabledModules = await getEnabledModules()

  return (
    <DashboardShell enabledModules={enabledModules}>
      {children}
    </DashboardShell>
  )
}
