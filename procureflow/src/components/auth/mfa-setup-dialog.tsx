'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck, Copy, Check } from 'lucide-react'
import { useMfaSetup, useMfaVerifySetup } from '@/hooks/use-mfa'

type Step = 'qr' | 'verify' | 'recovery'

interface MfaSetupDialogProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
}

export function MfaSetupDialog({
  open,
  onClose,
  onComplete,
}: MfaSetupDialogProps) {
  const [step, setStep] = useState<Step>('qr')
  const [secret, setSecret] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const { startSetup, isLoading: setupLoading, error: setupError } = useMfaSetup()
  const {
    verifySetup,
    isLoading: verifyLoading,
    error: verifyError,
  } = useMfaVerifySetup()

  async function handleOpen() {
    const data = await startSetup()
    if (data) {
      setSecret(data.secret)
      setQrCodeDataUrl(data.qrCodeDataUrl)
      setStep('qr')
    }
  }

  async function handleVerify() {
    const codes = await verifySetup(secret, verifyCode)
    if (codes) {
      setRecoveryCodes(codes)
      setStep('recovery')
    }
  }

  function handleCopyCodes() {
    navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDone() {
    setStep('qr')
    setSecret('')
    setQrCodeDataUrl('')
    setVerifyCode('')
    setRecoveryCodes([])
    onComplete()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-card border border-pf-border bg-pf-bg-secondary p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-pf-accent" />
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            Configura MFA
          </h2>
        </div>

        {step === 'qr' && !qrCodeDataUrl && (
          <div className="space-y-4">
            <p className="text-sm text-pf-text-secondary">
              Scansiona il codice QR con la tua app di autenticazione (Google
              Authenticator, Authy, ecc.)
            </p>
            <button
              onClick={handleOpen}
              disabled={setupLoading}
              className="flex w-full items-center justify-center gap-2 rounded-button bg-pf-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
            >
              {setupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Genera codice QR
            </button>
            {setupError && (
              <p className="text-sm text-red-400">{setupError}</p>
            )}
          </div>
        )}

        {step === 'qr' && qrCodeDataUrl && (
          <div className="space-y-4">
            <p className="text-sm text-pf-text-secondary">
              Scansiona questo codice QR con la tua app di autenticazione:
            </p>
            <div className="flex justify-center rounded-lg bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeDataUrl} alt="QR Code MFA" className="h-48 w-48" />
            </div>
            <div className="rounded-badge bg-pf-bg-tertiary px-3 py-2">
              <p className="mb-1 text-xs text-pf-text-muted">
                Oppure inserisci manualmente questo codice:
              </p>
              <code className="font-mono text-sm text-pf-text-primary">
                {secret}
              </code>
            </div>
            <button
              onClick={() => setStep('verify')}
              className="w-full rounded-button bg-pf-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
            >
              Avanti
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-pf-text-secondary">
              Inserisci il codice a 6 cifre mostrato nella tua app:
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={(e) =>
                setVerifyCode(e.target.value.replace(/\D/g, ''))
              }
              className="w-full rounded-button border border-pf-border bg-pf-bg-tertiary px-3 py-2 text-center font-mono text-lg tracking-widest text-pf-text-primary focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent"
              placeholder="000000"
              autoFocus
            />
            {verifyError && (
              <p className="text-sm text-red-400">{verifyError}</p>
            )}
            <button
              onClick={handleVerify}
              disabled={verifyLoading || verifyCode.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-button bg-pf-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
            >
              {verifyLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Verifica e attiva
            </button>
          </div>
        )}

        {step === 'recovery' && (
          <div className="space-y-4">
            <div className="rounded-badge bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              Salva questi codici di recupero in un luogo sicuro. Non potrai
              vederli di nuovo.
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-pf-bg-tertiary p-4">
              {recoveryCodes.map((code) => (
                <code
                  key={code}
                  className="font-mono text-sm text-pf-text-primary"
                >
                  {code}
                </code>
              ))}
            </div>
            <button
              onClick={handleCopyCodes}
              className="flex w-full items-center justify-center gap-2 rounded-button border border-pf-border bg-pf-bg-tertiary px-4 py-2 text-sm text-pf-text-primary transition-colors hover:bg-pf-bg-hover"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copiato!' : 'Copia codici'}
            </button>
            <button
              onClick={handleDone}
              className="w-full rounded-button bg-pf-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pf-accent-hover"
            >
              Ho salvato i codici
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
