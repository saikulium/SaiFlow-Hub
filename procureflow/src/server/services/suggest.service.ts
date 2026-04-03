import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { extractJsonFromAiResponse } from '@/lib/ai/claude-client'

// ---------------------------------------------------------------------------
// SmartFill — Auto-compilazione PR
//
// Due livelli di suggerimento:
// 1. Ricerca storica DB (zero costo) → PR completate simili
// 2. Fallback Claude (single-shot JSON) → solo quando nessun match DB
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'
const MIN_CONFIDENCE = 0.5
const COMPLETED_STATUSES = ['DELIVERED', 'CLOSED', 'RECONCILED'] as const
const MIN_TOKEN_LENGTH = 3

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuggestedItem {
  readonly name: string
  readonly quantity: number
  readonly unit?: string
  readonly unit_price?: number
  readonly total_price?: number
  readonly sku?: string
}

export interface RequestSuggestion {
  readonly source: 'db' | 'ai'
  readonly confidence: number
  readonly vendor_id?: string
  readonly vendor_name?: string
  readonly category?: string
  readonly priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  readonly department?: string
  readonly cost_center?: string
  readonly estimated_amount?: number
  readonly items?: readonly SuggestedItem[]
  readonly matched_pr_code?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tokenize title: split on whitespace, filter short words and common Italian stopwords */
function tokenize(title: string): string[] {
  const stopwords = new Set([
    'di',
    'del',
    'della',
    'dei',
    'degli',
    'delle',
    'per',
    'con',
    'dal',
    'nel',
    'nella',
    'sul',
    'alla',
    'una',
    'uno',
    'che',
    'non',
  ])
  return title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= MIN_TOKEN_LENGTH && !stopwords.has(w))
}

/** Count how many tokens match in a candidate title */
function scoreMatch(tokens: readonly string[], candidateTitle: string): number {
  const lower = candidateTitle.toLowerCase()
  let matched = 0
  for (const token of tokens) {
    if (lower.includes(token)) {
      matched++
    }
  }
  return tokens.length > 0 ? matched / tokens.length : 0
}

// ---------------------------------------------------------------------------
// 1. DB Historical Search
// ---------------------------------------------------------------------------

export async function searchHistoricalPRs(
  title: string,
): Promise<RequestSuggestion | null> {
  const tokens = tokenize(title)
  if (tokens.length === 0) return null

  // Build OR conditions for each token
  const orConditions = tokens.map((token) => ({
    title: { contains: token, mode: 'insensitive' as const },
  }))

  const candidates = await prisma.purchaseRequest.findMany({
    where: {
      status: { in: [...COMPLETED_STATUSES] },
      OR: orConditions,
    },
    select: {
      code: true,
      title: true,
      vendor_id: true,
      vendor: { select: { id: true, name: true } },
      category: true,
      priority: true,
      department: true,
      cost_center: true,
      estimated_amount: true,
      items: {
        select: {
          name: true,
          quantity: true,
          unit: true,
          unit_price: true,
          total_price: true,
          sku: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
    take: 5,
  })

  if (candidates.length === 0) return null

  // Score each candidate and find the best match
  let bestCandidate = candidates[0]!
  let bestScore = 0

  for (const candidate of candidates) {
    const score = scoreMatch(tokens, candidate.title)
    if (score > bestScore) {
      bestScore = score
      bestCandidate = candidate
    }
  }

  if (bestScore < MIN_CONFIDENCE) return null

  return {
    source: 'db',
    confidence: bestScore,
    vendor_id: bestCandidate.vendor_id ?? undefined,
    vendor_name: bestCandidate.vendor?.name ?? undefined,
    category: bestCandidate.category ?? undefined,
    priority: bestCandidate.priority as RequestSuggestion['priority'],
    department: bestCandidate.department ?? undefined,
    cost_center: bestCandidate.cost_center ?? undefined,
    estimated_amount: bestCandidate.estimated_amount
      ? Number(bestCandidate.estimated_amount)
      : undefined,
    items: bestCandidate.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit ?? undefined,
      unit_price: item.unit_price ? Number(item.unit_price) : undefined,
      total_price: item.total_price ? Number(item.total_price) : undefined,
      sku: item.sku ?? undefined,
    })),
    matched_pr_code: bestCandidate.code,
  }
}

// ---------------------------------------------------------------------------
// 2. Claude AI Fallback
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Sei un assistente procurement per PMI italiane. Ti viene dato il titolo di una richiesta di acquisto e delle liste di fornitori, centri di costo e dipartimenti disponibili.

Rispondi SOLO con un oggetto JSON valido (senza markdown, senza commenti) con questi campi opzionali:
- "vendor_id": string (ID esatto dalla lista fornitori, solo se sei sicuro)
- "category": string (una tra: Hardware, Software, Servizi, Materiali, Attrezzature, Altro)
- "priority": string (una tra: LOW, MEDIUM, HIGH, URGENT)
- "department": string (valore esatto dalla lista dipartimenti)
- "cost_center": string (valore esatto dalla lista centri di costo)

Se non sei sicuro di un campo, omettilo. Non inventare valori non presenti nelle liste fornite.`

interface ClaudeFieldSuggestion {
  vendor_id?: string
  category?: string
  priority?: string
  department?: string
  cost_center?: string
}

export async function suggestWithClaude(
  title: string,
): Promise<RequestSuggestion | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    // Fetch reference data in parallel
    const [vendors, costCentersRaw, departmentsRaw] = await Promise.all([
      prisma.vendor.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true, category: true },
        orderBy: { name: 'asc' },
      }),
      prisma.purchaseRequest.findMany({
        distinct: ['cost_center'],
        where: { cost_center: { not: null } },
        select: { cost_center: true },
      }),
      prisma.purchaseRequest.findMany({
        distinct: ['department'],
        where: { department: { not: null } },
        select: { department: true },
      }),
    ])

    const costCenters = costCentersRaw
      .map((r) => r.cost_center)
      .filter(Boolean) as string[]
    const departments = departmentsRaw
      .map((r) => r.department)
      .filter(Boolean) as string[]

    // Format vendor list for Claude
    const vendorList = vendors
      .map((v) => `- ${v.id}: ${v.name} (${v.code}) [${v.category.join(', ')}]`)
      .join('\n')

    const userMessage = `Titolo richiesta: "${title}"

Fornitori disponibili:
${vendorList || '(nessun fornitore)'}

Centri di costo: ${costCenters.length > 0 ? costCenters.join(', ') : '(nessuno)'}

Dipartimenti: ${departments.length > 0 ? departments.join(', ') : '(nessuno)'}`

    const model = process.env.AI_CHAT_MODEL ?? DEFAULT_MODEL
    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    // Extract text from response
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    const parsed: ClaudeFieldSuggestion = JSON.parse(
      extractJsonFromAiResponse(textBlock.text),
    )

    // Validate vendor_id against actual list
    const validVendorIds = new Set(vendors.map((v) => v.id))
    const validPriorities = new Set(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])

    const vendorId =
      parsed.vendor_id && validVendorIds.has(parsed.vendor_id)
        ? parsed.vendor_id
        : undefined
    const vendorName = vendorId
      ? vendors.find((v) => v.id === vendorId)?.name
      : undefined

    return {
      source: 'ai',
      confidence: 0.7,
      vendor_id: vendorId,
      vendor_name: vendorName,
      category: parsed.category ?? undefined,
      priority: validPriorities.has(parsed.priority ?? '')
        ? (parsed.priority as RequestSuggestion['priority'])
        : undefined,
      department: parsed.department ?? undefined,
      cost_center: parsed.cost_center ?? undefined,
    }
  } catch (error) {
    console.error('SmartFill Claude fallback error:', error)
    return null
  }
}

// ---------------------------------------------------------------------------
// 3. Orchestrator
// ---------------------------------------------------------------------------

export async function getSuggestions(
  title: string,
): Promise<RequestSuggestion | null> {
  const dbResult = await searchHistoricalPRs(title)
  if (dbResult && dbResult.confidence >= MIN_CONFIDENCE) {
    return dbResult
  }
  return suggestWithClaude(title)
}
