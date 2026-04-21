# ProcureFlow — Guida Completa di Installazione e Test

> Questa guida spiega passo-passo come installare ProcureFlow su un server VPS Aruba Cloud,
> caricare i dati demo, e testare tutte le funzionalita del sistema.
> Non serve esperienza tecnica avanzata — basta seguire i passaggi nell'ordine.

---

## Indice

1. [Cosa ti serve](#1-cosa-ti-serve)
2. [Installazione](#2-installazione)
3. [Primo avvio](#3-primo-avvio)
4. [Login e primi passi](#4-login-e-primi-passi)
5. [Test delle funzionalita](#5-test-delle-funzionalita)
   - [5.1 Dashboard](#51-dashboard)
   - [5.2 Richieste d'acquisto](#52-richieste-dacquisto)
   - [5.3 Fornitori](#53-fornitori)
   - [5.4 Fatture e riconciliazione](#54-fatture-e-riconciliazione)
   - [5.5 Approvazioni](#55-approvazioni)
   - [5.6 Budget](#56-budget)
   - [5.7 Inventario e magazzino](#57-inventario-e-magazzino)
   - [5.8 Analytics e ROI](#58-analytics-e-roi)
   - [5.9 AI Agent (Chat)](#59-ai-agent-chat)
   - [5.10 Impostazioni e sicurezza](#510-impostazioni-e-sicurezza)
6. [Test dell'automazione email (n8n)](#6-test-dellautomazione-email-n8n)
7. [Test dei webhook e integrazioni](#7-test-dei-webhook-e-integrazioni)
   - [7.1 Creazione automatica RdA da email](#71-creazione-automatica-rda-da-email)
   - [7.2 Aggiornamento automatico RdA da email fornitore](#72-aggiornamento-automatico-rda-da-email-fornitore)
   - [7.3 Email informativa (solo log nella timeline)](#73-email-informativa-solo-log-nella-timeline)
   - [7.4 Ricezione fattura SDI (Sistema di Interscambio)](#74-ricezione-fattura-sdi-sistema-di-interscambio)
   - [7.5 Aggiornamento fornitore da sistema esterno](#75-aggiornamento-fornitore-da-sistema-esterno)
   - [7.6 Approvazione/Rifiuto via webhook](#76-approvazionerifiuto-via-webhook)
   - [7.7 Auto-approvazione per soglia importo](#77-auto-approvazione-per-soglia-importo)
   - [7.8 Protezione duplicati (idempotenza)](#78-protezione-duplicati-idempotenza)
   - [7.9 Health check](#79-health-check)
   - [7.10 Creazione automatica commessa da email cliente](#710-creazione-automatica-commessa-da-email-cliente)
   - [7.11 Classificazione AI email con creazione commessa](#711-classificazione-ai-email-con-creazione-commessa)
   - [7.12 Associazione automatica RdA a commessa](#712-associazione-automatica-rda-a-commessa)
   - [7.13 Associazione manuale RdA a commessa](#713-associazione-manuale-rda-a-commessa)
   - [7.14 Creazione automatica clienti](#714-creazione-automatica-clienti)
   - [7.15 Creazione e gestione articoli](#715-creazione-e-gestione-articoli)
   - [7.16 Import massivo articoli da CSV](#716-import-massivo-articoli-da-csv)
8. [Test end-to-end: flusso completo ordine](#8-test-end-to-end-flusso-completo-ordine)
   - [8a. Flusso acquisto (RdA → Fattura)](#8a-flusso-acquisto-rda--fattura)
   - [8b. Flusso commessa (Email cliente → Commessa → RdA)](#8b-flusso-commessa-email-cliente--commessa--rda)
9. [Spegnere e riavviare](#9-spegnere-e-riavviare)
10. [Problemi comuni](#10-problemi-comuni)

---

## 1. Cosa ti serve

### 1a. Il VPS Aruba Cloud

Vai su [cloud.aruba.it](https://cloud.aruba.it) e crea un VPS con queste specifiche minime:

| Caratteristica | Valore consigliato |
|----------------|-------------------|
| **Piano** | VPS Smart o Cloud VPS Small |
| **Sistema operativo** | Ubuntu 22.04 LTS |
| **RAM** | 4 GB (minimo) |
| **vCPU** | 2 core |
| **Disco** | 80 GB SSD |
| **Data center** | Italia (Arezzo o Roma) |
| **Costo** | ~8-12 EUR/mese |

Dopo la creazione, Aruba ti fornisce un **indirizzo IP** e una **password root**. Annotali.

### 1b. Dal tuo computer

| Requisito | Come verificare | Come installare |
|-----------|----------------|-----------------|
| **Terminale SSH** | Gia incluso su Mac/Linux. Su Windows: PowerShell o [PuTTY](https://putty.org/) | Gia installato |
| **Un browser** | Chrome, Firefox, Safari, Edge | Gia installato |

### Come connettersi al server

Dal tuo Terminale locale:

```bash
ssh root@INDIRIZZO_IP_DEL_SERVER
```

Inserisci la password fornita da Aruba. Sei dentro.

---

## 2. Installazione sul VPS

> **Tutti i comandi di questa sezione vanno eseguiti sul server**, dopo essersi connessi via SSH.

### Passo 1: Installa Docker Engine sul server

Docker Engine e il motore che fa girare l'applicazione, il database e l'automazione in container isolati. A differenza di Docker Desktop (che si usa sui PC), Docker Engine gira direttamente sul server Linux senza interfaccia grafica.

```bash
# Aggiorna il sistema
sudo apt update && sudo apt upgrade -y

# Installa le dipendenze necessarie
sudo apt install -y ca-certificates curl gnupg

# Aggiungi il repository ufficiale Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installa Docker Engine + Docker Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verifica che funzioni
docker --version
docker compose version
```

Dovresti vedere qualcosa come `Docker version 24.x` e `Docker Compose version v2.x`.

### Passo 2: Installa Git e scarica il progetto

```bash
sudo apt install -y git
cd /opt
sudo git clone <URL-del-repository> procureflow
cd procureflow/procureflow
```

> Il progetto vive in `/opt/procureflow/procureflow` — questa e la cartella di lavoro per tutti i comandi successivi.

### Passo 3: Crea il file di configurazione

```bash
cp .env.production.example .env
nano .env
```

Modifica queste righe con **password robuste** (almeno 20 caratteri, mescola lettere, numeri e simboli):

```
POSTGRES_PASSWORD=una-password-robusta-per-il-database
NEXTAUTH_SECRET=una-stringa-lunga-e-casuale-di-almeno-32-caratteri
NEXTAUTH_URL=https://procurement.tuodominio.it
N8N_WEBHOOK_SECRET=un-segreto-robusto-per-i-webhook
N8N_PASSWORD=una-password-robusta-per-n8n
```

> **Importante:** `NEXTAUTH_URL` deve essere l'URL pubblico della piattaforma (con `https://`).
> Se non hai ancora un dominio, usa temporaneamente `http://INDIRIZZO_IP_DEL_SERVER:3000`.

**Per generare password sicure velocemente:**

```bash
# Genera una password casuale di 32 caratteri
openssl rand -base64 32
```

Eseguilo 4 volte e usa i risultati per le 4 password sopra.

### Passo 4: Configura Docker per ascoltare solo su localhost

Questo impedisce che i servizi interni (database, n8n) siano raggiungibili da internet. Solo l'applicazione web sara esposta tramite il reverse proxy HTTPS (configurato nella sezione Hardening).

```bash
nano docker-compose.yml
```

Cambia le porte da:

```yaml
ports:
  - "5432:5432"   # PostgreSQL
  - "3000:3000"   # App
  - "5678:5678"   # n8n
```

A:

```yaml
ports:
  - "127.0.0.1:5432:5432"   # PostgreSQL — solo locale
  - "127.0.0.1:3000:3000"   # App — solo locale (Caddy fara da proxy)
  - "127.0.0.1:5678:5678"   # n8n — solo locale
```

Salva con `Ctrl+O`, poi `Ctrl+X` per uscire.

### Passo 5: Abilita i dati demo (opzionale)

Se vuoi caricare dati di esempio per testare, assicurati che nel file `.env` ci sia:

```
SEED_ON_STARTUP=true
```

> **Per la produzione del cliente:** imposta `SEED_ON_STARTUP=false` per partire con un database vuoto.

Questo carichera automaticamente utenti, fornitori, richieste e fatture di esempio al primo avvio.

---

## 2b. Hardening del server

Questa sezione protegge il server da accessi non autorizzati, attacchi brute-force, e intrusioni.
Ogni passaggio spiega **cosa fa** e **perche serve**. Esegui tutti i passi prima di avviare l'applicazione.

### Passo 1: Accesso SSH solo con chiave (disabilita password)

**Cosa fa:** Invece di accedere al server con una password (indovinabile), usi una coppia di chiavi crittografiche. Solo chi possiede la chiave privata (tu) puo entrare.

**Perche serve:** I bot su internet provano continuamente combinazioni di password sui server esposti. Con la chiave SSH, anche miliardi di tentativi non possono entrare.

**Dal tuo PC** (non dal server):

```bash
# 1. Genera la coppia di chiavi (se non ne hai gia una)
ssh-keygen -t ed25519 -C "procureflow-server"
# Premi Invio per accettare il percorso default (~/.ssh/id_ed25519)
# Inserisci una passphrase (consigliato) oppure lascia vuoto

# 2. Copia la chiave pubblica sul server
ssh-copy-id root@INDIRIZZO_IP_DEL_SERVER
# Ti chiedera la password del server — e l'ultima volta che la usi
```

**Ora sul server** (connettiti con `ssh root@INDIRIZZO_IP_DEL_SERVER`):

```bash
# 3. Disabilita il login con password
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# 4. Disabilita il login root diretto (userai un utente dedicato)
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# 5. Riavvia il servizio SSH
sudo systemctl restart sshd
```

> **Attenzione:** Prima di chiudere la sessione, apri un **secondo terminale** e verifica
> che riesci ad accedere con la chiave. Se ti chiudi fuori, dovrai usare la console
> di emergenza del provider (Aruba/Hetzner).

### Passo 2: Crea un utente dedicato (non usare root)

**Cosa fa:** Crea un utente separato per gestire il server, cosi non lavori mai come root (l'utente con poteri illimitati).

**Perche serve:** Se un attaccante riesce a compromettere la sessione, il danno e limitato ai permessi dell'utente, non dell'intero sistema. E una best practice universale.

```bash
# 1. Crea l'utente
sudo adduser procureflow
# Scegli una password robusta, il resto puoi lasciare vuoto

# 2. Dagli i permessi di amministrazione (solo quando serve)
sudo usermod -aG sudo procureflow

# 3. Aggiungi Docker al gruppo dell'utente (per usare docker senza sudo)
sudo usermod -aG docker procureflow

# 4. Copia le chiavi SSH anche per il nuovo utente
sudo mkdir -p /home/procureflow/.ssh
sudo cp ~/.ssh/authorized_keys /home/procureflow/.ssh/
sudo chown -R procureflow:procureflow /home/procureflow/.ssh
sudo chmod 700 /home/procureflow/.ssh
sudo chmod 600 /home/procureflow/.ssh/authorized_keys
```

Da ora in poi, accedi con: `ssh procureflow@INDIRIZZO_IP_DEL_SERVER`

### Passo 3: Firewall (blocca tutto tranne HTTPS e SSH)

**Cosa fa:** Chiude tutte le porte del server tranne quelle strettamente necessarie: la 443 (HTTPS, per la piattaforma) e la 22 (SSH, per la manutenzione).

**Perche serve:** Un server espone di default decine di porte. Ogni porta aperta e un potenziale punto di ingresso. Il firewall blocca tutto il resto — il database (5432) e n8n (5678) restano invisibili dall'esterno.

```bash
# 1. Installa e attiva UFW (Uncomplicated Firewall)
sudo apt update && sudo apt install -y ufw

# 2. Regola base: blocca tutto in entrata, permetti tutto in uscita
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 3. Apri solo SSH (22) e HTTPS (443)
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 443/tcp comment 'HTTPS'

# 4. Attiva il firewall
sudo ufw enable

# 5. Verifica le regole
sudo ufw status verbose
```

Dovresti vedere:

```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere    # SSH
443/tcp                    ALLOW IN    Anywhere    # HTTPS
```

> **Nota:** Non apriamo la porta 3000 (Next.js) ne la 5432 (PostgreSQL) ne la 5678 (n8n).
> La piattaforma sara raggiungibile solo tramite il reverse proxy HTTPS sulla porta 443.

### Passo 4: Fail2ban (blocca chi tenta di entrare)

**Cosa fa:** Monitora i log del server e blocca automaticamente gli indirizzi IP che falliscono troppi tentativi di accesso SSH (3 tentativi sbagliati → ban di 1 ora).

**Perche serve:** Anche con la chiave SSH obbligatoria, i bot continuano a provare. Fail2ban li blocca a livello di IP, riducendo il rumore nei log e prevenendo attacchi distribuiti.

```bash
# 1. Installa
sudo apt install -y fail2ban

# 2. Crea configurazione personalizzata
sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log
EOF

# 3. Avvia e abilita all'avvio
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 4. Verifica che funzioni
sudo fail2ban-client status sshd
```

Parametri:
- `bantime = 3600` → IP bloccato per 1 ora (3600 secondi)
- `findtime = 600` → Finestra di osservazione: 10 minuti
- `maxretry = 3` → Dopo 3 tentativi falliti in 10 minuti → ban

### Passo 5: Aggiornamenti di sicurezza automatici

**Cosa fa:** Installa automaticamente le patch di sicurezza del sistema operativo senza intervento manuale.

**Perche serve:** Le vulnerabilita di sicurezza vengono scoperte continuamente. Se non aggiorni, il server diventa vulnerabile a exploit noti. Gli aggiornamenti automatici coprono le patch critiche senza che tu debba ricordarti di farlo.

```bash
# 1. Installa
sudo apt install -y unattended-upgrades

# 2. Abilita gli aggiornamenti automatici di sicurezza
sudo dpkg-reconfigure -plow unattended-upgrades
# Seleziona "Si" quando chiede se abilitare gli aggiornamenti automatici
```

### Passo 6: Reverse proxy con Caddy (HTTPS automatico)

**Cosa fa:** Caddy si mette davanti all'applicazione e gestisce due cose:
1. Prende il traffico sulla porta 443 (HTTPS) e lo inoltra a Docker sulla porta 3000
2. Ottiene e rinnova automaticamente il certificato SSL da Let's Encrypt

**Perche serve:** Senza HTTPS, le password e i dati viaggiano in chiaro su internet. Caddy rende tutto cifrato automaticamente — non devi configurare certificati a mano ne ricordarti di rinnovarli.

```bash
# 1. Installa Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# 2. Configura il reverse proxy
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
procurement.tuodominio.it {
    reverse_proxy localhost:3000
}
EOF
# Sostituisci "procurement.tuodominio.it" con il tuo dominio reale

# 3. Riavvia Caddy
sudo systemctl restart caddy
```

> **Prerequisito:** Il dominio deve puntare all'IP del server (record DNS di tipo A).
> Caddy ottiene il certificato SSL automaticamente al primo avvio — ci mette circa 30 secondi.

> **Se non hai ancora un dominio** e vuoi solo testare, puoi usare l'IP direttamente.
> In quel caso, configura Caddy cosi:
> ```
> :443 {
>     tls internal
>     reverse_proxy localhost:3000
> }
> ```
> Questo crea un certificato auto-firmato (il browser mostrera un avviso, ma la connessione e cifrata).

### Riepilogo sicurezza

> **Nota:** Il passo "Docker solo localhost" e gia stato configurato nella sezione 2, Passo 4.

| Protezione | Cosa blocca |
|------------|------------|
| **SSH con chiave** | Login con password rubata/indovinata |
| **Utente dedicato** | Danni da compromissione (no root) |
| **Firewall UFW** | Accesso a porte non necessarie |
| **Fail2ban** | Attacchi brute-force ripetuti |
| **Aggiornamenti auto** | Exploit su vulnerabilita note del sistema |
| **Caddy HTTPS** | Intercettazione dati in transito (man-in-the-middle) |
| **Docker solo localhost** | Accesso diretto ai servizi bypassando il firewall |

Con queste 7 protezioni attive, il server e significativamente piu sicuro della media dei VPS in circolazione.

---

## 3. Primo avvio

### Avvia tutti i servizi

Dal server (via SSH), nella cartella `/opt/procureflow/procureflow`:

```bash
cd /opt/procureflow/procureflow
docker compose up --build -d
```

**Cosa succede:**
1. Docker scarica le immagini necessarie (~2 minuti la prima volta)
2. Costruisce l'applicazione (~3-5 minuti)
3. Avvia 3 servizi: database (PostgreSQL), applicazione (Next.js), automazione (n8n)
4. Esegue le migrazioni del database
5. Carica i dati demo (se `SEED_ON_STARTUP=true`)

### Verifica che tutto funzioni

Aspetta 1-2 minuti dopo il comando, poi:

```bash
docker compose ps
```

Dovresti vedere 3 servizi con stato `Up` o `running`:

```
NAME                  STATUS
procureflow-db-1      Up (healthy)
procureflow-app-1     Up
procureflow-n8n-1     Up
```

### Verifica la salute dell'applicazione

Dal server, verifica che l'app risponda:

```bash
curl http://localhost:3000/api/health
```

Se vedi `{"status":"ok",...}` tutto funziona. Se vedi un errore, aspetta ancora 30 secondi e riprova.

Dal tuo browser, se hai gia configurato il dominio e Caddy (sezione 2b):

```
https://procurement.tuodominio.it/api/health
```

Se non hai ancora il dominio, l'app e raggiungibile solo dal server (localhost). Configura Caddy per esporla al pubblico.

---

## 4. Login e primi passi

### Apri ProcureFlow

Vai nel browser a: **https://procurement.tuodominio.it** (oppure `http://IP_DEL_SERVER:3000` se non hai ancora configurato il dominio)

### Utenti demo disponibili

Il sistema viene precaricato con 5 utenti. Usa queste credenziali per accedere:

| Ruolo | Email | Password | Cosa puo fare |
|-------|-------|----------|---------------|
| **Amministratore** | `marco.rossi@procureflow.it` | `admin123` | Tutto: gestione utenti, impostazioni, approvazioni, analytics |
| **Manager Acquisti** | `laura.bianchi@procureflow.it` | `password123` | Approvare richieste, gestire fornitori, vedere analytics |
| **Richiedente (Produzione)** | `giuseppe.verde@procureflow.it` | `password123` | Creare richieste d'acquisto, vedere le proprie richieste |
| **Richiedente (IT)** | `francesca.neri@procureflow.it` | `password123` | Creare richieste d'acquisto, vedere le proprie richieste |
| **Osservatore** | `alessio.conti@procureflow.it` | `password123` | Solo visualizzazione, nessuna modifica |

**Consiglio:** per la prima esplorazione, accedi come **Marco Rossi (admin)** — vedi tutto.

---

## 5. Test delle funzionalita

Per ogni sezione: cosa testare, dove trovarla, e cosa aspettarsi.

---

### 5.1 Dashboard

**Dove:** Pagina iniziale dopo il login (`http://localhost:3000`)

**Cosa vedere:**
- 4 card statistiche in alto (richieste attive, in attesa approvazione, ordini in corso, consegnati)
- Grafico andamento richieste nel tempo
- Lista richieste recenti
- Tab "Analisi" con metriche ROI sintetiche

**Test:**
1. Verifica che i numeri nelle card corrispondano ai dati demo
2. Clicca sulle tab (Panoramica, Analisi) — devono cambiare senza errori
3. Clicca su una richiesta dalla lista — deve aprire il dettaglio

---

### 5.2 Richieste d'acquisto

**Dove:** Menu laterale > "Richieste" (`http://localhost:3000/requests`)

**Test — visualizzazione:**
1. Vedi la lista delle richieste demo con stato, priorita, fornitore
2. Usa i **filtri** in alto: filtra per stato (es. "Approvate"), per priorita (es. "Alta")
3. Usa la **barra di ricerca**: cerca "carta" o "monitor" — devono apparire i risultati
4. Cambia la **vista**: clicca l'icona griglia per passare alla vista Kanban (colonne per stato)
5. Nella Kanban, verifica che tutte le richieste siano visibili su una sola pagina

**Test — creazione:**
1. Clicca **"Nuova Richiesta"**
2. Compila: Titolo = "Test stampante ufficio", Priorita = "Alta"
3. Aggiungi un articolo: Nome = "Stampante laser", Quantita = 1, Prezzo = 350
4. Salva — deve apparire nella lista con stato "Bozza"
5. Apri la richiesta creata — verifica che i dati siano corretti

**Test — dettaglio richiesta:**
1. Apri una richiesta esistente (es. clicca su una dalla lista)
2. Verifica: titolo, stato, fornitore, articoli, timeline degli eventi
3. Se lo stato lo permette, prova a cambiare stato (es. da Bozza a Inviata)

---

### 5.3 Fornitori

**Dove:** Menu laterale > "Fornitori" (`http://localhost:3000/vendors`)

**Test:**
1. Vedi la lista dei fornitori demo con nome, codice, stato, rating
2. Clicca su un fornitore per vedere il dettaglio
3. Nel dettaglio: verifica contatti, richieste associate, rating
4. Prova a creare un nuovo fornitore con il pulsante "Nuovo Fornitore"
5. Compila: Nome = "Test Forniture SRL", Codice = "TST-001", Email = "info@test.it"
6. Salva e verifica che appaia nella lista

---

### 5.4 Fatture e riconciliazione

**Dove:** Menu laterale > "Fatture" (`http://localhost:3000/invoices`)

**Test — visualizzazione:**
1. Vedi le fatture demo con numero, fornitore, importo, stato riconciliazione
2. Filtra per stato: "In attesa", "Riconciliate", "Con discrepanze"

**Test — caricamento fattura XML:**
1. Clicca **"Carica Fattura"**
2. Se hai un file XML di fattura elettronica italiana, caricalo
3. Il sistema dovrebbe: parsare il file, estrarre i dati, cercare il fornitore per P.IVA
4. Se il fornitore non esiste, ne crea uno automaticamente in stato "Da verificare"
5. Se la fattura corrisponde a un ordine, il matching avviene automaticamente

**Test — caricamento fattura PDF/immagine (richiede AI):**
1. Solo se hai configurato `ANTHROPIC_API_KEY` nel `.env`
2. Carica un PDF o foto di una fattura
3. L'AI analizza il documento e estrae i dati
4. Viene mostrata la confidenza dell'AI (es. 85%)

---

### 5.5 Approvazioni

**Dove:** Menu laterale > "Approvazioni" (`http://localhost:3000/approvals`)

**Test:**
1. Accedi come **Laura Bianchi** (manager) — dovrebbe vedere richieste in attesa
2. Apri un'approvazione pendente
3. Clicca **"Approva"** o **"Rifiuta"** con un commento
4. Verifica che lo stato della richiesta cambi di conseguenza
5. Accedi come **Marco Rossi** (admin) — verifica che veda la stessa approvazione con il nuovo stato

**Regole di auto-approvazione (preconfigurate nel seed):**
- Importo < 500 EUR → approvazione automatica
- Importo 500-5000 EUR → serve approvazione del manager
- Importo > 5000 EUR → serve approvazione del direttore

---

### 5.6 Budget

**Dove:** Menu laterale > "Budget" (`http://localhost:3000/budgets`)

**Test:**
1. Vedi i budget demo per dipartimento/centro di costo
2. Verifica: importo allocato, speso, disponibile, percentuale utilizzo
3. I budget con utilizzo alto (>80%) dovrebbero essere evidenziati in giallo/rosso

---

### 5.7 Inventario e magazzino

**Dove:** Menu laterale > "Materiali" (`http://localhost:3000/materials`)

**Test:**
1. Vedi la lista dei materiali demo con stock attuale, livello minimo
2. Materiali sotto il livello minimo dovrebbero essere evidenziati
3. Apri un materiale per vedere: lotti, movimenti, previsione WMA
4. La sezione "Forecast" mostra la proiezione di consumo per i prossimi 3 mesi
5. Se lo stock e basso, il sistema suggerisce un riordino

---

### 5.8 Analytics e ROI

**Dove:** Menu laterale > "Analytics" (`http://localhost:3000/analytics`)

**Test:**
1. Vedi 6 card di riepilogo: ciclo medio, tempo approvazione, savings, compliance, ecc.
2. Seleziona un **periodo** diverso (es. ultimo mese, ultimo trimestre)
3. Verifica i 4 grafici:
   - **Efficienza**: ciclo medio e tempo approvazione nel tempo
   - **Savings**: risparmi da negoziazione e compliance budget
   - **Automazione**: three-way matching e consegne puntuali
   - **Automazione email/fatture**: email processate, fatture SDI vs OCR, auto-riconciliazione
4. Clicca **"Esporta CSV"** — scarica un file con tutte le metriche
5. Apri il CSV con Excel/Numbers — verifica che contenga tutte le sezioni

---

### 5.9 AI Agent (Chat)

**Dove:** Icona chat in basso a destra (se configurato `ANTHROPIC_API_KEY`)

**Prerequisito:** Devi avere `ANTHROPIC_API_KEY=sk-ant-...` nel file `.env`

**Test:**
1. Clicca l'icona chat
2. Scrivi: "Quante richieste sono in attesa di approvazione?"
3. L'agente dovrebbe consultare il database e rispondere con il numero corretto
4. Scrivi: "Quali fornitori hanno il rating piu basso?"
5. L'agente usa tool-use per interrogare i dati e rispondere

**Se non hai la chiave API:** La chat non sara disponibile. Le altre funzionalita funzionano normalmente.

---

### 5.10 Impostazioni e sicurezza

**Dove:** Menu laterale > "Impostazioni" (`http://localhost:3000/settings`)

**Test — Profilo:**
1. Verifica i dati del profilo utente
2. Cambia il nome visualizzato e salva

**Test — Sicurezza (MFA):**
1. Vai su Impostazioni > Sicurezza
2. Clicca **"Attiva autenticazione a due fattori"**
3. Viene mostrato un QR code — scansionalo con un'app come Google Authenticator o Authy
4. Inserisci il codice a 6 cifre dall'app
5. Salva i **codici di recupero** mostrati (servono se perdi l'accesso all'app)
6. Al prossimo login, il sistema chiedera il codice oltre alla password

**Test — Moduli:**
1. Nella sezione Impostazioni, verifica quali moduli sono attivi/disattivi
2. Prova a disattivare un modulo (es. "Inventario") — le voci di menu corrispondenti spariscono

---

## 6. Test dell'automazione email (n8n)

n8n e il motore di automazione che processa le email dei fornitori.

### Accedere a n8n

Apri nel browser: **http://localhost:5678**

- Username: il valore di `N8N_USER` nel `.env` (default: `admin`)
- Password: il valore di `N8N_PASSWORD` nel `.env`

### Importare il workflow

1. In n8n, clicca **"Add workflow"** (o il pulsante +)
2. Clicca i tre puntini (...) in alto a destra > **"Import from file"**
3. Seleziona il file: `n8n/email-ingestion.json` (nella cartella del progetto)
4. Il workflow appare con 7 nodi collegati:

```
Gmail Trigger → Parsa Email → AI Parsing → Combina → Invia a ProcureFlow → Verifica → Log
```

### Configurare le credenziali

**Per far funzionare il workflow completo servono:**

| Credenziale | Dove configurarla | Note |
|-------------|-------------------|------|
| Gmail OAuth2 | n8n > Credentials > Gmail OAuth2 | Serve un account Google con Gmail API abilitata |
| OpenAI API | n8n > Credentials > OpenAI API | Per il parsing AI delle email |

**Se non hai queste credenziali**, puoi comunque testare il webhook manualmente (vedi sezione 7).

### Test senza credenziali Gmail/OpenAI

Puoi verificare che la connessione n8n → ProcureFlow funzioni senza configurare Gmail:

1. In n8n, apri il nodo **"Invia a ProcureFlow"**
2. Verifica che l'URL sia `http://app:3000/api/webhooks/email-ingestion`
3. Verifica che l'header Authorization contenga il webhook secret
4. Per un test manuale, usa il Terminale (vedi sezione 7)

---

## 7. Test dei webhook e integrazioni

I webhook sono le "porte" attraverso cui i sistemi esterni comunicano con ProcureFlow.
Puoi testarli tutti da Terminale senza bisogno di n8n, Gmail o altri servizi.

> **Prima di iniziare:** sostituisci `TUO-WEBHOOK-SECRET` in ogni comando con il valore di `N8N_WEBHOOK_SECRET` dal tuo file `.env`. Se hai usato le password di test suggerite sopra, il valore e `procureflow-webhook-secret-test`.

---

### 7.1 Creazione automatica RdA da email

**Cosa testa:** Un'email da un fornitore arriva nella casella, n8n la analizza con l'AI, e ProcureFlow crea automaticamente una richiesta d'acquisto completa di articoli, importi e fornitore.

**Come funziona nella realta:**
1. Il fornitore manda un'email (es. "Conferma ordine carta A4")
2. n8n intercetta l'email e la passa all'AI (GPT-4o-mini)
3. L'AI estrae: titolo, articoli, prezzi, fornitore, priorita
4. n8n invia questi dati a ProcureFlow via webhook
5. ProcureFlow crea la richiesta d'acquisto, associa il fornitore (o ne crea uno nuovo), e registra tutto nella timeline

**Test da Terminale:**

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-nuova-rda-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "ordini@fornitore-test.it",
    "email_subject": "Conferma ordine materiale ufficio",
    "email_body": "Confermiamo la ricezione del vostro ordine per 10 risme di carta A4 al prezzo di 5.50 EUR/risma e 5 confezioni di penne BIC a 3.20 EUR/conf. Consegna prevista entro 5 giorni lavorativi.",
    "action": "new_request",
    "ai_title": "Materiale ufficio — carta e penne",
    "ai_description": "Ordine confermato per cancelleria: carta A4 e penne",
    "ai_priority": "MEDIUM",
    "ai_vendor_name": "Cartoleria Moderna",
    "ai_category": "Cancelleria",
    "ai_department": "Amministrazione",
    "ai_estimated_amount": 71.00,
    "ai_currency": "EUR",
    "ai_needed_by": "2026-04-15",
    "ai_items": [
      {
        "name": "Carta A4 80g",
        "quantity": 10,
        "unit": "risma",
        "unit_price": 5.50,
        "total_price": 55.00
      },
      {
        "name": "Penne BIC Cristal blu",
        "quantity": 5,
        "unit": "confezione",
        "unit_price": 3.20,
        "total_price": 16.00
      }
    ],
    "ai_summary": "Ordine confermato per carta A4 (55 EUR) e penne BIC (16 EUR). Totale 71 EUR, consegna in 5gg.",
    "ai_confidence": 0.94,
    "ai_tags": ["cancelleria", "ufficio", "ordine-confermato"],
    "attachments": []
  }'
```

**Risultato atteso:**
```json
{
  "success": true,
  "data": {
    "action": "new_request",
    "request_code": "PR-2026-XXXXX",
    "items_created": 2,
    "status_updated": false,
    "ai_confidence": 0.94
  }
}
```

**Verifica in ProcureFlow:**
1. Vai su http://localhost:3000/requests
2. Cerca "Materiale ufficio" — deve apparire una nuova richiesta in stato **Bozza**
3. Apri la richiesta e verifica:
   - **Titolo**: "Materiale ufficio — carta e penne"
   - **Articoli**: 2 righe (Carta A4 e Penne BIC) con quantita e prezzi corretti
   - **Importo stimato**: 71,00 EUR
   - **Priorita**: Media
   - **Timeline**: evento "Richiesta creata da email" con mittente `ordini@fornitore-test.it`
4. Vai su http://localhost:3000/vendors — il fornitore **"Cartoleria Moderna"** e stato creato automaticamente in stato "Da verificare"

---

### 7.2 Aggiornamento automatico RdA da email fornitore

**Cosa testa:** Un fornitore invia un'email con un aggiornamento su un ordine esistente (es. "Il vostro ordine e stato spedito, ecco il tracking"). L'AI capisce che si riferisce a una richiesta gia presente e la aggiorna automaticamente.

**Come funziona nella realta:**
1. Il fornitore manda un'email tipo "Spedizione effettuata per ordine PR-2026-00001"
2. L'AI riconosce il codice della richiesta nel testo
3. ProcureFlow aggiorna automaticamente: stato → Spedito, numero tracking, data consegna prevista
4. Il richiedente riceve una notifica dell'aggiornamento

**Prerequisito:** Devi avere una richiesta esistente. Usa il codice della richiesta creata nel test 7.1 (es. `PR-2026-00042`). Sostituisci `PR-2026-XXXXX` nel comando con il codice reale.

**Test da Terminale:**

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-aggiornamento-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "spedizioni@fornitore-test.it",
    "email_subject": "[PR-2026-XXXXX] Spedizione effettuata",
    "email_body": "Vi informiamo che il vostro ordine PR-2026-XXXXX e stato spedito con corriere BRT. Numero tracking: BRT-12345678. Consegna prevista: 10 aprile 2026.",
    "action": "update_existing",
    "ai_matched_request_code": "PR-2026-XXXXX",
    "ai_status_update": "SHIPPED",
    "ai_tracking_number": "BRT-12345678",
    "ai_expected_delivery": "2026-04-10",
    "ai_summary": "Ordine spedito con BRT, tracking BRT-12345678, consegna prevista 10/04/2026.",
    "ai_confidence": 0.97,
    "ai_currency": "EUR",
    "ai_items": [],
    "ai_tags": ["spedizione", "tracking"],
    "attachments": []
  }'
```

**Risultato atteso:**
```json
{
  "success": true,
  "data": {
    "action": "update_existing",
    "request_code": "PR-2026-XXXXX",
    "items_created": 0,
    "status_updated": true,
    "ai_confidence": 0.97
  }
}
```

**Verifica in ProcureFlow:**
1. Apri la richiesta `PR-2026-XXXXX`
2. Lo **stato** e cambiato da "Bozza" a **"Spedito"**
3. Il campo **"Tracking"** mostra `BRT-12345678`
4. La **data di consegna prevista** e il 10 aprile 2026
5. Nella **timeline** c'e un nuovo evento: "Stato aggiornato a SHIPPED — Tracking: BRT-12345678 — Consegna prevista: 10/04/2026"
6. L'icona notifiche (campanella) mostra un avviso per il richiedente

**Test aggiuntivo — Conferma consegna:**

Simula l'email del fornitore che conferma la consegna avvenuta:

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-consegna-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "spedizioni@fornitore-test.it",
    "email_subject": "[PR-2026-XXXXX] Consegna completata",
    "email_body": "Confermiamo che la consegna per ordine PR-2026-XXXXX e stata effettuata in data odierna. Importo totale fatturato: 71.00 EUR.",
    "action": "update_existing",
    "ai_matched_request_code": "PR-2026-XXXXX",
    "ai_status_update": "DELIVERED",
    "ai_actual_amount": 71.00,
    "ai_summary": "Consegna completata. Importo fatturato: 71 EUR.",
    "ai_confidence": 0.95,
    "ai_currency": "EUR",
    "ai_items": [],
    "ai_tags": ["consegna-completata"],
    "attachments": []
  }'
```

**Verifica:** Lo stato ora e **"Consegnato"** e l'importo effettivo e 71,00 EUR.

---

### 7.3 Email informativa (solo log nella timeline)

**Cosa testa:** Un'email arriva che non richiede azioni ma contiene informazioni utili su un ordine esistente (es. "Vi ricordiamo che il nostro magazzino sara chiuso dal 14 al 18 aprile"). L'AI la classifica come "solo informazione" e la registra nella timeline.

**Test da Terminale:**

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-info-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "info@fornitore-test.it",
    "email_subject": "[PR-2026-XXXXX] Avviso chiusura magazzino",
    "email_body": "Gentile cliente, vi informiamo che il nostro magazzino sara chiuso dal 14 al 18 aprile per inventario. Gli ordini in corso non subiranno ritardi.",
    "action": "info_only",
    "ai_matched_request_code": "PR-2026-XXXXX",
    "ai_summary": "Fornitore avvisa chiusura magazzino 14-18 aprile. Nessun impatto sugli ordini in corso.",
    "ai_confidence": 0.88,
    "ai_currency": "EUR",
    "ai_items": [],
    "ai_tags": ["avviso", "chiusura"],
    "attachments": []
  }'
```

**Risultato atteso:**
```json
{
  "success": true,
  "data": {
    "action": "info_only",
    "request_code": "PR-2026-XXXXX",
    "items_created": 0,
    "status_updated": false
  }
}
```

**Verifica in ProcureFlow:**
1. Apri la richiesta — lo **stato NON cambia** (resta quello precedente)
2. Nella **timeline** c'e un nuovo evento tipo "Email informativa" con il riassunto dell'avviso
3. Nessun campo della richiesta viene modificato

---

### 7.4 Ricezione fattura SDI (Sistema di Interscambio)

**Cosa testa:** Una fattura elettronica arriva dal Sistema di Interscambio (SDI). ProcureFlow la processa automaticamente: parsing XML, deduplicazione, creazione record, matching con ordine esistente, riconciliazione three-way, e notifiche.

**Come funziona nella realta:**
1. Il fornitore emette una fattura elettronica (formato XML FatturaPA)
2. L'SDI la inoltra al tuo sistema (tramite provider o n8n)
3. ProcureFlow la parsa, cerca se corrisponde a un ordine esistente
4. Se trova un match: collega fattura → ordine, cambia stato a "Fatturato", esegue three-way matching
5. Se non trova match: la registra comunque e notifica gli admin

**Test da Terminale — Fattura senza ordine associato:**

```bash
curl -X POST http://localhost:3000/api/webhooks/sdi-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-sdi-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "event_type": "invoice_received",
    "sdi_id": "SDI-TEST-001",
    "sdi_filename": "IT12345678901_test1.xml",
    "sdi_status": "RECEIVED",
    "sender_vat_id": "IT12345678901",
    "sender_name": "Fornitore Demo SRL",
    "invoice_number": "FT-2026-001",
    "invoice_date": "2026-04-01",
    "document_type": "TD01",
    "total_taxable": 1000.00,
    "total_tax": 220.00,
    "total_amount": 1220.00,
    "currency": "EUR",
    "line_items": [
      {
        "description": "Servizio consulenza IT",
        "quantity": 1,
        "unit_of_measure": "ore",
        "unit_price": 1000.00,
        "total_price": 1000.00,
        "vat_rate": 22
      }
    ],
    "payment_method": "Bonifico bancario",
    "payment_iban": "IT60X0542811101000000123456",
    "payment_due_date": "2026-05-01"
  }'
```

**Risultato atteso:**
```json
{
  "success": true,
  "data": {
    "invoice_id": "...",
    "invoice_number": "FT-2026-001",
    "match_status": "UNMATCHED",
    "match_confidence": 0,
    "matched_request_id": null,
    "reconciliation": null,
    "deduplicated": false
  }
}
```

**Verifica in ProcureFlow:**
1. Vai su http://localhost:3000/invoices
2. Cerca "FT-2026-001" — la fattura e stata registrata
3. **Stato match**: "Non associata" (nessun ordine corrispondente trovato)
4. **Fornitore**: "Fornitore Demo SRL" creato automaticamente in stato "Da verificare"
5. Gli admin hanno ricevuto una **notifica**: "Fattura senza ordine: FT-2026-001"

**Test protezione duplicati SDI:**

Invia di nuovo la stessa fattura (stesso `sdi_id`):

```bash
curl -X POST http://localhost:3000/api/webhooks/sdi-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-sdi-dup-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "event_type": "invoice_received",
    "sdi_id": "SDI-TEST-001",
    "sdi_filename": "IT12345678901_test1.xml",
    "sender_vat_id": "IT12345678901",
    "sender_name": "Fornitore Demo SRL",
    "invoice_number": "FT-2026-001",
    "total_amount": 1220.00,
    "currency": "EUR",
    "line_items": []
  }'
```

**Risultato atteso:** `"deduplicated": true` — la fattura non viene creata una seconda volta.

---

### 7.5 Aggiornamento fornitore da sistema esterno

**Cosa testa:** Un sistema esterno (ERP, gestionale, portale fornitori) invia un aggiornamento sui dati di un fornitore. ProcureFlow lo recepisce e aggiorna l'anagrafica.

**Prerequisito:** Serve il **codice fornitore** di un vendor esistente. Puoi trovarlo nella pagina Fornitori — usa il codice di uno dei vendor demo (es. lo trovi nella colonna "Codice" della tabella).

Apri ProcureFlow > Fornitori e copia il codice di un fornitore (es. `TECH-001`). Sostituiscilo nel comando.

**Test da Terminale:**

```bash
curl -X POST http://localhost:3000/api/webhooks/vendor-update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-vendor-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "vendor_code": "CODICE-FORNITORE",
    "updates": {
      "email": "nuova-email@fornitore.it",
      "phone": "+39 02 1234567",
      "rating": 4.5
    }
  }'
```

**Risultato atteso:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "...",
    "code": "CODICE-FORNITORE",
    "email": "nuova-email@fornitore.it",
    "phone": "+39 02 1234567",
    "rating": 4.5
  }
}
```

**Verifica in ProcureFlow:**
1. Vai su Fornitori > apri il fornitore aggiornato
2. L'**email** e ora `nuova-email@fornitore.it`
3. Il **telefono** e `+39 02 1234567`
4. Il **rating** e 4.5

**Test cambio stato fornitore:**

```bash
curl -X POST http://localhost:3000/api/webhooks/vendor-update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-vendor-status-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "vendor_code": "CODICE-FORNITORE",
    "updates": {
      "status": "INACTIVE"
    }
  }'
```

**Verifica:** Lo stato del fornitore e ora "Inattivo". Stati validi: `ACTIVE`, `INACTIVE`, `BLACKLISTED`, `PENDING_REVIEW`.

---

### 7.6 Approvazione/Rifiuto via webhook

**Cosa testa:** Un sistema esterno (es. email con pulsante "Approva", app mobile, Slack bot) invia la decisione di un approvatore su una richiesta.

**Prerequisito:** Serve l'**ID di un'approvazione** in stato "In attesa". Per trovarlo:
1. Accedi come admin a ProcureFlow
2. Vai su una richiesta in stato "In attesa approvazione"
3. L'ID approvazione lo trovi nell'URL del dettaglio o tramite l'interfaccia

In alternativa, crea una nuova richiesta con importo > 500 EUR e inviala per approvazione.

**Test approvazione:**

```bash
curl -X POST http://localhost:3000/api/webhooks/approval-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-approval-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "approval_id": "ID-APPROVAZIONE",
    "action": "APPROVED",
    "comment": "Approvato — budget disponibile verificato"
  }'
```

**Verifica in ProcureFlow:**
1. L'approvazione risulta **"Approvata"** con il commento
2. Se era l'ultima approvazione necessaria, la richiesta cambia stato a **"Approvata"**
3. Nella timeline: evento "Approvazione: Approvata"

**Test rifiuto:**

```bash
curl -X POST http://localhost:3000/api/webhooks/approval-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-reject-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "approval_id": "ID-APPROVAZIONE",
    "action": "REJECTED",
    "comment": "Budget esaurito per questo trimestre"
  }'
```

**Verifica:** Se anche una sola approvazione e "Rifiutata", la richiesta passa a stato **"Rifiutata"**.

---

### 7.7 Auto-approvazione per soglia importo

**Cosa testa:** ProcureFlow approva automaticamente le richieste sotto una certa soglia di importo, senza intervento umano. Questo accelera gli acquisti di piccolo importo.

**Come funziona:**
- Importo **< 500 EUR** → approvazione automatica (per manager/admin)
- Importo **500 - 5.000 EUR** → serve approvazione del manager
- Importo **> 5.000 EUR** → serve approvazione del direttore

**Test: crea una richiesta da email con importo basso da un utente manager**

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-auto-approve-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "laura.bianchi@procureflow.it",
    "email_subject": "Ordine toner stampante",
    "email_body": "Ordino 2 toner per la stampante del reparto acquisti. Costo 45 EUR cadauno.",
    "action": "new_request",
    "ai_title": "Toner stampante reparto acquisti",
    "ai_priority": "LOW",
    "ai_vendor_name": "Office Depot",
    "ai_category": "Cancelleria",
    "ai_estimated_amount": 90.00,
    "ai_currency": "EUR",
    "ai_items": [
      {
        "name": "Toner HP 305A nero",
        "quantity": 2,
        "unit": "pz",
        "unit_price": 45.00,
        "total_price": 90.00
      }
    ],
    "ai_summary": "Ordine 2 toner HP 305A a 90 EUR totali.",
    "ai_confidence": 0.96,
    "ai_tags": ["cancelleria", "toner"],
    "attachments": []
  }'
```

**Risultato atteso:** `"status_updated": true` — la richiesta e stata **auto-approvata** perche:
1. L'email `laura.bianchi@procureflow.it` corrisponde a un utente con ruolo MANAGER
2. L'importo (90 EUR) e sotto la soglia di 500 EUR

**Verifica in ProcureFlow:**
1. Cerca "Toner stampante" nella lista richieste
2. Lo stato e direttamente **"Approvata"** (non passa per "Bozza" o "In attesa")
3. Nella timeline: "Auto-approvato per ruolo MANAGER"

---

### 7.8 Protezione duplicati (idempotenza)

**Cosa testa:** Se un webhook viene inviato due volte (es. per un errore di rete), ProcureFlow non crea duplicati. Usa l'header `x-webhook-id` per riconoscere i messaggi gia processati.

**Test:**

```bash
# Prima volta — crea la richiesta
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-idem-123" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{"email_from":"a@b.it","email_subject":"Test idempotenza","email_body":"Test","action":"new_request","ai_title":"Test Idempotenza","ai_items":[],"ai_tags":[],"ai_currency":"EUR","attachments":[]}'

# Seconda volta — stesso x-webhook-id, non crea duplicato
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: test-idem-123" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{"email_from":"a@b.it","email_subject":"Test idempotenza","email_body":"Test","action":"new_request","ai_title":"Test Idempotenza","ai_items":[],"ai_tags":[],"ai_currency":"EUR","attachments":[]}'
```

**Risultato atteso:** Entrambe le risposte sono **identiche**. La seconda chiamata non crea una nuova richiesta — risponde con i dati della prima. Nella lista richieste c'e un solo "Test Idempotenza".

---

### 7.9 Health check

Il controllo piu semplice — verifica che il sistema sia vivo:

```bash
curl http://localhost:3000/api/health
```

**Risultato atteso:** `{"status":"ok","timestamp":"...","uptime":...}`

---

### 7.10 Creazione automatica commessa da email cliente

**Cosa testa:** Quando un cliente invia un ordine via email, ProcureFlow crea automaticamente una **commessa** (job order) con le richieste d'acquisto suggerite dall'AI.

**Come funziona in produzione:** L'email del cliente arriva e n8n la analizza con l'AI. Se l'AI riconosce un ordine cliente (intent `ORDINE_CLIENTE`), il sistema:
1. Crea (o trova) il **cliente** nella rubrica
2. Crea una **commessa** con codice COM-YYYY-NNNNN
3. Crea una o piu **richieste d'acquisto suggerite** (in stato DRAFT) collegate alla commessa
4. Registra un evento nella timeline della commessa
5. Notifica i manager

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -d '{
    "email_from": "ordini@clienterossi.it",
    "email_subject": "Ordine per fornitura scaffalature magazzino",
    "email_body": "Buongiorno, vi inviamo ordine per: 20 scaffalature industriali 200x100cm, 50 ripiani aggiuntivi in acciaio, 10 kit montaggio con bulloneria. Consegna entro 2025-06-15. Budget indicativo 15000 EUR. Rif. Cliente: CLI-ROSSI-001",
    "email_date": "2025-04-05",
    "email_message_id": "<ordine-001@clienterossi.it>",
    "action": "create_commessa",
    "ai_title": "Fornitura scaffalature magazzino Rossi",
    "ai_description": "Ordine cliente per scaffalature industriali e accessori per magazzino",
    "ai_priority": "HIGH",
    "ai_category": "Arredamento industriale",
    "ai_department": "Logistica",
    "ai_client_name": "Rossi & C. Srl",
    "ai_client_code": "CLI-ROSSI-001",
    "ai_client_value": 15000,
    "ai_client_deadline": "2025-06-15",
    "ai_client_order_items": [
      { "description": "Scaffalature industriali 200x100cm", "quantity": 20, "unit": "pz" },
      { "description": "Ripiani aggiuntivi acciaio", "quantity": 50, "unit": "pz" },
      { "description": "Kit montaggio con bulloneria", "quantity": 10, "unit": "kit" }
    ],
    "ai_confidence": 0.93,
    "ai_summary": "Ordine cliente Rossi per fornitura scaffalature magazzino: 20 scaffalature, 50 ripiani, 10 kit montaggio. Budget 15000 EUR, consegna entro 15/06/2025.",
    "ai_tags": ["ai-classified", "ai-intent:ORDINE_CLIENTE", "cliente:rossi"],
    "ai_currency": "EUR",
    "ai_items": [],
    "attachments": []
  }'
```

**Risultato atteso (JSON):**

```json
{
  "success": true,
  "data": {
    "action": "create_commessa",
    "commessa_id": "...",
    "commessa_code": "COM-2025-00001",
    "suggested_prs_created": 3,
    "timeline_event_id": "...",
    "ai_confidence": 0.93,
    "deduplicated": false
  }
}
```

**Verifica nell'interfaccia:**

1. Vai alla pagina **Commesse** → trovi la commessa "COM-2025-00001" con stato **PLANNING**
2. Aprila → il cliente e "Rossi & C. Srl", il valore e 15.000 EUR, la deadline e 15/06/2025
3. Nella sezione "Richieste suggerite" trovi 3 RdA in stato DRAFT:
   - "Scaffalature industriali 200x100cm" (20 pz)
   - "Ripiani aggiuntivi acciaio" (50 pz)
   - "Kit montaggio con bulloneria" (10 kit)
4. Nella timeline della commessa c'e l'evento "Commessa creata da email cliente"
5. Il campanello notifiche mostra "Nuova commessa da email: COM-2025-00001"

> **Nota:** Le RdA suggerite hanno il tag `ai-suggested` e sono collegate alla commessa. Il responsabile puo accettarle (cambiano stato a SUBMITTED) o modificarle prima di procedere.

---

### 7.11 Classificazione AI email con creazione commessa

**Cosa testa:** L'endpoint di classificazione AI (`/classify`) riceve un'email grezza, la classifica automaticamente come ordine cliente, e crea la commessa senza pre-classificazione manuale.

**Come funziona in produzione:** A differenza del test 7.10 (dove l'AI ha gia classificato i dati), qui l'email arriva **grezza** — senza campi `ai_*`. L'AI di ProcureFlow (Claude) analizza il testo, estrae i dati del cliente e degli articoli, e poi crea la commessa automaticamente.

> **Prerequisito:** Serve la chiave API Anthropic configurata (variabile `ANTHROPIC_API_KEY` nel file `.env`). Se non e configurata, questo test restituira un errore 503.

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion/classify \
  -H "Content-Type: application/json" \
  -d '{
    "email_from": "acquisti@bianchi-srl.it",
    "email_to": "vendite@miazienda.it",
    "email_subject": "Ordine materiale elettrico - rif. progetto capannone",
    "email_body": "Spett.le Ditta,\n\ncon la presente vi ordiniamo il seguente materiale per il progetto capannone industriale:\n\n- 100 metri di cavo elettrico 3x2.5mm\n- 50 plafoniere LED 60W\n- 20 quadri elettrici 12 moduli\n- 30 interruttori differenziali 30mA\n\nPrezzo concordato: 8.500 EUR + IVA\nConsegna richiesta entro: 30/05/2025\n\nCodice cliente: BIANCHI-IND\n\nCordiali saluti,\nUfficio Acquisti\nBianchi Srl",
    "email_date": "2025-04-05",
    "email_message_id": "<ordine-bianchi-002@bianchi-srl.it>"
  }'
```

**Risultato atteso (JSON):**

```json
{
  "success": true,
  "data": {
    "classification": {
      "intent": "ORDINE_CLIENTE",
      "confidence": 0.90
    },
    "action_taken": true,
    "ingestion_result": {
      "action": "create_commessa",
      "commessa_code": "COM-2025-00002",
      "suggested_prs_created": 4
    }
  }
}
```

**Cosa ha fatto il sistema automaticamente:**
1. Claude ha letto l'email e identificato l'intent come ORDINE_CLIENTE
2. Ha estratto: nome cliente (Bianchi Srl), codice (BIANCHI-IND), 4 articoli, importo (8500 EUR), deadline (30/05/2025)
3. Ha creato la commessa COM-2025-00002 collegata al cliente Bianchi Srl
4. Ha creato 4 richieste d'acquisto suggerite (una per ogni riga dell'ordine)

> **Se non hai la chiave Anthropic:** Questo test e facoltativo. Il test 7.10 copre la stessa funzionalita ma con dati gia pre-classificati (non serve l'AI).

---

### 7.12 Associazione automatica RdA a commessa

**Cosa testa:** Quando una commessa viene creata da email (test 7.10), le RdA suggerite nascono **gia collegate** alla commessa. Qui verifichiamo come accettare o rifiutare i suggerimenti dell'AI.

**Prerequisito:** Esegui prima il test 7.10. Annota il `commessa_code` dalla risposta (es: `COM-2025-00001`).

#### Accettare un suggerimento

L'accettazione cambia lo stato della RdA da DRAFT a SUBMITTED e la conferma come richiesta reale:

```bash
curl -X POST http://localhost:3000/api/commesse/COM-2025-00001/accept-suggestion \
  -H "Content-Type: application/json" \
  -d '{ "suggestion_id": "ID_DELLA_RDA_SUGGERITA" }'
```

> **Come trovare l'ID:** Apri la commessa nell'interfaccia → sezione "Suggerimenti AI" → clicca sulla RdA → l'ID e nell'URL o nei dettagli.

**Risultato atteso:**

```json
{
  "success": true,
  "data": { "accepted": true, "request_id": "..." }
}
```

**Verifica:** La RdA passa da DRAFT a **SUBMITTED**. Nella timeline della commessa appare "Suggerimento accettato".

#### Modificare un suggerimento prima di accettarlo

Puoi cambiare titolo, importo stimato, fornitore o priorita di una RdA suggerita:

```bash
curl -X PATCH http://localhost:3000/api/commesse/COM-2025-00001/suggestions/ID_SUGGERIMENTO \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Scaffalature industriali 200x100cm (modificato)",
    "estimated_amount": 5500,
    "priority": "URGENT"
  }'
```

**Risultato atteso:** La RdA viene aggiornata mantenendo il collegamento alla commessa.

#### Rifiutare un suggerimento

Se l'AI ha suggerito una RdA non necessaria:

```bash
curl -X DELETE http://localhost:3000/api/commesse/COM-2025-00001/suggestions/ID_SUGGERIMENTO
```

**Risultato atteso:** `{ "success": true, "data": { "deleted": true } }`. La RdA viene eliminata. Nella timeline: "Suggerimento rifiutato".

---

### 7.13 Associazione manuale RdA a commessa

**Cosa testa:** Collegare una RdA esistente a una commessa manualmente, oppure creare una nuova RdA gia collegata.

#### Creare una RdA collegata a una commessa

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Vernice industriale per scaffalature",
    "description": "Vernice antiruggine per trattamento scaffalature commessa Rossi",
    "priority": "MEDIUM",
    "category": "Materiali di consumo",
    "department": "Produzione",
    "estimated_amount": 800,
    "commessa_id": "ID_DELLA_COMMESSA"
  }'
```

> **Come trovare l'ID commessa:** Vai alla pagina Commesse → apri la commessa → l'ID e nell'URL (es: `/commesse/clxyz123...`).

**Risultato atteso:** La RdA viene creata con stato DRAFT e appare nella sezione "Richieste collegate" della commessa.

#### Collegare una RdA esistente a una commessa

```bash
curl -X PATCH http://localhost:3000/api/requests/ID_DELLA_RDA \
  -H "Content-Type: application/json" \
  -d '{ "commessa_id": "ID_DELLA_COMMESSA" }'
```

**Risultato atteso:** La RdA viene collegata alla commessa. Il margine della commessa si aggiorna automaticamente.

#### Scollegare una RdA da una commessa

```bash
curl -X PATCH http://localhost:3000/api/requests/ID_DELLA_RDA \
  -H "Content-Type: application/json" \
  -d '{ "commessa_id": null }'
```

**Risultato atteso:** La RdA torna indipendente. Il margine della commessa viene ricalcolato senza quella RdA.

---

### 7.14 Creazione automatica clienti

**Cosa testa:** I clienti vengono creati automaticamente quando arriva un ordine via email da un cliente sconosciuto, oppure manualmente tramite API.

#### Creazione automatica (da email)

Questo avviene gia nel test 7.10: quando l'email contiene `ai_client_name` e `ai_client_code`, il sistema:
1. Cerca un cliente con quel codice
2. Se non lo trova, cerca per nome (fuzzy match)
3. Se non trova nulla, lo crea con stato **PENDING_REVIEW**

Per verificare che il cliente sia stato creato:

```bash
curl http://localhost:3000/api/clients
```

**Risultato atteso:** Nella lista trovi "Rossi & C. Srl" con `status: "PENDING_REVIEW"` e nota "Cliente creato automaticamente da email ingestion. Verificare i dati."

#### Creazione manuale

```bash
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Verdi Costruzioni SpA",
    "tax_id": "IT12345678901",
    "email": "info@verdicostruzioni.it",
    "phone": "+39 02 1234567",
    "address": "Via Roma 42, 20100 Milano",
    "contact_person": "Ing. Marco Verdi",
    "notes": "Cliente settore edile, pagamento 60gg DFFM"
  }'
```

**Risultato atteso:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "code": "CLI-0004",
    "name": "Verdi Costruzioni SpA",
    "status": "ACTIVE",
    "tax_id": "IT12345678901",
    "email": "info@verdicostruzioni.it"
  }
}
```

**Verifica:** Il cliente appare nella pagina Clienti con codice auto-generato `CLI-NNNN` e stato **ACTIVE**.

#### Modificare un cliente (es. confermare uno auto-creato)

```bash
curl -X PATCH http://localhost:3000/api/clients/ID_DEL_CLIENTE \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ACTIVE",
    "tax_id": "IT98765432101",
    "notes": "Dati verificati, cliente confermato"
  }'
```

**Risultato atteso:** Lo stato passa da PENDING_REVIEW ad **ACTIVE**.

---

### 7.15 Creazione e gestione articoli

**Cosa testa:** L'anagrafica articoli permette di creare codici interni, associare alias fornitore/cliente, e registrare prezzi storici.

#### Creare un articolo con alias

```bash
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Scaffalatura industriale 200x100cm",
    "unit_of_measure": "pz",
    "category": "Arredamento industriale",
    "manufacturer": "MetalRack Srl",
    "manufacturer_code": "MR-SHELF-200100",
    "tags": ["scaffalature", "magazzino"],
    "aliases": [
      {
        "alias_type": "VENDOR",
        "alias_code": "SHELF-200-100",
        "alias_label": "Codice fornitore TechSupply"
      },
      {
        "alias_type": "CLIENT",
        "alias_code": "SCAF-IND-001",
        "alias_label": "Codice cliente Rossi"
      }
    ]
  }'
```

**Risultato atteso:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "code": "ART-0001",
    "name": "Scaffalatura industriale 200x100cm",
    "unit_of_measure": "pz",
    "aliases_count": 2
  }
}
```

**Verifica:** Vai alla pagina Articoli → trovi "ART-0001" con 2 alias (uno fornitore, uno cliente).

#### Aggiungere un prezzo fornitore

```bash
curl -X POST http://localhost:3000/api/articles/ID_ARTICOLO/prices \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "ID_DEL_FORNITORE",
    "unit_price": 420.00,
    "currency": "EUR",
    "min_quantity": 5,
    "source": "quote",
    "notes": "Prezzo da preventivo del 01/04/2025"
  }'
```

**Risultato atteso:** Il prezzo viene registrato. Nella scheda articolo appare lo storico prezzi per fornitore.

#### Cercare un articolo (per nome, codice o alias)

```bash
curl "http://localhost:3000/api/articles/search?q=scaffalatura&limit=5"
```

**Risultato atteso:** Restituisce gli articoli che corrispondono, indicando anche **come** sono stati trovati (`matched_via: "name"`, `"alias"`, `"code"`, o `"manufacturer_code"`).

---

### 7.16 Import massivo articoli da CSV

**Cosa testa:** L'importazione di centinaia di articoli da un file CSV, con creazione automatica di alias e risoluzione dei fornitori per nome.

> **Prerequisito:** Devi essere loggato come ADMIN.

```bash
curl -X POST http://localhost:3000/api/articles/import \
  -H "Content-Type: application/json" \
  -d '{
    "rows": [
      {
        "codice_interno": "TRAVE-HEA200",
        "nome": "Trave HEA 200",
        "um": "m",
        "categoria": "Strutture metalliche",
        "produttore": "ArcelorMittal",
        "codice_produttore": "AM-HEA200",
        "tipo_alias": "vendor",
        "codice_alias": "HEA200-6M",
        "entita": "TechSupply Srl"
      },
      {
        "codice_interno": "TRAVE-HEA200",
        "nome": "Trave HEA 200",
        "um": "m",
        "tipo_alias": "client",
        "codice_alias": "TR-HEA-200",
        "entita": "Rossi & C. Srl"
      },
      {
        "codice_interno": "PIASTRA-ANC",
        "nome": "Piastra di ancoraggio 200x200mm",
        "um": "pz",
        "categoria": "Ferramenta",
        "produttore": "FerroItalia",
        "codice_produttore": "FI-PA-200"
      }
    ]
  }'
```

**Come funziona:**
- Le righe con lo stesso `codice_interno` vengono raggruppate: si crea un solo articolo con piu alias
- Il campo `entita` viene risolto cercando il fornitore/cliente per nome (fuzzy match)
- Se l'articolo esiste gia (stesso `codice_produttore`), vengono aggiunti solo i nuovi alias
- Massimo 10.000 righe per importazione

**Risultato atteso:**

```json
{
  "success": true,
  "data": {
    "articles_created": 2,
    "aliases_created": 2,
    "skipped": 0,
    "errors": []
  }
}
```

**Verifica:** Nella pagina Articoli trovi "ART-0002 - Trave HEA 200" con 2 alias (vendor TechSupply + client Rossi) e "ART-0003 - Piastra di ancoraggio" senza alias.

---

## 8. Test end-to-end: flusso completo ordine

Due scenari completi che puoi testare in sequenza. Il primo copre il flusso classico di acquisto, il secondo il flusso commessa (ordine da cliente).

### 8a. Flusso acquisto (RdA → Fattura)

Questo test simula un **ciclo di vita completo** di un ordine, dall'email del fornitore fino alla riconciliazione della fattura. Eseguilo nell'ordine — ogni passo dipende dal precedente.

### Passo 1: Arriva un'email → Creazione RdA

Un dipendente riceve un'offerta da un fornitore. L'email viene processata e diventa una richiesta.

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: e2e-step1-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "laura.bianchi@procureflow.it",
    "email_subject": "Offerta monitor Dell 27 pollici",
    "email_body": "Buongiorno, confermiamo disponibilita per 3 monitor Dell P2723QE a 420 EUR cadauno. Consegna in 7 giorni lavorativi.",
    "action": "new_request",
    "ai_title": "Monitor Dell P2723QE per ufficio IT",
    "ai_priority": "HIGH",
    "ai_vendor_name": "Dell Technologies",
    "ai_category": "Hardware IT",
    "ai_department": "IT",
    "ai_estimated_amount": 1260.00,
    "ai_needed_by": "2026-04-20",
    "ai_currency": "EUR",
    "ai_items": [
      {
        "name": "Monitor Dell P2723QE 27\" 4K USB-C",
        "quantity": 3,
        "unit": "pz",
        "unit_price": 420.00,
        "total_price": 1260.00,
        "sku": "P2723QE"
      }
    ],
    "ai_summary": "Offerta per 3 monitor Dell 4K a 1260 EUR totali, consegna 7gg.",
    "ai_confidence": 0.95,
    "ai_tags": ["hardware", "monitor", "it"],
    "attachments": []
  }'
```

**Cosa succede:** La richiesta viene creata con importo 1.260 EUR. Poiche Laura e MANAGER ma l'importo supera 500 EUR, la richiesta va in **approvazione** (non auto-approvata).

**Annota il codice richiesta** dalla risposta (es. `PR-2026-00043`).

### Passo 2: Approvazione del manager

Accedi a ProcureFlow come admin (`marco.rossi@procureflow.it`), vai su Approvazioni, e approva la richiesta. In alternativa, trova l'ID approvazione e usa il webhook:

```bash
curl -X POST http://localhost:3000/api/webhooks/approval-response \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: e2e-step2-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "approval_id": "ID-APPROVAZIONE",
    "action": "APPROVED",
    "comment": "Budget IT disponibile, approvato"
  }'
```

**Verifica:** La richiesta passa a stato **"Approvata"**.

### Passo 3: Il fornitore conferma la spedizione

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: e2e-step3-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "logistica@dell.com",
    "email_subject": "[PR-2026-XXXXX] Spedizione confermata",
    "email_body": "I monitor Dell P2723QE sono stati spediti. Tracking DHL: DHL-9876543210. Consegna prevista 15 aprile.",
    "action": "update_existing",
    "ai_matched_request_code": "PR-2026-XXXXX",
    "ai_status_update": "SHIPPED",
    "ai_tracking_number": "DHL-9876543210",
    "ai_expected_delivery": "2026-04-15",
    "ai_summary": "Monitor spediti con DHL, consegna prevista 15/04.",
    "ai_confidence": 0.98,
    "ai_currency": "EUR",
    "ai_items": [],
    "ai_tags": ["spedizione"],
    "attachments": []
  }'
```

**Verifica:** Stato → **"Spedito"**, tracking aggiornato, data consegna prevista impostata.

### Passo 4: Consegna avvenuta

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: e2e-step4-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "email_from": "logistica@dell.com",
    "email_subject": "[PR-2026-XXXXX] Consegna effettuata",
    "email_body": "La consegna dei 3 monitor e stata completata oggi.",
    "action": "update_existing",
    "ai_matched_request_code": "PR-2026-XXXXX",
    "ai_status_update": "DELIVERED",
    "ai_actual_amount": 1260.00,
    "ai_summary": "Consegna completata per 3 monitor Dell.",
    "ai_confidence": 0.96,
    "ai_currency": "EUR",
    "ai_items": [],
    "ai_tags": ["consegna"],
    "attachments": []
  }'
```

**Verifica:** Stato → **"Consegnato"**, importo effettivo aggiornato.

### Passo 5: Arriva la fattura SDI

Il fornitore emette la fattura elettronica, che arriva via SDI:

```bash
curl -X POST http://localhost:3000/api/webhooks/sdi-invoice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TUO-WEBHOOK-SECRET" \
  -H "x-webhook-id: e2e-step5-$(date +%s)" \
  -H "x-webhook-timestamp: $(date +%s)" \
  -d '{
    "event_type": "invoice_received",
    "sdi_id": "SDI-E2E-TEST-001",
    "sdi_filename": "IT00488410010_e2e01.xml",
    "sdi_status": "RECEIVED",
    "sender_vat_id": "IT00488410010",
    "sender_name": "Dell Technologies Italia SRL",
    "invoice_number": "FT-DELL-2026-001",
    "invoice_date": "2026-04-15",
    "document_type": "TD01",
    "total_taxable": 1260.00,
    "total_tax": 277.20,
    "total_amount": 1537.20,
    "currency": "EUR",
    "line_items": [
      {
        "description": "Monitor Dell P2723QE 27\" 4K USB-C",
        "quantity": 3,
        "unit_of_measure": "pz",
        "unit_price": 420.00,
        "total_price": 1260.00,
        "vat_rate": 22
      }
    ],
    "payment_method": "Bonifico bancario 30gg DFFM",
    "payment_iban": "IT60X0542811101000000654321",
    "payment_due_date": "2026-05-31"
  }'
```

**Verifica in ProcureFlow:**
1. Vai su **Fatture** — la fattura FT-DELL-2026-001 e stata registrata
2. Se il sistema ha trovato un match con la richiesta dei monitor:
   - La fattura mostra **"Auto-matched"** con la richiesta
   - La richiesta passa a stato **"Fatturato"**
   - Il **three-way matching** confronta: ordine (1.260 EUR) vs fattura (1.537,20 EUR IVA inclusa)
3. Se non ha trovato un match automatico: gli admin ricevono una notifica per associare manualmente

### Riepilogo del ciclo

Apri la richiesta e guarda la **timeline completa**. Dovresti vedere 5+ eventi:

| # | Evento | Fonte |
|---|--------|-------|
| 1 | Richiesta creata da email | Email ingestion |
| 2 | Approvazione | Manager/Webhook |
| 3 | Stato → Spedito + tracking | Email fornitore |
| 4 | Stato → Consegnato | Email fornitore |
| 5 | Fattura ricevuta e associata | SDI |

Questo e il flusso che nella vita reale richiederebbe settimane di lavoro manuale — ProcureFlow lo gestisce automaticamente grazie alle email e al Sistema di Interscambio.

---

### 8b. Flusso commessa (Email cliente → Commessa → RdA)

Questo test simula il flusso quando un **cliente** invia un ordine: ProcureFlow crea la commessa, le richieste d'acquisto suggerite, e il responsabile le approva.

### Passo 1: Arriva l'ordine del cliente → Creazione commessa

Un cliente invia un ordine via email. L'AI lo classifica e crea automaticamente la commessa con le RdA suggerite.

```bash
curl -X POST http://localhost:3000/api/webhooks/email-ingestion \
  -H "Content-Type: application/json" \
  -H "x-webhook-id: e2e-commessa-step1-$(date +%s)" \
  -d '{
    "email_from": "acquisti@metalworks.it",
    "email_subject": "Ordine strutture metalliche per capannone",
    "email_body": "Ordiniamo: 10 travi HEA 200 da 6m, 30 piastre di ancoraggio, 5 colonne HEB 240 da 4m. Consegna entro 20/07/2025. Budget 22000 EUR.",
    "email_date": "2025-04-05",
    "email_message_id": "<e2e-commessa-001@metalworks.it>",
    "action": "create_commessa",
    "ai_title": "Strutture metalliche capannone MetalWorks",
    "ai_priority": "HIGH",
    "ai_category": "Strutture metalliche",
    "ai_department": "Produzione",
    "ai_client_name": "MetalWorks Srl",
    "ai_client_code": "CLI-METALWORKS",
    "ai_client_value": 22000,
    "ai_client_deadline": "2025-07-20",
    "ai_client_order_items": [
      { "description": "Travi HEA 200 da 6m", "quantity": 10, "unit": "pz" },
      { "description": "Piastre di ancoraggio", "quantity": 30, "unit": "pz" },
      { "description": "Colonne HEB 240 da 4m", "quantity": 5, "unit": "pz" }
    ],
    "ai_confidence": 0.95,
    "ai_summary": "Ordine cliente MetalWorks per strutture metalliche capannone industriale.",
    "ai_tags": ["ai-classified", "ai-intent:ORDINE_CLIENTE"],
    "ai_currency": "EUR",
    "ai_items": [],
    "attachments": []
  }'
```

**Risultato atteso:** La commessa viene creata con codice COM-YYYY-NNNNN. Annota il `commessa_code` dalla risposta (ti servira ai passi successivi).

**Verifica:** Vai alla pagina Commesse → trovi la commessa con stato PLANNING e 3 RdA suggerite collegate.

### Passo 2: Accetta le RdA suggerite

Il responsabile esamina le richieste suggerite dall'AI e le accetta. Questo le porta dallo stato DRAFT a SUBMITTED, pronte per approvazione.

Usa il codice commessa ricevuto al Passo 1 (esempio: `COM-2025-00003`):

```bash
curl -X POST http://localhost:3000/api/commesse/COM-2025-00003/accept-suggestion \
  -H "Content-Type: application/json"
```

**Verifica:** Le 3 RdA nella commessa ora hanno stato **SUBMITTED** (non piu DRAFT). Nella timeline della commessa c'e un nuovo evento "Suggerimenti accettati".

### Passo 3: Approva le RdA collegate

Il manager approva le richieste d'acquisto per procedere con gli ordini ai fornitori. Usa gli `approval_id` delle RdA create:

```bash
# Approva le RdA — sostituisci APPROVAL_ID con l'ID reale dall'interfaccia
curl -X POST http://localhost:3000/api/webhooks/approval-response \
  -H "Content-Type: application/json" \
  -H "x-webhook-id: e2e-commessa-step3-$(date +%s)" \
  -d '{
    "approval_id": "APPROVAL_ID",
    "action": "APPROVED",
    "comment": "Approvato — materiale necessario per commessa MetalWorks"
  }'
```

**Verifica:** Le RdA passano a stato **APPROVED**. Nella commessa il progresso mostra le richieste approvate.

### Passo 4: Verifica il riepilogo completo

Apri la commessa nell'interfaccia e controlla:

| Elemento | Valore atteso |
|----------|---------------|
| **Stato commessa** | PLANNING |
| **Cliente** | MetalWorks Srl |
| **Valore cliente** | 22.000 EUR |
| **Deadline** | 20/07/2025 |
| **RdA collegate** | 3 (tutte APPROVED) |
| **Timeline** | 3+ eventi (creazione, accettazione suggerimenti, approvazioni) |

> **Differenza chiave rispetto al flusso 8a:** Nel flusso acquisto il sistema riceve email dal fornitore e crea RdA interne. Nel flusso commessa il sistema riceve un ordine dal **cliente** e genera la commessa con le RdA necessarie per evaderlo. La commessa aggrega piu richieste, traccia il margine e la deadline verso il cliente.

---

## 9. Gestione del server

> Tutti i comandi vanno eseguiti via SSH sul server: `ssh procureflow@IP_DEL_SERVER`

### Spegnere tutto

```bash
cd /opt/procureflow/procureflow
docker compose down
```

I dati nel database vengono **mantenuti** (salvati nel volume Docker).

### Riavviare

```bash
cd /opt/procureflow/procureflow
docker compose up -d
```

Non serve `--build` a meno che tu non abbia modificato il codice.

> **Nota:** Grazie a `restart: unless-stopped` nel docker-compose, se il server viene riavviato (es. dopo un aggiornamento di sistema), i servizi ripartono automaticamente con Docker.

### Aggiornare l'applicazione

Quando c'e una nuova versione:

```bash
cd /opt/procureflow/procureflow
git pull origin main
docker compose up --build -d
```

L'applicazione sara offline per 2-3 minuti durante la build. I dati nel database non vengono toccati.

### Ripartire da zero (cancella tutti i dati)

```bash
docker compose down -v
```

Il flag `-v` cancella i volumi (database). Al prossimo avvio, se `SEED_ON_STARTUP=true`, i dati demo vengono ricaricati.

> **Attenzione:** In produzione, `docker compose down -v` cancella TUTTI i dati del cliente. Usalo solo in ambiente di test.

### Backup manuale del database

```bash
docker compose exec db pg_dump -U procureflow procureflow > backup-$(date +%Y%m%d).sql
```

Per ripristinare un backup:

```bash
docker compose exec -T db psql -U procureflow procureflow < backup-20260407.sql
```

### Vedere i log in tempo reale

```bash
# Tutti i servizi
docker compose logs -f

# Solo l'applicazione
docker compose logs -f app

# Solo il database
docker compose logs -f db

# Solo n8n
docker compose logs -f n8n
```

Premi `Ctrl + C` per uscire dai log.

---

## 10. Problemi comuni

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| **Il sito non si apre** (https://dominio) | Caddy non e configurato o il DNS non punta al server | Verifica: `sudo systemctl status caddy` e che il record DNS A punti all'IP del server |
| **Errore "Set NEXTAUTH_SECRET"** | Manca la variabile nel `.env` | Apri `.env` e aggiungi `NEXTAUTH_SECRET=una-stringa-lunga` |
| **Login fallisce con credenziali corrette** | Il seed non e stato eseguito | Controlla i log: `docker compose logs app`. Se dice "Seed failed", prova `docker compose down -v` e riavvia |
| **"Database connection failed"** su /api/health | PostgreSQL non e pronto | Aspetta 30 secondi. Se persiste: `docker compose restart db` |
| **Webhook restituisce 401** | Secret non corrispondente | Verifica che `N8N_WEBHOOK_SECRET` nel `.env` corrisponda al Bearer token usato nel curl |
| **"Module not enabled"** su una pagina | Il modulo e disattivato | Vai su Impostazioni > Moduli e attivalo |
| **AI Agent non risponde** | Manca `ANTHROPIC_API_KEY` | Aggiungi la chiave API Anthropic nel `.env` e riavvia: `docker compose restart app` |
| **Fattura PDF rifiutata** | Manca `ANTHROPIC_API_KEY` | Il parsing AI delle fatture non-XML richiede Claude. Usa fatture XML come alternativa |
| **Build Docker fallisce** | Cache corrotta | Prova: `docker compose build --no-cache` |
| **Tutto funzionava, ora non parte** | Aggiornamento Docker o spazio disco | Libera spazio: `docker system prune` (attenzione: cancella container fermi) |
| **Non riesco a connettermi via SSH** | IP bloccato da Fail2ban o chiave SSH sbagliata | Usa la console di emergenza dal pannello Aruba. Verifica: `sudo fail2ban-client status sshd` |
| **Certificato HTTPS non funziona** | DNS non ancora propagato | Aspetta fino a 24 ore. Verifica: `dig procurement.tuodominio.it` deve restituire l'IP del server |
| **Spazio disco esaurito** | Log o immagini Docker accumulate | `docker system prune` per pulire. `df -h` per verificare lo spazio |

### Serve aiuto?

- Connettiti al server: `ssh procureflow@IP_DEL_SERVER`
- Controlla i log: `docker compose logs -f` mostra cosa succede in tempo reale
- Riparti da zero: `docker compose down -v && docker compose up --build -d`
- Verifica lo stato di Caddy: `sudo systemctl status caddy`
- Verifica il firewall: `sudo ufw status`

---

## Riepilogo URL

| Servizio | URL pubblico | URL interno (dal server) | Note |
|----------|-------------|-------------------------|------|
| **ProcureFlow** | https://procurement.tuodominio.it | http://localhost:3000 | Applicazione principale |
| **Health Check** | https://procurement.tuodominio.it/api/health | http://localhost:3000/api/health | Stato del sistema |
| **n8n** | Non esposto (solo dal server) | http://localhost:5678 | Automazione workflow — accessibile solo via SSH tunnel |
| **PostgreSQL** | Non esposto | localhost:5432 | Database — accessibile solo dal server |

### Accedere a n8n da remoto (SSH tunnel)

n8n non e esposto su internet per sicurezza. Per accedervi dal tuo browser:

```bash
# Dal tuo PC locale, crea un tunnel SSH
ssh -L 5678:localhost:5678 procureflow@IP_DEL_SERVER
```

Poi apri nel browser: `http://localhost:5678` — il traffico passa attraverso il tunnel cifrato SSH.

### Costi infrastruttura

| Voce | Costo |
|------|-------|
| VPS Aruba Cloud (4GB RAM, 2 vCPU, 80GB SSD) | ~8-12 EUR/mese |
| Backup automatico (snapshot giornaliero) | ~2-3 EUR/mese |
| Dominio (opzionale) | ~10-15 EUR/anno |
| Certificato SSL (Let's Encrypt via Caddy) | Gratuito |
| AI (Anthropic API, opzionale) | 0-25 EUR/mese (a consumo) |
| **Totale senza AI** | **~12-16 EUR/mese** |
| **Totale con AI** | **~20-40 EUR/mese** |
