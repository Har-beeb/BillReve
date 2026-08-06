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
    - `LandingPage.tsx` - (`/`) The public marketing home page
    - `Dashboard.tsx` - (`/dashboard`) Main overview
    - `Invoices.tsx` / `Quotes.tsx` - List views
    - `DocumentEditor.tsx` - The unified editor for quotes & invoices
    - `Reports.tsx` - Analytics & Revenue tracking
    - `Trash.tsx` - Soft-deleted items recovery
    - `Splash.tsx` - App loading screen
    - `PublicQuote.tsx` / `PublicInvoice.tsx` - Public-facing client views
  - `db/` - Dexie.js offline-first database setup
  - `store/` - Zustand global state management (`useAppStore.ts`)
  - `api/` - Network requests (Supabase edge functions, etc.)
  - `services/` - Background services (e.g., `syncEngine.ts`)

## ✨ Key Features
- **Offline-First Storage**: Uses Dexie.js to store all client/invoice data locally.
- **Background Syncing**: `syncEngine.ts` automatically pushes local changes to Supabase when online. Includes a persistent queue stored in `localStorage` to handle abrupt app closures.
- **AI Revenue Chat**: Natural language queries over local financial data (reports/invoices).
- **Interactive Documents**: Live preview panel, automatic tax calculations.
- **Public Client Views**: Clients can view, pay (via Paystack), or negotiate (counter-offer) quotes via secure public links.
- **Theming**: Dynamic CSS variable-based themes (Wine, Emerald, default Purple).

## 🛠️ Recent Fixes & Improvements (Pre-Launch Polish)

### Routing & Navigation
- **Routing Overhaul**: The default route (`/`) is now the public Landing Page. The main application view has been moved to `/dashboard`.
- **Auth Flow Redirects**: Updated `Login`, `Register`, and `ResetPassword` views to safely route users to `/dashboard` upon successful authentication, preventing them from being stuck on the marketing page.
- **Post-Action Routing**: Successfully sending a document from the `DocumentEditor` now cleanly closes the modal and routes the user back to their respective Quotes or Invoices list tab.

### Data Integrity & Sync
- **SyncEngine Reliability**: Upgraded `syncEngine.ts` to implement delayed background syncing (debounced) and persistent queues. This prevents race conditions where rapidly clicking between tabs caused newly drafted documents to be overridden by stale server state.
- **Send Document Flow Safety**: Disabled instant background saving when opening the "Send" modal. Documents are now only saved and marked as "SENT" if the actual send action succeeds, allowing the user to retry upon failure without losing draft status.

### Global UI Standardization
- **Universal Logo Standard**: Enforced a uniform brand logo (Purple outer square, rotated white inner square) across the entire application—including headers, sidebars, the splash screen, Auth screens, and directly injected into the PDF Export engine (`html2pdf.js`).
- **Premium Auth Layout**: Upgraded the Login/Register panels from a dark grid to a premium animated `purple-to-indigo` gradient matching the Pro subscription tier aesthetic.

### Landing Page Implementation
- **Hero & Animations**: Implemented a responsive Hero section with dynamic text looping ("Simplified", "Automated", "Perfected") using `framer-motion`.
- **Mockup Preview**: Built an intricate CSS/Tailwind-based application mockup beneath the Hero section displaying dummy metrics, charts, and recent invoices to showcase the app without needing screenshots.
- **Pricing Clarity**: Standardized the pricing block to match the app's internal `/upgrade` view (₦3,500/mo, highlighting the 10-document cap for the Free tier).
- **Professional Polish**: Added a mobile hamburger menu and a full comprehensive SaaS footer.

## 🚀 Upcoming / Backlog
- Configure `support@billreve.app` via custom email hosting (Google Workspace/Zoho).
- Verify Google Search Console DNS TXT records.
- Architect backend subscription tiers and Row Level Security (RLS) enforcement.
