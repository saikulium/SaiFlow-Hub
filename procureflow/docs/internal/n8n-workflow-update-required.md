# n8n Workflow Update Required — PDF Attachment Passthrough

**Scope:** `procureflow/n8n/email-ingestion.json` (workflow "Email Ingestion Pipeline")

**Related backend change:** feat/core-order-lifecycle — Fase 4 wires PDF
attachments from the webhook payload into the AI email agent (new tool
`create_order_confirmation` + first-class `OrderConfirmation` model).

**Status:** NOT applied. This document describes what the n8n operator must
change in the visual editor. The JSON under `procureflow/n8n/` is the
current/legacy version and remains untouched in this sprint.

---

## Why

Today the `Combina Email + AI` Code node in `email-ingestion.json` ends with:

```js
const payload = {
  // ... email_* + ai_* fields ...
  attachments: [],   // ← always empty, even when the email has a PDF
}
```

The backend's Zod schema
(`src/modules/core/email-intelligence/validations/email-ingestion.ts`) already
accepts an `attachments` array:

```ts
const emailAttachmentSchema = z.object({
  filename: z.string().min(1),
  url: z.string().url(),
  mime_type: nullableString,
  file_size: z.number().int().nonnegative().nullable().optional(),
})
```

After Fase 4, the webhook handler downloads those URLs (5s timeout, 10MB cap,
PDF-only, fail-soft), uploads them to the Anthropic Files API, and invokes
`processEmail` so the AI agent can read the PDF and call the new
`create_order_confirmation` tool. The plumbing is in:

- `src/modules/core/email-intelligence/server/attachment-fetch.ts` — fetch helper
- `src/modules/core/email-intelligence/server/email-ingestion.service.ts` → `enrichWithAgent`
- `src/app/api/webhooks/email-ingestion/route.ts` → post-processing call

Without the n8n update, the webhook path keeps ignoring PDFs and the AI agent
never sees supplier confirmation attachments via this ingestion channel. The
manual `/api/email-import` path already works because it uploads the bytes
inline.

---

## What to change in n8n

### Step 1 — Expose IMAP attachment metadata

The `IMAP Email` trigger node already emits attachment info in
`binary.*`. Add a Code node **before** the existing `Combina Email + AI` to
extract filename/mime/size/url from each binary attachment.

Two viable URL strategies (pick one):

**Option A (recommended) — Upload to S3/MinIO**
- Add an `HTTP Request` or `AWS S3` node after `Parsa Email` that uploads each
  binary attachment to a bucket the app can reach (public or pre-signed URL).
- Output: list of `{ filename, url, mime_type, file_size }`.

**Option B — Use a data-URI or temporary host**
- Viable only if you can guarantee the URL is reachable within 5 seconds from
  the ProcureFlow backend. Many staging environments can't. Prefer Option A.

Do **not** inline base64 in the payload — the webhook's Zod schema expects a
URL, not raw bytes. (Inline base64 would also blow up the webhook body and
bypass the 10MB download cap.)

### Step 2 — Patch the "Combina Email + AI" node

Replace the hardcoded `attachments: []` line with the real mapping:

```js
// Before (current)
attachments: []

// After
attachments: (emailData.attachments ?? []).map(a => ({
  filename: a.filename,
  url: a.url,
  mime_type: a.mime_type ?? 'application/pdf',
  file_size: typeof a.file_size === 'number' ? a.file_size : undefined,
}))
```

`emailData.attachments` should come from the new extraction Code node added in
Step 1. Non-PDF attachments can be included too — the backend filters them out
based on mime_type/magic bytes, so it's safe to pass everything.

### Step 3 — Verify webhook body limits

The webhook accepts up to Next.js's default body size. Passing URLs (not
bytes) keeps the payload tiny. No changes required.

### Step 4 — Test

Send a real IMAP email with a supplier PDF ("conferma d'ordine") through the
workflow. Expected log line on the backend:

```
[email-ingestion] Agent enrichment: invoked=true downloaded=1 skipped=0
```

And in the database:

- One new `OrderConfirmation` row in status `PARSED`.
- One or more `OrderConfirmationLine` rows with `price_delta_pct` and
  `delivery_delay_days` populated.
- Notification sent to a MANAGER/ADMIN if any line has a significant variance.

If instead you see `invoked=false` or `downloaded=0`, inspect the webhook log:

| Symptom | Likely cause |
|---|---|
| `attachment-fetch] HTTP 403/404` | The attachment URL is not reachable from the backend (credentials, signed-URL expired) |
| `attachment-fetch] timeout after 5000ms` | Slow host. Pre-stage to S3/MinIO (Option A) |
| `attachment-fetch] rejected non-PDF content-type` | Host returns wrong `Content-Type`. Fix upstream or remove mime filter only for trusted sources |
| `attachment-fetch] content does not start with %PDF-` | The file was not actually a PDF, or was corrupted mid-transfer |
| `agent enrichment failed` | The agent itself errored (usually ANTHROPIC_API_KEY / rate limit). Non-fatal — the structured ingestion already succeeded |

---

## Safety caps (informational, not configurable from n8n)

The backend enforces (see `attachment-fetch.ts`):

- Max **3** PDFs per email (extras are silently dropped)
- **5s** per-URL download timeout
- **10 MB** per-URL size cap (checked via Content-Length and actual bytes)
- **`application/pdf` only** — enforced by MIME header + `%PDF-` magic bytes
- HTTP/HTTPS only — `file://` and `data:` URLs are rejected

These are defensive defaults for fail-soft behavior. If a supplier regularly
exceeds them (e.g., 15MB scanned PDFs), bump `AGENT_ATTACHMENT_MAX_BYTES` in
`email-ingestion.service.ts` rather than changing n8n.

---

## Rollback

If the patched workflow causes issues (e.g., attachments breaking the merge
Code node), revert Step 2 back to `attachments: []`. The backend remains
functional — `enrichWithAgent` is a no-op when the array is empty, and all
existing structured-ingestion paths continue to work.
