import type { LucideIcon } from 'lucide-react'
import { Building2, Users, Globe } from 'lucide-react'

// --- Alias Type ---

export type AliasTypeKey = 'VENDOR' | 'CLIENT' | 'STANDARD'

export interface AliasTypeConfig {
  readonly label: string
  readonly color: string
  readonly bgColor: string
  readonly icon: LucideIcon
}

export const ALIAS_TYPE_CONFIG: Readonly<Record<AliasTypeKey, AliasTypeConfig>> = {
  VENDOR: {
    label: 'Fornitore',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-400/10',
    icon: Building2,
  },
  CLIENT: {
    label: 'Cliente',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    icon: Users,
  },
  STANDARD: {
    label: 'Standard',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
    icon: Globe,
  },
} as const

// --- Price Source ---

export type PriceSourceKey = 'manual' | 'invoice' | 'quote'

export const PRICE_SOURCE_CONFIG: Readonly<Record<PriceSourceKey, { readonly label: string; readonly color: string; readonly bgColor: string }>> = {
  manual: {
    label: 'Manuale',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  },
  invoice: {
    label: 'Fattura',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  quote: {
    label: 'Preventivo',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
} as const

// --- Default Article Config (for DeployConfig.article_config) ---

export const DEFAULT_ARTICLE_CONFIG = {
  auto_match_threshold: 0, // 0 = never auto-match, 80 = auto-match above 80% confidence
} as const

export type ArticleConfig = typeof DEFAULT_ARTICLE_CONFIG
