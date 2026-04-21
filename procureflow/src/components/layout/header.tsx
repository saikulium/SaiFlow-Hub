'use client'

import { useState, useRef, useEffect } from 'react'
import { Menu, Search, MessageSquare, LogOut } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { useSidebar } from './sidebar-context'
import { Breadcrumbs } from './breadcrumbs'
import { ThemeToggle } from './theme-toggle'
import { SearchDialog } from './search-dialog'
import { NotificationCenter } from './notification-center'
import { ChatPanel } from '@/modules/core/chatbot'
import { useModules } from '@/hooks/use-modules'
import { getInitials } from '@/lib/utils'

export function Header() {
  const { setMobileOpen } = useSidebar()
  const [searchOpen, setSearchOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { isModuleEnabled } = useModules()

  const { data: session } = useSession()
  const user = session?.user
  const chatEnabled = isModuleEnabled('chatbot')

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  return (
    <>
      <header className="bg-pf-bg-primary/80 sticky top-0 z-30 flex h-16 items-center justify-between border-b border-pf-border px-4 backdrop-blur-md md:px-6">
        <div className="flex items-center gap-4">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-button text-pf-text-secondary hover:bg-pf-bg-hover md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Breadcrumbs />
        </div>

        <div className="flex items-center gap-2">
          {/* Search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 items-center gap-2 rounded-button border border-pf-border bg-pf-bg-tertiary px-3 text-sm text-pf-text-muted transition-colors hover:border-pf-border-hover hover:text-pf-text-secondary"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cerca...</span>
            <kbd className="hidden rounded border border-pf-border bg-pf-bg-secondary px-1.5 py-0.5 text-[10px] font-medium sm:inline">
              ⌘K
            </kbd>
          </button>

          {/* Chat AI */}
          {chatEnabled && (
            <button
              onClick={() => setChatOpen(true)}
              title="Assistente AI"
              className="flex h-9 w-9 items-center justify-center rounded-button text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-accent"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}

          {/* Notifications */}
          <NotificationCenter />

          {/* Theme toggle */}
          <ThemeToggle />

          {/* User avatar + dropdown */}
          {user && (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-pf-accent text-xs font-bold text-white transition-opacity hover:opacity-80"
              >
                {getInitials(user.name ?? '')}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-card border border-pf-border bg-pf-bg-secondary py-1 shadow-lg">
                  <div className="border-b border-pf-border px-4 py-3">
                    <p className="truncate text-sm font-medium text-pf-text-primary">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-pf-text-muted">
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-red-400"
                  >
                    <LogOut className="h-4 w-4" />
                    Esci
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {searchOpen && <SearchDialog />}
      {chatEnabled && (
        <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      )}
    </>
  )
}
