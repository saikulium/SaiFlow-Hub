# Module Migration Guide

> Step-by-step per migrare codice esistente (sparso in `src/server`, `src/components`, `src/lib`) dentro un modulo formale sotto `src/modules/`.

Questa guida è derivata dalla migrazione pilota del modulo `commesse` (commit `1befa92`).

## Quando migrare

Migra un pezzo di codice in un modulo quando:
- Ha un nome di dominio chiaro (commesse, invoices, tenders, articles...).
- Ha ≥3 file tra services/components/validations.
- Si può immaginare come disabilitarlo senza rompere il resto.

Non migrare:
- Utility generiche (auth, db, api-response): vivono in `src/lib`.
- Componenti UI primitivi: vivono in `src/components/ui`.
- Codice che attraversa >2 moduli: indica che il modulo non è ancora ben delimitato.

---

## Pre-flight check

```bash
# 1. Parti sempre da main pulito su un branch dedicato
git checkout main && git pull
git checkout -b refactor/move-<module-name>

# 2. Baseline verde
rm -rf .next
npx tsc --noEmit
npx vitest run
```

Se questi falliscono, non iniziare: risolvi prima la baseline.

---

## Step 1 — Mappa le dipendenze

Prima di spostare nulla, inventaria:

```bash
# Trova chi importa il codice che vuoi migrare
grep -r "from '@/server/services/<module>.service'" src/
grep -r "from '@/components/<module>/" src/
grep -r "from '@/lib/validations/<module>'" src/

# Trova i file che appartengono al modulo
find src/server/services -name "*<module>*"
find src/components/<module> -type f
find src/lib/validations -name "*<module>*"
```

Scrivi una lista di:
- File da spostare (interno al modulo)
- File che importeranno dal modulo dopo la migrazione (external)

---

## Step 2 — Crea la folder del modulo

```bash
mkdir -p src/modules/<pack>/<module>/{server,components,validations}
```

Dove `<pack>` è `core` (per ora tutti i moduli sono core).

---

## Step 3 — Registra il modulo

Aggiungi in `src/config/modules.ts`:

```typescript
<moduleName>: {
  name: '<moduleName>',
  pack: 'core',
  alwaysOn: false,  // o true se è foundational
  dependencies: ['core', /* altri moduli necessari */],
  description: 'Descrizione di 1 riga',
},
```

Se il modulo dipende da altri, elencali in `dependencies`. Il runtime valida al boot.

---

## Step 4 — Sposta i file con `git mv`

**Sempre `git mv`**, mai copia+cancella. Preserva la history.

```bash
git mv src/server/services/<module>.service.ts \
       src/modules/core/<module>/server/<module>.service.ts

git mv src/server/agents/tools/<module>.tools.ts \
       src/modules/core/<module>/server/<module>.tools.ts

git mv src/lib/validations/<module>.ts \
       src/modules/core/<module>/validations/<module>.ts

git mv src/components/<module>/*.tsx \
       src/modules/core/<module>/components/
```

Verifica che git mostri "renamed" (non "deleted + new file"):
```bash
git status
```

---

## Step 5 — Aggiorna import interni al modulo

I file spostati hanno import relativi o `@/` che puntano a percorsi ora sbagliati. Aggiustali per stare nel modulo.

Esempio: se `server/commessa.service.ts` importava `@/lib/commessa-state-machine`, e anche `state-machine.ts` è stato spostato dentro il modulo come `server/state-machine.ts`, aggiorna:

```typescript
// prima
import { ... } from '@/lib/commessa-state-machine'

// dopo
import { ... } from './state-machine'
```

Regola: **import interni al modulo = path relativi**. Solo la public API passa per `@/modules/...`.

---

## Step 6 — Crea `index.ts` barrel

File: `src/modules/<pack>/<module>/index.ts`

Esporta **solo** ciò che è public. Non esportare helpers interni.

```typescript
// Services
export {
  doSomething,
  SomeClass,
} from './server/<module>.service'

// Tools (per AI agents)
export {
  someTool,
  <MODULE>_TOOLS,
} from './server/<module>.tools'

// Validations
export {
  create<Module>Schema,
  update<Module>Schema,
  type Create<Module>Input,
  type Update<Module>Input,
} from './validations/<module>'

// Components
export { <ModulePageContent> } from './components/<module>-page-content'
export { <ModuleDialog> } from './components/<module>-dialog'
```

---

## Step 7 — Crea `README.md` del modulo

File: `src/modules/<pack>/<module>/README.md`

Breve, 1-2 pagine. Includi:
- Responsabilità del modulo (cosa fa, cosa NON fa)
- Public API (link al barrel)
- Dipendenze (altri moduli che usa)
- Storage (tabelle Prisma di cui è owner)
- Gotchas / note operative

Serve a chi apre il modulo per la prima volta per capire in 30 secondi dove mettere le mani.

---

## Step 8 — Aggiorna import esterni

Cerca tutti i consumer del vecchio path e sostituisci con il barrel:

```bash
# Trova consumer
grep -r "from '@/server/services/<module>.service'" src/ tests/
grep -r "from '@/components/<module>/" src/ tests/

# Sostituisci a mano o con sed, verificando ogni file
```

**Pattern**: sostituisci import multipli con un singolo import dal barrel.

```typescript
// prima
import { doThing } from '@/server/services/foo.service'
import { FooSchema } from '@/lib/validations/foo'
import { FooComponent } from '@/components/foo/foo-component'

// dopo
import { doThing, FooSchema, FooComponent } from '@/modules/core/foo'
```

**Non dimenticare i test**: `tests/**/*.test.ts` può usare path relativi (`../src/...`) invece di `@/`.

---

## Step 9 — API routes e pagine app router

Le API routes (`src/app/api/...`) e le pagine (`src/app/(dashboard)/...`) **non si spostano**: restano nella struttura di Next.js. Ma devono:

1. **Importare la logica dal barrel del modulo** (non dai vecchi path).
2. **Aggiungere il pack gate**:
   ```typescript
   import { assertModuleEnabled } from '@/lib/module-guard'
   
   export async function GET() {
     const packGate = assertModuleEnabled('<module>')
     if (packGate) return packGate
     // ...
   }
   ```

---

## Step 10 — Verify

```bash
rm -rf .next
npx tsc --noEmit      # deve essere clean
npx vitest run        # tutti i test passano
```

Se fallisce:
- **Modulo sconosciuto / circular import** → controlla `index.ts` del barrel
- **Type errors** → probabilmente un import dimenticato, cercalo nel file segnalato
- **Test falliti** → probabilmente un test usava il vecchio path; aggiornalo

---

## Step 11 — Commit

Un singolo commit per la migrazione (usa `git mv` rende il diff piccolo):

```bash
git add -A
git commit -m "refactor(modules): migrate <module> to src/modules/core/<module>"
```

---

## Step 12 — Verifica runtime (opzionale)

Prova a disabilitare il modulo:

```bash
ENABLED_MODULES=core,requests,vendors,clients,articles npm run dev
```

Visita le API routes del modulo: dovrebbero rispondere 404 `MODULE_DISABLED`.

Riabilita:

```bash
unset ENABLED_MODULES
npm run dev
```

---

## Checklist finale

- [ ] Tutti i file del modulo sono sotto `src/modules/<pack>/<module>/`
- [ ] `git mv` ha preservato la history (verifica con `git log --follow`)
- [ ] `index.ts` esporta solo la public API
- [ ] `README.md` spiega responsabilità, deps, storage
- [ ] Nessun import esterno punta ai vecchi path (grep pulito)
- [ ] API routes e pagine importano dal barrel
- [ ] API routes hanno `assertModuleEnabled()` guard
- [ ] Modulo registrato in `src/config/modules.ts`
- [ ] `tsc --noEmit` clean
- [ ] `vitest run` verde
- [ ] Se il modulo è `alwaysOn: false`: testato disabilitandolo via env

---

## Errori comuni

### "Modulo sconosciuto in ENABLED_MODULES"
Hai dimenticato di registrare il modulo in `src/config/modules.ts` prima di abilitarlo.

### "Il modulo X richiede Y che non è attivo"
Una dipendenza transitiva non è stata inclusa. O aggiungila a `ENABLED_MODULES`, o rimuovi il modulo che la richiede.

### Circular imports dopo la migrazione
Probabilmente un componente del modulo importa dal barrel `@/modules/<pack>/<module>` invece che da path relativo. **Interno = relativo, esterno = barrel**.

### Test che falliscono improvvisamente
Un test usava un path relativo (`../src/server/services/...`). Cercalo e aggiorna.

### Prisma types che si rompono
Dopo un `git pull` o cambio branch: `npx prisma generate`.
