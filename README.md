# BillReve 🚀

**BillReve** is a modern, offline-first invoice and quote management application tailored for freelancers and small businesses. It combines a beautiful, responsive user interface with robust offline capabilities, ensuring users can manage their businesses seamlessly, anywhere, anytime.

## 🌟 Key Features

- **Offline-First Architecture**: Built with Dexie.js (IndexedDB), allowing full functionality without an internet connection. Data syncs automatically to the cloud when online.
- **AI-Powered Workflows**: Integrated with Google Gemini to automatically draft professional email campaigns and enhance invoice/quote terms & notes.
- **Dynamic Document Editor**: A highly intuitive, drag-and-drop enabled document editor for creating quotes and invoices with real-time totals, tax, and discount calculations.
- **Customizable Branding**: Users can upload their logos, customize the app's color theme, typography, and layout preferences.
- **Secure Authentication**: Powered by Supabase Auth, supporting both Email/Password and Google OAuth.
- **Export & Share**: Generate pixel-perfect PDFs or share secure public links for clients to view and pay invoices online.
- **SEO Optimized**: Fully server-side and client-side optimized with dynamic meta tags, sitemaps, and Open Graph data for maximum discoverability.

---

## 🏗️ Technical Architecture

### Tech Stack
- **Frontend Framework**: React 18 with Vite
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS & Framer Motion
- **State Management**: Zustand (with local persistence)
- **Local Database**: Dexie.js (IndexedDB wrapper)
- **Backend & Cloud DB**: Supabase (PostgreSQL, Storage, Edge Functions)
- **Routing**: React Router DOM (with Code Splitting/Lazy Loading)

### The Offline-First Sync Engine
The core innovation of BillReve lies in its `SyncEngine`. 
1. **Local Writes**: All user actions (creating an invoice, updating a client) write directly to the local IndexedDB. This guarantees zero-latency UI updates.
2. **Background Sync**: The `SyncEngine` listens to IndexedDB changes and pushes them to Supabase in the background.
3. **Real-time Subscriptions**: It leverages Supabase Realtime to pull changes from the cloud, ensuring multi-device synchronization.

---

## 📂 Project Structure

The repository is divided into two main environments:

### `/client` (Frontend Application)
- **`src/components/`**: Reusable UI components.
  - `auth/`: Authentication layout and inputs.
  - `editor/`: Modular components for the Document Editor.
  - `settings/`: Modular components for the Settings dashboard.
  - `ui/`: Design system components (Buttons, Inputs, Modals, Logo).
- **`src/pages/`**: Primary route views (Dashboard, Invoices, Settings, LandingPage).
- **`src/layouts/`**: `MainLayout` (Authenticated) and `PublicLayout` (Marketing/Legal).
- **`src/store/`**: Zustand global state management (`useAppStore.ts`).
- **`src/services/`**: Core background services (`syncEngine.ts`).
- **`src/utils/`**: Helper functions (PDF generation, formatters, calculations).
- **`src/db/`**: Dexie database schema definitions.

### `/server` (Backend Services)
- **`supabase/functions/`**: Deno-based Edge Functions.
  - `ai/`: Handles communication with the Google Gemini API for drafting campaigns and enhancing notes.
  - `email-cron/`: Scheduled cron job for triggering automated recurring email campaigns and reminders.
  - `email-worker/`: Background worker for processing email queues reliably.
  - `send-email/`: Core function for dispatching transactional emails (invoices, quotes, welcome emails).
  - `paystack-webhook/`: Webhook handler for processing Paystack payment events for invoices.
  - `flutterwave-webhook/`: Webhook handler for processing Flutterwave payment events for invoices.
  - `saas-webhook/`: Webhook handler for processing Pro subscriptions and platform billing.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- A Supabase Project
- Google Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/billreve.git
   cd billreve
   ```

2. **Setup the Client Environment:**
   Create a `.env` file in the `/client` directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Install Dependencies:**
   ```bash
   cd client
   npm install
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

### Backend Setup (Supabase)
1. Link your local project to your Supabase project using the Supabase CLI.
2. Apply the database migrations to set up the `profiles`, `clients`, `invoices`, and `quotes` tables.
3. Deploy the Edge Functions:
   ```bash
   cd server
   supabase functions deploy ai
   ```
   Ensure you set the `GEMINI_API_KEY` secret in your Supabase project.

---

## 🎨 UI/UX Philosophy

BillReve is designed to feel **premium and dynamic**.
- **Glassmorphism & Gradients**: Used extensively across marketing pages and modal overlays to create depth.
- **Micro-animations**: Powered by Framer Motion, ensuring smooth page transitions, list reordering, and hover states.
- **Responsive Design**: Mobile-first approach. The layout seamlessly adapts from desktop sidebars to mobile bottom navigation drawers based on user preference.

---

## 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.
