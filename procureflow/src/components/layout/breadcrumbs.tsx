'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

const SEGMENT_LABELS: Record<string, string> = {
  requests: 'Richieste',
  vendors: 'Fornitori',
  approvals: 'Approvazioni',
  analytics: 'Analytics',
  settings: 'Impostazioni',
  new: 'Nuova',
}

export function Breadcrumbs() {
  const pathname = usePathname()

  if (pathname === '/') return null

  const segments = pathname.split('/').filter(Boolean)

  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      <Link
        href="/"
        className="flex items-center text-pf-text-muted transition-colors hover:text-pf-text-primary"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {segments.map((segment, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/')
        const isLast = i === segments.length - 1
        const label = SEGMENT_LABELS[segment] ?? segment

        return (
          <span key={href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 text-pf-text-muted" />
            {isLast ? (
              <span className="font-medium text-pf-text-primary">{label}</span>
            ) : (
              <Link
                href={href}
                className="text-pf-text-muted transition-colors hover:text-pf-text-primary"
              >
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
