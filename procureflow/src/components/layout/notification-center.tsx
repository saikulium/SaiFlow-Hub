'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNotifications, useMarkAsRead } from '@/modules/core/requests'
import { NotificationItemRow } from './notification-item'
import { useRouter } from 'next/navigation'

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()

  const { data } = useNotifications()
  const { mutate: markRead } = useMarkAsRead()

  const notifications = data?.notifications ?? []
  const unreadCount = data?.unreadCount ?? 0

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  function handleNotificationClick(id: string, link: string | null) {
    markRead([id])
    setIsOpen(false)
    if (link) router.push(link)
  }

  function handleMarkAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length > 0) markRead(unreadIds)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-button text-pf-text-secondary transition-colors hover:bg-pf-bg-hover hover:text-pf-text-primary"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-pf-danger px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-card border border-pf-border bg-pf-bg-secondary shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-pf-border px-4 py-3">
              <h3 className="text-sm font-semibold text-pf-text-primary">
                Notifiche
                {unreadCount > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-pf-text-muted">
                    ({unreadCount} non lette)
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 text-xs text-pf-accent hover:underline"
                >
                  <Check className="h-3 w-3" />
                  Segna tutte
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Bell className="h-8 w-8 text-pf-text-muted" />
                  <p className="mt-2 text-sm text-pf-text-secondary">
                    Nessuna notifica
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-pf-border">
                  {notifications.map((notification) => (
                    <NotificationItemRow
                      key={notification.id}
                      notification={notification}
                      onClick={() =>
                        handleNotificationClick(
                          notification.id,
                          notification.link,
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
