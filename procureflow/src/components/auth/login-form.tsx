'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, LogIn, ShieldCheck, ArrowLeft } from 'lucide-react'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'

type ErrorType = 'generic' | 'lockout' | 'mfa'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [errorType, setErrorType] = useState<ErrorType>('generic')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const totpInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginInput) {
    setError(null)
    setErrorType('generic')

    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      totpCode: mfaRequired ? totpCode : undefined,
      redirect: false,
    })

    if (result?.error) {
      const errorMsg = result.error

      if (errorMsg.includes('ACCOUNT_LOCKED')) {
        const minutes = errorMsg.split(':')[1] ?? '15'
        setError(`Account bloccato. Riprova tra ${minutes} minuti.`)
        setErrorType('lockout')
      } else if (errorMsg.includes('MFA_REQUIRED')) {
        setMfaRequired(true)
        setError(null)
        // Focus TOTP input after render
        setTimeout(() => totpInputRef.current?.focus(), 100)
      } else if (errorMsg.includes('INVALID_TOTP')) {
        setError('Codice non valido')
        setErrorType('mfa')
        setTotpCode('')
      } else {
        setError('Credenziali non valide')
        setErrorType('generic')
      }
      return
    }

    router.push('/')
    router.refresh()
  }

  function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    const values = getValues()
    onSubmit(values)
  }

  function handleBackToLogin() {
    setMfaRequired(false)
    setTotpCode('')
    setError(null)
    setErrorType('generic')
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="font-display text-2xl font-bold text-pf-text-primary">
          ProcureFlow
        </h1>
        <p className="mt-2 text-sm text-pf-text-secondary">
          {mfaRequired ? 'Verifica in due fattori' : 'Accedi al tuo account'}
        </p>
      </div>

      {!mfaRequired ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-card border border-pf-border bg-pf-bg-secondary p-6"
        >
          {error && (
            <div
              className={`rounded-badge px-3 py-2 text-sm ${
                errorType === 'lockout'
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-pf-text-primary"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              placeholder="nome@azienda.it"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-pf-text-primary"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-button bg-pf-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Accedi
          </button>
        </form>
      ) : (
        <form
          onSubmit={handleMfaSubmit}
          className="space-y-4 rounded-card border border-pf-border bg-pf-bg-secondary p-6"
        >
          <div className="flex items-center justify-center">
            <ShieldCheck className="h-10 w-10 text-pf-accent" />
          </div>

          {error && (
            <div className="rounded-badge bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <p className="text-center text-sm text-pf-text-secondary">
            Inserisci il codice dall&apos;app di autenticazione o un codice di
            recupero
          </p>

          <div>
            <label
              htmlFor="totpCode"
              className="mb-1.5 block text-sm font-medium text-pf-text-primary"
            >
              Codice di verifica
            </label>
            <input
              ref={totpInputRef}
              id="totpCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.toUpperCase())}
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-center font-mono text-lg tracking-widest text-pf-text-primary placeholder:text-pf-text-muted focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              placeholder="000000"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || totpCode.length < 6}
            className="flex w-full items-center justify-center gap-2 rounded-button bg-pf-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Verifica
          </button>

          <button
            type="button"
            onClick={handleBackToLogin}
            className="flex w-full items-center justify-center gap-1.5 text-sm text-pf-text-secondary transition-colors hover:text-pf-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Indietro
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-xs text-pf-text-muted">
        Contatta l&apos;amministratore per ottenere le credenziali
      </p>
    </div>
  )
}
