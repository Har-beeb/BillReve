<div align="center">

<img src="./client/public/pwa-192x192.png" width="80" height="80" alt="BillReve Logo" />

# BillReve

**AI-powered invoicing for freelancers and small businesses.**

[![Live App](https://img.shields.io/badge/Live%20App-billreve.app-6d28d9?style=flat-square&logo=vercel&logoColor=white)](https://billreve.app)
[![Documentation](https://img.shields.io/badge/Docs-billreve.app%2Fdocumentation-5b21b6?style=flat-square)](https://billreve.app/documentation)
[![Version](https://img.shields.io/badge/version-1.5.0-a78bfa?style=flat-square)](https://github.com/Har-beeb/BillReve/releases)
[![License](https://img.shields.io/badge/license-MIT-4c1d95?style=flat-square)](LICENSE)

*Create, send, and get paid — even without internet.*

</div>

---

## What is BillReve?

BillReve is a **local-first, AI-powered invoicing and business management platform** for freelancers, consultants, and small businesses. It combines the snappiness of a native desktop app with the reliability of cloud sync, so you can always work — online or offline.

### Why BillReve?

| Problem | BillReve's Solution |
| --- | --- |
| Can't invoice when internet is down | Full offline mode — everything works locally first |
| Writing invoices line-by-line is slow | AI draft from one natural-language sentence |
| Back-and-forth quote negotiations via email | Built-in counter-offer & negotiation loop |
| Chasing clients for payment confirmation | Clients click "I've transferred" — you get notified instantly |
| Managing multiple tools (invoicing + email + reports) | Everything in one place |

---

## ✨ Feature Highlights

### 🧾 Invoicing & Quotes
- Full invoice lifecycle: `DRAFT → SENT → PENDING → PAID` (+ `PARTIAL`, `OVERDUE`, `VOID`)
- Quote negotiation loop with counter-offers, server-enforced minimum counter limits, and redraft mechanic
- One-click conversion from accepted quote to invoice
- Recurring invoices — schedule a template and let `pg_cron` generate and send on cadence
- 5 professionally designed PDF templates (Standard, Professional, Modern, Classic, Monochrome)
- Per-invoice currency override
- Gapless, per-organization sequential document numbers assigned server-side

### 🤖 AI Capabilities
- **AI Document Drafting** — describe your invoice/quote in plain English (or speak it, or upload an image/PDF) and get a pre-filled editor
- **RevenueChat** — conversational AI assistant that knows your business data. Ask "Who owes me money?" or "Create an invoice for John" — it responds with answers and actionable cards
- **AI CFO Report** *(Pro)* — comprehensive AI-written financial analysis of your business
- **AI Email Campaigns** — draft and send bulk emails to your entire client directory in seconds

### 🔄 Offline-First Sync
- All data stored locally in **IndexedDB** (via Dexie.js)
- Every action writes locally first — zero-latency UI
- Background sync pushes changes to Supabase cloud every 10 seconds
- Supabase Realtime subscriptions for instant multi-device updates
- Polling pauses entirely while the tab is hidden, with one catch-up sync on return
- **Last-Write-Wins** conflict resolution with server-clock-drift correction; `PAID`/`ACCEPTED` statuses are always protected
- Per-table sync watermarks, so a busy table can never cause another's changes to be skipped
- Failed pushes surface in a dead-letter queue in Settings → Sync, with a retry action

### 💸 Payments
- Bank transfer details embedded in every public invoice (free)
- **Paystack** and **Flutterwave** gateway integrations *(Pro)*
- Webhook-based automatic `PAID` status updates, with the paid amount and currency verified against the invoice before anything is marked settled
- Partial payment recording with running balance

### 📧 Automated Reminders *(Pro)*
- Scheduled email reminders at: -3 days, due date, +3, +7, +14 days
- Automatically skips paid invoices — no manual management needed

### 🎨 Theming & Personalization
- 8 built-in colour themes + fully custom hex colour picker
- Auto-generates a complete 10-shade colour palette from any custom colour
- Dark mode with persistent preference
- 5 font families and 3 font sizes
- Configurable mobile navigation (bottom bar or sidebar drawer)

### 🔐 Security
- Supabase Row Level Security on every table, scoped by organization membership
- Merchant payment gateway secret keys encrypted at rest with `pgcrypto`, readable only by Edge Functions through a locked-down RPC
- Public links use random document IDs — not guessable
- Public status endpoints are rate limited per source address *and* per document, and cannot set `PAID` — only a signature-verified gateway webhook can
- Webhook signatures compared in constant time
- Plan limits and AI quotas enforced server-side, not in the browser
- AI never receives raw client contact details

---

## 💳 Free vs Pro

| | Free | Pro |
| --- | --- | --- |
| Invoices | 10 / month | Unlimited |
| Quotes | 10 / month | Unlimited |
| Clients | 5 | Unlimited |
| AI prompts | 10 / month | Unlimited |
| Trash retention | 7 days | 30 days |
| Payment gateways | — | Paystack, Flutterwave |
| Automated reminders | — | ✓ |
| AI CFO Report | — | ✓ |

Limits are enforced by Postgres triggers and inside the `ai` Edge Function, so they hold regardless of what the client does. Pro is ₦3,500/month.

> **Note:** automated Pro checkout is currently disabled pending payment-processor business verification. Upgrades run through a manual bank transfer flow in the meantime — see `Upgrade.tsx`.

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 19 + Vite 8 + TypeScript 6 (strict) |
| **Styling** | Tailwind CSS v4 + Framer Motion |
| **State** | Zustand (with persistence) |
| **Local DB** | Dexie.js (IndexedDB) |
| **Cloud DB** | Supabase (PostgreSQL + RLS) |
| **Auth** | Supabase Auth (Email/Password + Google OAuth) |
| **Backend** | Supabase Edge Functions (Deno) |
| **AI** | Google Gemini API (server-side proxy only) |
| **Email** | Resend |
| **Payments** | Paystack, Flutterwave (webhooks) |
| **Testing** | Vitest + Testing Library + jsdom |
| **CI** | GitHub Actions (typecheck → test → build → lint) |
| **Observability** | Sentry (errors) + PostHog (analytics), both optional |
| **Deployment** | Vercel (client) + Supabase Cloud (server) |
| **PWA** | Vite PWA plugin (Workbox, offline-first SW) |

### The Sync Engine

The heart of BillReve's offline-first architecture is `client/src/services/syncEngine.ts`:

```
User Action
    │
    ▼
Local IndexedDB Write (instant)
    │
    ├─▶ UI updates immediately (no latency)
    │
    ▼
Background SyncEngine (every 10s, paused while tab hidden)
    │
    ├─▶ PUSH: drain syncQueue → upsert to Supabase
    │          on conflict (organization_id, local_id)
    │          failures land in the dead-letter queue
    │
    └─▶ PULL: rows where updated_at > per-table watermark
            │   (also triggered instantly by Realtime)
            │
            └─▶ Merge remote changes into IndexedDB
                    │
                    └─▶ LWW conflict resolution, clock-drift corrected
                           (PAID/ACCEPTED statuses always win)
```

### Money representation

**Every monetary value in BillReve is an integer in minor units** — kobo, cents, pesewas. Postgres columns are `BIGINT`, Dexie mirrors them, and all arithmetic and comparison happens in minor units. Floating-point currency is never stored.

Conversion happens in exactly one place: `client/src/utils/money.ts`, mirrored for Deno at `server/supabase/functions/_shared/money.ts`. Those files also encode the fact that the two payment gateways disagree — **Paystack speaks minor units, Flutterwave speaks major units**. If you find yourself writing `* 100` or `/ 100` anywhere else, it belongs in `money.ts` instead.

### Database Schema (Supabase)

| Table | Key Columns | Notes |
| --- | --- | --- |
| `organizations` | `id`, `name`, `logo_url`, `currency`, `bank_accounts` (jsonb), `is_pro`, `pro_expires_at` | The tenant. Replaced the old `profiles` table |
| `organization_members` | `organization_id`, `user_id`, `role` | Maps auth users to tenants. `role` ∈ owner/admin/member |
| `clients` | `local_id`, `organization_id`, `name`, `email`, `deleted_at` | Soft-delete via `deleted_at` |
| `invoices` | `local_id`, `organization_id`, `client_id`, `status`, `total` (bigint), `items` (jsonb) | `local_id` is the offline-generated UUID and the real join key |
| `quotes` | `local_id`, `organization_id`, `status`, `counter_amount`, `minimum_counter_amount` | Negotiation state lives here |
| `recurring_schedules` | `local_id`, `organization_id`, `template_invoice_id`, `next_run_date` | Driven by `pg_cron` |
| `notifications` | `organization_id`, `type`, `title`, `is_read` | In-app notification feed |
| `user_secrets` | `organization_id`, encrypted gateway keys (`bytea`) | `pgcrypto`-encrypted; read only via `get_merchant_secret` |
| `user_sequences` | `organization_id`, `entity`, `last_value` | Backs gapless invoice/quote numbering |
| `api_logs` | `organization_id`, `endpoint`, `created_at` | Backs API rate limiting and the AI quota |
| `rate_limits` | `identifier`, `action`, `attempted_at` | Public-endpoint throttling |
| `webhook_logs` | raw payload, status | Webhook audit trail |

Bank accounts are a JSONB array on `organizations`, not a separate table. Documents additionally freeze a `bank_account_snapshot` at creation so historical invoices keep correct payment details even if the account is later deleted.

> ⚠️ `server/supabase/schema.sql` is a point-in-time dump and currently **predates** the multi-tenant migration. Re-dump it after applying migrations — the migration files are the source of truth.

### Edge Functions

| Function | Trigger | Purpose |
| --- | --- | --- |
| `send-email` | HTTP | Send transactional emails (invoices, quotes, welcome) via Resend |
| `ai` | HTTP | Proxy to Google Gemini. Enforces auth, Pro gating, monthly AI quota, and rate limits |
| `email-cron` | Cron (daily) | Invoice reminders; also sweeps expired Pro subscriptions |
| `email-worker` | Queue | Process email queue reliably |
| `process-recurring-invoices` | Cron (`pg_cron`) | Generate and send invoices from recurring schedules |
| `paystack-webhook` | Webhook | Verify signature + amount + currency, then settle the invoice |
| `flutterwave-webhook` | Webhook | Verify signature + amount + currency, then settle the invoice |
| `saas-webhook` | Webhook | Handle Pro subscription events (min-amount checked before granting) |

---

## 📂 Project Structure

```
BillReve/
├── .github/workflows/ci.yml         # typecheck → test → build → lint
├── AGENTS.md                        # instructions for AI coding agents
├── client/
│   ├── public/                      # Static assets, manifest
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/                # Auth UI (OAuthButton, AuthInput)
│   │   │   ├── editor/              # DocumentEditor sub-components
│   │   │   ├── settings/            # Settings tab sub-components
│   │   │   └── ui/                  # Design system primitives
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Invoices.tsx  Quotes.tsx  Clients.tsx
│   │   │   ├── Recurring.tsx  Reports.tsx  Campaigns.tsx
│   │   │   ├── Payments.tsx  Trash.tsx  Settings.tsx
│   │   │   └── public/              # Public pages (no auth)
│   │   │       ├── Documentation.tsx
│   │   │       └── LandingPage.tsx
│   │   ├── layouts/                 # MainLayout, PublicLayout
│   │   ├── store/useAppStore.ts     # Zustand global state
│   │   ├── services/
│   │   │   ├── syncEngine.ts        # Core offline sync engine
│   │   │   └── ai.ts                # AI client wrapper
│   │   ├── db/db.ts                 # Dexie IndexedDB schema (v4)
│   │   ├── lib/monitoring.ts        # Sentry + PostHog init
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── utils/
│   │   │   ├── money.ts             # ← the ONLY unit-conversion boundary
│   │   │   ├── formatters.ts  pdfGenerator.tsx  csvGenerator.ts
│   │   │   └── *.test.ts            # Vitest suites
│   │   └── index.css                # Tailwind v4 theme + global styles
│   ├── vitest.config.ts
│   └── vite.config.ts
│
└── server/
    └── supabase/
        ├── functions/
        │   ├── _shared/money.ts     # Deno mirror of the money boundary
        │   ├── ai/  send-email/  email-cron/  email-worker/
        │   ├── process-recurring-invoices/
        │   └── paystack-webhook/  flutterwave-webhook/  saas-webhook/
        ├── migrations/              # SQL schema migrations (source of truth)
        └── schema.sql               # Point-in-time dump (see warning above)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20.19 or ≥ 22.12 (required by Vite 8)
- **npm**
- **Docker** — for `supabase start` (local Postgres)
- A **Supabase** project ([supabase.com](https://supabase.com))
- A **Google Gemini** API key ([ai.google.dev](https://ai.google.dev))
- A **Resend** account for transactional email ([resend.com](https://resend.com))

### 1. Clone the repository

```bash
git clone https://github.com/Har-beeb/BillReve.git
cd BillReve
```

### 2. Set up the client

```bash
cd client
cp .env.example .env.local
```

Fill in your values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Optional but strongly recommended in production
VITE_SENTRY_DSN=
VITE_POSTHOG_KEY=
```

> 🔒 **Never put the Gemini key, or any gateway secret key, in a `VITE_*` variable.** Anything prefixed `VITE_` is compiled into the public JavaScript bundle. The Gemini key lives only in Supabase Edge Function secrets, and merchant gateway secrets live encrypted in `user_secrets`.

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### 3. Set up the database

Locally, which is the recommended way to validate migrations:

```bash
cd server
supabase start
supabase db reset        # replays every migration from scratch
```

Against a hosted project:

```bash
supabase link --project-ref your_project_ref
supabase db push         # ⚠️ applies to the LINKED project — check which one
```

Then enable **Realtime** for `invoices`, `quotes`, `clients`, `recurring_schedules` and `notifications`.

### 4. Deploy Edge Functions

Run the migrations **before** deploying functions — several functions depend on RPCs the migrations define, and they fail closed rather than silently degrading.

```bash
cd server
supabase functions deploy send-email ai email-cron email-worker \
  process-recurring-invoices paystack-webhook flutterwave-webhook saas-webhook
```

Set the required secrets:

```bash
supabase secrets set GEMINI_API_KEY=your_key
supabase secrets set RESEND_API_KEY=your_key
supabase secrets set SAAS_PAYSTACK_SECRET_KEY=your_key
supabase secrets set CRON_SECRET=your_random_string
```

### 5. Run the checks

```bash
cd client
npm test            # Vitest, single run
npm run build       # tsc -b && vite build
npm run lint
```

`npm run build` must exit 0 before you push — see `.agents/rules/git-push-policy.md`.

### 6. Build for production

Deploy the `dist/` folder to any static host (Vercel recommended — already configured via `vercel.json`).

---

## 🧪 Testing & CI

| Suite | Covers |
| --- | --- |
| `utils/money.test.ts` | The unit boundary: major↔minor round-trips, per-gateway conversion, webhook settlement comparison, counter-offer conversion |
| `utils/formatters.test.ts` | `formatMoney`, `roundMoney`, `formatCompactMinor`, `calculatePercentage` |
| `services/syncEngine.test.ts` | Push/pull paths, `onConflict` target, organization scoping, per-table watermarks |
| `components/DocumentPreview.test.tsx` | Rendered-document snapshot |

`.github/workflows/ci.yml` runs on push and PR to `main`/`master`, in the order typecheck → test → build → lint. Lint runs last deliberately: a style regression should never stop the three checks that actually matter from reporting.

Vitest uses the `threads` pool with a single worker. Do not switch to `isolate: false` for speed — several suites `vi.mock` shared modules and disabling isolation lets mocks leak between files.

---

## 🎨 UI/UX Philosophy

BillReve is designed to feel **premium and frictionless**:

- **Local-first** — The UI never waits for the server. Everything feels instant.
- **Typography hierarchy** — Playfair Display for display headings, Plus Jakarta Sans for UI text, Fira Code for code/mono elements.
- **Micro-animations** — Framer Motion powers smooth page transitions, list reordering, and interactive states.
- **Responsive by default** — From 320px mobile to 4K desktop. Bottom navigation on mobile, sidebar on desktop.
- **Accessible themes** — 8 built-in themes + custom colour. All themes maintain WCAG AA contrast ratios.
- **Dark mode first** — Dark mode was built in from day one, not bolted on.

---

## 🔑 Key Developer Notes

> **Money rule:** All monetary values are integers in minor units. Convert only through `utils/money.ts` (or `_shared/money.ts` in Edge Functions). Never write a bare `* 100` or `/ 100`. Paystack expects minor units; Flutterwave expects major units; `toGatewayAmount()` knows the difference.

> **Sync rule:** Never write directly to Supabase from components. Always write to Dexie (IndexedDB) and let the SyncEngine handle cloud replication. The only tolerated exceptions are `organizations` profile writes in `App.tsx` and `OnboardingWizard.tsx`, because `organizations` is not a synced entity.

> **Theme rule:** The app maps `blue-*` Tailwind classes to the purple brand palette in `index.css`. **Always use `purple-*` for accent colours** in new code — never `blue-*`.

> **Tenancy rule:** Every entity row is keyed by `organization_id`, resolved via `organization_members`. There is no `user_id` column and no `profiles` table. Always include an explicit `.eq('organization_id', orgId)` on writes rather than relying on RLS alone.

> **Pro check:** `is_pro` on `organizations` is not self-managed — it is set by the `saas-webhook` Edge Function and protected by a Postgres trigger that silently discards client-side changes. Always check `is_pro && (!pro_expires_at || pro_expires_at > now)`.

> **Payment truth:** The browser may never assert that money arrived. Public endpoints can move an invoice to `PENDING`; only a signature-verified webhook that has compared amount and currency may set `PAID` or write `amount_paid`.

---

## 📋 Known Limitations & Roadmap

### Resolved Tech Debt & Optimizations ✅

| Issue | Resolution |
| --- | --- |
| **Public Endpoint Abuse** | `update_invoice_status_public` / `update_quote_status_public` validate status against an allow-list, refuse `PAID`/`PARTIAL`, write `amount_paid` idempotently, and rate limit per source address *and* per document |
| **100× Billing on Checkout** | Gateway amounts now cross a single typed boundary (`money.ts`), with regression tests asserting each gateway's convention |
| **Payments Never Reconciling** | Both payment webhooks convert gateway amounts into minor units before comparing against the invoice total |
| **Historic Payment Data Loss** | Documents freeze a `bank_account_snapshot` JSONB at creation |
| **Plaintext Gateway Secrets** | `user_secrets` columns are `pgcrypto`-encrypted `bytea`, reachable only through `get_merchant_secret` |
| **Client-Side Quota Bypass** | Document and AI limits enforced by Postgres triggers and inside the `ai` Edge Function; all failure paths fail closed |
| **Duplicate Invoice Numbers** | Per-organization Postgres sequences; offline documents carry a `DRAFT-` prefix until the sequence assigns a real number |
| **Silent Cross-Table Data Loss** | Per-table sync watermarks, cleared on logout so a second user on the same browser starts clean |
| **Logout Trap** | Logout is never blocked by a poisoned sync queue; unsynced items are surfaced with an explicit confirmation |
| **PDF Sender/Recipient Swap** | `generateDocumentPdf` takes a named options object, so positional confusion is impossible |
| **PDF Generator Bundle Bloat** | `pdfGenerator.tsx` + `html2pdf.js` (900KB+) lazily loaded via dynamic import |
| **AI Payload Token Bloat** | `RevenueChat` and `AICfoReport` both use the `get_ai_context` RPC for server-side aggregation |
| **Aggressive Background Polling** | Sync engine pauses polling on `visibilitychange`, with one catch-up sync on return |
| **`logo_url` Base64 Crashes** | Postgres `CHECK` constraint blocks base64; legacy strings auto-migrate to Supabase Storage |
| **Client Clock Drift (LWW)** | `serverTimeOffsetMs` computed from the Supabase `Date` header and applied during conflict resolution |
| **Money Precision Loss** | All currency stored as integer minor units in both Postgres and Dexie |
| **Multi-Tenant Foundation** | `profiles` replaced by `organizations` + `organization_members` with membership-based RLS |
| **Dead Letter Queue** | Failed sync payloads surfaced in `SyncSettings.tsx` with a retry action |
| **React CPU Spikes** | `useMemo` on inline filters; dictionary caching replaces O(N×M) client metric loops |
| **No Tests / No CI / No Telemetry** | Vitest suites, GitHub Actions pipeline, and Sentry + PostHog wiring |

### Pending Tech Debt 🚧

| Issue | Severity | Notes |
| --- | --- | --- |
| **Automated Pro checkout disabled** | High | `Upgrade.tsx` is locked to manual bank transfer pending payment-processor business verification. Blocks all self-serve revenue. |
| **`schema.sql` is stale** | Medium | Predates the multi-tenant migration. Re-dump so the committed schema matches production. |
| **Flutterwave webhook trusts its payload** | Medium | Should re-verify via `GET /v3/transactions/:id/verify`, which needs a Flutterwave API secret stored separately from the verif-hash. |
| **No webhook idempotency key** | Medium | Handlers set absolute values so replay is not a double-count, but storing the gateway reference would make reconciliation auditable. |
| **~250 `any` usages** | Low | `no-explicit-any` is a warning so CI stays useful; worth paying down incrementally. |
| **No sync retry backoff** | Low | Failed items are retryable from the DLQ UI but there is no automatic exponential backoff. |
| **Team accounts not reachable** | Low | Schema and owner-gated policies exist; invite flow and role enforcement in the UI do not. |

### Roadmap 🔜

| Feature | Notes |
| --- | --- |
| Automate Pro checkout | Highest-value item — everything else is gated behind it |
| Team accounts / multi-user | `organization_id` groundwork and RBAC policies are in place; needs an invite flow |
| Stripe gateway | Not implemented. Paystack and Flutterwave are live |
| Accounting integrations | Sync finalized documents to QuickBooks or Xero |
| Native mobile app (React Native / Expo) | PWA is the current mobile solution |

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ☕ and late nights by [Har-beeb](https://github.com/Har-beeb)

**[billreve.app](https://billreve.app)** · **[Documentation](https://billreve.app/documentation)** · **[Support](https://billreve.app/support)**

</div>
