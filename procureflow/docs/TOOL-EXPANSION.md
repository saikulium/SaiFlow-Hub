# Tool Layer Expansion — Documentazione Completa

Data: 16 aprile 2026
Commit: `c411ee0` (tools) + `88260a7` (prompt)

---

## Perche questa modifica

I 7 agenti Claude di ProcureFlow avevano solo 25 tool disponibili. Questo creava gap concreti:

- **Il chat assistant poteva creare e approvare una RDA, ma non cancellarla, rifiutarla, metterla in attesa, o marcarla come consegnata.** L'operatore doveva uscire dalla chat e usare la UI per completare il flusso.
- **Zero tool per gestire approvazioni in coda.** L'agente non poteva mostrare "hai 3 approvazioni pending" ne permettere di approvarle/rifiutarle dalla chat.
- **Il modulo Gare era quasi scoperto.** L'agente tender-analysis produceva un JSON ma non lo salvava nel DB. Nessun tool per aggiornare stato gare o registrare decisioni Go/No-Go.
- **Smart-reorder rischiava riordini doppi.** Non poteva verificare se per un materiale c'erano gia ordini pending prima di crearne uno nuovo.
- **Invoice-reconciliation confrontava importi "a mano"** invece di usare il service `performThreeWayMatch` gia esistente.
- **Nessun tool per commenti, allegati, timeline, budget list, stock granulare.**

---

## Prima vs Dopo

### Numeri

| Metrica | Prima | Dopo | Delta |
|---|---|---|---|
| Tool totali | 25 | ~55 | +30 |
| Tool esposti al chat assistant | 25 | 34 | +9 nuovi WRITE + tool READ |
| Tool agent-only (autonomi) | 0 | ~21 | +21 |
| File tool | 8 | 15 | +7 nuovi file |
| Test agenti | ~45 | 81 | +36 |
| Test totali progetto | 543 | 555 | +12 |
| Righe codice tool layer | ~2800 | ~5400 | +2589 |
| Aree funzionali coperte | 6 | 11 | +5 |

### Copertura per area funzionale

| Area | Prima | Dopo |
|---|---|---|
| **Richieste d'acquisto** | search, detail, create, approve | + cancel, submit, reject, hold/resume, mark_ordered, mark_delivered, timeline, comments, attachments |
| **Approvazioni** | Solo approve_request (diretto) | + list_pending, get_detail, decide_approval (approve O reject) |
| **Fornitori** | search, find_or_create | + update_vendor (status, rating, notes, payment_terms, category) |
| **Fatture** | detail, search, stats, match, reconcile | + dispute_invoice (strutturato), perform_three_way_match (wrapper service) |
| **Gare d'appalto** | Solo get_tender_stats | + create, detail, update_status, go/no-go decision, save_analysis |
| **Commesse** | search, create | + update_commessa_status |
| **Budget** | Solo get_budget_overview (aggregato) | + list_budgets (con snapshot dettagliato per centro di costo) |
| **Magazzino/Stock** | alerts, forecast, price_history | + get_stock_for_article, get_pending_orders, create_material, update_stock_levels, set_preferred_vendor |
| **Commenti** | Nessuno | add_comment (wraps service + @mentions), list_comments |
| **Allegati** | Nessuno | add_attachment (wraps service + timeline), list_attachments |
| **Timeline** | Solo create_timeline_event (write) | + get_request_timeline (read) |

### Workflow ora completabili dalla chat

**Prima**: l'operatore poteva solo chiedere informazioni e creare/approvare RDA.

**Dopo**: l'operatore puo gestire l'intero ciclo di vita dalla chat:

```
"Crea una RDA per 10 connettori MIL-SPEC"
  → create_request (dialog conferma)

"Invia per approvazione"
  → submit_for_approval (policy auto-tier)

"Mostrami le approvazioni in attesa"
  → list_pending_approvals

"Approva la PR-2026-00042"
  → decide_approval (dialog conferma)

"Marca come ordinata, ref fornitore PO-12345"
  → mark_ordered (dialog conferma)

"L'ordine e arrivato, importo effettivo 4.800 EUR"
  → mark_delivered (dialog conferma)

"La fattura non quadra, il fornitore ha fatturato 300 pz a 15.50 ma l'ordine era a 14.80"
  → dispute_invoice (dialog conferma)

"Metti in attesa la PR-2026-00050, aspettiamo budget Q3"
  → put_request_on_hold (dialog conferma)

"Annulla la PR-2026-00051, duplicata"
  → cancel_request (dialog conferma)

"Quanto stock abbiamo del connettore MS3106A?"
  → get_stock_for_article

"Aggiorna il rating di Amphenol a 4.5"
  → update_vendor (dialog conferma)

"Mostrami i budget IT disponibili"
  → list_budgets

"Qual e lo stato della gara GARA-2026-00003?"
  → get_tender_detail

"Registra decisione GO sulla gara, score 78, note: margine buono"
  → decide_tender_go_nogo (dialog conferma)
```

---

## Architettura: due pattern per WRITE tool

### Pattern 1: WRITE-intercepted (chat assistant)

Usato quando l'utente e nel loop e deve confermare prima dell'esecuzione.

```
User: "Annulla PR-2026-00042"
  |
  v
Chat Agent chiama cancel_request(code: "PR-2026-00042")
  |
  v
isWriteTool("cancel_request") → true (via TOOL_META)
  |
  v
storePendingAction() → salva params + genera preview
  |
  v
yield action_request → UI mostra dialog di conferma
  |
  v
User clicca "Conferma"
  |
  v
/api/chat/confirm → executeWriteTool("cancel_request", params, userId)
  |
  v
WRITE_EXECUTORS["cancel_request"](params, userId)
  |
  v
assertTransition(current, 'CANCELLED') → DB update + timeline + notification
```

**Tool con questo pattern** (15 totali):
cancel_request, submit_for_approval, reject_request, put_request_on_hold, resume_request, mark_ordered, mark_delivered, decide_approval, update_commessa_status, update_vendor, update_tender_status, decide_tender_go_nogo, dispute_invoice, add_comment, add_attachment

### Pattern 2: WRITE-direct (agent autonomi)

Usato quando l'agente opera senza utente nel loop (email processing, reorder automatico, tender analysis).

```
Email Intelligence Agent riceve email conferma consegna
  |
  v
toolRunner chiama mark_delivered(code: "PR-2026-00042")
  |
  v
run() esegue direttamente: DB update + timeline + notification
  |
  v
Risultato JSON ritornato al toolRunner → agente continua
```

**Tool con questo pattern** (8 totali):
create_tender, save_tender_analysis, perform_three_way_match, create_material, update_material_stock_levels, set_preferred_vendor, find_or_create_vendor, find_or_create_client, find_or_create_article

---

## File creati

### Nuovi file tool (7)

| File | Tool | Linee |
|---|---|---|
| `src/server/agents/tools/request-status.tools.ts` | 7 tool PR lifecycle | ~170 |
| `src/server/agents/tools/approval.tools.ts` | 3 tool approvazioni | ~120 |
| `src/server/agents/tools/tender.tools.ts` | 5 tool gare | ~280 |
| `src/server/agents/tools/comment.tools.ts` | 2 tool commenti | ~60 |
| `src/server/agents/tools/attachment.tools.ts` | 2 tool allegati | ~50 |
| `src/server/agents/tools/budget.tools.ts` | 1 tool budget list | ~100 |
| `src/server/agents/tools/stock.tools.ts` | 2 tool stock granulare | ~200 |

### Nuovi file test (7)

| File | Test count |
|---|---|
| `tests/server/agents/tools/request-status.tools.test.ts` | 2 |
| `tests/server/agents/tools/approval.tools.test.ts` | 2 |
| `tests/server/agents/tools/tender.tools.test.ts` | 2 |
| `tests/server/agents/tools/comment.tools.test.ts` | 2 |
| `tests/server/agents/tools/attachment.tools.test.ts` | 2 |
| `tests/server/agents/tools/budget.tools.test.ts` | 1 |
| `tests/server/agents/tools/stock.tools.test.ts` | 1 |

### File modificati (6)

| File | Cosa aggiunto |
|---|---|
| `src/server/agents/tools/procurement.tools.ts` | +885 righe: resolveRequest helper, 15 executor functions, TOOL_META entries, generateActionPreview cases, ALL_TOOLS spread |
| `src/server/agents/tools/invoice.tools.ts` | +2 tool: dispute_invoice, perform_three_way_match |
| `src/server/agents/tools/commessa.tools.ts` | +1 tool: update_commessa_status |
| `src/server/agents/tools/vendor.tools.ts` | +1 tool: update_vendor |
| `src/server/agents/tools/notification.tools.ts` | +1 tool: get_request_timeline |
| `src/server/agents/tools/inventory.tools.ts` | +3 tool: create_material, update_material_stock_levels, set_preferred_vendor |

---

## Dettaglio per ogni nuovo tool

### request-status.tools.ts — Ciclo di vita PR

| Tool | Input chiave | Transizioni ammesse | Note |
|---|---|---|---|
| `cancel_request` | code/id, reason? | DRAFT/SUBMITTED/PENDING_APPROVAL/APPROVED/ORDERED → CANCELLED | Solo owner o MANAGER+ |
| `submit_for_approval` | code/id | DRAFT → SUBMITTED/PENDING_APPROVAL/APPROVED (auto-tier) | Wrapper di initiateApprovalWorkflow: auto-approve <500EUR, manager 500-5000, admin 5000+ |
| `reject_request` | approval_id o request_id, notes? | PENDING_APPROVAL → REJECTED | Wrapper di decideApproval(REJECTED). Cerca la PENDING approval se solo request_id |
| `put_request_on_hold` | code/id, reason? | PENDING_APPROVAL/ORDERED/SHIPPED/INVOICED → ON_HOLD | Reason salvato in timeline metadata |
| `resume_request` | code/id, target_status | ON_HOLD → target | Target esplicito richiesto (non c'e campo previous_status nel DB) |
| `mark_ordered` | code/id, external_ref?, tracking_number? | APPROVED → ORDERED | Popola ordered_at + external_ref |
| `mark_delivered` | code/id, actual_amount?, notes? | SHIPPED → DELIVERED | Popola delivered_at + actual_amount |

Tutti rispettano la state machine (`assertTransition` da `src/lib/state-machine.ts`). Se la transizione non e valida, l'executor ritorna un messaggio d'errore chiaro con le transizioni consentite.

### approval.tools.ts — Gestione approvazioni

| Tool | Tipo | Cosa fa |
|---|---|---|
| `list_pending_approvals` | READ | Query Approval.status=PENDING con include request (code, title, amount) + approver (name). Filtra per approver_id opzionale. |
| `get_approval_detail` | READ | Dettaglio full include con request items e vendor. |
| `decide_approval` | WRITE | Wrapper di `decideApproval(approval_id, APPROVED\|REJECTED, notes)`. Include guard contro self-approval. |

### tender.tools.ts — Gare d'appalto

| Tool | Tipo | Cosa fa |
|---|---|---|
| `create_tender` | WRITE-direct | Auto-genera codice GARA-YYYY-NNNNN via getNextTenderCode(). Stato iniziale DISCOVERED. Solo agent autonomi. |
| `get_tender_detail` | READ | Include contracting_authority, timeline (ultimi 20), documents. Cerca per id o code. |
| `update_tender_status` | WRITE-intercepted | Valida transizione con validateStatusTransition(). Crea TenderTimeline entry. |
| `decide_tender_go_nogo` | WRITE-intercepted | Popola go_no_go (GO/NO_GO), go_no_go_score, go_no_go_notes, decided_by, decided_at. Crea timeline entry. |
| `save_tender_analysis` | WRITE-direct | Persiste output dell'agent tender-analysis. Mappa recommendation: GO→GO, NO_GO→NO_GO, CONDITIONAL_GO→PENDING. Serializza analysis completa in go_no_go_notes come JSON. Chiamato dal route handler /api/agents/tender-analysis dopo la response Opus. |

### invoice.tools.ts — Estensioni fatture

| Tool | Tipo | Cosa fa |
|---|---|---|
| `dispute_invoice` | WRITE-intercepted | Aggiorna reconciliation_status=DISPUTED, salva amount_discrepancy + discrepancy_type + notes. Crea TimelineEvent su PR correlata. Notifica il requester o l'utente specificato. |
| `perform_three_way_match` | WRITE-direct | Wrapper diretto di `performThreeWayMatch(invoiceId, requestId)`. Confronta ordered vs received vs invoiced. Auto-approva se discrepanza <2%. Usato solo da invoice-reconciliation agent. |

### comment.tools.ts, attachment.tools.ts, notification.tools.ts

| Tool | Tipo | Cosa fa |
|---|---|---|
| `add_comment` | WRITE-intercepted | Wrapper di createComment(). Gestisce @menzioni automatiche + notifica owner + timeline event. |
| `list_comments` | READ | Filter per request_id + include_internal (default true). |
| `add_attachment` | WRITE-intercepted | Wrapper di createAttachmentRecord(). Richiede file_url gia disponibile (no upload fisico). Crea timeline "Allegato aggiunto". |
| `list_attachments` | READ | Query Attachment per request_id. |
| `get_request_timeline` | READ | Query TimelineEvent per request_id, ordinata per data desc, limit 20. |

### budget.tools.ts

| Tool | Tipo | Cosa fa |
|---|---|---|
| `list_budgets` | READ | Query Budget con filtri (cost_center, department, is_active). Include latest BudgetSnapshot. Calcola: spent, committed, available, usagePercent, isOverBudget, isWarning. |

### stock.tools.ts

| Tool | Tipo | Cosa fa |
|---|---|---|
| `get_stock_for_article` | READ | Dato article_id o material_id: somma StockLot AVAILABLE + conta ordini pending (PR in APPROVED/ORDERED/SHIPPED con RequestItem.article_id matching). Ritorna available_quantity + pending_quantity + lista ordini. |
| `get_pending_orders_for_material` | READ | Dato material_id: trova il material.article_id, poi cerca RequestItem con article_id in PR pending. Include vendor name e expected_delivery. Fallback su nome se article_id assente. |

### inventory.tools.ts — Estensioni materiali

| Tool | Tipo | Cosa fa |
|---|---|---|
| `create_material` | WRITE-direct | Auto-genera codice MAT-YYYY-NNNNN. Link opzionale ad article_id. Solo agent autonomi (smart-reorder). |
| `update_material_stock_levels` | WRITE-direct | Aggiorna min_stock_level e max_stock_level (Decimal). Influenza alert di riordino. |
| `set_preferred_vendor` | WRITE-direct | Imposta Material.preferred_vendor_id. Verifica che il vendor esista. |

---

## Infrastructure in procurement.tools.ts

### resolveRequest helper

Funzione condivisa usata da tutti i 7 tool di request-status. Accetta `{ request_id?, code? }`, cerca in DB, ritorna `{ id, code, status, requester_id, estimated_amount, vendor_id, commessa_id }` o lancia errore.

### TOOL_META (22 nuove entry)

Mappa name → `{ permissionLevel: 'READ'|'WRITE', minRole: 'VIEWER'|'REQUESTER'|'MANAGER'|'ADMIN' }`. Usata da:
- `isWriteTool()` per decidere se intercettare
- `getToolsForRole()` per filtrare i tool in base al ruolo dell'utente

### WRITE_EXECUTORS (15 nuove entry)

Mappa name → `(params, userId) => Promise<unknown>`. Ogni executor:
1. Valida i parametri
2. Verifica transizioni (assertTransition per PR, validateStatusTransition per Tender)
3. Esegue la mutazione DB in transazione
4. Crea TimelineEvent
5. Invia Notification dove rilevante
6. Ritorna oggetto risultato o lancia errore

### generateActionPreview (15 nuovi case)

Genera la preview user-friendly per il dialog di conferma. Ogni case produce label italiano + lista di campi chiave-valore.

### ALL_TOOLS

Spread di tutte le collection READ + WRITE chat-interceptable. Da 25 a 34 tool esposti al chat assistant.

---

## Servizi backend riutilizzati (nessuna modifica)

| Servizio | Funzioni wrappate | Usato da tool |
|---|---|---|
| `approval.service.ts` | initiateApprovalWorkflow, decideApproval | submit_for_approval, reject_request, decide_approval |
| `commessa.service.ts` | updateCommessaStatus | update_commessa_status |
| `tenders.service.ts` | validateStatusTransition, getNextTenderCode | update_tender_status, create_tender |
| `comment.service.ts` | createComment | add_comment |
| `attachment.service.ts` | createAttachmentRecord | add_attachment |
| `three-way-matching.service.ts` | performThreeWayMatch | perform_three_way_match |
| `notification.service.ts` | createNotification | Molti executor |
| `state-machine.ts` | assertTransition | Tutti i tool request-status |
| `code-generator.service.ts` | generateNextCodeAtomic | create_tender, create_material |

---

## System prompt aggiornato

Il `AGENT_SYSTEM_PROMPT` (in `src/lib/ai/prompts.ts`) ora elenca tutte le 11 aree funzionali con i tool disponibili. L'assistente chat sa che puo:

1. Gestire l'intero ciclo di vita delle RDA (12 operazioni)
2. Gestire approvazioni (3 operazioni)
3. Gestire fornitori (3 operazioni)
4. Gestire fatture (7 operazioni)
5. Gestire gare (5 operazioni)
6. Gestire budget (2 operazioni)
7. Gestire magazzino (5 operazioni)
8. Gestire commesse (3 operazioni)
9. Gestire articoli (1 operazione)
10. Gestire clienti (2 operazioni)
11. Gestire notifiche/timeline (3 operazioni)

---

## Prossimi passi (fuori scope di questo intervento)

1. **Agent prompt tuning per agent autonomi**: i system prompt di email-intelligence, invoice-reconciliation, smart-reorder, compliance-monitor vanno aggiornati per menzionare i nuovi tool specifici (mark_delivered, perform_three_way_match, get_pending_orders_for_material, list_pending_approvals)
2. **DURC compliance**: richiede migrazione schema Vendor + tool dedicati
3. **Merge articles assistito da AI**: tool `suggest_article_merge` per deduplicazione
4. **UI per pending review**: badge PENDING_REVIEW nella lista fornitori/clienti (analogo ad articoli verified)
5. **Cron scheduling**: collegare smart-reorder + compliance-monitor a cron giornaliero
