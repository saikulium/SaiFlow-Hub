# Module System — Developer Guide

> Come funziona il sistema a moduli di ProcureFlow e come aggiungerne uno nuovo.

## TL;DR

ProcureFlow è un **modular monolith**. Il codice è organizzato in moduli autosufficienti sotto `src/modules/<pack>/<module-name>/`. Ogni istanza di deploy può abilitare un sottoinsieme di moduli tramite la variabile d'ambiente `ENABLED_MODULES`. Due sistemi di gate convivono:

| Gate | Fonte di verità | Quando si usa |
|---|---|---|
| **Pack gate** (env-based) | `ENABLED_MODULES` (build/deploy time) | Filtra cosa il cliente ha "comprato" (pack commerciale) |
| **DB gate** (runtime) | `DeployConfig.enabled_modules` (DB) | Permette all'admin di toggle on/off tramite UI |

Il pack gate è il nuovo sistema introdotto dal refactoring `refactor/modular-monolith`. Il DB gate è pre-esistente e rimane operativo: i due sono layered (prima env, poi DB).

---

## Architettura dei file

```
src/
├── config/
│   ├── modules.ts         # Registry: dichiara ogni modulo con pack, dipendenze, alwaysOn
│   ├── packs.ts           # Pack commerciali (core, defense)
│   └── runtime.ts         # Legge ENABLED_MODULES, valida, cache in memoria
├── lib/
│   └── module-guard.ts    # assertModuleEnabled() per API routes
├── modules/
│   ├── core/
│   │   └── commesse/      # Esempio modulo migrato
│   │       ├── server/    # services, tools, state-machine
│   │       ├── components/
│   │       ├── validations/
│   │       ├── index.ts   # Barrel: public API del modulo
│   │       └── README.md  # Contratto modulo
│   └── defense/           # Moduli defense (roadmap)
└── customers/
    ├── _shared/           # Customizzazioni condivise tra più customer
    └── <customer>/        # Code isolato per un singolo customer (Faleni, ...)
```

---

## Il Registry

File: `src/config/modules.ts`

```typescript
export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  core: {
    name: 'core',
    pack: 'core',
    alwaysOn: true,
    dependencies: [],
    description: '...',
  },
  // ...altri moduli
}
```

Campi:
- **name**: identificatore univoco del modulo
- **pack**: pack commerciale (`'core' | 'defense'`)
- **alwaysOn**: se `true`, sempre abilitato (non filtrabile da `ENABLED_MODULES`)
- **dependencies**: altri moduli che devono essere attivi perché questo funzioni. Validato al boot.
- **description**: 1 riga, leggibile

**Regola**: i moduli `alwaysOn` sono requisiti di sistema (core, requests, vendors, clients, articles, commesse). I moduli `alwaysOn: false` sono opzionali (invoicing, tenders, budgets, analytics, ecc.).

---

## Runtime

File: `src/config/runtime.ts`

```typescript
export function getRuntimeConfig(): RuntimeConfig
export function isModuleEnabled(moduleName: string): boolean
export function getEnabledModules(): string[]
```

Logica al primo accesso:
1. Legge `ENABLED_MODULES` (CSV) e `CUSTOMER_CODE` dall'ambiente.
2. Se `ENABLED_MODULES` è vuota → abilita tutti i moduli pack='core' (backward compat).
3. Aggiunge sempre i moduli `alwaysOn`.
4. Valida che ogni modulo esista nel registry (throw se no).
5. Valida che ogni dipendenza transitiva sia soddisfatta (throw se no).
6. Calcola `primaryPack` (defense vince su core se presente).
7. Cacha il risultato in memoria.

**La configurazione è frozen al boot**: non cambia a runtime. Per riapplicare, riavvia il processo.

Nei test usa `__resetConfigCache()` per resettare tra test con env diversi.

---

## API Guards

File: `src/lib/module-guard.ts`

```typescript
import { assertModuleEnabled } from '@/lib/module-guard'

export async function GET(req: NextRequest) {
  const packGate = assertModuleEnabled('tenders')
  if (packGate) return packGate
  // ... resto della logica
}
```

Se il modulo non è attivo, ritorna un `NextResponse` 404 con body:
```json
{ "error": "MODULE_DISABLED", "message": "Il modulo \"tenders\" non è attivo per questa istanza." }
```

### Con `withApiHandler`

```typescript
export const GET = withApiHandler(
  {
    packModule: 'tenders',   // env gate
    module: '/api/tenders',  // DB gate
    auth: ['ADMIN', 'MANAGER'],
  },
  async ({ params }) => { /* ... */ },
)
```

Il wrapper invoca prima `packModule` (env), poi `module` (DB). Entrambi opzionali.

---

## Client-side

Per capire cosa abilitare/nascondere lato client c'è:
- `GET /api/config/modules` → `{ customerCode, primaryPack, enabledModules }` (pack-level)
- `useModules()` hook (esistente) → DB-level via `getEnabledModules()` dal service

Oggi l'UI (sidebar, dashboard tabs) usa il sistema DB-based (`filterNavItems`, `filterDashboardTabs` in `src/lib/modules/helpers.ts`). Il sistema env-based è disponibile ma non ancora cablato in UI; si farà in una fase successiva se necessario.

---

## Aggiungere un nuovo modulo

1. **Dichiaralo nel registry** (`src/config/modules.ts`):
   ```typescript
   myModule: {
     name: 'myModule',
     pack: 'core',
     alwaysOn: false,
     dependencies: ['core'],
     description: 'Descrizione di cosa fa',
   },
   ```

2. **Crea la folder**:
   ```
   src/modules/core/myModule/
   ├── server/        # services, tools, business logic
   ├── components/    # UI components
   ├── validations/   # Zod schemas
   ├── index.ts       # Barrel export (public API)
   └── README.md      # Contratto: cosa esporta, chi lo consuma
   ```

3. **Proteggi le API routes**:
   ```typescript
   const packGate = assertModuleEnabled('myModule')
   if (packGate) return packGate
   ```

4. **Registra il percorso DB-based** (opzionale, se vuoi il toggle admin):
   Aggiungi entry in `src/lib/modules/registry.ts` con `navPaths` e `apiPrefixes`.

5. **Test**: aggiungi un test sotto `src/app/api/myModule/__tests__/module-guard.test.ts` che verifica 404 quando disabilitato.

---

## Testing

Pattern per test che manipolano `ENABLED_MODULES`:

```typescript
import { __resetConfigCache } from '@/config/runtime'

beforeEach(() => {
  __resetConfigCache()
})

afterEach(() => {
  __resetConfigCache()
  // ripristina env
})

it('tests with tenders disabled', () => {
  process.env.ENABLED_MODULES = 'core,requests,vendors,clients,articles,commesse'
  expect(assertModuleEnabled('tenders')).not.toBeNull()
})
```

---

## Cosa non fare

- **Non importare dal registry a runtime per logica business**. Usa `isModuleEnabled()`.
- **Non spostare un modulo fuori da `src/modules/` senza aggiornare il registry**.
- **Non cambiare `alwaysOn` da `true` a `false`** senza piano di migrazione dati (customer esistenti si aspettano il modulo attivo).
- **Non fare import cross-module diretti**: passa per `@/modules/<pack>/<name>` (il barrel). Questo mantiene la superficie pubblica esplicita.
