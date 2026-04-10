'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, useFieldArray, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  Send,
  ChevronDown,
  Search,
  AlertCircle,
} from 'lucide-react'
import { createRequestSchema } from '@/lib/validations/request'
import type { z } from 'zod'

type CreateRequestFormValues = z.input<typeof createRequestSchema>
import { PRIORITY_CONFIG, type PriorityKey } from '@/lib/constants'
import { cn } from '@/lib/utils'
import {
  useCreateRequest,
  useVendors,
  useQuickCreateVendor,
} from '@/hooks/use-request'
import { useAdminConfig } from '@/hooks/use-admin-config'
import { useCommesse } from '@/hooks/use-commesse'
import { useRequestSuggestions } from '@/hooks/use-request-suggestions'
import { BudgetCapacityBanner } from '@/components/requests/budget-capacity-banner'
import { SuggestionPanel } from '@/components/requests/suggestion-panel'
import type { RequestSuggestion } from '@/server/services/suggest.service'

// --- Constants ---

const PRIORITY_OPTIONS: readonly { value: PriorityKey; label: string }[] = [
  { value: 'LOW', label: PRIORITY_CONFIG.LOW.label },
  { value: 'MEDIUM', label: PRIORITY_CONFIG.MEDIUM.label },
  { value: 'HIGH', label: PRIORITY_CONFIG.HIGH.label },
  { value: 'URGENT', label: PRIORITY_CONFIG.URGENT.label },
] as const

const CATEGORY_OPTIONS = [
  'Hardware',
  'Software',
  'Servizi',
  'Materiali',
  'Attrezzature',
  'Altro',
] as const

// --- Sub-components ---

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
      <AlertCircle className="h-3 w-3" />
      {message}
    </p>
  )
}

function FormLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm text-pf-text-secondary"
    >
      {children}
      {required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
  )
}

// --- Vendor Select ---

function VendorSelect({
  value,
  onChange,
  error,
}: {
  value: string | undefined
  onChange: (value: string) => void
  error?: string
}) {
  const { data: vendorsData, isLoading } = useVendors()
  const quickCreate = useQuickCreateVendor()
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showQuickForm, setShowQuickForm] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickEmail, setQuickEmail] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        buttonRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return
      setIsOpen(false)
      setShowQuickForm(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const vendors = useMemo(() => vendorsData?.data ?? [], [vendorsData])

  const filteredVendors = useMemo(() => {
    if (!searchQuery) return vendors
    const lower = searchQuery.toLowerCase()
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(lower) ||
        v.code.toLowerCase().includes(lower),
    )
  }, [vendors, searchQuery])

  const selectedVendor = vendors.find((v) => v.id === value)

  const handleStartQuickCreate = useCallback(() => {
    setQuickName(searchQuery)
    setQuickEmail('')
    setQuickPhone('')
    setShowQuickForm(true)
  }, [searchQuery])

  const handleQuickCreate = useCallback(async () => {
    if (!quickName.trim()) return
    try {
      const vendor = await quickCreate.mutateAsync({
        name: quickName.trim(),
        email: quickEmail.trim() || undefined,
        phone: quickPhone.trim() || undefined,
      })
      onChange(vendor.id)
      setIsOpen(false)
      setSearchQuery('')
      setShowQuickForm(false)
      setQuickName('')
      setQuickEmail('')
      setQuickPhone('')
    } catch {
      // Error handled by mutation state
    }
  }, [quickName, quickEmail, quickPhone, quickCreate, onChange])

  return (
    <div>
      <FormLabel htmlFor="vendor_id">Fornitore</FormLabel>
      <button
        ref={buttonRef}
        type="button"
        id="vendor_id"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-pf-accent',
          selectedVendor ? 'text-pf-text-primary' : 'text-pf-text-secondary/50',
        )}
      >
        <span className="truncate">
          {isLoading
            ? 'Caricamento...'
            : selectedVendor
              ? selectedVendor.name
              : 'Seleziona fornitore'}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-pf-text-secondary" />
      </button>

      {isOpen &&
        mounted &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
              backgroundColor: '#1C1C1E',
            }}
            className="rounded-card border border-pf-border shadow-2xl"
          >
            <div className="border-b border-pf-border p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pf-text-secondary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setShowQuickForm(false)
                  }}
                  placeholder="Cerca fornitore..."
                  className="placeholder:text-pf-text-secondary/50 h-8 w-full rounded-button border border-pf-border bg-pf-bg-primary pl-8 pr-3 text-sm text-pf-text-primary focus:outline-none focus:ring-1 focus:ring-pf-accent"
                  autoFocus
                />
              </div>
            </div>

            {!showQuickForm ? (
              <div className="max-h-48 overflow-y-auto p-1">
                {filteredVendors.map((vendor) => (
                  <button
                    key={vendor.id}
                    type="button"
                    onClick={() => {
                      onChange(vendor.id)
                      setIsOpen(false)
                      setSearchQuery('')
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-button px-3 py-2 text-left text-sm transition-colors hover:bg-pf-bg-secondary',
                      vendor.id === value
                        ? 'text-pf-accent'
                        : 'text-pf-text-primary',
                    )}
                  >
                    <span className="truncate">{vendor.name}</span>
                    <span className="shrink-0 text-xs text-pf-text-secondary">
                      {vendor.code}
                    </span>
                  </button>
                ))}
                {filteredVendors.length === 0 && searchQuery.length > 0 && (
                  <div className="px-3 py-2">
                    <p className="text-xs text-pf-text-muted">
                      Nessun fornitore trovato
                    </p>
                  </div>
                )}
                {/* Quick-create button: always visible when searching */}
                {searchQuery.length > 0 && (
                  <button
                    type="button"
                    onClick={handleStartQuickCreate}
                    className="hover:bg-pf-accent/10 flex w-full items-center gap-2 rounded-button border-t border-pf-border px-3 py-2.5 text-left text-sm font-medium text-pf-accent transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Crea &ldquo;{searchQuery}&rdquo;
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 p-3">
                <p className="text-xs font-medium text-pf-text-secondary">
                  Nuovo fornitore (da completare)
                </p>
                <input
                  type="text"
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="Nome fornitore *"
                  className="h-8 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:outline-none focus:ring-1 focus:ring-pf-accent"
                  autoFocus
                />
                <input
                  type="email"
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                  placeholder="Email (opzionale)"
                  className="h-8 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:outline-none focus:ring-1 focus:ring-pf-accent"
                />
                <input
                  type="tel"
                  value={quickPhone}
                  onChange={(e) => setQuickPhone(e.target.value)}
                  placeholder="Telefono (opzionale)"
                  className="h-8 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary placeholder:text-pf-text-muted focus:outline-none focus:ring-1 focus:ring-pf-accent"
                />
                {quickCreate.isError && (
                  <p className="text-xs text-red-400">
                    {quickCreate.error?.message ?? 'Errore creazione'}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickForm(false)}
                    className="h-8 flex-1 rounded-button border border-pf-border text-xs font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickCreate}
                    disabled={!quickName.trim() || quickCreate.isPending}
                    className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-button bg-pf-accent text-xs font-medium text-white transition-colors hover:bg-pf-accent-hover disabled:opacity-50"
                  >
                    {quickCreate.isPending && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Crea
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}

      <FieldError message={error} />
    </div>
  )
}

// --- Main Form ---

export function RequestForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCommessaId = searchParams.get('commessa_id') ?? undefined
  const createRequest = useCreateRequest()
  const { data: adminConfig } = useAdminConfig()
  const { data: commesse, isLoading: commesseLoading } = useCommesse({
    status: 'PLANNING,ACTIVE',
  })

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateRequestFormValues>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
      vendor_id: undefined,
      estimated_amount: undefined,
      needed_by: undefined,
      category: undefined,
      department: '',
      cost_center: '',
      budget_code: '',
      cig: '',
      cup: '',
      commessa_id: preselectedCommessaId,
      is_mepa: false,
      mepa_oda_number: '',
      tags: [],
      items: [],
    },
  })

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'items',
  })

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [complianceOpen, setComplianceOpen] = useState(false)
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false)

  const vendorId = watch('vendor_id')
  const isMepa = watch('is_mepa')
  const titleValue = watch('title')

  // SmartFill suggestions
  const { data: suggestionsData, isLoading: suggestionsLoading } =
    useRequestSuggestions(titleValue)
  const suggestion = suggestionsData?.data ?? null

  // Reset dismissed state when a new suggestion arrives
  const prevSuggestionRef = useRef<RequestSuggestion | null>(null)
  useEffect(() => {
    if (suggestion && suggestion !== prevSuggestionRef.current) {
      setSuggestionsDismissed(false)
      prevSuggestionRef.current = suggestion
    }
  }, [suggestion])

  const handleAcceptField = useCallback(
    (field: string, value: unknown) => {
      if (field === 'items' && Array.isArray(value)) {
        replace(
          value.map((item) => ({
            name: item.name ?? '',
            quantity: item.quantity ?? 1,
            unit: item.unit,
            unit_price: item.unit_price,
            total_price: item.total_price,
            sku: item.sku,
          })),
        )
      } else {
        setValue(field as keyof CreateRequestFormValues, value as never, {
          shouldValidate: true,
        })
      }
    },
    [setValue, replace],
  )

  const handleAcceptAll = useCallback(() => {
    if (!suggestion) return

    const fieldMap: Record<string, unknown> = {
      vendor_id: suggestion.vendor_id,
      category: suggestion.category,
      priority: suggestion.priority,
      department: suggestion.department,
      cost_center: suggestion.cost_center,
      estimated_amount: suggestion.estimated_amount,
    }

    for (const [key, val] of Object.entries(fieldMap)) {
      if (val != null) {
        setValue(key as keyof CreateRequestFormValues, val as never, {
          shouldValidate: true,
        })
      }
    }

    if (suggestion.items && suggestion.items.length > 0) {
      replace(
        suggestion.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total_price: item.total_price,
          sku: item.sku,
        })),
      )
    }
  }, [suggestion, setValue, replace])

  const onSubmit: SubmitHandler<CreateRequestFormValues> = async (data) => {
    setSubmitError(null)

    try {
      const result = await createRequest.mutateAsync(data)

      if (result.data?.id) {
        router.push(`/requests/${result.data.id}`)
      } else {
        router.push('/requests')
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Errore nella creazione della richiesta',
      )
    }
  }

  const handleSaveDraft: SubmitHandler<CreateRequestFormValues> = async (
    data,
  ) => {
    setSubmitError(null)

    try {
      const result = await createRequest.mutateAsync(data)

      if (result.data?.id) {
        router.push(`/requests/${result.data.id}`)
      } else {
        router.push('/requests')
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Errore nel salvataggio della bozza',
      )
    }
  }

  const addItem = () => {
    append({
      name: '',
      quantity: 1,
      unit: undefined,
      unit_price: undefined,
      total_price: undefined,
      sku: undefined,
    })
  }

  const isProcessing = isSubmitting || createRequest.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* General Error */}
      {submitError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-card border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-400"
        >
          {submitError}
        </motion.div>
      )}

      {/* SmartFill Suggestions */}
      {!suggestionsDismissed && (suggestion || suggestionsLoading) && (
        <SuggestionPanel
          suggestion={suggestion}
          isLoading={suggestionsLoading}
          onAcceptField={handleAcceptField}
          onAcceptAll={handleAcceptAll}
          onDismiss={() => setSuggestionsDismissed(true)}
        />
      )}

      {/* Basic Info */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <h2 className="mb-4 text-sm font-semibold text-pf-text-primary">
          Informazioni Base
        </h2>
        <div className="space-y-4">
          {/* Title */}
          <div>
            <FormLabel htmlFor="title" required>
              Titolo
            </FormLabel>
            <input
              id="title"
              type="text"
              {...register('title')}
              placeholder="es. Acquisto laptop per team sviluppo"
              className="placeholder:text-pf-text-secondary/50 h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
            />
            <FieldError message={errors.title?.message} />
          </div>

          {/* Description */}
          <div>
            <FormLabel htmlFor="description">Descrizione</FormLabel>
            <textarea
              id="description"
              {...register('description')}
              rows={3}
              placeholder="Descrivi la richiesta in dettaglio..."
              className="placeholder:text-pf-text-secondary/50 w-full resize-none rounded-button border border-pf-border bg-pf-bg-primary px-3 py-2 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
            />
            <FieldError message={errors.description?.message} />
          </div>

          {/* Priority & Category */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FormLabel htmlFor="priority">Priorità</FormLabel>
              <select
                id="priority"
                {...register('priority')}
                className="h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <FieldError message={errors.priority?.message} />
            </div>

            <div>
              <FormLabel htmlFor="category">Categoria</FormLabel>
              <select
                id="category"
                {...register('category')}
                className="h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
              >
                <option value="">Seleziona categoria</option>
                {(adminConfig?.categories ?? CATEGORY_OPTIONS).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <FieldError message={errors.category?.message} />
            </div>
          </div>
        </div>
      </div>

      {/* Vendor & Financial */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <h2 className="mb-4 text-sm font-semibold text-pf-text-primary">
          Fornitore e Importi
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <VendorSelect
              value={vendorId}
              onChange={(val) =>
                setValue('vendor_id', val, { shouldValidate: true })
              }
              error={errors.vendor_id?.message}
            />

            <div>
              <FormLabel htmlFor="estimated_amount">
                Importo Stimato (&euro;)
              </FormLabel>
              <input
                id="estimated_amount"
                type="number"
                step="0.01"
                min="0"
                {...register('estimated_amount', { valueAsNumber: true })}
                placeholder="0,00"
                className="placeholder:text-pf-text-secondary/50 h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
              />
              <FieldError message={errors.estimated_amount?.message} />
            </div>
          </div>

          <div>
            <FormLabel htmlFor="needed_by">Data Necessità</FormLabel>
            <input
              id="needed_by"
              type="date"
              {...register('needed_by', {
                setValueAs: (v: string) =>
                  v ? new Date(v).toISOString() : undefined,
              })}
              className="h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
            />
            <FieldError message={errors.needed_by?.message} />
          </div>
        </div>
      </div>

      {/* Organizational */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <h2 className="mb-4 text-sm font-semibold text-pf-text-primary">
          Informazioni Organizzative
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Commessa select */}
          <div className="sm:col-span-2 lg:col-span-3">
            <FormLabel htmlFor="commessa_id">Commessa</FormLabel>
            <select
              id="commessa_id"
              {...register('commessa_id')}
              disabled={commesseLoading || !!preselectedCommessaId}
              className="h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent disabled:opacity-50"
            >
              <option value="">Nessuna commessa</option>
              {(commesse ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
            {preselectedCommessaId && (
              <p className="mt-1 text-xs text-pf-text-muted">
                Commessa preselezionata — la richiesta sarà associata
                automaticamente
              </p>
            )}
          </div>

          <div>
            <FormLabel htmlFor="department">Dipartimento</FormLabel>
            <select
              id="department"
              {...register('department')}
              className="h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
            >
              <option value="">Seleziona dipartimento</option>
              {(adminConfig?.departments ?? []).map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
            <FieldError message={errors.department?.message} />
          </div>

          <div>
            <FormLabel htmlFor="cost_center">Centro Costo</FormLabel>
            <select
              id="cost_center"
              {...register('cost_center')}
              className="h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
            >
              <option value="">Seleziona centro costo</option>
              {(adminConfig?.cost_centers ?? []).map((cc) => (
                <option key={cc} value={cc}>
                  {cc}
                </option>
              ))}
            </select>
            <FieldError message={errors.cost_center?.message} />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <BudgetCapacityBanner
              costCenter={watch('cost_center')}
              amount={watch('estimated_amount')}
            />
          </div>

          <div>
            <FormLabel htmlFor="budget_code">Codice Budget</FormLabel>
            <input
              id="budget_code"
              type="text"
              {...register('budget_code')}
              placeholder="es. BUD-2026-IT"
              className="placeholder:text-pf-text-secondary/50 h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
            />
            <FieldError message={errors.budget_code?.message} />
          </div>
        </div>
      </div>

      {/* Compliance */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary">
        <button
          type="button"
          onClick={() => setComplianceOpen((prev) => !prev)}
          className="flex w-full items-center justify-between p-6 text-left"
        >
          <h2 className="text-sm font-semibold text-pf-text-primary">
            Compliance
          </h2>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-pf-text-secondary transition-transform duration-200',
              complianceOpen && 'rotate-180',
            )}
          />
        </button>

        {complianceOpen && (
          <div className="space-y-4 border-t border-pf-border px-6 pb-6 pt-4">
            {/* MEPA checkbox */}
            <div className="flex items-center gap-3">
              <input
                id="is_mepa"
                type="checkbox"
                {...register('is_mepa')}
                className="h-4 w-4 rounded border-pf-border bg-pf-bg-primary text-pf-accent accent-pf-accent focus:ring-2 focus:ring-pf-accent"
              />
              <label htmlFor="is_mepa" className="text-sm text-pf-text-primary">
                Acquisto MEPA/Consip
              </label>
            </div>

            {/* MEPA ODA number — visible only when is_mepa is true */}
            {isMepa && (
              <div>
                <FormLabel htmlFor="mepa_oda_number" required>
                  Numero ODA MEPA
                </FormLabel>
                <input
                  id="mepa_oda_number"
                  type="text"
                  {...register('mepa_oda_number')}
                  placeholder="Inserisci numero ODA"
                  className="placeholder:text-pf-text-secondary/50 h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
                />
                <FieldError message={errors.mepa_oda_number?.message} />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* CIG */}
              <div>
                <FormLabel htmlFor="cig">
                  CIG — Codice Identificativo Gara
                </FormLabel>
                <input
                  id="cig"
                  type="text"
                  {...register('cig')}
                  placeholder="es. A1B2C3D4E5"
                  className="placeholder:text-pf-text-secondary/50 h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 font-mono text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
                />
                <FieldError message={errors.cig?.message} />
              </div>

              {/* CUP */}
              <div>
                <FormLabel htmlFor="cup">CUP — Codice Unico Progetto</FormLabel>
                <input
                  id="cup"
                  type="text"
                  {...register('cup')}
                  placeholder="es. A1B2C3D4E5F6G7H"
                  className="placeholder:text-pf-text-secondary/50 h-10 w-full rounded-button border border-pf-border bg-pf-bg-primary px-3 font-mono text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
                />
                <FieldError message={errors.cup?.message} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="rounded-card border border-pf-border bg-pf-bg-secondary p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-pf-text-primary">
            Articoli ({fields.length})
          </h2>
          <button
            type="button"
            onClick={addItem}
            className="bg-pf-accent/10 hover:bg-pf-accent/20 inline-flex h-8 items-center gap-1.5 rounded-button px-3 text-xs font-medium text-pf-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Aggiungi Articolo
          </button>
        </div>

        {fields.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-pf-text-secondary">
              Nessun articolo aggiunto
            </p>
            <p className="mt-1 text-xs text-pf-text-secondary">
              Clicca &quot;Aggiungi Articolo&quot; per inserire gli articoli
              della richiesta.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {fields.map((field, index) => (
            <motion.div
              key={field.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-card border border-pf-border bg-pf-bg-primary p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-pf-text-secondary">
                  Articolo {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="flex h-7 w-7 items-center justify-center rounded-button text-pf-text-secondary transition-colors hover:bg-red-400/10 hover:text-red-400"
                  aria-label={`Rimuovi articolo ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <FormLabel htmlFor={`items.${index}.name`} required>
                    Nome
                  </FormLabel>
                  <input
                    id={`items.${index}.name`}
                    type="text"
                    {...register(`items.${index}.name`)}
                    placeholder="Nome articolo"
                    className="placeholder:text-pf-text-secondary/50 h-10 w-full rounded-button border border-pf-border bg-pf-bg-secondary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
                  />
                  <FieldError message={errors.items?.[index]?.name?.message} />
                </div>

                <div>
                  <FormLabel htmlFor={`items.${index}.quantity`} required>
                    Quantità
                  </FormLabel>
                  <input
                    id={`items.${index}.quantity`}
                    type="number"
                    min="1"
                    step="1"
                    {...register(`items.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                    className="h-10 w-full rounded-button border border-pf-border bg-pf-bg-secondary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
                  />
                  <FieldError
                    message={errors.items?.[index]?.quantity?.message}
                  />
                </div>

                <div>
                  <FormLabel htmlFor={`items.${index}.unit`}>Unità</FormLabel>
                  <input
                    id={`items.${index}.unit`}
                    type="text"
                    {...register(`items.${index}.unit`)}
                    placeholder="es. pz, kg, m"
                    className="placeholder:text-pf-text-secondary/50 h-10 w-full rounded-button border border-pf-border bg-pf-bg-secondary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
                  />
                </div>

                <div>
                  <FormLabel htmlFor={`items.${index}.unit_price`}>
                    Prezzo Unitario (&euro;)
                  </FormLabel>
                  <input
                    id={`items.${index}.unit_price`}
                    type="number"
                    step="0.01"
                    min="0"
                    {...register(`items.${index}.unit_price`, {
                      valueAsNumber: true,
                    })}
                    placeholder="0,00"
                    className="placeholder:text-pf-text-secondary/50 h-10 w-full rounded-button border border-pf-border bg-pf-bg-secondary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
                  />
                </div>

                <div>
                  <FormLabel htmlFor={`items.${index}.total_price`}>
                    Prezzo Totale (&euro;)
                  </FormLabel>
                  <input
                    id={`items.${index}.total_price`}
                    type="number"
                    step="0.01"
                    min="0"
                    {...register(`items.${index}.total_price`, {
                      valueAsNumber: true,
                    })}
                    placeholder="0,00"
                    className="placeholder:text-pf-text-secondary/50 h-10 w-full rounded-button border border-pf-border bg-pf-bg-secondary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
                  />
                </div>

                <div>
                  <FormLabel htmlFor={`items.${index}.sku`}>SKU</FormLabel>
                  <input
                    id={`items.${index}.sku`}
                    type="text"
                    {...register(`items.${index}.sku`)}
                    placeholder="Codice SKU"
                    className="placeholder:text-pf-text-secondary/50 h-10 w-full rounded-button border border-pf-border bg-pf-bg-secondary px-3 text-sm text-pf-text-primary focus:outline-none focus:ring-2 focus:ring-pf-accent"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={isProcessing}
          onClick={handleSubmit(handleSaveDraft)}
          className="bg-pf-bg-elevated inline-flex h-10 items-center justify-center gap-2 rounded-button border border-pf-border px-4 text-sm font-medium text-pf-text-primary transition-colors hover:bg-pf-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salva come Bozza
        </button>

        <button
          type="submit"
          disabled={isProcessing}
          className="hover:bg-pf-accent/90 inline-flex h-10 items-center justify-center gap-2 rounded-button bg-pf-accent px-4 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Invia Richiesta
        </button>
      </div>
    </form>
  )
}
