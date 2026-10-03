# BillReve — Technical Working Document
*Last updated: 2026-09-21 | Version: 1.4.1*

> This document is the **authoritative internal reference** for BillReve. It is written for developers, AI agents, and collaborators continuing work on this project. It must be kept up-to-date after every significant change.

---

## 1. Project Overview & Tech Stack

BillReve is an **offline-first, AI-powered invoicing and billing SaaS** for freelancers and small-to-medium businesses. It is built to function flawlessly with zero internet connection, syncing automatically to the cloud when connectivity is restored.

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS v4 + custom CSS variable theme engine |
| Animations | Framer Motion |
| State Management | Zustand (`useAppStore.ts`) |
| Local Database | Dexie.js (IndexedDB wrapper) |
| Cloud Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| Serverless Functions | Supabase Edge Functions (Deno) |
| PWA | `vite-plugin-pwa` + Workbox |
| PDF Generation | Client-side custom renderer (`pdfGenerator.tsx`) |
| AI | Google Gemini via Supabase Edge Function proxy |

---

## 2. Full Feature Inventory

### Core Business Features
- **Invoicing Engine** — Full lifecycle: `DRAFT → SENT → PENDING → PARTIAL → PAID → OVERDUE → VOID`
- **Quotes & Negotiation Loop** — Lifecycle: `DRAFT → SENT → ACCEPTED / DECLINED / COUNTERED`. Clients can counter-offer via public link; admin can accept counter, decline, or redraft a new version
- **Quote → Invoice Conversion** — One-click conversion preserves all line items
- **Client Directory** — Full CRUD, soft-delete, CSV import via wizard
- **Payments Tab** — Manual bank transfer accounts (free), Paystack / Flutterwave / Stripe gateway (Pro)
- **Trash & Auto-Purge** — Soft-deleted records are recoverable for 7 days (Free) or 30 days (Pro), then auto-purged
- **Email Campaigns** — Promotional emails sent to client directory
- **Reports & CFO Insights** — Financial summaries, revenue/outstanding/overdue charts, AI CFO report generation
- **PDF Export** — 5 distinct themes (Standard, Professional, Modern, Classic, Monochrome) with live logo and branding

### SaaS / Platform Features
- **Subscription Tiers** — Free vs. Pro with feature gating via `isPro` boolean
- **Quota System** — Limits on invoices, clients, and AI prompts per tier
- **Automated Payment Webhooks** — Paystack, Flutterwave, SaaS subscription webhooks
- **Automated Email Reminders** — Scheduled cron at -3, 0, +3, +7, +14 days from due date

### AI Features
- **RevenueChat** — Persistent conversational assistant embedded on the dashboard. Can answer financial questions and issue Action Cards (draft invoice, create quote)
- **AI Draft Modal (`AiDraftModal.tsx`)** — Drag-and-drop/voice/text invoice/quote generation with line-item parsing

### UX & App Features
- **Offline-First Sync** — All writes go to IndexedDB first; cloud sync happens in background
- **PWA Support** — Installable on mobile and desktop. Works fully offline after first load
- **Multi-Theme Engine** — 7 preset themes + custom hex color picker
- **Dark Mode** — Full dark mode with persistence
- **Font Preferences** — Multiple font options with size controls
- **Getting Started Checklist** — Onboarding wizard guides new users through first setup steps
- **Notification System** — In-app notifications for invoice paid, counter offer received, payment pending
- **Public Invoice Links** — `/pay/:id` — client-facing view with payment flow
- **Public Quote Links** — `/quote/:id` — client-facing view with accept/decline/counter flow

---

## 3. Database Schema (Supabase PostgreSQL + Dexie.js Parity)

> Both databases mirror each other. The Dexie schema is the source of truth for local structure; Supabase mirrors it with additional server-only columns.

### `profiles`
```
id (uuid, FK → auth.users)
name, email, phone, address
logo_url (text — currently stores base64 ⚠️ See Risks)
country, currency
industry, business_description
bank_accounts (JSONB array of {id, bankName, accountName, accountNumber, isDefault})
is_pro (boolean)
pro_expires_at (timestamptz)
ai_prompts_used (integer)
getting_started_completed (boolean)
```

### `clients`
```
localId, userId, name, email, phone, address
syncStatus ('PENDING' | 'SYNCED' | 'ERROR')
updatedAt, createdAt
deletedAt (soft delete), isPurged (boolean)
```

### `invoices`
```
localId, userId, clientId
invoiceNumber, status, description
items (JSONB — array of line items)
taxes (JSONB — array of tax rules)
subtotal, total, amountPaid
currency, dueDate, createdAt, updatedAt
bankAccountId (references bank_accounts[].id in profiles)
counterAmount, clientMessage
syncStatus, deletedAt, isPurged
```

### `quotes`
```
(Same base as invoices, plus:)
quoteNumber, expiresAt
allowCounterOffer (boolean)
minimumCounterAmount
```

### `payments`
```
localId, userId, invoiceId
amount, method, paidAt
reference, notes
syncStatus
```

### `campaigns`
```
localId, userId, subject, body
sentAt, recipientCount
syncStatus
```

### `notifications` (Supabase only, not synced locally)
```
id, user_id, title, message, type, entity_id
is_read (boolean), created_at
```

### `syncQueue` (Dexie/local only — never synced to Supabase)
```
id, table, localId, operation ('CREATE' | 'UPDATE' | 'DELETE')
payload (JSONB), createdAt, attempts
```

---

## 4. Migration History (Supabase)

Migrations are in `server/supabase/migrations/`. Key milestones:

| File | Purpose |
|---|---|
| Early migrations | Initial schema: profiles, clients, invoices, quotes |
| `*_add_payments_table*` | Added `payments` table |
| `*_add_bank_accounts_jsonb*` | Migrated bank details from flat columns to `bank_accounts` JSON array |
| `*_add_notifications*` | Added `notifications` table with type/entity_id fields |
| `*_add_campaigns*` | Added `campaigns` table |
| `*_public_read_policies*` | Added RLS policies for public invoice/quote read access |
| `*_revert_notifications_to_triggers*` | Moved notification logic from RPCs into Postgres triggers |
| `*_create_logos_bucket*` | Created Supabase Storage bucket for logo uploads (partially implemented) |
| `*_fix_public_status_rpc*` | Fixed the `update_invoice_status_public` overload conflict (PGRST203 bug) |

---

## 5. API / RPC & Edge Function Catalogue

### Supabase RPCs (Postgres Functions)

| Function | Caller | Purpose |
|---|---|---|
| `update_invoice_status_public(p_local_id, p_status, p_amount_paid)` | `PublicInvoice.tsx` | Allows unauthenticated clients to set invoice to PENDING |
| `update_quote_status_public(p_local_id, p_status, p_counter_amount, p_client_message)` | `PublicQuote.tsx` | Allows clients to accept/decline/counter a quote |
| `auto_empty_trash` | Cron / Trigger | Purges soft-deleted rows past retention period |

### Postgres Triggers

| Trigger | Table | Function | Purpose |
|---|---|---|---|
| `on_invoice_status_change` | `invoices` | `handle_invoice_status_change()` | Creates notifications for PAID, PARTIAL, PENDING status changes |
| `on_quote_status_change` | `quotes` | `handle_quote_status_change()` | Creates notifications for ACCEPTED, DECLINED, COUNTERED |

> **Important:** Both trigger functions check `auth.uid() IS NOT DISTINCT FROM NEW.user_id` to prevent self-notifications when the admin changes their own records. Notifications only fire when the change originates from a public (unauthenticated) link.

### Supabase Edge Functions

| Function | Trigger | Purpose |
|---|---|---|
| `ai` | HTTP POST from client | Proxies requests to Gemini API with business context |
| `email-cron` | Daily cron schedule | Scans invoices for upcoming/overdue dates; dispatches reminder emails |
| `email-worker` | HTTP (internal) | Sends transactional emails via email provider |
| `send-email` | HTTP | Generic email dispatch endpoint |
| `saas-webhook` | Paystack/Flutterwave webhook | Handles Pro subscription upgrades, renewals, cancellations, and failed charges |
| `paystack-webhook` | Paystack POST | Payment confirmation for invoice payments |
| `flutterwave-webhook` | Flutterwave POST | Payment confirmation for invoice payments |

---

## 6. State Management Architecture

### Zustand (`useAppStore.ts`)
Manages non-volatile UI state only. Persisted to `localStorage`.

**Stores:**
- `user` — Supabase auth session object
- `businessProfile` — lightweight mirror of `profiles` row (name, currency, is_pro, etc.)
- `theme` — active theme class string
- `customColor` — hex string for custom theme
- `fontSize` — user font size preference
- `mobileNavStyle` — bottom bar vs. slide-out sidebar preference
- `isDarkMode`
- `isOnline` — connectivity flag
- `lastSyncTime` — cursor timestamp used by sync engine

**Pattern:** Use the Zustand hook reactively inside components: `const { isPro } = useAppStore()`. Do NOT use `useAppStore.getState()` in JSX — this is non-reactive and will not trigger re-renders.

### Dexie.js (IndexedDB)
Source of truth for all heavy entities. Accessed via `dexie-react-hooks` (`useLiveQuery`) for reactive real-time UI updates without needing Zustand subscription.

---

## 7. Sync Engine Deep Dive (`client/src/services/syncEngine.ts`)

The sync engine is the most critical service. It maintains the offline-first guarantee.

### Flow
```
User Action
  → Write to Dexie (immediate, offline-safe)
  → Add to syncQueue (localId, table, operation, payload)
  → UI updates instantly via useLiveQuery

Background (every 10 seconds OR on reconnect):
  → Push: Read syncQueue → Upsert to Supabase → Mark as SYNCED
  → Pull: Fetch Supabase rows where updated_at > lastSyncTime → Merge to Dexie
  → Realtime subscription: Supabase Postgres Changes → instant pull on remote update
```

### Conflict Resolution (Last-Write-Wins)
- Compares local `updatedAt` vs. remote `updatedAt`
- Remote wins if remote timestamp is newer
- **Priority override:** Statuses like `PAID`, `ACCEPTED` always win regardless of timestamp to prevent accidentally reverting confirmed payments

### Known Weakness ⚠️
Client clock drift. If a user's local device clock is wrong, the LWW logic will favour the wrong record. See Section 15 for the recommendation.

---

## 8. Auth & Subscription Logic

### Authentication
- Handled entirely by Supabase Auth (email/password + Google OAuth)
- Session is stored in Zustand after `supabase.auth.getSession()`
- `App.tsx` sets up the `onAuthStateChange` listener to keep Zustand in sync

### isPro Check
```typescript
// Correct pattern — always read from Zustand reactively:
const { businessProfile } = useAppStore();
const isPro = businessProfile?.is_pro && 
  (!businessProfile?.pro_expires_at || new Date(businessProfile.pro_expires_at) > new Date());
```

> **Note:** `is_pro` being `true` in the DB while `pro_expires_at` is past means the user is **downgraded** even though the boolean says true. The app frontend correctly handles this, but agents should be aware: `is_pro = true` alone is NOT sufficient.

### Subscription Webhook Flow (`saas-webhook/index.ts`)
```
Paystack sends webhook event
  → charge.success: Sets is_pro = true, sets pro_expires_at
  → subscription.disable / charge.failed: Sets is_pro = false, clears pro_expires_at
```

---

## 9. Theming System (`client/src/index.css`)

### Preset Themes
Applied as a class on `<html>` element (e.g., `class="theme-ocean dark"`):

| Class | Accent Color Palette |
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
When the user picks a custom hex (`#RRGGBB`), `MainLayout.tsx` uses the `generatePalette()` function to produce a 10-shade scale from black to white and injects it as inline CSS variables directly on `<html>`.

### Critical Rule ⚠️
The global `index.css` maps **all Tailwind `blue-*` classes** to the app's purple palette. This means `bg-blue-600` renders as dark purple in BillReve. **Never use `bg-blue-*` or `text-blue-*` for accent colors** — use `bg-purple-*` instead. This was the root cause of the Ocean theme appearing purple.

---

## 10. AI Integration

### RevenueChat (`components/RevenueChat.tsx`)
- Floating button on dashboard, expands to full chat panel
- Sends business context (aggregated invoice/client data) to the Gemini edge function
- Can issue **Action Cards** — structured JSON responses that spawn UI actions (e.g., open invoice editor with prefilled data)
- AI prompt usage is tracked in `profiles.ai_prompts_used` and enforced server-side

### AiDraftModal (`components/AiDraftModal.tsx`)
- Accessible from Dashboard Quick Actions and Document Editor
- Supports three input modes: **text description**, **voice dictation**, and **file upload** (image/PDF parse)
- Returns structured JSON matching the Invoice/Quote schema, pre-filling the DocumentEditor

### ⚠️ Risk: AI Context Size
RevenueChat currently sends **all invoices, quotes, and clients** to the LLM on every request. For large datasets this will:
1. Exceed token limits and truncate context
2. Increase latency and API cost significantly
3. Potentially expose more data than necessary

---

## 11. PDF Generation (`utils/pdfGenerator.tsx`)

- Renders entirely client-side — no server required
- Five themes: Standard, Professional, Modern, Classic, Monochrome
- Uses inline HTML/CSS rendered to canvas via browser APIs
- Embeds business logo (base64) directly into the PDF
- Supports multi-page documents with automatic pagination

---

## 12. Email System

### Automated Reminders (`email-cron`)
- Runs on a daily cron schedule via Supabase
- Scans `invoices` table for records where `dueDate` matches the reminder windows: -3, 0, +3, +7, +14 days
- Checks `last_reminded_at` to ensure idempotency — no duplicate sends for the same threshold
- Sends via `send-email` edge function

### Campaigns (`campaigns` table + `Campaigns.tsx`)
- Admin composes subject + body
- Sent to all clients in directory
- Tracked with `sentAt` and `recipientCount`

---

## 13. Public-Facing Pages

### `/pay/:id` (`PublicInvoice.tsx`)
- Unauthenticated. Uses `update_invoice_status_public` RPC (SECURITY DEFINER)
- Shows invoice details, payment options based on admin's configured payment methods
- **Manual transfer:** Client clicks "I've transferred the funds" → invoice transitions to `PENDING`
- **Paystack/Flutterwave:** Payment gateway iframe embedded (Pro feature)
- After payment confirmation, Paystack/Flutterwave webhook fires and updates the invoice to `PAID`

### `/quote/:id` (`PublicQuote.tsx`)
- Unauthenticated. Uses `update_quote_status_public` RPC
- Client can Accept, Decline, or Counter-offer
- Counter-offer stores `counterAmount` and `clientMessage` on the quote row
- Admin is notified via Postgres trigger → `notifications` table

---

## 14. Risks, Bugs & Technical Debt

> **Priority:** 🔴 Critical | 🟡 Medium | 🟢 Low

### 🔴 1. Logo Stored as Base64 in PostgreSQL
`profiles.logo_url` currently stores raw base64 image strings. This:
- Bloats the Supabase DB row size significantly on every profile sync
- Slows down the initial `fetchProfile` call
- Can cause JSON payload size errors
- **Fix:** Use Supabase Storage Bucket (the `logos` bucket from migration `20260805210001_create_logos_bucket.sql` already exists). Upload logo to bucket and store only the public URL. **This is the highest priority tech debt item.**

### 🔴 2. AI Context Window Overflow
RevenueChat sends the entire user database to Gemini on every message. For users with 500+ invoices, this will fail silently or produce degraded results.
- **Fix:** Pre-aggregate: send only summary stats (total revenue, top 10 clients, last 20 invoices) rather than raw arrays.

### 🟡 3. Bank Account Referential Integrity
Invoices store `bankAccountId` (a reference to a UUID inside `profiles.bank_accounts` JSON array). If the user deletes or edits that bank account, old invoices point to a ghost ID and won't render the correct bank details on PDFs or public pages.
- **Fix:** Snapshot the full bank details object (name, number, bank) into the invoice at creation time. The `bankAccountId` should remain for reference but the snapshot ensures immutability.

### 🟡 4. Client-Side Clock Drift in Sync Engine
LWW conflict resolution uses `new Date().toISOString()` — a client-generated timestamp. A device with a wrong clock will always "win" conflicts incorrectly.
- **Fix:** Use Supabase's `now()` server timestamp for `updated_at` when syncing. Compare server timestamps only.

### 🟡 5. `is_pro` vs. `pro_expires_at` Desync
The `is_pro` boolean can remain `true` even after `pro_expires_at` has passed. The frontend correctly reads both, but the database is technically in an inconsistent state. The SaaS webhook doesn't always fire on-time.
- **Fix:** Add a Postgres scheduled function or the `email-cron` function to sweep `profiles` daily and set `is_pro = false` where `pro_expires_at < now()`.

### 🟡 6. Paystack SaaS Subscription Commented Out
`Upgrade.tsx` has the automated Paystack Pro subscription commented out, reverting to a manual verification flow. This means Pro upgrades are not fully automated.
- **Fix:** Re-enable when business verification is complete.

### 🟢 7. No Rate Limiting on Public RPCs (FIXED)
`update_invoice_status_public` and `update_quote_status_public` are callable by anyone who knows the `localId`. While Row Level Security restricts *reading* data, There is no rate limiting on status mutations. Fixed by adding a PostgreSQL rate_limits table and check_rate_limit function.
- **Fix:** Add IP-based rate limiting in the Supabase Edge Function layer or add a CAPTCHA challenge on the public pages before allowing status changes.

### 🟢 8. `syncQueue` Retry Logic
Failed sync attempts (`syncStatus: 'ERROR'`) are retried but there is no exponential backoff. A persistent failure will create tight retry loops.
- **Fix:** Implement exponential backoff with a max retry cap of 5 attempts per queue item.

### 🟢 9. PDF Image Rendering
PDFs are rendered client-side. On very slow devices or large invoices with high-res logos, the PDF generation can freeze the browser tab.
- **Fix:** Move PDF generation to a Web Worker to prevent main thread blocking.

---

## 15. Recent Hotfixes (Reverse Chronological)

1. **AI Chat Memory & History Persistence (2026-09-28):** Increased RevenueChat memory from 20 to 50 messages. Added `localStorage` tracking for chat history with a "View previous chats" toggle button to satisfy the UI requirement of not losing past context between reloads.
2. **AI Context Size Overflow Fix (2026-09-28):** Re-engineered `RevenueChat.tsx` to time-box `invoices` and `quotes` sent to Gemini to the last 90 days. Older documents are aggregated into a `historicalSummary` block, saving massive token counts and preventing context overflow on heavy accounts.
3. **Clock Drift LWW Resolution Fix (2026-09-28):** Fixed the bug where local clock drifts caused incorrect "Last-Write-Wins" outcomes. `syncEngine.ts` now fetches a `Date` header from the Supabase REST API on sync to compute `serverTimeOffsetMs`. This offset is dynamically added to `localTime` during conflict resolution to ensure absolute chronological accuracy.
4. **Base64 Logo Migration Script (2026-09-28):** Added a silent, auto-migrating script to `App.tsx` which detects legacy base64 `logoUrl` instances in `profiles`, converts them to Blobs, uploads them to the `logos` storage bucket, and updates the profile with the public URL. This drastically reduces row bloat and JSON parsing overhead.
5. **Subscription Expiry Sweeper & Reference Error (2026-09-28):** Added a failsafe cron sweep to `email-cron/index.ts` to actively downgrade `is_pro` to `false` for any profile where `pro_expires_at` is in the past, solving missed SaaS webhook un-subscriptions. Also fixed an undeclared `overdueInvoices` variable reference that would have caused the function to crash.
6. **Documentation Page — Full Redesign (2026-09-21):** Completely rewrote `Documentation.tsx` with a professional two-column layout — sticky sidebar with 20-section Table of Contents, `IntersectionObserver`-based scroll-spy (active section auto-highlights), smooth scroll-to-anchor, mobile hamburger nav sheet, and a complete Tailwind `prose` typography system. Added `rehype-slug` for anchor IDs and `remark-gfm` for tables. Fixed a build-breaking syntax issue caused by raw backticks/curly braces in the markdown template literal — resolved by serializing content via `JSON.stringify()`.
2. **Full Codebase Audit & working.md Rewrite (2026-09-20):** Performed a comprehensive audit of every file in the project. Completely rewrote `working.md` from ~110 lines to 550+ lines covering the full tech stack, database schema (all 7 tables), RPC/edge function catalogue, sync engine architecture, auth/subscription logic, theming rules, risk matrix (9 items), 16 historical hotfixes, and developer DO/DON'T rules.
3. **Mobile Horizontal Overflow (2026-09-13):** Added `overflow-x-hidden w-full` to Dashboard root div to prevent mobile horizontal drag.

2. **Notification Loop Animation (2026-09-13):** Replaced aggressive 1s infinite shake with a gentle 4s looping keyframe (0.6s shake + 3.4s rest).
3. **Pending Invoice Quick Actions (2026-09-13):** Added `Confirm & Mark as Paid` button to PreviewPanel for PENDING invoices.
4. **RPC Overload Fix (2026-09-13):** Fixed `PGRST203` error on `update_invoice_status_public` by dropping the duplicate overloaded function with extra parameters.
5. **PENDING DB Trigger (2026-09-13):** Updated `handle_invoice_status_change()` trigger to dispatch a notification when status transitions to `PENDING`.
6. **Dynamic Dashboard Greeting (2026-09-13):** Enhanced header to show "Good morning/afternoon/evening, {Company Name}!" across two styled paragraphs.
7. **Legacy Bank Columns Cleanup (2026-09-13):** Removed stale `bank_name`, `account_name`, `account_number` column references from `App.tsx`, `ProfileSettings.tsx`, and `PublicInvoice.tsx`. This was causing a `400 Bad Request` on app load, blocking `isPro` detection.
8. **Dashboard PENDING Invoice Filter (2026-09-12):** Added `PENDING` to filter tabs in `Invoices.tsx`.
9. **SaaS Downgrade Webhook (2026-09-12):** Fixed `saas-webhook/index.ts` to properly catch `subscription.disable` and `charge.failed` events, setting `is_pro = false`.
10. **Theme Engine Color Bleed Fix (2026-09-12):** Fixed Ocean theme rendering as purple. Root cause: `bg-blue-*` maps to purple globally. Fixed by using `bg-purple-*` everywhere and strict inline hex for previews.
11. **Footer Theme Reactivity (2026-09-12):** Changed `useAppStore.getState().theme` to reactive `useAppStore()` hook in Footer.tsx.
12. **Payments & Bank Accounts Refactor (2026-09-08):** Moved bank account management from Business Profile tab to its own Payments tab. Converted flat columns to `bank_accounts` JSONB array.
13. **PWA SVG Caching (2026-09-08):** Added `billreve.svg`, `billreve-white.svg`, `revenuechat-icon.svg` to `vite-plugin-pwa` `includeAssets` array.
14. **Quote Public Link Copy Button (2026-09-08):** Added "Copy Public Link" quick action for SENT quotes.
15. **Settings Modularization (2026-09-06):** Broke `Settings.tsx` into `AccountSettings`, `ProfileSettings`, `TaxSettings`, `SyncSettings`, and `PreferencesSettings` components.
16. **DocumentEditor Modularization (2026-09-05):** Broke `DocumentEditor.tsx` into `EditorHeader`, `EditorLineItems`, and `EditorSummary` components.

---

## 16. Key Developer Patterns & Rules

### DO
- Always write to Dexie first, then let the sync engine handle Supabase
- Use `useLiveQuery` from `dexie-react-hooks` for reactive data in components
- Use `const { isPro } = useAppStore()` reactively — never `useAppStore.getState()` in JSX
- Use `bg-purple-*` for all accent colors (the theme engine remaps these dynamically)
- Build, then commit: always run `npm run build` from `client/` before `git push`
- Check `is_pro && (!pro_expires_at || pro_expires_at > now)` for proper Pro gating

### DON'T
- Don't use `bg-blue-*` for accent colors — they render as purple globally
- Don't query Supabase directly from components for CRUD — go through Dexie + sync engine
- Don't store bank account changes without migrating historical invoice snapshots
- Don't push to master without building first

---

## 17. Environment Variables

```env
# client/.env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_VERSION=1.4.1
VITE_PAYSTACK_PUBLIC_KEY=
VITE_FLUTTERWAVE_PUBLIC_KEY=

# server/supabase/.env (for edge functions)
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
PAYSTACK_SECRET_KEY=
FLUTTERWAVE_SECRET_KEY=
EMAIL_PROVIDER_API_KEY=
```

---

**End of Document**


- **2026-10-02 (Phase 1):** Implemented server-side rate limiting for public RPCs.
- **2026-10-02 (Phase 2):** Implemented bank account snapshots on document creation, cleaned up Upgrade.tsx with feature flags, added Edge middleware for dynamic OG tags, and fully integrated document themes across preview, PDF generation, and public pages.
