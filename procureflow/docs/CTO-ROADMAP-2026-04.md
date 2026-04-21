# ProcureFlow — CTO Roadmap Aprile 2026

> Snapshot al 2026-04-05. Revisione ogni 2 settimane.

---

## Stato Progetto

| Metrica | Valore |
|---------|--------|
| Linee di codice | ~47.000 |
| Modelli Prisma | 34 |
| API Routes | 76 |
| Pagine | 25 |
| Hook | 31 |
| Services | 29 |
| Test files | 22 |
| Commit | 66 |

### Moduli Completati

- **Core Procurement**: CRUD richieste, fornitori, fatture, budget, gare
- **Workflow Approvazione**: soglie configurabili, auto-approvazione
- **Three-Way Matching**: auto-match, suggested, manual
- **SDI**: fatturazione elettronica italiana
- **Inventory**: materiali, magazzini, zone, lotti, movimenti, forecast WMA
- **Admin Panel**: config, integrazioni AES-256-GCM, import/export CSV+ZIP
- **AI Agent**: Claude tool-use + streaming SSE + RBAC
- **ROI Analytics**: 18 query, 4 sezioni grafici, 6 summary card, export CSV
- **Security**: MFA/TOTP, refresh token rotation, lockout, webhook HMAC+idempotency, rate limiting

---

## Priorita' — Prossime 2 Settimane

### P1. Docker + Deploy Demo (2-3gg)

Nessuno fuori dal laptop puo' vedere il prodotto.

- [ ] `Dockerfile` multi-stage (deps → build → runtime)
- [ ] `docker-compose.yml` (postgres + app + n8n)
- [ ] `.env.production.example` con tutte le variabili
- [ ] `prisma migrate deploy` nel container startup
- [ ] Health check endpoint `/api/health`
- [ ] Seed opzionale via env flag
- [ ] Deploy su Railway/Fly.io/VPS con dominio demo

### P2. CI Pipeline (1gg)

Protezione contro regressioni.

- [ ] GitHub Actions: `lint` + `tsc --noEmit` + `vitest run`
- [ ] Trigger su push main + PR
- [ ] Cache node_modules + .next
- [ ] Badge status nel README

### P3. Pulizia Working Tree (0.5gg)

21 file non committati = debito invisibile.

- [ ] Decidere per ogni file: completare o eliminare
- [ ] Committare file completati
- [ ] Eliminare scheletri vuoti
- [ ] Working tree pulito (git status clean)

### P4. 1 Workflow n8n Funzionante — Email Ingestion (2-3gg)

Il differenziatore del prodotto. Senza automazione, ProcureFlow e' un CRUD.

- [ ] Template n8n JSON: IMAP polling → AI classify → webhook → PR creation
- [ ] Setup guide per connessione n8n ↔ ProcureFlow
- [ ] Test end-to-end con email reale
- [ ] Documentazione per demo

### P5. Onboarding Wizard (1-2gg)

Prima impressione del prospect.

- [ ] Completare step components (gia' in working tree)
- [ ] Collegare API routes
- [ ] Test flow completo
- [ ] Committare

### P6. Integration Test (2gg)

Fiducia nel deploy.

- [ ] Test su 5 endpoint critici: requests CRUD, approvals, invoices, auth, webhooks
- [ ] Setup test DB (docker postgres per CI)
- [ ] Integrare in CI pipeline

---

## Cosa NON Fare Ora

- **Altre feature** — troppa superficie, consolidare prima
- **Next.js 14 → 16** — troppo rischioso senza CI+test, fare dopo
- **Refactoring** — codice gia' pulito, stop
- **Nuovi moduli** (commesse, etc.) — prima far funzionare bene l'esistente

---

## Milestone per Scenario

| Scenario | Requisiti Minimi |
|----------|-----------------|
| Demo prospect | P1 + P4 + P5 |
| MVP early adopter | P1 + P2 + P3 + P4 + P6 |
| Pitch investitore | P1 + metriche ROI live + 1 caso e2e funzionante |

---

## Debito Tecnico Noto

| Item | Severita' | Note |
|------|-----------|------|
| Next.js 14.2.35 (4 CVE in 15.x) | HIGH | Upgrade dopo CI |
| Zero integration test su 76 routes | HIGH | P6 |
| n8n workflows non esistono | HIGH | P4 |
| 21 file non committati | MEDIUM | P3 |
| Prisma index mancanti (Approval, Timeline, Vendor, Invoice) | LOW | Con dati reali |
| onDelete mancante su 5 relazioni User | LOW | Edge case admin |
