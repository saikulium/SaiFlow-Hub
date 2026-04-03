import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  Briefcase,
  CheckCircle2,
  BarChart3,
  Settings,
  FileEdit,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  ShoppingCart,
  Truck,
  PackageCheck,
  Ban,
  Pause,
  Receipt,
  CheckCheck,
  Lock,
  Users,
  PiggyBank,
  Gavel,
  Package,
  Shield,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'

// --- Request Status ---

export type RequestStatusKey =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ORDERED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'INVOICED'
  | 'RECONCILED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'ON_HOLD'

export interface StatusConfig {
  label: string
  color: string
  bgColor: string
  icon: LucideIcon
}

export const REQUEST_STATUS_CONFIG: Record<RequestStatusKey, StatusConfig> = {
  DRAFT: {
    label: 'Bozza',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
    icon: FileEdit,
  },
  SUBMITTED: {
    label: 'Inviata',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    icon: Send,
  },
  PENDING_APPROVAL: {
    label: 'In Approvazione',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    icon: Clock,
  },
  APPROVED: {
    label: 'Approvata',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    icon: CheckCircle,
  },
  REJECTED: {
    label: 'Rifiutata',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    icon: XCircle,
  },
  ORDERED: {
    label: 'Ordinata',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-400/10',
    icon: ShoppingCart,
  },
  SHIPPED: {
    label: 'Spedita',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    icon: Truck,
  },
  DELIVERED: {
    label: 'Consegnata',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    icon: PackageCheck,
  },
  CANCELLED: {
    label: 'Annullata',
    color: 'text-zinc-500 line-through',
    bgColor: 'bg-zinc-500/10',
    icon: Ban,
  },
  ON_HOLD: {
    label: 'Sospesa',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    icon: Pause,
  },
  INVOICED: {
    label: 'Fatturata',
    color: 'text-violet-400',
    bgColor: 'bg-violet-400/10',
    icon: Receipt,
  },
  RECONCILED: {
    label: 'Riconciliata',
    color: 'text-teal-400',
    bgColor: 'bg-teal-400/10',
    icon: CheckCheck,
  },
  CLOSED: {
    label: 'Chiusa',
    color: 'text-zinc-500',
    bgColor: 'bg-zinc-500/10',
    icon: Lock,
  },
}

// --- Priority ---

export type PriorityKey = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export const PRIORITY_CONFIG: Record<
  PriorityKey,
  { label: string; color: string; bgColor: string }
> = {
  LOW: { label: 'Bassa', color: 'text-zinc-400', bgColor: 'bg-zinc-400/10' },
  MEDIUM: {
    label: 'Media',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  HIGH: {
    label: 'Alta',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  URGENT: {
    label: 'Urgente',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
  },
}

// --- Approval Status ---

export const APPROVAL_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  PENDING: {
    label: 'In Attesa',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
  APPROVED: {
    label: 'Approvata',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  REJECTED: {
    label: 'Rifiutata',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
  },
  DELEGATED: {
    label: 'Delegata',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
}

// --- Vendor Status ---

export const VENDOR_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  ACTIVE: {
    label: 'Attivo',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  INACTIVE: {
    label: 'Inattivo',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
  },
  BLACKLISTED: {
    label: 'Bloccato',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
  },
  PENDING_REVIEW: {
    label: 'In Revisione',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
  },
}

// --- Navigation ---

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: 'requests' | 'approvals' | 'invoices'
  adminOnly?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    label: 'Richieste',
    href: '/requests',
    icon: ClipboardList,
    badge: 'requests',
  },
  { label: 'Fornitori', href: '/vendors', icon: Building2 },
  {
    label: 'Approvazioni',
    href: '/approvals',
    icon: CheckCircle2,
    badge: 'approvals',
  },
  {
    label: 'Fatture',
    href: '/invoices',
    icon: Receipt,
    badge: 'invoices',
  },
  { label: 'Budget', href: '/budgets', icon: PiggyBank },
  { label: 'Gare', href: '/tenders', icon: Gavel },
  { label: 'Magazzino', href: '/inventory', icon: Package },
  { label: 'Articoli', href: '/articles', icon: BookOpen },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Commesse', href: '/commesse', icon: Briefcase },
  { label: 'Clienti', href: '/clients', icon: Building2 },
  { label: 'Utenti', href: '/users', icon: Users },
  { label: 'Admin', href: '/admin/config', icon: Shield, adminOnly: true },
  { label: 'Impostazioni', href: '/settings', icon: Settings },
]

// --- Chart Colors ---

export const CHART_COLORS = [
  '#6366F1', // Indigo (accent)
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#14B8A6', // Teal
  '#F97316', // Orange
]
