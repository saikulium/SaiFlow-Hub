'use client'

import { useState } from 'react'

interface MfaSetupData {
  secret: string
  qrCodeDataUrl: string
}

export function useMfaSetup() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startSetup(): Promise<MfaSetupData | null> {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' })
      const json = await res.json()
      if (!json.success) {
        setError(json.error?.message ?? 'Errore durante il setup MFA')
        return null
      }
      return json.data as MfaSetupData
    } catch {
      setError('Errore di rete')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { startSetup, isLoading, error }
}

export function useMfaVerifySetup() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function verifySetup(
    secret: string,
    code: string,
  ): Promise<string[] | null> {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/mfa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, code }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error?.message ?? 'Codice non valido')
        return null
      }
      return json.data.recoveryCodes as string[]
    } catch {
      setError('Errore di rete')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { verifySetup, isLoading, error }
}

export function useMfaDisable() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function disable(code: string): Promise<boolean> {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error?.message ?? 'Codice non valido')
        return false
      }
      return true
    } catch {
      setError('Errore di rete')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return { disable, isLoading, error }
}
