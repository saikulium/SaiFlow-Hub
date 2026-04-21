import { describe, it, expect } from 'vitest'
import { MODULE_REGISTRY, type ModuleId } from '../src/lib/modules/registry'

describe('articles module', () => {
  it('is registered in MODULE_REGISTRY', () => {
    const mod = MODULE_REGISTRY.get('articles' as ModuleId)
    expect(mod).toBeDefined()
    expect(mod!.id).toBe('articles')
    expect(mod!.label).toBe('Anagrafica Articoli')
    expect(mod!.navPaths).toContain('/articles')
    expect(mod!.apiPrefixes).toContain('/api/articles')
  })
})
