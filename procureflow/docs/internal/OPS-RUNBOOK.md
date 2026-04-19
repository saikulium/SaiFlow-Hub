# ProcureFlow — Stato Operativo e Gap di Fleet Management

Data snapshot: 2026-04-17
Commit di riferimento: `74d4a1b` (main)

---

## 1. Inventario File di Deployment

| File | Esiste | Stato |
|------|--------|-------|
| `Dockerfile` | Si | Multi-stage, ben strutturato |
| `docker-compose.yml` | Si | 3 servizi (db, app, n8n) |
| `.dockerignore` | Si | Completo |
| `.env.example` | Si | 13 variabili documentate |
| `.env.production.example` | Si | 10 variabili, subset produzione |
| `.github/workflows/ci.yml` | Si | Lint + typecheck + test + Docker build |
| `scripts/migrate-attachments.sh` | Si | Migrazione path allegati (PF-005) |
| `scripts/migrate-totp-encryption.ts` | Si | Migrazione cifratura TOTP (PF-001) |
| `next.config.mjs` | Si | output: 'standalone', security headers |
| `infra/` | No | Non esiste |
| `deploy/` | No | Non esiste |
| `ansible/` | No | Non esiste |
| `terraform/` | No | Non esiste |
| `k8s/` / `helm/` | No | Non esiste |

Nessuna infrastruttura as code. Il deployment e interamente Docker Compose-based.

---

## 2. Dockerfile Analisi

**File**: `Dockerfile` (57 righe)

### Struttura multi-stage

| Stage | Base Image | Scopo |
|-------|-----------|-------|
| `deps` | node:20-alpine | `npm ci --ignore-scripts` + `prisma generate` |
| `builder` | node:20-alpine | `npm run build` (Next.js) |
| `runner` | node:20-alpine | Runtime produzione con standalone output |

### Checklist

| Criterio | Stato | Dettaglio |
|----------|-------|-----------|
| Multi-stage | ✅ | 3 stage, solo artefatti necessari nel runner |
| Immagine base | ✅ | `node:20-alpine` (~180 MB compresso) |
| User non-root | ✅ | `nextjs` (UID 1001, gruppo `nodejs` GID 1001) |
| HEALTHCHECK | ✅ | `wget http://localhost:3000/api/health`, 30s interval, 5s timeout, 10s start, 3 retry |
| Build arg leak | ⚠️ | `DATABASE_URL` dummy hardcoded nello stage builder — non e un leak (valore finto `postgresql://dummy:dummy@localhost:5432/dummy`) ma potrebbe confondere |
| Cache layer | ⚠️ | `package.json` + `package-lock.json` copiati prima del codice — corretto per cache npm. Ma `COPY . .` nello stage builder invalida la cache ad ogni cambio di qualsiasi file |
| `.dockerignore` | ✅ | Esclude node_modules, .next, .git, .env*, test, docs, .md |
| Prisma runtime | ✅ | Schema, client, e migration files copiati per `prisma migrate deploy` al startup |
| Extra deps | ⚠️ | `tsx` e `esbuild` copiati nel runner per seed/migration scripts — aggiungono ~15 MB. Necessari solo se `SEED_ON_STARTUP=true` |

### Dimensione immagine stimata

- Base node:20-alpine: ~180 MB
- Next.js standalone: ~80-120 MB
- Prisma client: ~20 MB
- tsx/esbuild: ~15 MB
- **Totale stimato: ~300-350 MB**

---

## 3. Docker Compose Analisi

**File**: `docker-compose.yml` (77 righe)

### Servizi

| Servizio | Immagine | Port | Restart | Healthcheck |
|----------|---------|------|---------|-------------|
| `db` | postgres:16-alpine | 5432:5432 | unless-stopped | `pg_isready -U procureflow` (5s interval) |
| `app` | Build da `./Dockerfile` | 3000:3000 | unless-stopped | Via Dockerfile (wget /api/health) |
| `n8n` | n8nio/n8n:latest | 127.0.0.1:5678:5678 | unless-stopped | Nessuno |

### Volumi

| Volume | Tipo | Servizio | Contenuto |
|--------|------|----------|-----------|
| `pgdata` | Named | db | Dati PostgreSQL |
| `n8ndata` | Named | n8n | Workflow n8n + credenziali |
| `appdata` | Named | app | Upload allegati (/app/data) |

Tutti volumi Docker named — persistono tra restart ma sono locali al singolo host.

### Rete

Tutti i servizi sono sulla rete Docker default (stesso compose). Non c'e network isolation tra app, db, e n8n.

| Porta | Binding | Rischio |
|-------|---------|---------|
| 5432 (PostgreSQL) | 0.0.0.0:5432 | **ALTO** — DB esposto su tutte le interfacce, accessibile da internet se il firewall VPS non lo blocca |
| 3000 (app) | 0.0.0.0:3000 | Normale — serve il frontend |
| 5678 (n8n) | 127.0.0.1:5678 | ✅ Localhost-only (PF-043) |

### depends_on

`app` dipende da `db` con `condition: service_healthy` — corretto. n8n dipende da `db` con `condition: service_healthy` — corretto.

### Startup Command (app)

```sh
npx prisma migrate deploy
if [ "$$SEED_ON_STARTUP" = "true" ]; then
  npx prisma db seed || echo "Seed failed or already applied"
fi
node server.js
```

Le migrazioni Prisma vengono applicate automaticamente ad ogni avvio container. Il seed e opzionale (controllato da `SEED_ON_STARTUP`).

### Gestione secret

Tutte le variabili sensibili vengono dal file `.env` tramite interpolazione `${VAR}`. Tre variabili hanno `?` (required):
- `POSTGRES_PASSWORD`
- `NEXTAUTH_SECRET`
- `N8N_WEBHOOK_SECRET`

Il compose fallisce al `docker compose up` se queste mancano. `ANTHROPIC_API_KEY` e `ENCRYPTION_KEY` hanno default vuoto — l'app parte ma le feature AI e la cifratura non funzionano.

### Logging

Nessun logging driver configurato. I log vanno su stdout/stderr dei container (default Docker `json-file`). Nessuna rotazione configurata — i file JSON crescono indefinitamente.

---

## 4. Osservabilita Stack

| Layer | Stato | Dettaglio |
|-------|-------|-----------|
| **Health check** | ✅ Esiste | GET `/api/health` — verifica connessione DB, restituisce status + timestamp + uptime |
| **Logging strutturato** | ❌ Non esiste | L'app usa `console.log`/`console.warn`/`console.error` (17 occorrenze in `src/`). Output non JSON, non structured |
| **Log rotation** | ❌ Non configurato | Docker json-file driver senza max-size/max-file |
| **Metriche Prometheus** | ❌ Non esiste | Nessun endpoint `/metrics` |
| **Error tracking (Sentry)** | ❌ Non esiste | Nessun import Sentry nel codebase. Unica menzione in un file docs Python |
| **APM** | ❌ Non esiste | Nessun Datadog, New Relic, o equivalente |
| **Uptime monitoring** | ❌ Non esiste | Nessun servizio esterno (UptimeRobot, Better Uptime) configurato |
| **Alerting** | ❌ Non esiste | Nessun canale di alert (email, Telegram, PagerDuty, Slack) |
| **Dashboard** | ❌ Non esiste | Nessun Grafana, Kibana, o equivalente |

L'unico segnale osservabile e il HEALTHCHECK Docker che riavvia il container se `/api/health` fallisce 3 volte consecutive. Non c'e nessuno che riceve un alert se questo succede.

---

## 5. Backup e Disaster Recovery

| Aspetto | Stato | Dettaglio |
|---------|-------|-----------|
| Script pg_dump | ❌ Non esiste | Nessuno script di backup nel repo |
| Backup automatico | ❌ Non configurato | Nessun cron, nessun servizio esterno |
| Destinazione backup | N/A | Non definita (nessun S3, B2, o storage remoto) |
| Retention policy | N/A | Non definita |
| Restore testato | ❌ Mai testato | Nessuna documentazione di restore |
| Backup allegati | ❌ Non esiste | Volume `appdata` non backuppato separatamente |
| Backup n8n workflow | ❌ Non esiste | Volume `n8ndata` non backuppato |
| Point-in-time recovery | ❌ Non configurato | PostgreSQL WAL archiving non abilitato |

**Scenario di perdita dati**: se il disco VPS si corrompe, si perdono: database, allegati, workflow n8n. Non c'e modo di ripristinare.

---

## 6. CI/CD Pipeline

### Workflow: `.github/workflows/ci.yml`

**Trigger**: push a `main` o PR verso `main`, solo se file in `procureflow/**` cambiano.

| Job | Cosa fa | Dipendenze |
|-----|---------|------------|
| `lint-typecheck-test` | checkout → Node 20 + npm cache → `npm ci` → `prisma generate` → `next lint` → `tsc --noEmit` → `vitest run` | Nessuna |
| `docker-build` | checkout → `docker build -t procureflow:ci .` | Richiede job 1 |

### Cosa c'e

- ✅ Lint (ESLint via Next.js)
- ✅ Type check (TypeScript strict)
- ✅ Unit test (Vitest, 589 test)
- ✅ Docker build smoke test (verifica che l'immagine si costruisce)
- ✅ Cache npm per velocizzare le run

### Cosa manca

- ❌ **Nessun push a registry Docker**: l'immagine `procureflow:ci` viene costruita e poi buttata. Non viene pushata a Docker Hub, GHCR, o altro registry.
- ❌ **Nessun CD (Continuous Deployment)**: nessun deploy automatico dopo merge su main. Il deploy e manuale.
- ❌ **Nessun security scanning**: nessun Dependabot, CodeQL, Trivy (scan vulnerabilita container), gitleaks (scan secret).
- ❌ **Nessun E2E test**: nessun Playwright in CI.
- ❌ **Nessun artefatto pubblicato**: nessun release, nessun changelog automatico, nessun tag versione.

### Tempo stimato

- Job 1 (lint+typecheck+test): ~2-3 minuti (npm ci con cache + 589 test in ~5s)
- Job 2 (Docker build): ~3-5 minuti (build multi-stage Next.js)
- **Totale**: ~5-8 minuti per pipeline

---

## 7. Onboarding Nuovo Cliente — AS-IS

> AS-IS ricostruito da analisi del codice e dei file di configurazione. Nessuna documentazione di processo trovata nel repo.

### Processo stimato

1. **Provisioning VPS** (manuale, ~15 min)
   - Crea VPS su provider (Hetzner, DigitalOcean, OVH)
   - Installa Docker + Docker Compose
   - Configura DNS (dominio.cliente.com → IP VPS)

2. **Setup certificato SSL** (manuale, ~10 min)
   - Installa Caddy/Nginx come reverse proxy con Let's Encrypt
   - Configura proxy per porta 3000 (app) e opzionalmente 5678 (n8n)

3. **Clone repo e configurazione** (manuale, ~20 min)
   - `git clone` del repo sulla VPS
   - Copia `.env.production.example` → `.env`
   - Genera secret: `openssl rand -base64 32` per NEXTAUTH_SECRET
   - Genera ENCRYPTION_KEY: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Inserisce: POSTGRES_PASSWORD, N8N_WEBHOOK_SECRET, N8N_PASSWORD, ANTHROPIC_API_KEY
   - Configura NEXTAUTH_URL con il dominio del cliente

4. **Primo avvio** (manuale, ~10 min)
   - `docker compose up -d`
   - Verifica che i 3 container partano (db, app, n8n)
   - L'entrypoint esegue `prisma migrate deploy` automaticamente
   - Se `SEED_ON_STARTUP=true`, il seed crea l'utente admin iniziale

5. **Post-deploy migrations** (manuale, condizionale)
   - Se e la prima installazione dopo il security sprint: `npx tsx scripts/migrate-totp-encryption.ts`
   - Se ci sono allegati da migrare: `bash scripts/migrate-attachments.sh`

6. **Configurazione iniziale** (manuale, ~15 min)
   - Login come admin
   - Configura moduli abilitati (chatbot, magazzino, gare, ecc.)
   - Configura categorie, dipartimenti, centri di costo
   - Crea utenti
   - (Opzionale) Import fornitori da CSV via onboarding agent

7. **Verifica** (manuale, ~10 min)
   - Testa health check: `curl https://dominio/api/health`
   - Crea una PR di test
   - Verifica n8n raggiungibile
   - Verifica HTTPS funzionante

### Tempo totale stimato: ~80-120 minuti per cliente

### Cosa puo andare storto al primo deploy

| Problema | Probabilita | Impatto |
|----------|-------------|---------|
| Secret mancante nel .env → compose non parte | Alta | Container non parte, errore visibile |
| ENCRYPTION_KEY vuoto → cifratura TOTP disabilitata | Alta | App parte ma MFA non funziona, errore runtime |
| ANTHROPIC_API_KEY vuoto → AI features silenziosamente rotte | Media | App parte, chatbot/email agent restituiscono errori |
| PostgreSQL porta esposta su internet | Alta | DB accessibile dall'esterno se firewall non configurato |
| DNS non propagato → HTTPS fallisce | Media | Certificato non rilasciato, sito non raggiungibile |
| `SEED_ON_STARTUP=true` dimenticato → no utente admin | Media | App accessibile ma nessun modo di fare login |
| Disco VPS troppo piccolo per Docker build | Bassa | Build fallisce, serve resize disco |
| n8n database `n8n` non creato automaticamente | Media | n8n non parte — il servizio db crea solo `procureflow` |

---

## 8. Release & Update — AS-IS

> AS-IS ricostruito da analisi del codice. Nessun processo di release documentato.

### Processo di update stimato

1. **Developer** pusha su `main` → CI verifica lint/typecheck/test/docker build
2. **Founder** fa SSH sulla VPS del cliente
3. `cd /path/to/procureflow && git pull`
4. `docker compose build app` (ricostruisce l'immagine con il nuovo codice)
5. `docker compose up -d` (riavvia il container app)
6. L'entrypoint esegue `prisma migrate deploy` automaticamente
7. Il servizio e aggiornato

### Versioning

- ❌ Nessun tag Git (nessun `v1.0.0`, `v1.1.0`)
- ❌ Nessun changelog automatico
- ❌ Nessun semantic versioning
- ❌ Nessun modo di sapere quale "versione" gira su quale cliente
- Il `package.json` ha `"version": "0.1.0"` — mai aggiornato

### Migrazioni Prisma

- Le migrazioni si applicano automaticamente all'avvio del container (`prisma migrate deploy` nell'entrypoint)
- Se una migrazione fallisce, il container non parte (Node process non raggiunge `server.js`)
- La migrazione `pf004_hash_refresh_tokens` e BREAKING: invalida tutti i refresh token (force re-login)
- Non c'e modo di sapere in anticipo se una migrazione e distruttiva senza leggere il codice

### Rollback

- ❌ Non documentato
- ❌ Nessun meccanismo automatico
- Rollback possibile in teoria: `git checkout <commit-precedente>` → rebuild → restart
- Ma: se la migrazione Prisma ha alterato lo schema DB, il rollback potrebbe rompere la compatibilita
- Non esistono migration `down` in Prisma Migrate (solo `up`)

### Rischio: update diversi per clienti diversi

Con 10+ VPS, il founder deve:
- Ricordare quale commit gira su quale VPS
- Decidere manualmente quando aggiornare ogni cliente
- Fare SSH su ogni VPS singolarmente
- Verificare manualmente che l'update sia andato a buon fine

---

## 9. Incident Response — AS-IS

| Aspetto | Stato |
|---------|-------|
| Status page pubblica | ❌ Non esiste |
| Alerting automatico | ❌ Non esiste |
| Canale di notifica incidenti | ❌ Non definito (nessun email, Telegram, PagerDuty) |
| Runbook per problemi comuni | ❌ Non esiste |
| On-call rotation | N/A — il founder e l'unica persona |
| Log accessibili | Solo via `docker logs` su SSH |
| Metriche per diagnostica | Solo health check binario (ok/fail) |

### Scenari di incidente e stato attuale

| Scenario | Come il founder lo scopre oggi | Come lo risolve |
|----------|-------------------------------|-----------------|
| DB down | Il HEALTHCHECK Docker riavvia il container. Se persistente, il cliente chiama/scrive. | SSH → `docker compose restart db` → verifica log |
| Disk full | Il cliente segnala errori. Nessun alert proattivo. | SSH → `docker system prune` → resize disco |
| OOM killer | Container ucciso, Docker lo riavvia (restart: unless-stopped). Se loop, il cliente segnala. | SSH → `docker stats` → verifica memory limit → restart |
| Certificato SSL scaduto | Il cliente vede "connessione non sicura". Nessun alert. | SSH → rinnova certbot/caddy → restart proxy |
| Migrazione Prisma fallita | Container app non parte. Il cliente segnala che il sito e down. | SSH → `docker logs app` → fix manuale → rebuild |
| API Anthropic down | Le feature AI falliscono silenziosamente. L'utente vede errori generici. | Nessun modo di saperlo proattivamente. |
| Secret/API key scaduta | Feature rotta. L'utente segnala. | SSH → modifica .env → restart |

**Chi risponde alle 23 di sabato**: il founder, se il cliente lo contatta. Nessun sistema automatico di detection o escalation.

---

## 10. Hardening VPS

| Aspetto | Documentato | Stato |
|---------|-------------|-------|
| Firewall (UFW/iptables) | ❌ | Non documentato. Necessario per bloccare porta 5432 PostgreSQL |
| fail2ban | ❌ | Non documentato |
| SSH key-only (no password) | ❌ | Non documentato |
| SSH porta non-standard | ❌ | Non documentato |
| Unattended upgrades | ❌ | Non documentato |
| Swap configurato | ❌ | Non documentato |
| Playbook Ansible | ❌ | Non esiste |
| Docker rootless mode | ❌ | Non documentato |
| Log rotation Docker | ❌ | Non configurato nel compose |
| TLS per PostgreSQL | ❌ | Connessione DB in plaintext tra container |

Nessuna documentazione di hardening nel repo. Il founder deve ricordare tutti gli step a memoria per ogni VPS.

---

## 11. Top 10 Gap per Fleet Management Multi-Cliente

| # | Gap | Rischio operativo | Effort | Priorita |
|---|-----|-------------------|--------|----------|
| 1 | **Nessun backup automatico** | Perdita dati totale se disco VPS si corrompe. Nessun RPO/RTO definito. | M | CRITICAL |
| 2 | **PostgreSQL porta 5432 esposta su 0.0.0.0** | DB accessibile da internet se firewall non configurato. Accesso non autenticato possibile con password debole. | S | CRITICAL |
| 3 | **Nessun alerting/monitoring** | Il founder scopre che un VPS e down solo quando il cliente lo chiama. Con 10 VPS, un down notturno puo durare ore. | M | CRITICAL |
| 4 | **Nessun CD — deploy manuale per VPS** | Con 10 VPS, un update richiede 10 sessioni SSH. Un errore di copia .env su un VPS puo rompere quel cliente. Tempo: ~30 min × 10 = 5 ore. | L | HIGH |
| 5 | **Nessun versioning/tagging** | Impossibile sapere quale versione gira su quale cliente. Impossibile rollback mirato. Impossibile comunicare changelog al cliente. | S | HIGH |
| 6 | **Nessun log rotation** | I log Docker crescono indefinitamente. Dopo mesi di operazione, il disco si riempie di log JSON. Impatta tutti i 10 VPS. | S | HIGH |
| 7 | **Nessun runbook di hardening VPS** | Ogni VPS configurato diversamente. Dimenticare il firewall su uno = DB esposto. Dimenticare fail2ban = brute force SSH. | M | HIGH |
| 8 | **Rollback non possibile dopo migrazione DB** | Se una release introduce un bug grave E una migrazione distruttiva, non c'e modo di tornare indietro senza restore da backup (che non esiste). | M | HIGH |
| 9 | **Nessun secret rotation procedure** | NEXTAUTH_SECRET, ENCRYPTION_KEY, ANTHROPIC_API_KEY non hanno processo di rotazione. Se una key viene compromessa, il founder deve fare SSH su ogni VPS per cambiarla. | S | MEDIUM |
| 10 | **n8n database non creato automaticamente** | Il servizio `db` crea solo il database `procureflow`. n8n richiede un database `n8n` che potrebbe non esistere al primo avvio, causando errore silenzioso. | S | MEDIUM |

---

## 12. Sintesi: Pronto per Quanti Clienti?

### Stato attuale

| Componente | Stato |
|-----------|-------|
| Dockerfile | ✅ Produzione-ready |
| Docker Compose | ⚠️ Funzionale ma con gap sicurezza (porta DB) e ops (log rotation) |
| CI | ✅ Lint + typecheck + test + Docker build |
| CD | ❌ Non esiste |
| Backup | ❌ Non esiste |
| Monitoring | ❌ Non esiste |
| Alerting | ❌ Non esiste |
| Hardening doc | ❌ Non esiste |
| Versioning | ❌ Non esiste |
| Runbook incidenti | ❌ Non esiste |

### Verdetto

**Con lo stato attuale: 1-2 VPS gestibili con dolore accettabile.**

Il founder puo gestire 1-2 clienti perche:
- Fa SSH direttamente e tiene tutto a mente
- Monitora "a occhio" (controlla manualmente ogni tanto)
- I clienti lo contattano se qualcosa non funziona
- Il rischio di perdita dati e accettato implicitamente

**A 3-5 VPS, il dolore diventa significativo:**
- Deploy manuale = mezza giornata per un update
- Nessun modo di sapere quale versione gira dove
- Nessun alert = incidenti scoperti in ritardo
- Nessun backup = rischio catastrofico su ogni VPS

**A 10+ VPS, il modello attuale non scala:**
- Tempo di deploy: 5+ ore per un update
- Tempo di incident response: imprevedibile (deve fare SSH su ogni VPS per diagnosticare)
- Rischio: una dimenticanza (firewall, backup, secret) su un VPS puo causare breach o perdita dati
- Il founder diventa single point of failure per tutte le operazioni

### Soglia critica per investire

Prima di superare 3 clienti, servono almeno:
1. Backup automatico con retention e restore testato
2. Bind PostgreSQL a 127.0.0.1 nel compose
3. Monitoring esterno con alert (anche solo UptimeRobot + Telegram)
4. Log rotation configurato
5. Script di deploy centralizzato (anche solo un `deploy.sh` con lista VPS)
6. Tag di versione su ogni release
