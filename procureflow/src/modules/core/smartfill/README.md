# SmartFill module

**Pack:** core · **alwaysOn:** false · **depends on:** core, requests

Auto-compilazione AI dei campi di una RDA a partire dal titolo.

## Strategia a due livelli

1. **Match storico (zero cost)** — cerca PR completate (DELIVERED/CLOSED/RECONCILED)
   con titoli simili in DB, copia items/vendor/priority/budget da quella PR.
2. **Fallback Claude** — se nessuna PR simile supera `MIN_CONFIDENCE`, usa
   Claude Sonnet single-shot JSON per generare i campi a partire dal titolo.

## Public API

```ts
import {
  getSuggestions,
  useRequestSuggestions,
  SuggestionPanel,
  suggestRequestSchema,
  type RequestSuggestion,
  type SuggestedItem,
  type SuggestRequestInput,
} from '@/modules/core/smartfill'
```

## Scope

- `server/suggest.service.ts` — DB lookup + Claude fallback.
- `hooks/use-request-suggestions.ts` — React Query hook con debounce.
- `components/suggestion-panel.tsx` — pannello UI nel form RDA.
- `validations/suggest.ts` — schema input API.

## Fuori scope

- `src/app/api/requests/suggest/route.ts` — route Next.js che importa dal barrel.
- `src/components/requests/request-form.tsx` — consumer UI (resta nel modulo
  requests quando verra migrato).
- `src/lib/ai/{claude-client,models}` — infrastruttura AI condivisa.
