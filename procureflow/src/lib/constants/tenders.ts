import type { LucideIcon } from 'lucide-react'
import {
  Search,
  Scale,
  ThumbsUp,
  ThumbsDown,
  Wrench,
  Send,
  Eye,
  Trophy,
  XCircle,
  FileSignature,
  Ban,
  Undo2,
} from 'lucide-react'

/** Configurazione visuale per ogni stato gara */
export const TENDER_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: LucideIcon }
> = {
  DISCOVERED: {
    label: 'Individuata',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-400/10',
    icon: Search,
  },
  EVALUATING: {
    label: 'In Valutazione',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    icon: Scale,
  },
  GO: {
    label: 'Approvata',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    icon: ThumbsUp,
  },
  NO_GO: {
    label: 'Non Partecipare',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    icon: ThumbsDown,
  },
  PREPARING: {
    label: 'In Preparazione',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    icon: Wrench,
  },
  SUBMITTED: {
    label: 'Inviata',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-400/10',
    icon: Send,
  },
  UNDER_EVALUATION: {
    label: 'In Valutazione Ente',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    icon: Eye,
  },
  WON: {
    label: 'Aggiudicata',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    icon: Trophy,
  },
  LOST: {
    label: 'Non Aggiudicata',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    icon: XCircle,
  },
  AWARDED: {
    label: 'Contrattualizzata',
    color: 'text-teal-400',
    bgColor: 'bg-teal-400/10',
    icon: FileSignature,
  },
  CANCELLED: {
    label: 'Annullata',
    color: 'text-zinc-400 line-through',
    bgColor: 'bg-zinc-400/10',
    icon: Ban,
  },
  WITHDRAWN: {
    label: 'Ritirata',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    icon: Undo2,
  },
} as const

/** Labels italiane per il tipo di procedura */
export const TENDER_TYPE_LABELS: Record<string, string> = {
  OPEN: 'Procedura Aperta',
  RESTRICTED: 'Procedura Ristretta',
  NEGOTIATED: 'Procedura Negoziata',
  DIRECT_AWARD: 'Affidamento Diretto',
  MEPA: 'MePA / Consip',
  FRAMEWORK: 'Accordo Quadro',
  PRIVATE: 'Gara Privata',
} as const

/** Labels italiane per i tipi di documento */
export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  BANDO: 'Bando di Gara',
  CAPITOLATO: 'Capitolato',
  DISCIPLINARE: 'Disciplinare',
  ALLEGATO: 'Allegato',
  OFFERTA_TECNICA: 'Offerta Tecnica',
  OFFERTA_ECONOMICA: 'Offerta Economica',
  CAUZIONE: 'Cauzione',
  DGUE: 'DGUE',
  CONTRATTO: 'Contratto',
  VERBALE: 'Verbale',
  ALTRO: 'Altro',
} as const

/** Transizioni di stato valide per la macchina a stati delle gare */
export const VALID_TRANSITIONS: Record<string, readonly string[]> = {
  DISCOVERED: ['EVALUATING', 'CANCELLED'],
  EVALUATING: ['GO', 'NO_GO', 'CANCELLED'],
  GO: ['PREPARING', 'CANCELLED', 'WITHDRAWN'],
  NO_GO: [],
  PREPARING: ['SUBMITTED', 'CANCELLED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_EVALUATION', 'CANCELLED', 'WITHDRAWN'],
  UNDER_EVALUATION: ['WON', 'LOST', 'CANCELLED'],
  WON: ['AWARDED', 'CANCELLED'],
  LOST: [],
  AWARDED: [],
  CANCELLED: [],
  WITHDRAWN: [],
} as const

/** Criteri di valutazione Go/No-Go con punteggi massimi */
export const GO_NO_GO_CRITERIA = [
  {
    id: 'margin',
    label: 'Margine Atteso',
    maxScore: 25,
    description: 'Marginalità economica prevista sulla commessa',
  },
  {
    id: 'technical',
    label: 'Capacità Tecnica',
    maxScore: 25,
    description: 'Disponibilità di competenze e risorse tecniche necessarie',
  },
  {
    id: 'experience',
    label: 'Esperienza Settore',
    maxScore: 15,
    description: 'Track record in progetti simili o nello stesso settore',
  },
  {
    id: 'risk',
    label: 'Rischio',
    maxScore: 15,
    description: 'Livello di rischio complessivo (più alto = meno rischioso)',
  },
  {
    id: 'workload',
    label: 'Carico di Lavoro',
    maxScore: 10,
    description: 'Capacità di assorbire il carico senza impattare altri progetti',
  },
  {
    id: 'strategic',
    label: 'Strategicità',
    maxScore: 10,
    description: 'Allineamento con obiettivi strategici aziendali',
  },
] as const

/** Stati terminali — nessuna transizione possibile */
export const TERMINAL_STATUSES = [
  'NO_GO',
  'LOST',
  'AWARDED',
  'CANCELLED',
  'WITHDRAWN',
] as const

/** Stati che contano nella pipeline value (gare attive con potenziale) */
export const PIPELINE_STATUSES = [
  'GO',
  'PREPARING',
  'SUBMITTED',
  'UNDER_EVALUATION',
] as const
