'use client'

import { motion } from 'framer-motion'
import { ChevronLeft, Boxes } from 'lucide-react'
import { useSidebar } from './sidebar-context'
import { SidebarNavItem } from './sidebar-nav-item'
import { NAV_ITEMS } from '@/lib/constants'
import { useModules } from '@/hooks/use-modules'
import { filterNavItems } from '@/lib/modules/helpers'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const { isCollapsed, toggle } = useSidebar()
  const { enabledModules } = useModules()
  const visibleItems = filterNavItems(enabledModules, NAV_ITEMS)

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-pf-border bg-pf-bg-secondary transition-all duration-300 ease-in-out md:flex',
        isCollapsed ? 'w-16' : 'w-[260px]',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-pf-border px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-button bg-pf-accent">
            <Boxes className="h-4 w-4 text-white" />
          </div>
          <motion.span
            initial={false}
            animate={{
              opacity: isCollapsed ? 0 : 1,
              width: isCollapsed ? 0 : 'auto',
            }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden whitespace-nowrap font-display text-lg font-bold text-pf-text-primary"
          >
            ProcureFlow
          </motion.span>
        </div>
        <button
          onClick={toggle}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-badge text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary"
        >
          <ChevronLeft
            className={cn(
              'h-4 w-4 transition-transform duration-300',
              isCollapsed && 'rotate-180',
            )}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {visibleItems.map((item) => (
          <SidebarNavItem
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>

      {/* Bottom brand */}
      <div className="border-t border-pf-border p-4">
        <motion.p
          initial={false}
          animate={{ opacity: isCollapsed ? 0 : 1 }}
          className="truncate text-xs text-pf-text-muted"
        >
          ProcureFlow v0.1
        </motion.p>
      </div>
    </aside>
  )
}
