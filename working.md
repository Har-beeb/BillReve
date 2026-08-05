# BillReve Architecture & Working Document

This document serves as the master map of the BillReve application structure, features, and active fixes. Keep this updated as new features are added.

## 🏗️ Project Structure
`client/` (Frontend React Application)
- `src/`
  - `components/` - Reusable UI components
    - `auth/` - Authentication layout and screens
    - `ui/` - Foundational UI (Badge, Card, Logo, etc.)
    - `DocumentItemsTable.tsx` - Invoice/Quote line items
    - `DocumentPreview.tsx` - Live document preview
    - `RevenueChat.tsx` - AI chatbot widget
  - `pages/` - Main application routes
    - `Dashboard.tsx` - Main overview
    - `Invoices.tsx` / `Quotes.tsx` - List views
    - `DocumentEditor.tsx` - The unified editor for quotes & invoices
    - `Reports.tsx` - Analytics & Revenue tracking
    - `Trash.tsx` - Soft-deleted items recovery
    - `Splash.tsx` - App loading screen
    - `PublicQuote.tsx` / `PublicInvoice.tsx` - Public-facing client views
  - `db/` - Dexie.js offline-first database setup
  - `store/` - Zustand global state management (`useAppStore.ts`)
  - `api/` - Network requests (Supabase edge functions, etc.)

## ✨ Key Features
- **Offline-First Storage**: Uses Dexie.js to store all client/invoice data locally.
- **Background Syncing**: `syncEngine.ts` automatically pushes local changes to Supabase when online.
- **AI Revenue Chat**: Natural language queries over local financial data (reports/invoices).
- **Interactive Documents**: Live preview panel, automatic tax calculations.
- **Public Client Views**: Clients can view, pay (via Paystack), or negotiate (counter-offer) quotes via secure public links.
- **Theming**: Dynamic CSS variable-based themes (Wine, Emerald, default Purple).

## 🛠️ Recent Fixes & Improvements
1. **Document Editor Crash Fix**: Fixed a bug where clicking edit on a draft without a date would crash the app (`Invalid Date` error).
2. **Auth Page Redesign**: Implemented a dark, premium SaaS layout for the `/login` and `/register` views with a glassy gradient and fluid typography.
3. **Logo Standardization**: Abstracted the CSS logo from the Splash screen into a universal `<Logo />` component, now used across Splash and Auth pages.
4. **Offline Guards**: Added proper network checks (`navigator.onLine`) to AI Revenue Chat and Document Note enhancement to prevent Edge Function fetch errors when offline.
5. **Reports Tab Enhancement**: Integrated the `RevenueChat` directly into the Reports tab for easier access during auditing.
6. **Mobile Table Optimization**: Ensured action buttons on the `Trash.tsx` table do not wrap awkwardly on small screens using flex properties.

## 🚀 Upcoming / Backlog
- Configure `support@billreve.app` via custom email hosting (Google Workspace/Zoho).
- Verify Google Search Console DNS TXT records.
- Architect backend subscription tiers.
