import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO } from '../../components/SEO';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { ChevronRight, Menu, X, BookOpen } from 'lucide-react';

// ─── Navigation Structure ────────────────────────────────────────────────────
const sections = [
  { id: '1-what-is-billreve',             label: 'What is BillReve?',         number: '01' },
  { id: '2-getting-started',              label: 'Getting Started',            number: '02' },
  { id: '3-dashboard',                    label: 'Dashboard',                  number: '03' },
  { id: '4-invoices',                     label: 'Invoices',                   number: '04' },
  { id: '5-quotes',                       label: 'Quotes',                     number: '05' },
  { id: '6-clients',                      label: 'Clients',                    number: '06' },
  { id: '7-payments--bank-accounts',      label: 'Payments & Bank Accounts',   number: '07' },
  { id: '8-reports',                      label: 'Reports',                    number: '08' },
  { id: '9-email-campaigns',              label: 'Email Campaigns',            number: '09' },
  { id: '10-revenue-ai-revenuechat',      label: 'Revenue AI',                 number: '10' },
  { id: '11-ai-document-drafting',        label: 'AI Document Drafting',       number: '11' },
  { id: '12-public-payment--quote-links', label: 'Public Links',               number: '12' },
  { id: '13-settings',                    label: 'Settings',                   number: '13' },
  { id: '14-theming--personalization',    label: 'Theming',                    number: '14' },
  { id: '15-pro-subscription',            label: 'Pro Subscription',           number: '15' },
  { id: '16-offline-mode--sync',          label: 'Offline Mode & Sync',        number: '16' },
  { id: '17-pwa--installing-billreve',    label: 'PWA — Installing',           number: '17' },
  { id: '18-trash--recovery',             label: 'Trash & Recovery',           number: '18' },
  { id: '19-security--privacy',           label: 'Security & Privacy',         number: '19' },
  { id: '20-frequently-asked-questions',  label: 'FAQ',                        number: '20' },
];

// ─── Markdown Content ─────────────────────────────────────────────────────────
export const billreveDocMarkdown = "# BillReve \u2014 Complete Documentation\n\n*Version 1.4.1 \u00b7 Updated September 2026*\n\n---\n\n## 1. What is BillReve?\n\nBillReve is an **AI-powered invoicing and business management platform** built for freelancers, consultants, and small businesses. It combines the speed of a native app with the reliability of cloud sync \u2014 so you can work anywhere, even offline.\n\n### What makes BillReve different?\n\n- **Works offline** \u2014 Create and edit invoices, quotes, and client records with no internet connection. Everything syncs automatically when you're back online.\n- **AI built in** \u2014 Draft professional invoices from a single sentence. Ask your AI assistant \"Who owes me money?\" and get an instant answer.\n- **Client-facing payment links** \u2014 Share a payment link. Your client sees a professional invoice page and can pay directly or report a bank transfer.\n- **Quote negotiation** \u2014 Allow clients to counter-offer on quotes directly from a link. No back-and-forth emails.\n- **Automated reminders** \u2014 Set it and forget it. BillReve automatically emails your clients before and after due dates.\n\n---\n\n## 2. Getting Started\n\n### Creating Your Account\n\n1. Visit [billreve.app](https://billreve.app) and click **Get Started**\n2. Sign up with your email or continue with Google\n3. Verify your email address\n4. You'll be guided through the **Getting Started Checklist** \u2014 a quick 5-step setup\n\n### Getting Started Checklist\n\nThe checklist appears on your dashboard until all steps are complete:\n\n| Step | What to do |\n| --- | --- |\n| 1. Business Profile | Add your company name, logo, address |\n| 2. First Client | Add your first client to the directory |\n| 3. First Invoice | Create and send your first invoice |\n| 4. Payment Method | Add a bank account for receiving payments |\n| 5. Explore AI | Try drafting a document with AI |\n\n---\n\n## 3. Dashboard\n\nThe Dashboard is your business control centre. It shows you everything at a glance.\n\n### Greeting Header\n\nShows a personalised greeting based on your local time (\"Good morning, Techieness!\") with a live summary of your business today.\n\n### Metric Cards (Swipeable on mobile)\n\n| Card | What it shows |\n| --- | --- |\n| **Total Revenue** | Paid invoices this month + month-over-month growth % |\n| **Outstanding Balance** | Total value of unpaid, sent invoices |\n| **Overdue Amount** | Total value of invoices past their due date |\n| **Accepted Quotes** | Total value of accepted quotes this period |\n\n> Tap any card to jump directly to the filtered view in Invoices or Quotes.\n\n### Revenue Chart\n\nA bar chart of your monthly revenue. Switches to a pie chart automatically if no bar chart data is available. Toggle between bar and pie manually using the chart controls.\n\n### Recent Activity\n\nShows your 5 most recently updated invoices and quotes. Click any row to open its preview panel.\n\n### Action Buttons\n\n- **New Quote** \u2014 Create a quote (manually or with AI)\n- **New Invoice** \u2014 Create an invoice (manually or with AI)\n\n---\n\n## 4. Invoices\n\n### Invoice Lifecycle\n\n```\nDRAFT \u2192 SENT \u2192 PENDING \u2192 PAID\n                       \u2198 PARTIAL (partial payment recorded)\n              \u2192 OVERDUE (past due date)\n              \u2192 VOID\n```\n\n### Invoice Statuses\n\n| Status | Meaning |\n| --- | --- |\n| `DRAFT` | Created but not yet sent to client |\n| `SENT` | Shared with client via link or email |\n| `PENDING` | Client has reported a manual bank transfer (awaiting your confirmation) |\n| `PARTIAL` | Some payment recorded, balance still owed |\n| `PAID` | Fully paid \u2014 triggers notification |\n| `OVERDUE` | Past due date and still unpaid |\n| `VOID` | Cancelled/voided |\n\n### Creating an Invoice\n\n1. Click **New Invoice** on Dashboard or Invoices page\n2. Select a client (or create one inline)\n3. Add line items (description, quantity, unit price)\n4. Apply taxes if applicable\n5. Set due date, notes, and payment terms\n6. Choose **Save Draft** or **Save & Send**\n\n### Quick Actions (Preview Panel)\n\nWhen you open an invoice's side panel, you'll see contextual buttons based on its status:\n\n| Status | Quick Action |\n| --- | --- |\n| DRAFT | Edit Invoice |\n| SENT | Copy Payment Link |\n| PENDING | \u2705 Confirm & Mark as Paid |\n| PARTIAL / OVERDUE | Record Payment |\n| OVERDUE | Send Reminder |\n| Any | Download PDF / Receipt |\n\n### Filtering & Search\n\n- Filter by status: All, Draft, Sent, Pending, Partial, Paid, Overdue, Void\n- Search by client name or invoice number\n- Sort by date, amount, or status\n\n### Marking as Paid\n\n1. Open the invoice\n2. Click **Mark as Paid** (full) or **Record Payment** (partial)\n3. Enter the amount and payment method\n4. The balance due updates automatically\n\n---\n\n## 5. Quotes\n\n### Quote Lifecycle\n\n```\nDRAFT \u2192 SENT \u2192 ACCEPTED \u2192 Convert to Invoice\n                        \u2198 DECLINED\n             \u2192 COUNTERED \u2192 Admin: Accept Counter / Decline / Redraft\n```\n\n### The Negotiation Loop\n\nBillReve's counter-offer feature allows true negotiation:\n\n1. You send a quote for $1,000\n2. Client opens the quote link and clicks **Make a Counter Offer**\n3. Client enters their counter ($800) and a message\n4. You see a `COUNTERED` badge on your quote\n5. You can:\n   - **Accept Counter** \u2014 Automatically updates the quote total to $800\n   - **Decline** \u2014 Marks quote as declined\n   - **Redraft** \u2014 Creates a new DRAFT from the countered quote to continue negotiation\n\n### Converting to Invoice\n\nOnce a quote is `ACCEPTED`, click **Convert to Invoice**. All line items, taxes, and client details carry over automatically.\n\n### Counter-Offer Settings\n\nWhen creating a quote, you can configure:\n\n- **Allow Counter Offers** \u2014 Toggle to enable/disable client counter-offers\n- **Minimum Counter Amount** \u2014 The lowest counter you'll accept (clients can't go below this)\n\n---\n\n## 6. Clients\n\n### Client Directory\n\nYour client directory stores contact information for everyone you bill. All records sync across devices.\n\n### Adding Clients\n\n- **Manually:** Click **Add Client** and fill in the form\n- **CSV Import:** Click the upload icon to import from a spreadsheet. The wizard maps your columns to BillReve fields.\n\n### Client Fields\n\n- Name (required)\n- Email\n- Phone\n- Address\n\n### Soft Delete\n\nDeleting a client moves them to **Trash** \u2014 they are not permanently deleted. This preserves the historical record on all invoices and quotes associated with them.\n\n---\n\n## 7. Payments & Bank Accounts\n\n### Bank Accounts (Free)\n\nStore your bank transfer details so clients know exactly where to send money.\n\n**To add a bank account:**\n\n1. Go to **Settings \u2192 Payments**\n2. Click **Add Bank Account**\n3. Enter Bank Name, Account Name, Account Number\n4. Set as Default if this is your primary account\n\nYou can add multiple accounts (e.g., personal and business). When creating an invoice, you select which account applies.\n\n### Payment Gateways (Pro)\n\nPro subscribers can enable automated payment collection:\n\n| Gateway | Regions |\n| --- | --- |\n| **Paystack** | Nigeria, Ghana, South Africa |\n| **Flutterwave** | Africa-wide, global |\n| **Stripe** | Global |\n\nWhen a gateway is enabled, your public invoice page shows a **Pay Now** button. Clients pay directly \u2014 no manual verification needed. Your invoice is automatically marked as `PAID` via webhook.\n\n---\n\n## 8. Reports\n\n### Financial Summary\n\nThe Reports page gives you a bird's eye view of your financial health:\n\n- **Total Revenue** \u2014 all-time and by period\n- **Outstanding** \u2014 unpaid invoice totals\n- **Overdue** \u2014 breakdown of what's late\n- **Invoice Count** \u2014 by status\n\n### Charts & Visualisation\n\n- Monthly revenue bar chart\n- Pie chart breakdown (Revenue vs. Outstanding vs. Overdue)\n- Period filters (This Month, Last 3 Months, This Year, All Time)\n\n### AI CFO Report (Pro)\n\nClick **Generate CFO Report** to get a comprehensive AI-written financial analysis of your business, including:\n\n- Revenue trends\n- Payment behaviour analysis\n- Recommendations for improving cash flow\n- Outstanding risk assessment\n\n### Tax Export\n\nExport a filtered list of paid invoices for your accountant or tax filings.\n\n---\n\n## 9. Email Campaigns\n\nSend promotional or informational emails to your entire client directory in one go.\n\n### Sending a Campaign\n\n1. Go to **Campaigns**\n2. Write your subject line and email body\n3. Click **Send to All Clients**\n\n### Campaign History\n\nEach sent campaign is logged with:\n\n- Subject\n- Date sent\n- Number of recipients\n\n> **Note:** Campaigns are sent via BillReve's email infrastructure. Standard anti-spam rules apply.\n\n---\n\n## 10. Revenue AI (RevenueChat)\n\nRevenueChat is your embedded AI business assistant. Access it via the chat bubble on the bottom-right of your dashboard.\n\n### What can it do?\n\n**Financial queries:**\n\n- \"How much did I earn this month?\"\n- \"Who are my top 5 clients by revenue?\"\n- \"Which invoices are overdue right now?\"\n- \"What's my outstanding balance?\"\n\n**Action cards:**\n\n- \"Create an invoice for John Doe for 3 hours of consulting at $150/hr\" \u2192 Opens a pre-filled invoice editor\n- \"Draft a quote for web design services \u2014 20 hours at $80\" \u2192 Opens a pre-filled quote editor\n\n### Privacy\n\nRevenueChat **never** sends sensitive data (client contact details, full bank account numbers) to the AI. Only aggregated, anonymised financial summaries are shared.\n\n### Quotas\n\n| Plan | Monthly AI Prompts |\n| --- | --- |\n| Free | 20 prompts/month |\n| Pro | Unlimited |\n\n---\n\n## 11. AI Document Drafting\n\nThe **AI Draft Modal** lets you create invoices and quotes from natural language.\n\n### How to use it\n\n1. Click the dropdown arrow on **New Invoice** or **New Quote**\n2. Select **Draft with AI**\n3. Describe what you need in plain English:\n   - *\"Invoice for Ahmed for 5 hours of logo design at $60/hr, due in 14 days\"*\n   - *\"Quote for Zara Clothing for full website redesign, $3,500 fixed price\"*\n4. Review the auto-filled editor and adjust if needed\n\n### Input Modes\n\n- **Text** \u2014 Type your description\n- **Voice** \u2014 Speak your invoice (microphone required)\n- **File Upload** \u2014 Upload an image or PDF; AI extracts the line items\n\n---\n\n## 12. Public Payment & Quote Links\n\n### Payment Link (`/pay/:id`)\n\nEvery invoice has a unique public payment link. Share it with your client via email, WhatsApp, or any channel.\n\n**What the client sees:**\n\n- Your business logo and branding\n- Invoice details (items, amounts, due date)\n- Payment options (bank transfer details and/or payment gateway)\n\n**Payment options:**\n\n- **Bank Transfer:** Client sees your bank account details and can click \"I've transferred the funds\" to notify you\n- **Pay Online (Pro):** Embedded Paystack / Flutterwave payment form\n\n### Quote Link (`/quote/:id`)\n\nShare a quote link to allow clients to review and respond.\n\n**What the client can do:**\n\n- **Accept** the quote\n- **Decline** the quote\n- **Make a Counter Offer** (if you enabled it)\n\nYou receive an instant notification for each client action.\n\n### Security\n\nPublic links use Supabase's Row Level Security policies. Clients can only see their specific document \u2014 no other data is accessible via the link.\n\n---\n\n## 13. Settings\n\n### Business Profile\n\n- Business name, email, phone, address\n- Logo upload\n- Country and default currency\n- Industry and business description\n\n### Payments\n\n- Bank account management\n- Payment gateway configuration (Pro)\n\n### Taxes\n\n- Create reusable tax rules (e.g., \"VAT 7.5%\", \"WHT 5%\")\n- Toggle tax as addition or deduction\n- Apply to specific invoices and quotes\n\n### Preferences\n\n- **Theme** \u2014 Choose from 7 preset colour themes or set a custom hex colour\n- **Dark Mode** \u2014 Toggle light/dark appearance\n- **Font** \u2014 Choose your preferred typography\n- **Font Size** \u2014 Compact, Normal, or Comfortable\n- **Mobile Navigation** \u2014 Bottom bar vs. slide-out sidebar\n\n### Account\n\n- Update your name and email\n- Change your password\n- Delete your account\n\n### Sync Status\n\n- View last sync time\n- Manually trigger a sync\n- See any pending or failed sync items\n\n---\n\n## 14. Theming & Personalization\n\n### Available Themes\n\n| Theme | Character |\n| --- | --- |\n| **Default (Purple)** | Deep, premium purple \u2014 the BillReve signature look |\n| **Ocean Blue** | Clean, professional blue |\n| **Emerald** | Fresh, natural green |\n| **Wine** | Bold, glossy wine red |\n| **Sunset** | Warm, energetic orange |\n| **Mustard** | Confident, warm yellow |\n| **Cherry** | Sharp, assertive red |\n| **Slate** | Neutral, minimal charcoal |\n\n### Custom Color\n\nPick any hex color using the color picker. BillReve automatically generates a full 10-shade palette from your color and applies it across the entire app.\n\n### Dark Mode\n\nToggle dark mode from Settings \u2192 Preferences or via the moon icon in the footer. Your preference is saved and persists across sessions and devices.\n\n---\n\n## 15. Pro Subscription\n\n### Free Plan\n\n| Feature | Limit |\n| --- | --- |\n| Invoices | 10/month |\n| Quotes | 10/month |\n| Clients | 10 |\n| AI Prompts | 20/month |\n| Trash retention | 7 days |\n| Payment gateways | \u2717 Not included |\n| Automated reminders | \u2717 Not included |\n\n### Pro Plan\n\n| Feature | Limit |\n| --- | --- |\n| Invoices | Unlimited |\n| Quotes | Unlimited |\n| Clients | Unlimited |\n| AI Prompts | Unlimited |\n| Trash retention | 30 days |\n| Payment gateways | Paystack, Flutterwave, Stripe |\n| Automated reminders | \u2713 Included |\n| AI CFO Reports | \u2713 Included |\n| Priority support | \u2713 Included |\n\n### Upgrading\n\nGo to **Settings \u2192 Upgrade** or click any **Pro** badge in the app. Payment is processed securely via Paystack.\n\n### Billing\n\n- Monthly or annual billing\n- Cancel anytime \u2014 your account downgrades gracefully at the end of the billing period; no data is deleted\n\n---\n\n## 16. Offline Mode & Sync\n\n### How it works\n\nBillReve uses a local-first architecture powered by IndexedDB (via Dexie.js):\n\n1. All your data is stored locally on your device\n2. Every action writes to local storage first \u2014 instantly, without waiting for a server response\n3. A background sync engine runs every 10 seconds, pushing your changes to the cloud\n4. When you return to connectivity after being offline, all queued changes upload automatically\n\n### Sync Status Indicator\n\nThe cloud icon in the top navigation shows your sync status:\n\n- **Cloud icon** \u2014 Synced and connected\n- **Spinning** \u2014 Sync in progress\n- **Error** \u2014 One or more items failed to sync (will retry automatically)\n\n### Conflict Resolution\n\nIf the same record is edited on two devices simultaneously, the **most recently edited version wins**. Additionally, confirmed statuses (like `PAID` or `ACCEPTED`) always take priority and can never be overwritten by an older edit.\n\n### Working Offline\n\n| Available Offline | Requires Connection |\n| --- | --- |\n| Create, edit, delete invoices/quotes/clients | Process online payments |\n| View all existing data | AI features (RevenueChat, AI Drafting) |\n| Generate PDFs | Real-time notifications |\n| Send emails (queued until online) | Webhook-triggered status updates |\n\n---\n\n## 17. PWA \u2014 Installing BillReve\n\nBillReve is a Progressive Web App. You can install it on any device for a native app-like experience.\n\n### On Mobile (Android / iOS)\n\n1. Open [billreve.app](https://billreve.app) in your browser\n2. **Android:** Tap the browser menu \u2192 **Add to Home Screen**\n3. **iOS (Safari):** Tap the Share icon \u2192 **Add to Home Screen**\n\n### On Desktop (Chrome / Edge)\n\n1. Open [billreve.app](https://billreve.app)\n2. Click the install icon in the address bar\n3. Click **Install**\n\n### After Installing\n\n- BillReve runs as a standalone app with no browser chrome\n- Works fully offline after first load\n- Updates automatically when a new version is available (you'll see a prompt)\n\n---\n\n## 18. Trash & Recovery\n\n### How Trash Works\n\nWhen you delete an invoice, quote, or client, it moves to **Trash** rather than being permanently deleted.\n\n### Recovering Items\n\n1. Go to **Trash** (accessible from the main navigation)\n2. Find the item you want to recover\n3. Click **Restore** \u2014 it returns to its original state\n\n### Automatic Purge\n\nItems in Trash are automatically and permanently deleted after:\n\n| Plan | Retention |\n| --- | --- |\n| Free | 7 days |\n| Pro | 30 days |\n\nOnce purged, items **cannot be recovered**.\n\n### Permanent Delete\n\nYou can permanently delete individual items from Trash before the auto-purge timer, or use **Empty Trash** to clear everything at once.\n\n---\n\n## 19. Security & Privacy\n\n### Data Encryption\n\nAll data is encrypted in transit (HTTPS/TLS) and at rest in Supabase's managed PostgreSQL database.\n\n### Row Level Security\n\nEvery database query is enforced with Supabase's Row Level Security (RLS) policies. This means:\n\n- You can only ever access your own data\n- No SQL query, even a direct API call, can retrieve another user's data\n- Public invoice/quote links expose only the minimum required data (line items, total, status)\n\n### Public Link Security\n\nPublic payment and quote links use a randomly generated document ID. The URL is not guessable. Only the specific document's data is accessible \u2014 no client directory, no business financials, no other invoices.\n\n### Your Data\n\n- BillReve does not sell your data to third parties\n- AI prompts are processed by Google Gemini. Only anonymised, aggregated financial summaries are sent \u2014 never client names, contact details, or bank account numbers\n- You can export or delete your data at any time from Settings \u2192 Account\n\n---\n\n## 20. Frequently Asked Questions\n\n**Q: Can I use BillReve without internet?**\n\nYes. BillReve works fully offline. All your data is stored locally and synced to the cloud when you're back online.\n\n---\n\n**Q: How do I receive payment from a client?**\n\nShare the payment link from any invoice. Clients can pay via your bank account details (all plans) or online payment gateway (Pro). You'll receive a notification when payment is made.\n\n---\n\n**Q: What happens when a client clicks \"I've transferred the funds\"?**\n\nThe invoice status changes to `PENDING` and you receive an in-app notification. You then verify the transfer in your bank and click **Confirm & Mark as Paid** to close the invoice.\n\n---\n\n**Q: Can multiple devices sync automatically?**\n\nYes. Log in on any device and your data will sync. Changes from one device appear on other devices within seconds.\n\n---\n\n**Q: What currencies are supported?**\n\nBillReve supports any currency. Set your default currency in Business Profile, and you can override it per invoice.\n\n---\n\n**Q: How do automated email reminders work?**\n\nFor Pro subscribers, BillReve automatically emails your clients at -3 days (upcoming), due date, +3, +7, and +14 days (overdue). No action needed \u2014 it runs in the background.\n\n---\n\n**Q: Is there a limit on how many clients I can have?**\n\nFree plan: 10 clients. Pro plan: unlimited.\n\n---\n\n**Q: Can I customise invoice templates?**\n\nYes. Choose from 5 document themes (Standard, Professional, Modern, Classic, Monochrome) in the PDF settings. Your business logo and branding are applied automatically.\n\n---\n\n**Q: What happens if my Pro subscription expires?**\n\nYour account gracefully downgrades to Free. All your existing data is preserved. You'll lose access to Pro-only features (gateways, unlimited records, etc.) but nothing is deleted.\n\n---\n\n**Q: How do I contact support?**\n\nUse the Support page at [billreve.app/support](https://billreve.app/support) or email support from the Help Centre.\n";

// ─── Sidebar Component ────────────────────────────────────────────────────────
const Sidebar: React.FC<{ activeId: string; onNavigate: (id: string) => void }> = ({ activeId, onNavigate }) => (
  <nav className="space-y-0.5 pb-8">
    <p className="px-3 pt-1 pb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
      Contents
    </p>
    {sections.map((section) => {
      const isActive = activeId === section.id;
      return (
        <button
          key={section.id}
          onClick={() => onNavigate(section.id)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 flex items-center gap-2.5 group ${
            isActive
              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <span className={`text-[10px] font-mono font-bold flex-shrink-0 w-6 transition-colors ${isActive ? 'text-purple-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'}`}>
            {section.number}
          </span>
          <span className="truncate leading-snug">{section.label}</span>
          {isActive && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0 text-purple-400" />}
        </button>
      );
    })}
  </nav>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Documentation: React.FC = () => {
  const { hash } = useLocation();
  const [activeId, setActiveId] = useState('1-what-is-billreve');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Scroll to anchor on hash change
  useEffect(() => {
    if (hash) {
      setTimeout(() => {
        const id = hash.replace('#', '');
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActiveId(id);
        }
      }, 150);
    }
  }, [hash]);

  // Scroll-spy via IntersectionObserver
  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting entry
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          const topmost = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          );
          setActiveId(topmost.target.id);
        }
      },
      { rootMargin: '-10% 0px -60% 0px', threshold: 0 }
    );
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const handleNavigate = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <SEO
        title="Documentation"
        description="Complete BillReve user & developer documentation — invoices, quotes, AI, offline sync, payments, and more."
      />

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <span>BillReve</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">Docs</span>
              </div>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Documentation
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full">
              v1.4.1
            </span>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Nav Sheet ─────────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute top-0 left-0 bottom-0 w-72 bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white text-sm">Contents</span>
              <button onClick={() => setMobileNavOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3">
              <Sidebar activeId={activeId} onNavigate={handleNavigate} />
            </div>
          </div>
        </div>
      )}

      {/* ── Body Layout ──────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6 xl:gap-10 py-8">

          {/* Left Sidebar — full-height sticky */}
          <aside className="hidden lg:flex flex-col w-60 xl:w-64 flex-shrink-0">
            <div className="sticky top-[69px] h-[calc(100vh-69px)] overflow-y-auto scrollbar-hide rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <Sidebar activeId={activeId} onNavigate={handleNavigate} />
            </div>
          </aside>

          {/* Main Content */}
          <main ref={contentRef} className="flex-1 min-w-0">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">

              {/* Hero banner inside the content card */}
              <div className="px-8 sm:px-12 py-10 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-purple-50 via-white to-slate-50 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900">
                <p className="text-xs font-semibold uppercase tracking-widest text-purple-500 mb-2">BillReve Docs</p>
                <h2
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3 leading-tight"
                >
                  Complete User &amp; Developer Guide
                </h2>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }} className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-2xl">
                  Everything you need to understand, set up, and get the most out of BillReve — from your first invoice to advanced AI workflows and Pro features.
                </p>
              </div>

              {/* Markdown body */}
              <div className="px-8 sm:px-12 py-10">
                <div
                  ref={contentRef}
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  className={`
                    max-w-none
                    /* Base text */
                    text-slate-700 dark:text-slate-300 text-[15px] leading-7

                    /* H1 — hidden (hero replaces it) */
                    [&_h1]:hidden

                    /* H2 — section headings */
                    [&_h2]:font-bold
                    [&_h2]:text-2xl
                    [&_h2]:text-slate-900
                    dark:[&_h2]:text-white
                    [&_h2]:mt-14
                    [&_h2]:mb-5
                    [&_h2]:pb-3
                    [&_h2]:border-b
                    [&_h2]:border-slate-200
                    dark:[&_h2]:border-slate-700
                    [&_h2]:scroll-mt-24

                    /* H3 — sub-headings */
                    [&_h3]:font-semibold
                    [&_h3]:text-[17px]
                    [&_h3]:text-slate-800
                    dark:[&_h3]:text-slate-200
                    [&_h3]:mt-9
                    [&_h3]:mb-3
                    [&_h3]:scroll-mt-24

                    /* Paragraphs */
                    [&_p]:mb-5
                    [&_p]:leading-7

                    /* Lists */
                    [&_ul]:mb-5
                    [&_ul]:pl-5
                    [&_ul]:space-y-2
                    [&_ul_li]:list-disc
                    [&_ul_li]:marker:text-purple-400
                    [&_ol]:mb-5
                    [&_ol]:pl-5
                    [&_ol]:space-y-2
                    [&_ol_li]:list-decimal
                    [&_ol_li]:marker:text-purple-400
                    [&_ol_li]:marker:font-semibold

                    /* Strong / bold */
                    [&_strong]:text-slate-900
                    dark:[&_strong]:text-white
                    [&_strong]:font-semibold

                    /* Inline code */
                    [&_:not(pre)>code]:text-purple-700
                    dark:[&_:not(pre)>code]:text-purple-300
                    [&_:not(pre)>code]:bg-purple-50
                    dark:[&_:not(pre)>code]:bg-purple-950/50
                    [&_:not(pre)>code]:px-1.5
                    [&_:not(pre)>code]:py-0.5
                    [&_:not(pre)>code]:rounded-md
                    [&_:not(pre)>code]:text-[13px]
                    [&_:not(pre)>code]:font-mono
                    [&_:not(pre)>code]:font-medium
                    [&_:not(pre)>code]:border
                    [&_:not(pre)>code]:border-purple-100
                    dark:[&_:not(pre)>code]:border-purple-900/50

                    /* Code blocks (pre) */
                    [&_pre]:bg-slate-900
                    dark:[&_pre]:bg-slate-950
                    [&_pre]:border
                    [&_pre]:border-slate-700
                    [&_pre]:rounded-xl
                    [&_pre]:px-5
                    [&_pre]:py-4
                    [&_pre]:overflow-x-auto
                    [&_pre]:mb-6
                    [&_pre]:mt-2
                    [&_pre_code]:text-slate-200
                    [&_pre_code]:text-[13px]
                    [&_pre_code]:font-mono
                    [&_pre_code]:bg-transparent
                    [&_pre_code]:border-none
                    [&_pre_code]:p-0

                    /* Blockquotes */
                    [&_blockquote]:border-l-4
                    [&_blockquote]:border-purple-400
                    [&_blockquote]:bg-purple-50
                    dark:[&_blockquote]:bg-purple-950/20
                    [&_blockquote]:rounded-r-xl
                    [&_blockquote]:px-5
                    [&_blockquote]:py-3
                    [&_blockquote]:mb-5
                    [&_blockquote]:text-slate-700
                    dark:[&_blockquote]:text-slate-300
                    [&_blockquote_p]:mb-0

                    /* Tables — full responsive wrapper */
                    [&_table]:w-full
                    [&_table]:mb-8
                    [&_table]:mt-4
                    [&_table]:text-sm
                    [&_table]:border-collapse
                    [&_table]:rounded-xl
                    [&_table]:overflow-hidden
                    [&_table]:border
                    [&_table]:border-slate-200
                    dark:[&_table]:border-slate-700
                    [&_thead]:bg-slate-50
                    dark:[&_thead]:bg-slate-800
                    [&_th]:text-left
                    [&_th]:font-semibold
                    [&_th]:text-slate-700
                    dark:[&_th]:text-slate-300
                    [&_th]:px-4
                    [&_th]:py-3
                    [&_th]:border-b
                    [&_th]:border-slate-200
                    dark:[&_th]:border-slate-700
                    [&_td]:px-4
                    [&_td]:py-3
                    [&_td]:text-slate-700
                    dark:[&_td]:text-slate-300
                    [&_td]:border-b
                    [&_td]:border-slate-100
                    dark:[&_td]:border-slate-800
                    [&_tr:last-child_td]:border-b-0
                    [&_tr:hover_td]:bg-slate-50
                    dark:[&_tr:hover_td]:bg-slate-800/40

                    /* Links */
                    [&_a]:text-purple-600
                    dark:[&_a]:text-purple-400
                    [&_a]:underline
                    [&_a]:underline-offset-2
                    [&_a:hover]:text-purple-800
                    dark:[&_a:hover]:text-purple-300

                    /* HR */
                    [&_hr]:border-slate-200
                    dark:[&_hr]:border-slate-700
                    [&_hr]:my-12

                    /* Em / italic */
                    [&_em]:text-slate-600
                    dark:[&_em]:text-slate-400
                    [&_em]:italic
                  `}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                    {billreveDocMarkdown}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Footer inside card */}
              <div className="px-8 sm:px-12 py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  <p className="font-medium text-slate-600 dark:text-slate-400">BillReve Documentation</p>
                  <p>Version 1.4.1 &middot; Updated September 2026</p>
                </div>
                <a
                  href="https://billreve.app/support"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get Support
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </main>

        </div>
      </div>
    </div>
  );
};

export default Documentation;
