'use client'

import { useCallback, useState } from 'react'
import { X } from 'lucide-react'
import { TENDER_TYPE_LABELS } from '@/lib/constants/tenders'
import { useCreateTender } from '@/hooks/use-tenders'
import { useUpdateTender } from '@/hooks/use-tender'
import { cn } from '@/lib/utils'
import type { TenderDetail } from '@/types'

interface TenderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: TenderDetail | null
}

interface FormState {
  title: string
  tender_type: string
  description: string
  contracting_authority_id: string
  cig: string
  cup: string
  gara_number: string
  platform_url: string
  publication_date: string
  question_deadline: string
  submission_deadline: string
  opening_date: string
  base_amount: string
  award_criteria: string
  technical_weight: string
  economic_weight: string
  assigned_to_id: string
  category: string
  department: string
  cost_center: string
  tags: string
  notes: string
}

function buildInitialState(data?: TenderDetail | null): FormState {
  return {
    title: data?.title ?? '',
    tender_type: data?.tenderType ?? 'OPEN',
    description: data?.description ?? '',
    contracting_authority_id: '',
    cig: data?.cig ?? '',
    cup: data?.cup ?? '',
    gara_number: data?.garaNumber ?? '',
    platform_url: data?.platformUrl ?? '',
    publication_date: data?.publicationDate?.slice(0, 10) ?? '',
    question_deadline: data?.questionDeadline?.slice(0, 10) ?? '',
    submission_deadline: data?.submissionDeadline?.slice(0, 10) ?? '',
    opening_date: data?.openingDate?.slice(0, 10) ?? '',
    base_amount: data?.baseAmount != null ? String(data.baseAmount) : '',
    award_criteria: data?.awardCriteria ?? '',
    technical_weight: data?.technicalWeight != null ? String(data.technicalWeight) : '',
    economic_weight: data?.economicWeight != null ? String(data.economicWeight) : '',
    assigned_to_id: '',
    category: data?.category ?? '',
    department: data?.department ?? '',
    cost_center: data?.costCenter ?? '',
    tags: data?.tags?.join(', ') ?? '',
    notes: data?.notes ?? '',
  }
}

function parsePayload(form: FormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: form.title,
    tender_type: form.tender_type,
  }

  if (form.description) payload.description = form.description
  if (form.contracting_authority_id) payload.contracting_authority_id = form.contracting_authority_id
  if (form.cig) payload.cig = form.cig
  if (form.cup) payload.cup = form.cup
  if (form.gara_number) payload.gara_number = form.gara_number
  if (form.platform_url) payload.platform_url = form.platform_url
  if (form.publication_date) payload.publication_date = form.publication_date
  if (form.question_deadline) payload.question_deadline = form.question_deadline
  if (form.submission_deadline) payload.submission_deadline = form.submission_deadline
  if (form.opening_date) payload.opening_date = form.opening_date
  if (form.base_amount) payload.base_amount = Number(form.base_amount)
  if (form.award_criteria) payload.award_criteria = form.award_criteria
  if (form.technical_weight) payload.technical_weight = Number(form.technical_weight)
  if (form.economic_weight) payload.economic_weight = Number(form.economic_weight)
  if (form.assigned_to_id) payload.assigned_to_id = form.assigned_to_id
  if (form.category) payload.category = form.category
  if (form.department) payload.department = form.department
  if (form.cost_center) payload.cost_center = form.cost_center
  if (form.notes) payload.notes = form.notes
  if (form.tags.trim()) {
    payload.tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
  }

  return payload
}

export function TenderFormDialog({ open, onOpenChange, initialData }: TenderFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(initialData))
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const createMutation = useCreateTender()
  const updateMutation = useUpdateTender()
  const isEdit = !!initialData

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
      setErrors((prev) => {
        if (!prev[key]) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [],
  )

  const validate = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {}
    if (!form.title.trim()) newErrors.title = 'Titolo obbligatorio'
    if (!form.tender_type) newErrors.tender_type = 'Tipo obbligatorio'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [form.title, form.tender_type])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return

      const payload = parsePayload(form)

      if (isEdit && initialData) {
        updateMutation.mutate(
          { id: initialData.id, ...payload },
          { onSuccess: () => onOpenChange(false) },
        )
      } else {
        createMutation.mutate(payload, {
          onSuccess: () => onOpenChange(false),
        })
      }
    },
    [form, validate, isEdit, initialData, createMutation, updateMutation, onOpenChange],
  )

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!open) return null

  const inputClassName =
    'w-full rounded-button border border-pf-border bg-pf-bg-primary/50 px-3 py-2 text-sm text-pf-text-primary placeholder:text-pf-text-secondary/60 focus:border-pf-accent focus:outline-none focus:ring-1 focus:ring-pf-accent'
  const labelClassName = 'block text-xs font-medium text-pf-text-secondary mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-card border border-pf-border bg-pf-bg-secondary shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-pf-border px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-pf-text-primary">
            {isEdit ? 'Modifica Gara' : 'Nuova Gara'}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-button p-1 text-pf-text-secondary transition-colors hover:text-pf-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
            {/* Base */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-pf-text-primary">Informazioni Base</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClassName}>Titolo *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className={cn(inputClassName, errors.title && 'border-red-500')}
                    placeholder="Titolo della gara"
                  />
                  {errors.title && (
                    <p className="mt-1 text-xs text-red-400">{errors.title}</p>
                  )}
                </div>
                <div>
                  <label className={labelClassName}>Tipo Procedura *</label>
                  <select
                    value={form.tender_type}
                    onChange={(e) => updateField('tender_type', e.target.value)}
                    className={cn(inputClassName, errors.tender_type && 'border-red-500')}
                  >
                    {Object.entries(TENDER_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClassName}>Descrizione</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={3}
                    className={inputClassName}
                    placeholder="Descrizione della gara..."
                  />
                </div>
              </div>
            </section>

            {/* Authority & IDs */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-pf-text-primary">Ente e Identificativi</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClassName}>CIG</label>
                  <input
                    type="text"
                    value={form.cig}
                    onChange={(e) => updateField('cig', e.target.value)}
                    className={inputClassName}
                    placeholder="Codice CIG"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className={labelClassName}>CUP</label>
                  <input
                    type="text"
                    value={form.cup}
                    onChange={(e) => updateField('cup', e.target.value)}
                    className={inputClassName}
                    placeholder="Codice CUP"
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Numero Gara</label>
                  <input
                    type="text"
                    value={form.gara_number}
                    onChange={(e) => updateField('gara_number', e.target.value)}
                    className={inputClassName}
                    placeholder="N. gara"
                  />
                </div>
                <div>
                  <label className={labelClassName}>URL Piattaforma</label>
                  <input
                    type="url"
                    value={form.platform_url}
                    onChange={(e) => updateField('platform_url', e.target.value)}
                    className={inputClassName}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </section>

            {/* Dates */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-pf-text-primary">Scadenze</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClassName}>Data Pubblicazione</label>
                  <input
                    type="date"
                    value={form.publication_date}
                    onChange={(e) => updateField('publication_date', e.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Scadenza Quesiti</label>
                  <input
                    type="date"
                    value={form.question_deadline}
                    onChange={(e) => updateField('question_deadline', e.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Scadenza Presentazione</label>
                  <input
                    type="date"
                    value={form.submission_deadline}
                    onChange={(e) => updateField('submission_deadline', e.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label className={labelClassName}>Data Apertura</label>
                  <input
                    type="date"
                    value={form.opening_date}
                    onChange={(e) => updateField('opening_date', e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>
            </section>

            {/* Amounts */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-pf-text-primary">Importi e Criteri</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClassName}>Importo Base (EUR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.base_amount}
                    onChange={(e) => updateField('base_amount', e.target.value)}
                    className={inputClassName}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelClassName}>Criterio di Aggiudicazione</label>
                  <input
                    type="text"
                    value={form.award_criteria}
                    onChange={(e) => updateField('award_criteria', e.target.value)}
                    className={inputClassName}
                    placeholder="OEPV, prezzo piu basso..."
                  />
                </div>
                <div>
                  <label className={labelClassName}>Peso Tecnico (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.technical_weight}
                    onChange={(e) => updateField('technical_weight', e.target.value)}
                    className={inputClassName}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelClassName}>Peso Economico (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.economic_weight}
                    onChange={(e) => updateField('economic_weight', e.target.value)}
                    className={inputClassName}
                    placeholder="0"
                  />
                </div>
              </div>
            </section>

            {/* Assignment */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-pf-text-primary">Assegnazione</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClassName}>Categoria</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => updateField('category', e.target.value)}
                    className={inputClassName}
                    placeholder="Categoria"
                  />
                </div>
                <div>
                  <label className={labelClassName}>Dipartimento</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => updateField('department', e.target.value)}
                    className={inputClassName}
                    placeholder="Dipartimento"
                  />
                </div>
                <div>
                  <label className={labelClassName}>Centro di Costo</label>
                  <input
                    type="text"
                    value={form.cost_center}
                    onChange={(e) => updateField('cost_center', e.target.value)}
                    className={inputClassName}
                    placeholder="Centro di costo"
                  />
                </div>
                <div>
                  <label className={labelClassName}>Tag (separati da virgola)</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => updateField('tags', e.target.value)}
                    className={inputClassName}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClassName}>Note</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    rows={2}
                    className={inputClassName}
                    placeholder="Note aggiuntive..."
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-pf-border px-6 py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-button border border-pf-border px-4 py-2 text-sm font-medium text-pf-text-secondary transition-colors hover:text-pf-text-primary"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={cn(
                'rounded-button bg-pf-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pf-accent-hover',
                isPending && 'cursor-not-allowed opacity-60',
              )}
            >
              {isPending ? 'Salvataggio...' : isEdit ? 'Aggiorna' : 'Crea Gara'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
