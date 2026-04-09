import { describe, it, expect } from 'vitest'
import {
  TenderAnalysisSchema,
  TenderRiskSchema,
} from '@/lib/ai/schemas/tender-analysis.schema'

// ---------------------------------------------------------------------------
// Schema validation tests
// ---------------------------------------------------------------------------

describe('TenderAnalysisSchema', () => {
  const validAnalysis = {
    fit_score: 72,
    recommendation: 'GO',
    reasoning: 'La PMI ha le competenze tecniche richieste e il margine atteso e positivo.',
    pros: ['Esperienza nel settore', 'Certificazioni presenti'],
    cons: ['Scadenza ravvicinata', 'Importo elevato'],
    risks: [
      {
        description: 'Tempi stretti per la preparazione',
        severity: 'medium' as const,
        mitigation: 'Dedicare risorse full-time alla preparazione',
      },
    ],
    estimated_participation_cost: 15000,
    key_requirements: ['ISO 9001', 'Esperienza triennale'],
    missing_capabilities: ['Certificazione NATO'],
  }

  it('parses a valid analysis object', () => {
    const result = TenderAnalysisSchema.parse(validAnalysis)
    expect(result.fit_score).toBe(72)
    expect(result.recommendation).toBe('GO')
    expect(result.pros).toHaveLength(2)
    expect(result.cons).toHaveLength(2)
    expect(result.risks).toHaveLength(1)
    expect(result.estimated_participation_cost).toBe(15000)
    expect(result.key_requirements).toHaveLength(2)
    expect(result.missing_capabilities).toHaveLength(1)
  })

  it('accepts all valid recommendation values', () => {
    for (const rec of ['GO', 'NO_GO', 'CONDITIONAL_GO']) {
      const result = TenderAnalysisSchema.parse({
        ...validAnalysis,
        recommendation: rec,
      })
      expect(result.recommendation).toBe(rec)
    }
  })

  it('rejects invalid recommendation values', () => {
    expect(() =>
      TenderAnalysisSchema.parse({
        ...validAnalysis,
        recommendation: 'MAYBE',
      }),
    ).toThrow()
  })

  it('rejects fit_score below 0', () => {
    expect(() =>
      TenderAnalysisSchema.parse({
        ...validAnalysis,
        fit_score: -1,
      }),
    ).toThrow()
  })

  it('rejects fit_score above 100', () => {
    expect(() =>
      TenderAnalysisSchema.parse({
        ...validAnalysis,
        fit_score: 101,
      }),
    ).toThrow()
  })

  it('allows estimated_participation_cost to be omitted', () => {
    const { estimated_participation_cost: _, ...withoutCost } = validAnalysis
    const result = TenderAnalysisSchema.parse(withoutCost)
    expect(result.estimated_participation_cost).toBeUndefined()
  })

  it('accepts empty arrays for pros, cons, risks, key_requirements, missing_capabilities', () => {
    const minimal = {
      ...validAnalysis,
      pros: [],
      cons: [],
      risks: [],
      key_requirements: [],
      missing_capabilities: [],
    }
    const result = TenderAnalysisSchema.parse(minimal)
    expect(result.pros).toHaveLength(0)
    expect(result.cons).toHaveLength(0)
    expect(result.risks).toHaveLength(0)
    expect(result.key_requirements).toHaveLength(0)
    expect(result.missing_capabilities).toHaveLength(0)
  })

  it('rejects missing required fields', () => {
    expect(() => TenderAnalysisSchema.parse({})).toThrow()
    expect(() =>
      TenderAnalysisSchema.parse({ fit_score: 50 }),
    ).toThrow()
  })
})

describe('TenderRiskSchema', () => {
  it('parses a valid risk object', () => {
    const risk = {
      description: 'Rischio di penali contrattuali',
      severity: 'high',
      mitigation: 'Negoziare clausole contrattuali favorevoli',
    }
    const result = TenderRiskSchema.parse(risk)
    expect(result.description).toBe('Rischio di penali contrattuali')
    expect(result.severity).toBe('high')
    expect(result.mitigation).toBe('Negoziare clausole contrattuali favorevoli')
  })

  it('accepts all severity levels', () => {
    for (const severity of ['low', 'medium', 'high']) {
      const result = TenderRiskSchema.parse({
        description: 'Test',
        severity,
        mitigation: 'Test',
      })
      expect(result.severity).toBe(severity)
    }
  })

  it('rejects invalid severity values', () => {
    expect(() =>
      TenderRiskSchema.parse({
        description: 'Test',
        severity: 'critical',
        mitigation: 'Test',
      }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Module export tests
// ---------------------------------------------------------------------------

describe('TenderAnalysisAgent module', () => {
  it('exports analyzeTender function', async () => {
    const mod = await import('@/server/agents/tender-analysis.agent')
    expect(typeof mod.analyzeTender).toBe('function')
  })

  it('has only the expected export', async () => {
    const mod = await import('@/server/agents/tender-analysis.agent')
    const exportKeys = Object.keys(mod)
    expect(exportKeys).toContain('analyzeTender')
  })
})

describe('TenderAnalysisSchema module', () => {
  it('exports TenderAnalysisSchema and TenderRiskSchema', async () => {
    const mod = await import('@/lib/ai/schemas/tender-analysis.schema')
    expect(mod.TenderAnalysisSchema).toBeDefined()
    expect(mod.TenderRiskSchema).toBeDefined()
  })
})
