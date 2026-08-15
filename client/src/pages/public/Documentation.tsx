import React from 'react';
import { SEO } from '../../components/SEO';
import ReactMarkdown from 'react-markdown';

export const billreveDocMarkdown = `
# BillReve 🚀

**BillReve** is a modern, offline-first invoice and quote management application tailored for freelancers and small businesses. It combines a beautiful, responsive user interface with robust offline capabilities, ensuring users can manage their businesses seamlessly, anywhere, anytime.

## 🌟 Key Features

- **Offline-First Architecture**: Built with Dexie.js (IndexedDB), allowing full functionality without an internet connection. Data syncs automatically to the cloud when online.
- **AI-Powered Workflows (RevenueChat)**: Integrated with Google Gemini to automatically draft professional email campaigns, assess invoice risks, and provide conversational analytics directly within the app.
- **Dynamic Document Editor**: A highly intuitive, drag-and-drop enabled document editor for creating quotes and invoices with real-time totals, tax, and discount calculations.
- **Customizable Branding & Theme Engine**: Users can upload their logos, customize the app's color theme, typography, and layout preferences. A dedicated ThemeController ensures that custom themes are strictly applied to the app interface, keeping public landing/auth pages cleanly branded.
- **Robust PDF Generation**: Employs an optimized, static-image-based PDF generation pipeline that ensures consistent, pixel-perfect layouts across devices without relying on heavy frontend CSS processing.
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
The core innovation of BillReve lies in its SyncEngine. 
1. **Local Writes**: All user actions (creating an invoice, updating a client) write directly to the local IndexedDB. This guarantees zero-latency UI updates.
2. **Background Sync**: The SyncEngine listens to IndexedDB changes and pushes them to Supabase in the background.
3. **Real-time Subscriptions**: It leverages Supabase Realtime to pull changes from the cloud, ensuring multi-device synchronization.

---

## 🎨 UI/UX Philosophy

BillReve is designed to feel **premium and dynamic**.
- **Glassmorphism & Gradients**: Used extensively across marketing pages and modal overlays to create depth.
- **Micro-animations**: Powered by Framer Motion, ensuring smooth page transitions, list reordering, continuous swipeable carousels, and engaging hover states.
- **Responsive Design**: Mobile-first approach. The layout seamlessly adapts from desktop sidebars to mobile bottom navigation drawers based on user preference.
- **Theme Segregation**: Custom user themes (fonts, brand colors) are confined to the /app ecosystem via the ThemeController, ensuring that standard public pages always retain the polished BillReve brand identity.
`;

const Documentation: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <SEO title="Documentation" />
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="prose prose-purple dark:prose-invert max-w-none">
          <ReactMarkdown>{billreveDocMarkdown}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
