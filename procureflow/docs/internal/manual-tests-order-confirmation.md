# Manual Test Script — Order Confirmation flow

Test manuali end-to-end per validare la Fase 3 del Core Order Lifecycle Hardening (feat/core-order-lifecycle).

Assunzioni:

- Migration `20260420210033_core_order_lifecycle` già applicata al DB (`npx prisma migrate deploy`).
- Dev server attivo (`npm run dev`) su `http://localhost:3000`.
- Utente autenticato con ruolo `ADMIN` o `MANAGER` per apply/reject.
- Utente autenticato qualunque per GET (lista/dettaglio).

Gli ID reali vanno sostituiti a quelli placeholder `PR_ID`, `CONF_ID`, `LINE_ID`.

---

## 1. Setup — crea una PR di test

```bash
# 1.1 Login come MANAGER (via UI /login) → recupera session cookie
COOKIE="next-auth.session-token=..."

# 1.2 Crea PR con 3 articoli (via UI /requests/new oppure chiamata API)
#     Presupposto: PR creata con code=PR-2026-XXXXX e 3 RequestItem:
#       - item_1: Carta A4, qty 10, unit_price 5.00, sku=CART-A4
#       - item_2: Penne BIC, qty 50, unit_price 0.30
#       - item_3: Toner HP, qty 2, unit_price 85.00
# Annota PR_ID restituito dall'API.
```

## 2. Create — POST confermad'ordine con 3 righe

```bash
curl -sS -X POST "http://localhost:3000/api/requests/$PR_ID/confirmations" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "MANUAL",
    "vendor_reference": "Ord.TEST-0001",
    "subject": "Conferma test",
    "lines": [
      { "request_item_id": "item_1", "confirmed_unit_price": 6.50, "confirmed_delivery": "2026-05-15T00:00:00Z" },
      { "request_item_id": "item_2", "confirmed_unit_price": 0.30, "confirmed_quantity": 50 },
      { "match_by_name": "Toner HP",   "confirmed_unit_price": 89.00, "confirmed_delivery": "2026-05-10T00:00:00Z" }
    ]
  }' | jq
```

**Atteso:**

- HTTP 200
- `data.id` presente (= CONF_ID)
- `data.status === "PARSED"`
- `data.lines.length === 3`
- `lines[0].price_delta_pct ≈ 0.3000` (+30%)
- `lines[0].delivery_delay_days` coerente con la data originale vs confermata
- `lines[1].price_delta_pct ≈ 0.0000` (nessuna variazione)
- `lines[2].request_item_id === "item_3"` (match via nome)

## 3. List — GET tutte le conferme della PR

```bash
curl -sS "http://localhost:3000/api/requests/$PR_ID/confirmations" \
  -H "Cookie: $COOKIE" | jq
```

**Atteso:**

- HTTP 200
- `data` è un array con la conferma creata in step 2
- Ordinamento: più recenti first

## 4. Detail — GET dettaglio

```bash
curl -sS "http://localhost:3000/api/confirmations/$CONF_ID" \
  -H "Cookie: $COOKIE" | jq
```

**Atteso:**

- HTTP 200
- Tutti i campi della conferma + `lines` con `price_delta_pct` e `delivery_delay_days` popolati

## 5. UI — review component su pagina PR

Apri `http://localhost:3000/requests/$PR_ID` nel browser.

**Atteso:**

- Sotto lo status stepper compare la card "Conferma d'ordine · Ord.TEST-0001"
- Status badge: PARSED (ambra)
- Tabella con 3 righe: articolo, prezzo originale vs confermato, delta %, data consegna
- Per le righe con variazione prezzo: delta colorato rosso (aumento) o verde (diminuzione)
- Checkbox per riga (tranne righe già applicate/rifiutate)
- Checkbox "seleziona tutto" in header
- Bottoni: "Applica selezionate (N)" e "Rifiuta conferma"

## 6. Apply parziale — seleziona 2 di 3 righe

Via UI:

1. Deseleziona la 2ª riga (item_2, delta 0%)
2. Click "Applica selezionate (2)"

Oppure via API:

```bash
curl -sS -X POST "http://localhost:3000/api/confirmations/$CONF_ID/apply" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{ "accepted_line_ids": ["LINE_ID_1", "LINE_ID_3"] }' | jq
```

**Atteso:**

- HTTP 200
- `data.status === "APPLIED"`
- `data.applied_at` popolato
- UI: la card aggiorna lo status badge a "Applicata" (verde)

**Verifiche DB (Prisma Studio):**

```sql
-- RequestItem.unit_price aggiornato SOLO per item_1 e item_3
SELECT id, name, unit_price, total_price, confirmed_delivery FROM request_items WHERE request_id = '$PR_ID';
-- Atteso:
-- item_1: unit_price = 6.50, total_price = 65.00 (qty=10), confirmed_delivery = 2026-05-15
-- item_2: unit_price = 0.30, total_price = 15.00 (INVARIATO)
-- item_3: unit_price = 89.00, total_price = 178.00 (qty=2), confirmed_delivery = 2026-05-10

-- OrderConfirmationLine.applied flag
SELECT id, request_item_id, applied, applied_at FROM order_confirmation_lines WHERE confirmation_id = '$CONF_ID';
-- Atteso: line_1 applied=true, line_2 applied=false, line_3 applied=true

-- TimelineEvent
SELECT type, title, metadata FROM timeline_events WHERE request_id = '$PR_ID' ORDER BY created_at DESC LIMIT 1;
-- Atteso: type='order_confirmation_applied', metadata con changes[]

-- AuditLog
SELECT entity_type, action, actor_id, changes FROM audit_logs WHERE entity_type = 'OrderConfirmation' AND entity_id = '$CONF_ID';
-- Atteso: 1 riga, action=UPDATE, changes={status: {old: 'PARSED', new: 'APPLIED'}}
```

## 7. Idempotency — double apply

```bash
curl -sS -X POST "http://localhost:3000/api/confirmations/$CONF_ID/apply" \
  -H "Cookie: $COOKIE" \
  -H "Content-Type: application/json" \
  -d '{ "accepted_line_ids": ["LINE_ID_1"] }' | jq
```

**Atteso:**

- HTTP 409
- `error.code === "INVALID_CONFIRMATION_STATE"`
- Messaggio menziona "APPLIED"

## 8. Reject — crea una seconda conferma e rifiutala

```bash
# Crea seconda conferma
curl -sS -X POST "http://localhost:3000/api/requests/$PR_ID/confirmations" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{ "source": "MANUAL", "vendor_reference": "Ord.TEST-0002",
        "lines": [{ "request_item_id": "item_1", "confirmed_unit_price": 99.00 }] }' | jq -r .data.id

export CONF_ID_2=...

# Reject via API
curl -sS -X POST "http://localhost:3000/api/confirmations/$CONF_ID_2/reject" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{ "reason": "Prezzi fuori soglia" }' | jq
```

**Atteso:**

- HTTP 200
- `data.status === "REJECTED"`
- `data.rejection_reason === "Prezzi fuori soglia"`
- DB: `RequestItem.unit_price` di item_1 **invariato** (resta 6.50 dal passaggio 6)
- UI: card mostra status "Rifiutata" (rosso) con il motivo

## 9. RBAC — utente REQUESTER non può apply/reject

Con session token di un utente REQUESTER:

```bash
curl -sS -X POST "http://localhost:3000/api/confirmations/$CONF_ID/apply" \
  -H "Cookie: $COOKIE_REQUESTER" -H "Content-Type: application/json" \
  -d '{ "accepted_line_ids": ["whatever"] }' | jq
```

**Atteso:**

- HTTP 403
- `error.code === "FORBIDDEN"` (o equivalente da requireRole)

## 10. Validation — body malformato

```bash
curl -sS -X POST "http://localhost:3000/api/requests/$PR_ID/confirmations" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{ "source": "MANUAL", "lines": [] }' | jq
```

**Atteso:**

- HTTP 400
- `error.code === "VALIDATION_ERROR"`
- Details menzionano "Almeno una riga"

## 11. Anti-double-render con legacy PriceVarianceReview

**Prerequisito:** crea a mano una `PriceVarianceReview` (PENDING) sulla stessa PR con un `email_log_id` specifico.

**Scenario A — banner legacy visibile:**

- `PriceVarianceReview` esiste con `email_log_id = "email_A"`, nessuna `OrderConfirmation` collegata
- Apri `/requests/$PR_ID` → il banner legacy deve essere visibile

**Scenario B — banner legacy nascosto:**

- Crea `OrderConfirmation` passando `email_log_id: "email_A"` (stesso del review)
- Apri `/requests/$PR_ID` → il banner legacy deve **sparire**, mostrata solo la nuova `OrderConfirmationReview`

## 12. Regression — PR senza conferme

Apri una PR diversa che non ha conferme d'ordine.

**Atteso:**

- Pagina detail si carica normalmente
- Nessuna card `OrderConfirmationReview` visibile
- Banner `PriceVarianceBanner` legacy ancora visibile se presente
- Tab Dettagli / Timeline / Approvazioni / Allegati / Commenti funzionano come prima

---

## Checklist rapida post-test

- [ ] Create → HTTP 200 + confirmation PARSED
- [ ] List → HTTP 200 con array
- [ ] Detail → HTTP 200 con lines
- [ ] UI mostra review component sotto status stepper
- [ ] Apply parziale → HTTP 200, stato APPLIED, prezzi aggiornati solo per righe accettate
- [ ] Double apply → HTTP 409 idempotency
- [ ] Reject → HTTP 200, nessun cambiamento prezzi
- [ ] RBAC REQUESTER bloccato su apply/reject
- [ ] Validation input vuoto → HTTP 400
- [ ] Banner legacy nascosto se stessa email_log_id di una confirmation
- [ ] Nessuna regressione su PR senza conferme
- [ ] TimelineEvent registrato
- [ ] AuditLog registrato

---

# Extension — Reject lines (granular) + Shipments

Questi scenari validano le 4 estensioni line-level del Core Order Lifecycle:
`LineDeliveryStatus`, `RequestItemShipment`, `rejectLines`, transizione
`PARTIALLY_APPLIED`.

## 13. Reject selective lines — 1 di 3 righe come UNAVAILABLE

Prerequisito: confirmation `CONF_ID_3` in stato `PARSED` con 3 righe.

```bash
curl -sS -X POST "http://localhost:3000/api/confirmations/$CONF_ID_3/reject-lines" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{
    "rejected_line_ids": ["LINE_A"],
    "reason": "Articolo fuori produzione",
    "new_request_item_status": "UNAVAILABLE"
  }' | jq
```

**Atteso:**

- HTTP 200
- `data.status === "PARTIALLY_APPLIED"` (altre righe restano gestibili)
- Riga rifiutata: `applied === false`, `rejected_reason`, `delivery_status === "UNAVAILABLE"`
- `RequestItem` collegato: `delivery_status === "UNAVAILABLE"`
- TimelineEvent registrato (`type === 'order_confirmation_lines_rejected'`)
- AuditLog registrato

## 14. Apply delle righe residue → APPLIED finale

Dopo lo step 13, applica le righe non rifiutate:

```bash
curl -sS -X POST "http://localhost:3000/api/confirmations/$CONF_ID_3/apply" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{ "accepted_line_ids": ["LINE_B", "LINE_C"] }' | jq
```

**Atteso:**

- HTTP 200
- `data.status === "APPLIED"`
- Righe B/C: `applied === true`, prezzi RequestItem aggiornati
- Riga A: invariata (già rifiutata)

## 15. UI — Reject-lines mode

Apri `/requests/$PR_ID` con una confirmation in `PARSED`.

**Atteso:**

- Checkbox per riga attivi
- Selezionate N righe → compaiono pulsanti "Applica selezionate (N)" + "Rifiuta selezionate (N)"
- Click "Rifiuta selezionate" → card espansa con:
  - Dropdown stato: UNAVAILABLE | CANCELLED
  - Textarea "Motivo"
  - Pulsante conferma "Rifiuta N righe"
- Dopo conferma: badge status diventa `PARTIALLY_APPLIED` (ciano)
- "Rifiuta tutta la conferma" disponibile solo per stati iniziali (RECEIVED/PARSED/ACKNOWLEDGED)

## 16. Shipments — crea spedizione per un articolo

Prerequisito: PR con `item_1` (qty 10, unit "pz").

```bash
curl -sS -X POST "http://localhost:3000/api/requests/$PR_ID/shipments" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{
    "request_item_id": "item_1",
    "shipped_quantity": "4",
    "status": "SHIPPED",
    "tracking_number": "TRK-0001",
    "carrier": "DHL",
    "actual_ship_date": "2026-04-21T10:00:00Z",
    "expected_delivery_date": "2026-04-24T00:00:00Z"
  }' | jq
```

**Atteso:**

- HTTP 200
- `data.status === "SHIPPED"`, `data.shipped_quantity === "4"`
- `RequestItem.delivery_status === "SHIPPED"` (propagato dalla recompute)

## 17. Shipments — lista per PR

```bash
curl -sS "http://localhost:3000/api/requests/$PR_ID/shipments" \
  -H "Cookie: $COOKIE" | jq
```

**Atteso:**

- HTTP 200
- Array con la spedizione dello step 16

## 18. Shipments — avanzamento stato a DELIVERED

```bash
curl -sS -X PATCH "http://localhost:3000/api/shipments/$SHIPMENT_ID" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{ "status": "DELIVERED" }' | jq
```

**Atteso:**

- HTTP 200
- `data.status === "DELIVERED"`, `data.actual_delivery_date` auto-stamped
- `RequestItem.delivery_status === "PARTIAL"` (4 di 10) oppure `DELIVERED` se cumulativo copre la qty

## 19. Shipments — split shipment (seconda spedizione stesso articolo)

```bash
curl -sS -X POST "http://localhost:3000/api/requests/$PR_ID/shipments" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{
    "request_item_id": "item_1",
    "shipped_quantity": "6",
    "status": "DELIVERED",
    "tracking_number": "TRK-0002"
  }' | jq
```

**Atteso:**

- HTTP 200
- Totale consegnato = 10/10
- `RequestItem.delivery_status === "DELIVERED"`

## 20. Shipments — quantità eccedente (cap + tolleranza)

```bash
curl -sS -X POST "http://localhost:3000/api/requests/$PR_ID/shipments" \
  -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{ "request_item_id": "item_1", "shipped_quantity": "5", "status": "SHIPPED" }' | jq
```

**Atteso:**

- HTTP 400
- `error.code === "SHIPMENT_QUANTITY_EXCEEDED"` (già 10 di 10 consegnati + 5 = 15 > cap con tolleranza)

## 21. UI — Tab Spedizioni

Apri `/requests/$PR_ID` → tab "Spedizioni".

**Atteso:**

- Gruppo per articolo con header: icona + nome + qty + DeliveryStatusBadge + "Spedite: X / Y"
- Lista spedizioni con ShipmentStatusBadge, tracking, dates, link URL
- Per utenti ADMIN/MANAGER: menu inline "Cambia stato" con transizioni permesse
- Pulsante "Nuova spedizione" → apre `ShipmentForm` inline
- Submit form → nuova spedizione visibile immediatamente (invalidation QueryClient)

## 22. RBAC — REQUESTER non può creare/modificare spedizioni

```bash
curl -sS -X POST "http://localhost:3000/api/requests/$PR_ID/shipments" \
  -H "Cookie: $COOKIE_REQUESTER" -H "Content-Type: application/json" \
  -d '{ "request_item_id": "item_1", "shipped_quantity": "1", "status": "SHIPPED" }' | jq
```

**Atteso:**

- HTTP 403
- REQUESTER può solo GET lista spedizioni, non create/update

---

## Checklist extensions

- [ ] Reject-lines 1/3 → HTTP 200, status PARTIALLY_APPLIED, RequestItem.delivery_status propagato
- [ ] Apply righe residue → HTTP 200, status APPLIED
- [ ] UI reject-lines mode con dropdown UNAVAILABLE/CANCELLED + reason
- [ ] Shipment create → HTTP 200, RequestItem.delivery_status aggiornato
- [ ] Shipment list per PR → HTTP 200
- [ ] Shipment update DELIVERED → auto-stamp actual_delivery_date
- [ ] Split shipment cumulativo → DELIVERED quando qty totale raggiunta
- [ ] Shipment overflow → HTTP 400 SHIPMENT_QUANTITY_EXCEEDED
- [ ] Tab Spedizioni UI con gruppi per articolo + inline status transitions
- [ ] RBAC REQUESTER bloccato su create/update shipments
