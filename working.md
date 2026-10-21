# BillReve — Technical Working Document
*Last updated: 2026-10-14 | Version: 1.5.0*

> This document is the **authoritative internal reference** for BillReve. It is written for developers, AI agents, and collaborators continuing work on this project. It must be kept up-to-date after every significant change.
>
> **Reliability note:** this file was substantially rewritten on 2026-10-11 after two audits found it contradicted the source in several places — it still described the `profiles` table (dropped), invented `payments` and `campaigns` tables (never existed), and listed resolved risks as open. Where this document and the code disagree, **the code wins**. Migration files, not `schema.sql`, are the source of truth for the database.

---

## 1. Project Overview & Tech Stack

BillReve is an **offline-first, AI-powered invoicing and billing SaaS** for freelancers and small-to-medium businesses. It is built to function flawlessly with zero internet connection, syncing automatically to the cloud when connectivity is restored.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 19.2 + TypeScript 6 (strict) |
| Build Tool | Vite 8 (Rolldown bundler) |
| Styling | Tailwind CSS v4 + custom CSS variable theme engine |
| Animations | Framer Motion |
| State Management | Zustand 5 (`useAppStore.ts`) |
| Local Database | Dexie.js 4 (IndexedDB wrapper), schema v4 |
| Cloud Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| Serverless Functions | Supabase Edge Functions (Deno) |
| PWA | `vite-plugin-pwa` + Workbox |
| PDF Generation | Client-side `html2pdf.js` renderer (`pdfGenerator.tsx`), lazy-loaded |
| AI | Google Gemini via Supabase Edge Function proxy |
| Testing | Vitest 5 + Testing Library + jsdom |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |
| Observability | Sentry (`@sentry/react`) + PostHog, both key-gated |

**Node requirement:** ≥ 20.19 or ≥ 22.12. Vite 8 will refuse older versions.

---

## 2. Full Feature Inventory

### Core Business Features
- **Invoicing Engine** — Full lifecycle: `DRAFT → SENT → PENDING → PARTIAL → PAID → OVERDUE → VOID`
- **Quotes & Negotiation Loop** — Lifecycle: `DRAFT → SENT → ACCEPTED / DECLINED / COUNTERED`. Clients can counter-offer via public link; admin can accept counter, decline, or redraft a new version. Minimum counter amount is enforced **server-side** in the RPC, not just in the browser
- **Quote → Invoice Conversion** — One-click conversion preserves all line items
- **Recurring Invoices** — `recurring_schedules` table + `process-recurring-invoices` edge function on `pg_cron`
- **Client Directory** — Full CRUD, soft-delete, CSV import via wizard
- **Payments Tab** — Manual bank transfer accounts (free), Paystack / Flutterwave gateways (Pro). **Stripe is not implemented**
- **Trash & Auto-Purge** — Soft-deleted records recoverable for 7 days (Free) or 30 days (Pro), then purged by `empty_trash_based_on_plan()` on a daily cron
- **Email Campaigns** — Rich-text composer (dependency-free, `components/campaigns/RichTextEditor.tsx`) with image upload, live desktop/mobile preview, a pre-send proofread gate, per-recipient unsubscribe, a suppression list, and per-recipient delivery tracking. Pro only: 250 emails/month, max 2 campaigns per rolling 7 days, top-up packs at ₦2,000 per 1,000 emails
- **Reports & CFO Insights** — Financial summaries, revenue/outstanding/overdue charts, AI CFO report generation
- **PDF Export** — 5 themes (Standard, Professional, Modern, Classic, Monochrome) with live logo and branding
- **Sequential Document Numbers** — gapless per-organization numbering via Postgres sequences in `user_sequences`; offline-created documents carry a `DRAFT-INV-xxxx` placeholder until synced

### SaaS / Platform Features
- **Subscription Tiers** — Free vs. Pro, gated on `organizations.is_pro` + `pro_expires_at`
- **Quota System** — Free tier: **5 clients, 10 invoices/month, 10 quotes/month, 10 AI prompts/month.** Enforced by the `check_user_quota()` trigger and inside the `ai` edge function
- **Automated Payment Webhooks** — Paystack, Flutterwave, SaaS subscription
- **Automated Email Reminders** — Cron at -3, 0, +3, +7, +14 days from due date

### AI Features
- **RevenueChat** — Persistent conversational assistant on the dashboard. Answers financial questions and issues Action Cards (draft invoice, create quote)
- **AI Draft Modal (`AiDraftModal.tsx`)** — Drag-and-drop/voice/text invoice/quote generation with line-item parsing
- **AI CFO Report** (Pro only, enforced server-side)

### UX & App Features
- **Offline-First Sync** — All writes go to IndexedDB first; cloud sync happens in background
- **PWA Support** — Installable on mobile and desktop. Works fully offline after first load
- **Multi-Theme Engine** — 8 preset themes + custom hex color picker
- **Dark Mode**, **Font Preferences**, **Getting Started Checklist**
- **Notification System** — In-app notifications for invoice paid, counter offer received, payment pending
- **Dead Letter Queue UI** — failed sync payloads listed in `SyncSettings.tsx` with a retry action
- **Public Invoice Links** — `/pay/:id`; **Public Quote Links** — `/quote/:id`

---

## 3. Money Representation ⚠️ READ THIS FIRST

**Every monetary value in BillReve is an integer in MINOR units** (kobo, cents, pesewas). Postgres columns are `BIGINT`, Dexie mirrors them (schema v2 migration), and every calculation and comparison happens in minor units. Floating-point currency is never stored.

Conversion happens in exactly **one** place per runtime:

| Runtime | File |
|---|---|
| Client | `client/src/utils/money.ts` |
| Edge Functions (Deno) | `server/supabase/functions/_shared/money.ts` |

Edge functions cannot import the client bundle, so the duplication is deliberate. **Change both or neither.**

### The gateway trap

The two payment gateways disagree with each other, and this is the single most expensive thing to get wrong in this codebase:

| Gateway | Unit it sends and expects |
|---|---|
| Paystack | **Minor** (kobo) — same as our storage, so pass-through |
| Flutterwave | **Major** (naira) — must convert |

Always use `toGatewayAmount(minor, gateway)` when sending and `fromGatewayAmount(amount, gateway)` when receiving. Never convert inline.

**History:** in October 2026 the minor-units migration landed *after* the payment fixes it invalidated. Four independent places kept treating stored values as major units. For several days checkout charged customers **100×**, both webhooks compared major against minor so no invoice could ever be marked `PAID`, and accepting a quote counter-offer rewrote the quote to ~1% of its value. `money.test.ts` exists specifically to make that class of bug impossible to reintroduce — each test names the bug and the `file:line` it came from.

If you are writing `* 100` or `/ 100` outside those two files, stop.

---

## 4. Database Schema

> Dexie and Supabase mirror each other for synced entities. Dexie uses camelCase, Supabase snake_case; `syncEngine.ts` converts between them.
>
> **There is no `profiles` table and no `payments` table.** Earlier revisions of this document described both, plus `campaigns` and `bank_accounts` tables that did not exist at the time. `campaigns` now DOES exist (added 2026-10-14) but with a different shape than was once documented. Bank accounts remain a JSONB array on `organizations`.

### Real tables

`organizations`, `organization_members`, `clients`, `invoices`, `quotes`, `recurring_schedules`, `notifications`, `user_secrets`, `user_sequences`, `api_logs`, `rate_limits`, `webhook_logs`, `payment_events`, `campaigns`, `campaign_recipients`, `email_suppressions`, `campaign_credit_purchases`.

### `organizations` (the tenant — replaced `profiles`)
```
id (uuid, PK)
name, email, phone, address
logo_url (text — base64 blocked by CHECK constraint chk_logo_url_no_base64)
country, currency
industry, business_description
bank_accounts (JSONB array of {id, bankName, accountName, accountNumber, isDefault})
email_flags (JSONB)
paystack_public_key, flutterwave_public_key
is_pro (boolean), pro_expires_at (timestamptz)
created_at, updated_at
```

### `organization_members`
```
id (uuid, PK)
organization_id (uuid, NOT NULL, FK → organizations)
user_id (uuid, NOT NULL, FK → auth.users)
role (text, CHECK IN ('owner','admin','member'), default 'owner')
UNIQUE (organization_id, user_id)
```

### `clients`
```
localId, organizationId, name, email, phone, address
syncStatus, updatedAt, createdAt
deletedAt (soft delete), isPurged (boolean)
UNIQUE (organization_id, local_id)
```

### `invoices`
```
localId, organizationId, clientId
invoiceNumber, status, description
items (JSONB — line items; unitPrice and amount are MINOR units)
taxes (JSONB — amount is MINOR units, rate is a percentage)
subtotal, total, amountPaid, counterAmount   ← ALL BIGINT MINOR UNITS
currency, dueDate, issuedAt, createdAt, updatedAt
bankAccountId + bank_account_snapshot (JSONB, frozen at creation)
clientMessage, documentTheme
syncStatus, deletedAt, isPurged
UNIQUE (organization_id, local_id)
```

### `quotes`
```
(Same base as invoices, plus:)
quoteNumber, expiresAt
allowCounterOffer (boolean)
minimumCounterAmount   ← BIGINT MINOR UNITS
```

### `recurring_schedules`
```
localId, organizationId, clientId
templateInvoiceId, frequency, nextRunDate, status
FK (organization_id, client_id) → clients(organization_id, local_id)
FK (organization_id, template_invoice_id) → invoices(organization_id, local_id)
```

### `user_secrets`
```
organization_id (PK)
paystack_secret_key_enc, flutterwave_secret_key_enc (BYTEA, pgcrypto)
```
Readable only through the `get_merchant_secret(p_org_id, p_gateway)` SECURITY DEFINER RPC. Never select these columns directly.

### `api_logs`
```
organization_id, endpoint, created_at
```
Backs both API rate limiting and the monthly AI quota count. Indexed on `(organization_id, endpoint, created_at DESC)`.

### `syncQueue` (Dexie only — never synced)
```
id, entity ('CLIENT' | 'INVOICE' | 'QUOTE' | 'RECURRING')
action ('CREATE' | 'UPDATE' | 'DELETE')
status ('pending' | 'failed')
payload, createdAt, error
```
Note the real field names: `entity`/`action`/`status`, not `table`/`operation`/`attempts`.

### Dexie version history (`client/src/db/db.ts`)
| Version | Change |
|---|---|
| 1 | Initial: clients, quotes, invoices, syncQueue |
| 2 | **Data migration** — convert all money fields to integer minor units |
| 3 | Index `deletedAt` for Trash queries |
| 4 | Add `recurringSchedules` table |

⚠️ The IndexedDB database is still named **`BillFlowDatabase`** (pre-rebrand). This is deliberate — renaming it would orphan every returning user's local data. The class is `BillReveDatabase`; only the string passed to `super()` is legacy.

---

## 5. API / RPC & Edge Function Catalogue

### Supabase RPCs

| Function | Caller | Purpose |
|---|---|---|
| `update_invoice_status_public(p_local_id, p_status, p_amount_paid)` | `PublicInvoice.tsx` | Unauthenticated status change. Allow-list: `PENDING, DECLINED, COUNTERED, DRAFT, SENT`. **Cannot set `PAID` or `PARTIAL`.** `amount_paid` is idempotent (set, never increment). Refuses to touch an already-`PAID` invoice |
| `update_quote_status_public(p_local_id, p_status, p_counter_amount, p_client_message)` | `PublicQuote.tsx` | Accept/decline/counter. Enforces `allow_counter_offer` and `minimum_counter_amount` from the DB row, not client trust |
| `get_public_invoice` / `get_public_quote` / `get_public_client` | public pages | Definer reads for unauthenticated document views |
| `get_public_profile(p_id)` | public pages | Returns an **explicit nine-column** subset of `organizations`. Never `SELECT *` here — the table holds email, phone and `pro_expires_at` |
| `get_ai_context()` | `RevenueChat`, `AICfoReport` | Server-side aggregation so raw arrays never ship to Gemini |
| `get_merchant_secret(p_org_id, p_gateway)` | payment webhooks | Decrypts a gateway secret |
| `check_rate_limit(identifier, action, max, window)` | public RPCs | Per-source-address **and** per-document throttling |
| `check_and_log_rate_limit(p_user_id, p_endpoint, p_limit, p_window_minutes)` | `ai`, `send-email` | Per-organization API rate limit |
| `is_member_of(_org_id)` / `is_org_owner(_org_id)` | RLS policies | Membership and ownership predicates |
| `record_payment_event(...)` | payment webhooks | Records a captured gateway payment and reconciles the invoice. **Accumulates**, and is replay-safe via `UNIQUE (gateway, reference)` |
| `queue_campaign(...)` | `Campaigns.tsx` | The only way a campaign enters the send queue. Re-checks quota, expands client ids into recipients, drops suppressed addresses, debits credit packs, refuses content that failed the proofread gate |
| `check_campaign_quota(p_recipient_count)` | `Campaigns.tsx` | Pro gate + 250/month + 2 campaigns per rolling 7 days + purchased credit balance |
| `unsubscribe_by_token(p_token)` | public unsubscribe page (anon) | Idempotent. Never reveals the email or organization, so the token cannot be used to enumerate contacts |
| `record_email_suppression(...)` | `resend-webhook` | Bounce/complaint → do-not-send list |
| `grant_campaign_credits(...)` | `saas-webhook` | Credits a paid top-up pack. Idempotent on the gateway reference |
| `bump_campaign_counter(...)` | `resend-webhook` | Increments denormalised campaign counters |
| `empty_trash_based_on_plan()` | daily cron | Purges soft-deleted rows past retention |

### Postgres Triggers

| Trigger | Table | Purpose |
|---|---|---|
| `on_invoice_status_change` | `invoices` | Notifications for PAID/PARTIAL/PENDING |
| `on_quote_status_change` | `quotes` | Notifications for ACCEPTED/DECLINED/COUNTERED |
| `check_user_quota` | `invoices`, `quotes`, `clients` | Free-tier limits. Fails closed on a missing organization |
| `enforce_pro_status_protection` | `organizations` | Silently discards client-side `is_pro` / `pro_expires_at` writes |
| `user_sequences` number assignment | `invoices`, `quotes` | Assigns the real document number on insert |

> **Known issue — notification suppression.** The status-change triggers currently do `IF auth.uid() IS NOT NULL THEN RETURN NEW`, which was meant to prevent self-notification. In a tenant model it suppresses the notification for **any** authenticated actor, including a *different* member of the same organization. Notifications therefore only fire for `anon` public-link actions. Needs narrowing to "the actor is the only member" or an actor-vs-recipient comparison before team accounts ship.

### Supabase Edge Functions

| Function | Trigger | Purpose |
|---|---|---|
| `ai` | HTTP POST | Gemini proxy. Verifies JWT → resolves org → checks `is_pro` + expiry → gates Pro-only endpoints → counts monthly AI usage → rate limits. **Every failure path fails closed.** Converts money to major units before prompting |
| `email-cron` | Daily cron | Reminder emails; also sweeps expired Pro subscriptions |
| `email-worker` | HTTP (internal) | Sends transactional emails |
| `send-email` | HTTP | Generic email dispatch |
| `process-recurring-invoices` | `pg_cron` | Generates invoices from `recurring_schedules`, emails them, and promotes DRAFT → SENT only when delivery succeeded |
| `campaign-worker` | `pg_cron`, every minute | Drains `campaign_recipients` in batches of 100 (Resend's hard cap), re-checks suppression at send time, attaches RFC 8058 unsubscribe headers, ships a plain-text part, records per-recipient outcomes. Caps itself at 5 batches per run and resumes on the next tick. **Service-role only** — requires `Authorization: Bearer CRON_SECRET` |
| `campaign-proofread` | HTTP | Pre-send gate. Deterministic rules block; the LLM only warns |
| `resend-webhook` | Resend (Svix-signed) | Bounce and complaint events → suppression. Hard bounces suppress, soft bounces do not |
| `saas-webhook` | Paystack | Pro subscription **and** campaign credit packs. HMAC verified **before** any DB logging; enforces a minimum amount; does **not** downgrade on `charge.failed` — `pro_expires_at` lapses naturally |
| `paystack-webhook` | Paystack POST | Verifies HMAC (constant-time), currency, and amount against the invoice total, then sets `PAID` or `PARTIAL` |
| `flutterwave-webhook` | Flutterwave POST | Same, with major→minor conversion on the incoming amount |

---

## 6. State Management Architecture

### Zustand (`useAppStore.ts`)
Manages non-volatile UI state only. Persisted to `localStorage` under key `billreve-storage`.

**Holds:** `session`, `businessProfile` (mirror of the `organizations` row), `theme`, `customColor`, `fontSize`, `mobileNavStyle`, `isDarkMode`, `isOnline`, `aiPromptsUsed`, `isProUser`.

> `isProUser` and `aiPromptsUsed` are persisted to localStorage and are therefore **UX hints only** — a user can edit them. All real gating happens in Postgres triggers and the `ai` edge function. Never treat them as authoritative.

Sync watermarks are **not** in Zustand. They live in `localStorage` as `last_sync_time_<table>` and are owned by the sync engine.

**Pattern:** use the hook reactively inside components — `const { isProUser } = useAppStore()`. Do NOT use `useAppStore.getState()` in JSX; it is non-reactive and will not re-render.

### Dexie.js (IndexedDB)
Source of truth for all heavy entities. Accessed via `dexie-react-hooks` (`useLiveQuery`) for reactive UI without Zustand subscriptions.

---

## 7. Sync Engine Deep Dive (`client/src/services/syncEngine.ts`)

The most critical service in the codebase. ~470 lines holding every customer's financial data.

### Flow
```
User Action
  → Write to Dexie (immediate, offline-safe)
  → Append to syncQueue (entity, action, payload)
  → UI updates instantly via useLiveQuery

Background, triggered by any of:
  10s interval  |  Realtime event  |  syncQueue Dexie hook (500ms debounce)  |  window 'online'
  → Resolve organization_id from organization_members
  → PUSH: drain pending syncQueue
      CREATE: upsert, onConflict 'organization_id,local_id'
      UPDATE/DELETE: .eq('local_id', …).eq('organization_id', orgId)
  → PULL: per table, rows where updated_at > last_sync_time_<table>, paginated 500
  → Merge into Dexie under LWW
```

> ⚠️ **`onConflict` must be `'organization_id,local_id'` with NO whitespace.** PostgREST parses it as a literal column list; a space makes it look for a column named `" local_id"` and every CREATE push fails into the dead-letter queue. The real constraint is `UNIQUE (organization_id, local_id)` on clients, invoices, quotes and recurring_schedules. `syncEngine.test.ts` asserts this.

### Conflict Resolution (Last-Write-Wins)
- Compares local `updatedAt` vs. remote `updated_at`, with `serverTimeOffsetMs` applied to the local side to correct device clock drift
- Remote wins if the remote timestamp is newer
- **Priority override:** `PAID`, `ACCEPTED`, `COUNTERED`, `DECLINED` always win regardless of timestamp, so a confirmed client action can never be reverted by a stale local edit

### Watermarks
One watermark **per table** (`last_sync_time_clients`, `_invoices`, `_quotes`). A single shared watermark previously allowed a newer timestamp in one table to advance past un-pulled rows in another — silent, unrecoverable partial data loss. All `last_sync_time*` keys are cleared on logout, so a second user on the same browser does not resume from the previous user's position.

### Dead letter queue
Failed pushes are marked `status: 'failed'` and are **not** auto-retried. They surface in `SyncSettings.tsx` with a retry button that resets them to `pending`. Logout is never blocked by them — the user gets an explicit confirmation instead.

### Remaining weakness 🟢
No automatic exponential backoff on retry. Manual retry only.

---

## 8. Auth & Subscription Logic

### Authentication
- Supabase Auth (email/password + Google OAuth)
- Session stored in Zustand after `supabase.auth.getSession()`
- `App.tsx` sets up `onAuthStateChange` to keep Zustand in sync, and resolves `organization_id` from `organization_members`

### isPro Check
```typescript
// Correct pattern — always read from Zustand reactively:
const { businessProfile } = useAppStore();
const isPro = businessProfile?.is_pro &&
  (!businessProfile?.pro_expires_at || new Date(businessProfile.pro_expires_at) > new Date());
```

> `is_pro = true` with a past `pro_expires_at` means the user is **downgraded**. Both the frontend and the server-side checks handle this. `is_pro` alone is NOT sufficient.

### Subscription Webhook Flow (`saas-webhook/index.ts`)
```
Paystack sends webhook event
  → verify HMAC FIRST (before any DB write)
  → charge.success + metadata type=saas_subscription + amount >= 350000 kobo
        → is_pro = true, pro_expires_at = now + 30 days
  → subscription.disable / charge.failed / subscription.not_renew
        → log only. Do NOT downgrade; let pro_expires_at lapse naturally
```
A daily sweep in `email-cron` sets `is_pro = false` where `pro_expires_at < now()`.

---

## 9. Theming System (`client/src/index.css`)

### Preset Themes
Applied as a class on `<html>` (e.g. `class="theme-ocean dark"`):

| Class | Accent Palette |
|---|---|
| (default) | Deep Premium Purple |
| `theme-wine` | Glossy Wine Red + Silver |
| `theme-ocean` | Ocean Blue |
| `theme-emerald` | Emerald Green |
| `theme-slate` | Charcoal Slate |
| `theme-sunset` | Sunset Orange |
| `theme-mustard` | Mustard Yellow |
| `theme-cherry` | Cherry Red |

### Custom Color
When the user picks a custom hex, `MainLayout.tsx` uses `generatePalette()` to produce a 10-shade scale and injects it as inline CSS variables on `<html>`.

### Critical Rule ⚠️
`index.css` maps **all Tailwind `blue-*` classes** to the purple palette, so `bg-blue-600` renders as dark purple. **Never use `bg-blue-*` or `text-blue-*` for accents** — use `bg-purple-*`. This was the root cause of the Ocean theme appearing purple.

---

## 10. AI Integration

### RevenueChat (`components/RevenueChat.tsx`)
- Floating dashboard button, expands to a full chat panel
- Context comes from the `get_ai_context()` RPC — **pre-aggregated server-side**. Raw invoice/client arrays are no longer sent
- Issues **Action Cards** — structured JSON that spawns UI actions
- LLM-returned prices are **major units** and are converted with `toMinor()` before being written to Dexie

### AiDraftModal (`components/AiDraftModal.tsx`)
- Three input modes: text description, voice dictation, file upload (image/PDF parse)
- Returns structured JSON matching the Invoice/Quote schema

### Quota & gating
Enforced entirely in `server/supabase/functions/ai/index.ts`: JWT verification → organization resolution → `is_pro` + `pro_expires_at` → Pro-only endpoint gate (`cfo-report`) → monthly count of `api_logs` rows matching `endpoint LIKE 'ai/%'` → per-minute rate limit. **All failure paths fail closed.** The client-side `aiPromptsUsed` counter is a display hint only.

### Money in prompts
`convertMoneyFieldsToMajor()` in `_shared/money.ts` walks the context JSON and converts money keys to major units before prompting. LLMs are unreliable at arithmetic, so this is done deterministically rather than by instruction. The `rate` key is deliberately excluded — it is a percentage, not an amount.

---

## 11. PDF Generation (`utils/pdfGenerator.tsx`)

- Renders entirely client-side via `html2pdf.js`; lazily loaded by dynamic import (~900KB, kept out of the main bundle)
- Five themes: Standard, Professional, Modern, Classic, Monochrome
- Logo is a **Supabase Storage URL**, not base64 — a `CHECK` constraint blocks base64 in `logo_url`
- Supports multi-page documents with automatic pagination
- A `getComputedStyle` monkey-patch hides `oklch` colours from html2canvas, which cannot parse them

> **Signature:** `generateDocumentPdf({ document, client, profile, type, download })` takes a **named options object**. It used to be positional, and `PublicInvoice.tsx` / `PublicQuote.tsx` passed `client` and `profile` swapped — so every PDF the paying customer downloaded had sender and recipient reversed and an empty bank-details block, while the merchant's own downloads looked fine. Keep it named.

---

## 12. Email System

### Automated Reminders (`email-cron`)
- Daily cron via Supabase
- Scans `invoices` for due dates matching -3, 0, +3, +7, +14 days
- Checks `last_reminded_at` for idempotency
- Amounts rendered with `toMajorString()` — raw minor units previously leaked into client-facing email bodies
- Also sweeps expired Pro subscriptions

### Sender identity and the footer
All three sending paths go through `_shared/email.ts`, which owns the `From` header and the "Powered by BillReve" footer so a new send path cannot forget either. Mail goes out as the merchant's own business, not as BillReve — `buildFrom` strips CR/LF and quotes from the merchant-supplied display name, because it is attacker-controllable and would otherwise allow header injection.

### Campaigns (`Campaigns.tsx` + `campaign-worker`)

The flow is: compose → proofread → `queue_campaign` → cron-driven `campaign-worker` → per-recipient rows updated → `resend-webhook` feeds bounces and complaints back into suppression.

Things that are load-bearing and easy to break:

- **Campaigns are immutable once queued.** The RLS UPDATE policy on `campaigns` requires `status = 'DRAFT'`. Otherwise a user could pass the proofread gate and then rewrite the body mid-send.
- **`campaign_recipients` is read-only to clients.** Rows are created only by `queue_campaign`. The `unsubscribe_token` is the sole credential on a public endpoint, so it must never be client-chosen.
- **The proofread gate is deterministic; the LLM is advisory.** Campaign bodies are untrusted text being fed to a model whose output we act on. If an LLM were the gate, a prompt injection or an unlucky sampling run would decide whether real mail goes out. `queue_campaign` independently refuses any payload whose `proofread.blocking` array is non-empty, so the gate is enforced in the database and not just the UI.
- **A proofread outage must not block sending.** If Gemini is unavailable the deterministic verdict stands.
- **The frequency limit is not decoration.** 2 campaigns per rolling 7 days, enforced regardless of credit balance. A volume cap alone does nothing to stop someone mailing the same list every other day, which is the pattern that gets a sending domain throttled.
- **Unsubscribe is mandatory, not a nicety.** Gmail and Yahoo's bulk sender rules (February 2024) require one-click unsubscribe and a complaint rate under 0.3%. Both `List-Unsubscribe` and `List-Unsubscribe-Post` are needed; the first alone does not satisfy them.
- **The unsubscribe page acts on load, not on a confirmation click.** Mail clients and security scanners pre-fetch links, so a confirm step loses genuine unsubscribes. The RPC is idempotent.
- **Hard bounces suppress; soft bounces do not.** A full mailbox is not a dead address.
- **Merchants cannot delete an `UNSUBSCRIBED`/`BOUNCED`/`COMPLAINED` suppression.** Only `MANUAL` entries. Overriding an unsubscribe is both a legal and a reputation problem.

### ⚠️ Sending domain
`CAMPAIGN_SENDER_ADDRESS` must point at a **separate verified subdomain** with its own SPF/DKIM/DMARC. Marketing mail attracts complaints; invoices are what customers depend on. While both share a domain, one badly-received campaign degrades invoice deliverability for every merchant. The worker logs a warning on every run until this is set.

### On Amazon SES
Considered and deliberately deferred. SES is roughly 4× cheaper ($0.10/1,000 versus Resend's ~$0.0004/email), but it enforces *ratio* thresholds — complaints above 0.1%, bounces above 5% — which are most dangerous at low volume, where a single complaint is many times the limit. SES also starts sandboxed (200/day, verified recipients only, production access by application), has no direct batch equivalent (`SendBulkEmail` needs server-side templates, so per-recipient unsubscribe tokens move into substitution data), and delivers events via SNS rather than one signed webhook. `campaign-worker` is the only file that talks to a send API, so this stays a one-file change. Revisit past a few hundred thousand emails a month.

---

## 13. Public-Facing Pages

### `/pay/:id` (`PublicInvoice.tsx`)
- Unauthenticated. Uses `update_invoice_status_public` (SECURITY DEFINER)
- **Manual transfer:** client clicks "I've transferred the funds" → status moves to `PENDING`. No amount is sent
- **Paystack/Flutterwave:** gateway modal embedded (Pro). Amount passed through `toGatewayAmount()`
- On gateway success the client sends **status only**. The webhook verifies the amount and currency and is the only thing that may set `PAID` or write `amount_paid`

> **Trust boundary:** the browser may never assert that money arrived. Any code path where the client supplies `p_amount_paid` is a bug.

### `/quote/:id` (`PublicQuote.tsx`)
- Unauthenticated. Uses `update_quote_status_public`
- Client can Accept, Decline, or Counter-offer
- The typed counter amount is **major units** and is converted with `toMinor()` before submission
- `minimum_counter_amount` and `allow_counter_offer` are validated in the RPC against the stored row

---

## 14. Risks, Bugs & Technical Debt

> **Priority:** 🔴 Critical | 🟡 Medium | 🟢 Low

### 🔴 1. Automated Pro checkout is disabled
`Upgrade.tsx` is locked to manual bank transfer pending payment-processor business verification. Conversion requires the user to leave the app, transfer, email a receipt, and wait for a manual upgrade. No funnel survives this, and it now also gates campaign credit packs.
- **Fix:** complete verification, then re-enable the `PaystackButton` path. The `plan` payload parameter is already wired. Credit packs need a checkout that sets metadata `type=campaign_credits` and `userId`.

### 🔴 2. Campaigns still share the transactional sending domain
Until `CAMPAIGN_SENDER_ADDRESS` points at a verified subdomain, a campaign that draws complaints degrades **invoice** deliverability for every merchant. This is DNS and configuration work, not code — the plumbing is already in place and `campaign-worker` warns on every run while it is unset.

### 🟡 3. `schema.sql` is stale
The committed dump predates the multi-tenant migration — it still shows `user_id NOT NULL` and `clients_user_id_local_id_key`. The migration files are correct; the dump is not.
- **Fix:** re-dump after applying migrations, and do it as part of the release checklist.

### 🟡 3. Flutterwave webhook trusts its own payload
It reads `data.status` and `data.amount` from the request body rather than re-fetching from `GET /v3/transactions/:id/verify`, which Flutterwave's docs recommend.
- **Blocker:** that call needs the merchant's Flutterwave **API secret**, which is a different credential from the `verif-hash` currently stored in `user_secrets`. Needs a new column first.

### 🟡 4. No webhook idempotency key
Both handlers set absolute values rather than incrementing, so replay is not a double-count risk. But the gateway transaction reference is not stored, so reconciliation against the gateway dashboard is manual.
- **Fix:** add a `payment_reference` column and treat it as an idempotency key.

### 🟡 5. Notification triggers suppress teammate notifications
See the note in Section 5. `auth.uid() IS NOT NULL` is too broad for a tenant model.

### 🟡 6. Team accounts not reachable from the UI
`organizations`, `organization_members`, owner-gated RLS policies and `is_org_owner()` all exist. There is no invite flow and the UI does not enforce `role`. Every member is effectively an owner.

### 🟢 7. ~250 `any` usages
`@typescript-eslint/no-explicit-any` is set to `warn` so CI stays useful. Worth paying down incrementally, not in one pass.

### 🟢 8. No sync retry backoff
Failed items are retryable from the DLQ UI but there is no automatic exponential backoff.

### 🟢 9. PDF rendering on the main thread
On slow devices, generating a large PDF can freeze the tab.
- **Fix:** move generation to a Web Worker.

### 🟢 10. Code duplication
`Quotes.tsx` / `Invoices.tsx` and `PublicQuote.tsx` / `PublicInvoice.tsx` remain near-duplicates (~2,800 lines expressing two behaviours). This is how the PDF argument swap and the Paystack currency bug reached production in one path but not the other.

### Resolved (do not re-report)
AI context overflow · bank-account referential integrity · client clock drift · `is_pro`/`pro_expires_at` desync · public RPC rate limiting · plaintext gateway secrets · duplicate invoice numbers · shared sync watermark · logout trap · PDF sender/recipient swap · client-side-only quotas · 100× gateway billing · webhook amount verification · zero tests/CI/telemetry · Paystack webhook metadata mismatch · organization writes matching zero rows · `email-cron` wrong column name · instalment payments never reaching PAID · `recurring_schedules` never pulled · dead webhook URL shown to merchants · soft 404 / not indexed · RevenueChat starved of context · campaigns with no unsubscribe, suppression or batching.

---

## 15. Recent Work (Reverse Chronological)

- **2026-10-15 → 10-20 — Live-testing fixes.** Campaigns stuck on QUEUED: the Vault secrets the cron job reads were never created, so `url` and `Authorization` resolved to NULL; cron bodies now raise a message naming the missing secret (`20261015000000`), and `campaign-worker` also accepts a signed-in user (scoped to their own org) so the client dispatches immediately and cron is only a retry backstop. The immediate dispatch then failed on CORS — `campaign-worker` and `process-recurring-invoices` hand-rolled header lists missing `x-app-version`; all CORS now comes from `_shared/cors.ts`. `email-cron` had **never been scheduled**, so no payment reminder or Pro-expiry sweep had ever run; scheduled daily at 07:00 UTC (`20261015010000`) with a guard so one deleted client cannot abort the whole run. `get_public_profile` returned the raw `is_pro` flag to anon, so a lapsed Pro merchant kept online checkout on public invoices; it now returns resolved status (`20261018000000`). All customer-facing dates moved off ambiguous `toLocaleDateString()` to `formatDate` ("Oct 9, 2026"), CSV exports to ISO — caught by CI on its first run when the runner's US locale disagreed with the snapshot. Rich-text toolbar now shows active state, read from `queryCommandState` on `selectionchange`. Merchant webhook URLs are now `https://billreve.app/api/v1/webhooks/{paystack,flutterwave}`, proxied by a Vercel rewrite; old Supabase URLs keep working. Vitest default environment switched to `node` (jsdom per file cost ~14s and caused worker timeouts that silently skipped whole files).
- **2026-10-14 — Campaign system rebuild.** Replaced fire-and-forget bulk sending with a real pipeline: `campaigns` / `campaign_recipients` / `email_suppressions` / `campaign_credit_purchases` tables, `queue_campaign` as the only entry point, a cron-driven `campaign-worker` batching at Resend's 100-message cap with per-recipient tracking, Svix-verified `resend-webhook` feeding bounces and complaints into suppression, RFC 8058 one-click unsubscribe with a public unsubscribe page, and a `campaign-proofread` gate (deterministic blocking + AI advisory). New dependency-free `RichTextEditor` with image upload to a `campaign-assets` bucket, live desktop/mobile preview, and a quota meter. Pro-gated at 250 emails/month with a 2-per-week frequency limit and ₦2,000/1,000-email top-up packs. Migrations `20261014000000`–`20261014030000`.
- **2026-10-12/13 — Third audit remediation.** Fixed the Paystack webhook metadata mismatch that was failing **every** invoice payment; four `organizations` updates using `.eq('id', user.id)` that matched zero rows and silently saved nothing (now `lib/organization.ts`); `email-cron` selecting a non-existent `business_name` column so no reminder had ever sent; instalment payments never reaching PAID (now the `payment_events` ledger); `recurring_schedules` never being pulled by the sync engine; raw minor units in notification text; the dead `api.billreve.app` webhook URL shown to merchants; recurring invoices generated as silent drafts; dashboard card click inconsistency; the native date-picker icon colliding with the custom one; the Google soft 404 (no catch-all route plus a `/(.*) → /` rewrite); and RevenueChat, where `get_ai_context` returned a client *count* with no list, quotes or ids while the prompt instructed the model to use them. Migrations `20261012000000`–`20261013000000`.
- **2026-10-11 — Audit remediation.** Introduced `money.ts` / `_shared/money.ts` as the single unit boundary and fixed all four 100× payment bugs plus the quote counter-offer unit mismatch. Repaired `check_and_log_rate_limit` and `empty_trash_based_on_plan`, which still referenced the dropped `profiles` table and `user_id` column. Rewrote the AI quota to resolve tenancy through `organization_members` and fail closed. Restored idempotent `amount_paid`. Fixed logout leaving per-table watermarks behind, and the whitespace in `onConflict`. Un-stubbed Sentry and PostHog. Made `formatMoney` deterministic by deriving locale from currency. Migration `20261011000000`.
- **2026-10-10 (Phase 7 & 8).** Deployed Recurring Invoices full-stack. Refactored Dashboard charts. Fixed offline localStorage fallbacks by routing to Zustand state. Rewrote list filters with `useMemo`.
- **2026-10-09 (Phase 6).** Built the Sync Settings DLQ UI. Removed legacy API interceptors and consolidated `services/`.
- **2026-10-08 (Phase 4 & 5).** Re-architected money to integer minor units. Migrated `profiles` → `organizations` to lay groundwork for team accounts.
- **2026-10-03 (Phase 3).** Code-split the ~1MB PDF generator. Added the `logo_url` base64 `CHECK` constraint.
- **2026-10-02 (Phase 2).** Bank account snapshots on document creation, `Upgrade.tsx` feature flags, Edge middleware for dynamic OG tags, document themes across preview/PDF/public pages.
- **2026-10-02 (Phase 1).** Server-side rate limiting for public RPCs.
- **2026-09-28.** RevenueChat memory 20→50 messages with history persistence. AI context time-boxed to 90 days with a historical summary. Clock-drift LWW fix via the Supabase `Date` header. Base64 logo migration to Storage. Subscription expiry sweeper.
- **2026-09-21.** Documentation page redesign — two-column layout, 20-section TOC, `IntersectionObserver` scroll-spy, `rehype-slug` + `remark-gfm`.
- **2026-09-13.** Mobile overflow fix · notification loop animation · pending-invoice quick actions · `PGRST203` RPC overload fix · PENDING notification trigger · dynamic dashboard greeting · legacy bank column cleanup.
- **2026-09-12.** Dashboard PENDING filter · SaaS downgrade webhook · theme colour bleed fix · footer theme reactivity.
- **2026-09-08.** Payments & bank accounts refactor to JSONB · PWA SVG caching · quote public link copy button.
- **2026-09-05/06.** Settings and DocumentEditor modularization.

---

## 16. Key Developer Patterns & Rules

### DO
- Convert money **only** through `utils/money.ts` or `_shared/money.ts`
- Always write to Dexie first, then let the sync engine handle Supabase
- Use `useLiveQuery` from `dexie-react-hooks` for reactive data
- Use `const { x } = useAppStore()` reactively — never `useAppStore.getState()` in JSX
- Use `bg-purple-*` for all accent colors
- Add an explicit `.eq('organization_id', orgId)` on every write — do not rely on RLS alone
- Check `is_pro && (!pro_expires_at || pro_expires_at > now)` for Pro gating
- Run `npm test` and `npm run build` from `client/` before `git push`
- Apply migrations **before** deploying edge functions — functions fail closed when their RPCs are missing

### DON'T
- Don't write a bare `* 100` or `/ 100` anywhere outside the two money files
- Don't let the client assert `PAID` or supply `amount_paid` — that is the webhook's job
- Don't insert `campaign_recipients` from the client, or let the UI be the only proofread gate
- Don't delete a non-`MANUAL` suppression, and don't add a campaign send path that bypasses `_shared/email.ts`
- Don't trust `isProUser` or `aiPromptsUsed` from localStorage for anything that costs money
- Don't use `bg-blue-*` for accent colors — they render as purple globally
- Don't query Supabase directly from components for CRUD
- Don't rename the Dexie database string — it would orphan returning users' local data
- Don't put a secret in a `VITE_*` variable; it ships in the public bundle
- Don't set `isolate: false` in `vitest.config.ts` for speed — mocks leak across files
- Don't push to master without building first

---

## 17. Environment Variables

```env
# client/.env.local  — ALL of these ship in the public bundle
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_VERSION=1.5.0
VITE_SENTRY_DSN=            # optional; errors are invisible without it
VITE_POSTHOG_KEY=           # optional
VITE_POSTHOG_HOST=          # optional, defaults to https://us.i.posthog.com
VITE_ENABLE_CSV_IMPORT=false

# Supabase Edge Function secrets — set via `supabase secrets set`, NEVER VITE_*
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
RESEND_API_KEY=
SAAS_PAYSTACK_SECRET_KEY=
CRON_SECRET=
RESEND_WEBHOOK_SECRET=        # whsec_… from the Resend webhook settings
CAMPAIGN_SENDER_ADDRESS=      # noreply@campaigns.billreve.app — see §12
FRONTEND_URL=                 # used to build unsubscribe and public links
```

The `campaign-worker` cron job reads its own credentials from Supabase Vault rather than from a committed migration:

```sql
SELECT vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
SELECT vault.create_secret('<same value as CRON_SECRET>', 'cron_secret');
```

Merchant Paystack/Flutterwave **secret** keys are not environment variables — they are stored per-organization, encrypted, in `user_secrets`, and read only via `get_merchant_secret`.

---

**End of Document**
