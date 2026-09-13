# BillReve - Comprehensive Project Architecture & Working Document

> **Agent Handover Note:** This document serves as the absolute source of truth for the BillReve project. If you are a new AI agent picking up this project, read this document entirely. It covers the full technical stack, architectural decisions, feature implementations, and the current state of the application.

## 1. Project Overview & Tech Stack
BillReve is a modern, intelligent, offline-first invoicing and billing platform tailored for freelancers, SMEs, and growing businesses.

**Core Stack:**
*   **Frontend Framework:** React 18 with TypeScript, built using Vite.
*   **Styling:** Tailwind CSS with a custom highly-dynamic theme engine (5+ themes using CSS variables and `@layer` directives).
*   **State Management:** Zustand (`useAppStore.ts`) for global UI state and lightweight app configuration.
*   **Local Database:** Dexie.js (wrapper for IndexedDB) for offline-first data storage.
*   **Backend Database & Auth:** Supabase (PostgreSQL, Row Level Security, Edge Functions).
*   **Animations:** Framer Motion.
*   **PWA Support:** `vite-plugin-pwa` for service worker generation and aggressive offline caching.

---

## 2. Core Architecture: Local-First & Sync Engine
The most critical architectural pattern in BillReve is its **Offline-First Sync Engine**. The app is designed to work completely offline, feeling instantaneous.

### Data Flow
1.  **Local Writes First:** All user actions (creating invoices, quotes, clients, updating settings) write *exclusively* to the local IndexedDB (via Dexie) first. 
2.  **Sync Status:** Every local record has a `syncStatus` property (`'PENDING' | 'SYNCED' | 'ERROR'`) and an `updatedAt` timestamp.
3.  **The Sync Engine (`client/src/services/syncEngine.ts`):** 
    *   Runs a continuous background heartbeat loop (every 10 seconds).
    *   Looks for local records marked as `PENDING` and pushes them to Supabase.
    *   Pulls the latest changes from Supabase (using a `last_sync_time` cursor) and merges them locally.
    *   Resolves conflicts using the `updatedAt` timestamp (last-write-wins).
    *   Emits global events so the UI (like `useNotifications`) can show sync status indicators (e.g., spinning cloud icon).

### Database Schema (Supabase & Dexie Parity)
The tables exist identically in both Dexie (`client/src/db/db.ts`) and Supabase PostgreSQL:
*   `profiles` (Business settings, tax preferences, customized themes)
*   `clients` (Client directory)
*   `invoices` (Invoice records, line items stored as JSONB)
*   `quotes` (Quote records, line items stored as JSONB)
*   `products` (Product catalog for quick insertion)
*   `payments` (Record of transactions)
*   `campaigns` (Email marketing tracking)

---

## 3. Key Feature Modules & Workflows

### A. The Invoicing Engine
Invoices traverse through several statuses: `DRAFT`, `SENT`, `PENDING` (manual verification), `PARTIAL`, `PAID`, `OVERDUE`, `VOID`.
*   **PDF Generation:** `pdfGenerator.tsx` handles generating highly-styled, theme-aware PDFs dynamically on the client.
*   **Public Links:** Invoices can be shared via public links (`/invoice/:id` or `/pay/:id`). The public view hides sensitive admin features.
*   **Pending Status (Recent Refactor):** When clients choose "Manual Bank Transfer" on the public link, they click an "I've transferred the funds" button. This triggers an RPC call, transitioning the invoice from `SENT` to `PENDING`. The admin sees this in `Invoices.tsx` and can click "Record Payment / Mark as Paid" to confirm it.

### B. The Quotes & Negotiation Loop
Quotes have a unique negotiation lifecycle:
*   Statuses: `DRAFT`, `SENT`, `ACCEPTED`, `DECLINED`, `COUNTERED`.
*   **Smart Looping:** If a client counters a quote via the public link, they provide a `counterAmount` and `clientMessage`. The admin sees this in `Quotes.tsx` and can either "Accept Counter" (auto-updates total), "Decline", or "Redraft" (spawns a new draft to continue negotiation).
*   Once `ACCEPTED`, a quote can be seamlessly converted into an Invoice.

### C. Payments & Bank Accounts Architecture
Recently refactored in `client/src/pages/Payments.tsx`.
*   **Free Tier:** Users get access to Manual Bank Transfers. Bank details are configured in the Payments tab and stored in the `profiles` table under a `bank_accounts` JSON array.
*   **Pro Tier:** Automated gateways (Paystack, Flutterwave, Stripe) are gated behind the Pro subscription wall.
*   The `PublicInvoice.tsx` conditionally renders these payment options based on what the user has configured and their subscription tier.

### D. Revenue AI (RevenueChat)
An embedded LLM assistant accessible via the dashboard (`RevenueChat.tsx`) and quick-draft modals (`AiDraftModal.tsx`).
*   Capable of conversational invoicing: "Create an invoice for John Doe for 5 hours of consulting at $100/hr."
*   Uses intelligent parsing to extract line items, clients, and amounts, automatically populating the `DocumentEditor`.
*   Can also generate professional Notes and Terms for invoices.

### E. Automated Email Reminders Engine
Supabase Edge Function (`server/supabase/functions/email-cron/index.ts`).
*   Runs on a cron job timeline.
*   **Timeline logic:** -3 days (upcoming), 0 days (due today), +3, +7, +14 days (overdue).
*   Uses a `last_reminded_at` timestamp column to ensure duplicate emails are not sent for the same timeline threshold.

---

## 4. UI/UX and Theming System

### Custom CSS & Tailwind
*   **Base Styles (`index.css`):** The app uses native CSS variables mapping to Tailwind colors. The theme engine injects classes like `.theme-wine`, `.theme-ocean`, `.theme-sunset` directly onto the `<html>` root element.
*   **Mobile Experience:** The app is designed to feel native on mobile. We explicitly disable visual scrollbars across all elements on mobile viewports (`max-width: 768px`) using `scrollbar-width: none` and `::-webkit-scrollbar { display: none; }` while keeping standard scrolling behavior intact.
*   **Dark Mode:** Full dark mode support toggleable via the footer or user preferences. (Fixed recent bug where `useAppStore.getState()` was preventing reactive updates on the footer icon).

### PWA and Assets
*   Configured in `vite.config.ts` using `vite-plugin-pwa`.
*   `workbox` caches HTML, JS, CSS, and critical SVGs (`billreve.svg`, `billreve-white.svg`, `revenuechat-icon.svg`) for complete offline availability.

---

## 5. Current State & Recent Hotfixes (As of Last Update)

### Recently Completed Refactors & Fixes:
1.  **Payments & PENDING Status:** Integrated Bank Accounts directly into the Payments tab. Added `PENDING` status flow to Invoices table Quick Actions, allowing admins to finalize manually paid invoices.
2.  **Scrollbar Hotfix:** Removed an erroneous `overflow: hidden; height: 100vh` on the body that broke page scrolling. Restored proper mobile scrollbar hiding without breaking scroll functionality.
3.  **PWA SVG Caching:** Added missing logos to the PWA `includeAssets` array so they don't break when switching to offline mode.
4.  **Copy Link Quick Buttons:** 
    *   Updated SENT Invoices to copy the `/pay/:id` link (public payment gateway).
    *   Added a "Copy Link" quick button for SENT Quotes copying the `/quote/:id` public quote link.
5.  **Changelog Sync:** Fixed `Changelog.tsx` so the top version dynamically syncs with `import.meta.env.VITE_APP_VERSION` (v1.4.1) while maintaining historical versions.
6.  **Footer Theme Reactivity:** Replaced `useAppStore.getState().theme` with the reactive `const { theme, toggleTheme } = useAppStore()` hook inside `Footer.tsx` so the Moon/Sun icon updates instantly on click.

### Pending / Next Up:
*   Currently, the primary feature set for MVP (Invoicing, Quotes, Sync, AI, Payments, Reminders) is robust and stable.
*   Future agents should check the Vercel deployments and Supabase logs for any real-time edge case issues.

---

**End of Document**
