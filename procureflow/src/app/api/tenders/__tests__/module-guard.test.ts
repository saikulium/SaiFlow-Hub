import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetConfigCache } from '@/config/runtime'
import { assertModuleEnabled } from '@/lib/module-guard'

const ORIGINAL_ENV = { ...process.env }

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value
  }
}

describe('tenders module guard (env-based)', () => {
  beforeEach(() => {
    __resetConfigCache()
  })

  afterEach(() => {
    __resetConfigCache()
    restoreEnv()
  })

  it('returns 404 MODULE_DISABLED when tenders is not in ENABLED_MODULES', async () => {
    setEnv({
      ENABLED_MODULES:
        'core,requests,vendors,clients,articles,commesse',
    })

    const res = assertModuleEnabled('tenders')
    expect(res).not.toBeNull()
    expect(res!.status).toBe(404)

    const body = await res!.json()
    expect(body.error).toBe('MODULE_DISABLED')
    expect(body.message).toMatch(/tenders/)
  })

  it('returns null (pass-through) when tenders is listed in ENABLED_MODULES', () => {
    setEnv({
      ENABLED_MODULES:
        'core,requests,vendors,clients,articles,commesse,tenders',
    })
    expect(assertModuleEnabled('tenders')).toBeNull()
  })

  it('returns null (pass-through) when ENABLED_MODULES is unset (backward compat)', () => {
    setEnv({ ENABLED_MODULES: undefined })
    expect(assertModuleEnabled('tenders')).toBeNull()
  })
})
