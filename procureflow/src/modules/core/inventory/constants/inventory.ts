import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Scale,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Ban,
  Package,
  Lock,
} from 'lucide-react'

/** Configurazione visuale per tipo di movimento */
export const MOVEMENT_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: LucideIcon }
> = {
  INBOUND: {
    label: 'Carico',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    icon: ArrowDownToLine,
  },
  OUTBOUND: {
    label: 'Scarico',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    icon: ArrowUpFromLine,
  },
  TRANSFER: {
    label: 'Trasferimento',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    icon: ArrowLeftRight,
  },
  ADJUSTMENT: {
    label: 'Rettifica',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    icon: Scale,
  },
  RETURN: {
    label: 'Reso',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    icon: RotateCcw,
  },
} as const

/** Configurazione visuale per stato lotto */
export const LOT_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: LucideIcon }
> = {
  AVAILABLE: {
    label: 'Disponibile',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    icon: CheckCircle,
  },
  RESERVED: {
    label: 'Riservato',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    icon: Lock,
  },
  DEPLETED: {
    label: 'Esaurito',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
    icon: Package,
  },
  EXPIRED: {
    label: 'Scaduto',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    icon: XCircle,
  },
} as const

/** Configurazione visuale per stato prenotazione */
export const RESERVATION_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: LucideIcon }
> = {
  ACTIVE: {
    label: 'Attiva',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    icon: Clock,
  },
  FULFILLED: {
    label: 'Evasa',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    icon: CheckCircle,
  },
  CANCELLED: {
    label: 'Annullata',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
    icon: Ban,
  },
} as const

/** Configurazione visuale per stato inventario */
export const INVENTORY_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: LucideIcon }
> = {
  DRAFT: {
    label: 'Bozza',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
    icon: Package,
  },
  IN_PROGRESS: {
    label: 'In Corso',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    icon: Clock,
  },
  COMPLETED: {
    label: 'Completato',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    icon: CheckCircle,
  },
  CANCELLED: {
    label: 'Annullato',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    icon: Ban,
  },
} as const

/** Labels italiane per i motivi di movimento */
export const MOVEMENT_REASON_LABELS: Record<string, string> = {
  ACQUISTO: 'Acquisto',
  RESO_CLIENTE: 'Reso da cliente',
  PRODUZIONE: 'Produzione',
  TRASFERIMENTO_IN: 'Trasferimento in entrata',
  RETTIFICA_POSITIVA: 'Rettifica positiva',
  VENDITA: 'Vendita',
  RESO_FORNITORE: 'Reso a fornitore',
  TRASFERIMENTO_OUT: 'Trasferimento in uscita',
  RETTIFICA_NEGATIVA: 'Rettifica negativa',
  SCARTO: 'Scarto',
  INVENTARIO: 'Inventario',
  CORREZIONE_MANUALE: 'Correzione manuale',
} as const

/** Configurazione visuale per lo stato scorta di un materiale */
export const STOCK_STATUS_CONFIG: Record<
  StockStatusKey,
  { label: string; color: string; bgColor: string; icon: LucideIcon; pulse: boolean }
> = {
  OK: {
    label: 'In Scorta',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    icon: CheckCircle,
    pulse: false,
  },
  LOW: {
    label: 'Scorta Bassa',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    icon: AlertTriangle,
    pulse: true,
  },
  OUT: {
    label: 'Esaurito',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    icon: XCircle,
    pulse: false,
  },
} as const

export type StockStatusKey = 'OK' | 'LOW' | 'OUT'
