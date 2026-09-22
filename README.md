<div align="center">

<img src="https://billreve.app/logo192.png" width="80" height="80" alt="BillReve Logo" />

# BillReve

**AI-powered invoicing for freelancers and small businesses.**

[![Live App](https://img.shields.io/badge/Live%20App-billreve.app-6d28d9?style=flat-square&logo=vercel&logoColor=white)](https://billreve.app)
[![Documentation](https://img.shields.io/badge/Docs-billreve.app%2Fdocumentation-5b21b6?style=flat-square)](https://billreve.app/documentation)
[![Version](https://img.shields.io/badge/version-1.4.1-a78bfa?style=flat-square)](https://github.com/Har-beeb/BillReve/releases)
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
- Quote negotiation loop with counter-offers, minimum counter limits, and redraft mechanic
- One-click conversion from accepted quote to invoice
- 5 professionally designed PDF templates (Standard, Professional, Modern, Classic, Monochrome)
- Per-invoice currency override

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
- **Last-Write-Wins** conflict resolution; `PAID`/`ACCEPTED` statuses are always protected

### 💸 Payments
- Bank transfer details embedded in every public invoice (free)
- **Paystack**, **Flutterwave**, and **Stripe** gateway integrations *(Pro)*
- Webhook-based automatic `PAID` status updates
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
- Supabase Row Level Security on every table — no cross-user data access possible
- Public links use random document IDs — not guessable
- AI never receives raw client data (names, contact details, bank numbers)

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 18 + Vite + TypeScript (strict) |
| **Styling** | Tailwind CSS v4 + Framer Motion |
| **State** | Zustand (with persistence) |
| **Local DB** | Dexie.js (IndexedDB) |
| **Cloud DB** | Supabase (PostgreSQL + RLS) |
| **Auth** | Supabase Auth (Email/Password + Google OAuth) |
| **Backend** | Supabase Edge Functions (Deno) |
| **AI** | Google Gemini API |
| **Email** | Resend |
| **Payments** | Paystack, Flutterwave, Stripe (webhooks) |
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
Background SyncEngine (every 10s)
    │
    ├─▶ PUSH: Upsert changed records to Supabase
    │
    └─▶ PULL: Supabase Realtime subscription
            │
            └─▶ Merge remote changes into IndexedDB
                    │
                    └─▶ LWW conflict resolution
                           (PAID/ACCEPTED statuses always win)
```

### Database Schema (Supabase)

| Table | Key Columns | Notes |
| --- | --- | --- |
| `profiles` | `id`, `business_name`, `logo_url`, `is_pro`, `pro_expires_at` | 1:1 with `auth.users` |
| `clients` | `id`, `user_id`, `name`, `email`, `deleted_at` | Soft-delete via `deleted_at` |
| `invoices` | `id`, `local_id`, `user_id`, `client_id`, `status`, `items` (jsonb) | `local_id` is offline UUID |
| `quotes` | `id`, `local_id`, `user_id`, `client_id`, `status`, `counter_amount` | Negotiation state lives here |
| `notifications` | `id`, `user_id`, `type`, `title`, `is_read` | In-app notification feed |
| `bank_accounts` | `id`, `user_id`, `bank_name`, `account_number` | Payment details for clients |
| `payments` | `id`, `invoice_id`, `amount`, `method` | Partial payment ledger |

### Edge Functions

| Function | Trigger | Purpose |
| --- | --- | --- |
| `send-email` | HTTP | Send transactional emails (invoices, quotes, welcome) via Resend |
| `ai` | HTTP | Proxy to Google Gemini API (drafting, chat, CFO reports) |
| `email-cron` | Cron (daily) | Trigger automated invoice reminders |
| `email-worker` | Queue | Process email queue reliably |
| `paystack-webhook` | Webhook | Mark invoice PAID on Paystack confirmation |
| `flutterwave-webhook` | Webhook | Mark invoice PAID on Flutterwave confirmation |
| `saas-webhook` | Webhook | Handle Pro subscription events |

---

## 📂 Project Structure

```
BillReve/
├── client/                          # Frontend React application
│   ├── public/                      # Static assets, manifest
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   │   ├── auth/                # Auth UI (OAuthButton, AuthInput)
│   │   │   ├── editor/              # DocumentEditor sub-components
│   │   │   │   ├── EditorHeader.tsx
│   │   │   │   ├── EditorLineItems.tsx
│   │   │   │   └── EditorSummary.tsx
│   │   │   ├── settings/            # Settings tab sub-components
│   │   │   │   ├── AccountSettings.tsx
│   │   │   │   ├── ProfileSettings.tsx
│   │   │   │   ├── TaxSettings.tsx
│   │   │   │   ├── SyncSettings.tsx
│   │   │   │   └── PreferencesSettings.tsx
│   │   │   └── ui/                  # Design system primitives
│   │   ├── pages/                   # Route-level pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Invoices.tsx
│   │   │   ├── Quotes.tsx
│   │   │   ├── Clients.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Campaigns.tsx
│   │   │   ├── Payments.tsx
│   │   │   ├── Trash.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── public/             # Public-facing pages (no auth)
│   │   │       ├── Documentation.tsx
│   │   │       ├── LandingPage.tsx
│   │   │       ├── PublicInvoice.tsx
│   │   │       └── PublicQuote.tsx
│   │   ├── layouts/
│   │   │   ├── MainLayout.tsx       # Authenticated app shell
│   │   │   └── PublicLayout.tsx     # Marketing/legal layout
│   │   ├── store/
│   │   │   └── useAppStore.ts       # Zustand global state
│   │   ├── services/
│   │   │   └── syncEngine.ts        # Core offline sync engine
│   │   ├── db/
│   │   │   └── db.ts                # Dexie IndexedDB schema
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── utils/                   # PDF, formatters, calculations
│   │   └── index.css                # Tailwind v4 theme + global styles
│   └── vite.config.ts
│
└── server/
    └── supabase/
        ├── functions/               # Deno Edge Functions
        │   ├── send-email/
        │   ├── ai/
        │   ├── email-cron/
        │   ├── email-worker/
        │   ├── paystack-webhook/
        │   ├── flutterwave-webhook/
        │   └── saas-webhook/
        └── migrations/              # SQL schema migrations
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** (or yarn / pnpm)
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
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GEMINI_API_KEY=your_gemini_key
```

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

### 3. Set up Supabase

1. Create a new Supabase project
2. Run the SQL migrations from `server/supabase/migrations/` in the Supabase SQL editor (in order)
3. Enable **Realtime** for the `invoices`, `quotes`, `clients`, and `notifications` tables
4. Set up **Row Level Security** policies (included in the migration files)

### 4. Deploy Edge Functions

```bash
cd server
supabase link --project-ref your_project_ref
supabase functions deploy send-email
supabase functions deploy ai
supabase functions deploy email-cron
supabase functions deploy paystack-webhook
supabase functions deploy flutterwave-webhook
supabase functions deploy saas-webhook
```

Set required secrets in your Supabase project dashboard:

```bash
supabase secrets set GEMINI_API_KEY=your_key
supabase secrets set RESEND_API_KEY=your_key
supabase secrets set PAYSTACK_SECRET_KEY=your_key
```

### 5. Build for production

```bash
cd client
npm run build
```

Deploy the `dist/` folder to any static host (Vercel recommended — it's already configured via `vercel.json`).

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

> **Theme rule:** The app maps `blue-*` Tailwind classes to the purple brand palette in `index.css`. **Always use `purple-*` for accent colours** in new code — never `blue-*`.

> **Sync rule:** Never write directly to Supabase from components. Always write to Dexie (IndexedDB) and let the SyncEngine handle cloud replication.

> **Pro check:** `is_pro` in `profiles` is not self-managed — it is set by the `saas-webhook` Edge Function on subscription events. Do not set it manually from the client.

---

## 📋 Known Limitations & Roadmap

| Issue | Status | Notes |
| --- | --- | --- |
| `logo_url` stored as base64 in DB | ⚠️ Tech Debt | Should migrate to Supabase Storage |
| AI context size grows with invoice count | ⚠️ Tech Debt | Need pagination/summarisation for large accounts |
| Client clock drift affects LWW resolution | ⚠️ Tech Debt | Should use server timestamps |
| `is_pro` not swept for expired subscriptions | ⚠️ Tech Debt | Needs a Supabase cron job |
| Payment gateways (Stripe full integration) | 🔜 Roadmap | Paystack & Flutterwave live; Stripe partial |
| Team accounts / multi-user | 🔜 Roadmap | Single-user only currently |
| Mobile native app (React Native) | 🔜 Roadmap | PWA is current mobile solution |

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with ☕ and late nights by [Har-beeb](https://github.com/Har-beeb)

**[billreve.app](https://billreve.app)** · **[Documentation](https://billreve.app/documentation)** · **[Support](https://billreve.app/support)**

</div>
