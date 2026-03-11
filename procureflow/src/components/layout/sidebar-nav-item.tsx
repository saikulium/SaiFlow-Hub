'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/constants'

interface SidebarNavItemProps {
  item: NavItem
  isCollapsed: boolean
}

export function SidebarNavItem({ item, isCollapsed }: SidebarNavItemProps) {
  const pathname = usePathname()
  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'group relative flex items-center gap-3 rounded-button px-3 py-2.5 text-sm transition-all duration-150',
        isActive
          ? 'bg-pf-accent-subtle text-pf-text-primary'
          : 'text-pf-text-secondary hover:bg-pf-bg-hover hover:text-pf-text-primary',
        isCollapsed && 'justify-center px-2',
      )}
      title={isCollapsed ? item.label : undefined}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-pf-accent"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}

      <Icon
        className={cn(
          'h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-105',
          isActive ? 'text-pf-accent' : 'text-pf-text-secondary',
        )}
      />

      <motion.span
        initial={false}
        animate={{
          opacity: isCollapsed ? 0 : 1,
          width: isCollapsed ? 0 : 'auto',
        }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden whitespace-nowrap font-medium"
      >
        {item.label}
      </motion.span>

      {/* Badge */}
      {item.badge && !isCollapsed && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-pf-accent px-1.5 text-[11px] font-semibold text-white">
          {item.badge === 'approvals' ? '4' : '3'}
        </span>
      )}

      {item.badge && isCollapsed && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-pf-accent" />
      )}
    </Link>
  )
}
