'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { X, Boxes } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSidebar } from './sidebar-context'
import { SidebarNavItem } from './sidebar-nav-item'
import { NAV_ITEMS } from '@/lib/constants'
import { useModules } from '@/hooks/use-modules'
import { filterNavItems } from '@/lib/modules/helpers'

export function MobileDrawer() {
  const { isMobileOpen, setMobileOpen } = useSidebar()
  const { enabledModules } = useModules()
  const visibleItems = filterNavItems(enabledModules, NAV_ITEMS)
  const pathname = usePathname()

  // Close on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname, setMobileOpen])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    if (isMobileOpen) {
      document.addEventListener('keydown', handler)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isMobileOpen, setMobileOpen])

  return (
    <AnimatePresence>
      {isMobileOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 z-50 flex h-full w-[280px] flex-col border-r border-pf-border bg-pf-bg-secondary md:hidden"
          >
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-pf-border px-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-button bg-pf-accent">
                  <Boxes className="h-4 w-4 text-white" />
                </div>
                <span className="font-display text-lg font-bold text-pf-text-primary">
                  ProcureFlow
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-button text-pf-text-secondary hover:bg-pf-bg-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
              {visibleItems.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  isCollapsed={false}
                />
              ))}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
