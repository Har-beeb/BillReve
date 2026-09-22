import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO } from '../../components/SEO';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { ChevronRight, Menu, X, BookOpen } from 'lucide-react';

// ─── Navigation Structure ─────────────────────────────────────────────────────
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

const HEADER_HEIGHT = 65; // px — sticky header offset for scroll

// ─── Markdown Content ─────────────────────────────────────────────────────────
export const billreveDocMarkdown = "## 1. What is BillReve?\n\nBillReve is an **AI-powered invoicing and business management platform** built for freelancers, consultants, and small businesses. It combines the speed of a native app with the reliability of cloud sync \u2014 so you can work anywhere, even offline.\n\n### What makes BillReve different?\n\n- **Works offline** \u2014 Create and edit invoices, quotes, and client records with no internet connection. Everything syncs automatically when you're back online.\n- **AI built in** \u2014 Draft professional invoices from a single sentence. Ask your AI assistant \"Who owes me money?\" and get an instant answer.\n- **Client-facing payment links** \u2014 Share a payment link. Your client sees a professional invoice page and can pay directly or report a bank transfer.\n- **Quote negotiation** \u2014 Allow clients to counter-offer on quotes directly from a link. No back-and-forth emails.\n- **Automated reminders** \u2014 Set it and forget it. BillReve automatically emails your clients before and after due dates.\n\n---\n\n## 2. Getting Started\n\n### Creating Your Account\n\n1. Visit [billreve.app](https://billreve.app) and click **Get Started**\n2. Sign up with your email or continue with Google\n3. Verify your email address\n4. You'll be guided through the **Getting Started Checklist** \u2014 a quick 5-step setup\n\n### Getting Started Checklist\n\nThe checklist appears on your dashboard until all steps are complete:\n\n| Step | What to do |\n| --- | --- |\n| 1. Business Profile | Add your company name, logo, address |\n| 2. First Client | Add your first client to the directory |\n| 3. First Invoice | Create and send your first invoice |\n| 4. Payment Method | Add a bank account for receiving payments |\n| 5. Explore AI | Try drafting a document with AI |\n\n---\n\n## 3. Dashboard\n\nThe Dashboard is your business control centre. It shows you everything at a glance.\n\n### Greeting Header\n\nShows a personalised greeting based on your local time (\"Good morning, Techieness!\") with a live summary of your business today.\n\n### Metric Cards\n\n| Card | What it shows |\n| --- | --- |\n| **Total Revenue** | Paid invoices this month + month-over-month growth % |\n| **Outstanding Balance** | Total value of unpaid, sent invoices |\n| **Overdue Amount** | Total value of invoices past their due date |\n| **Accepted Quotes** | Total value of accepted quotes this period |\n\n> Tap any card to jump directly to the filtered view in Invoices or Quotes.\n\n### Revenue Chart\n\nA bar chart of your monthly revenue. Switches to a pie chart automatically if no bar chart data is available.\n\n### Recent Activity\n\nShows your 5 most recently updated invoices and quotes. Click any row to open its preview panel.\n\n### Action Buttons\n\n- **New Quote** \u2014 Create a quote (manually or with AI)\n- **New Invoice** \u2014 Create an invoice (manually or with AI)\n\n---\n\n## 4. Invoices\n\n### Invoice Lifecycle\n\n```\nDRAFT \u2192 SENT \u2192 PENDING \u2192 PAID\n                       \u2198 PARTIAL (partial payment recorded)\n              \u2192 OVERDUE (past due date)\n              \u2192 VOID\n```\n\n### Invoice Statuses\n\n| Status | Meaning |\n| --- | --- |\n| `DRAFT` | Created but not yet sent to client |\n| `SENT` | Shared with client via link or email |\n| `PENDING` | Client has reported a manual bank transfer (awaiting your confirmation) |\n| `PARTIAL` | Some payment recorded, balance still owed |\n| `PAID` | Fully paid \u2014 triggers notification |\n| `OVERDUE` | Past due date and still unpaid |\n| `VOID` | Cancelled / voided |\n\n### Creating an Invoice\n\n1. Click **New Invoice** on Dashboard or Invoices page\n2. Select a client (or create one inline)\n3. Add line items (description, quantity, unit price)\n4. Apply taxes if applicable\n5. Set due date, notes, and payment terms\n6. Choose **Save Draft** or **Save & Send**\n\n### Quick Actions (Preview Panel)\n\n| Status | Quick Action |\n| --- | --- |\n| DRAFT | Edit Invoice |\n| SENT | Copy Payment Link |\n| PENDING | \u2705 Confirm & Mark as Paid |\n| PARTIAL / OVERDUE | Record Payment |\n| OVERDUE | Send Reminder |\n| Any | Download PDF / Receipt |\n\n---\n\n## 5. Quotes\n\n### Quote Lifecycle\n\n```\nDRAFT \u2192 SENT \u2192 ACCEPTED \u2192 Convert to Invoice\n                        \u2198 DECLINED\n             \u2192 COUNTERED \u2192 Accept Counter / Decline / Redraft\n```\n\n### The Negotiation Loop\n\n1. You send a quote for $1,000\n2. Client opens the quote link and clicks **Make a Counter Offer**\n3. Client enters their counter ($800) and a message\n4. You see a `COUNTERED` badge on your quote\n5. You can **Accept Counter**, **Decline**, or **Redraft** to continue negotiation\n\n### Converting to Invoice\n\nOnce a quote is `ACCEPTED`, click **Convert to Invoice**. All line items, taxes, and client details carry over automatically.\n\n### Counter-Offer Settings\n\n- **Allow Counter Offers** \u2014 Toggle to enable/disable client counter-offers\n- **Minimum Counter Amount** \u2014 The lowest counter you'll accept\n\n---\n\n## 6. Clients\n\n### Client Directory\n\nYour client directory stores contact information for everyone you bill. All records sync across devices.\n\n### Adding Clients\n\n- **Manually:** Click **Add Client** and fill in the form\n- **CSV Import:** Click the upload icon to import from a spreadsheet\n\n### Soft Delete\n\nDeleting a client moves them to **Trash** \u2014 not permanently deleted. All historical invoices and quotes are preserved.\n\n---\n\n## 7. Payments & Bank Accounts\n\n### Bank Accounts (Free)\n\n1. Go to **Settings \u2192 Payments**\n2. Click **Add Bank Account**\n3. Enter Bank Name, Account Name, Account Number\n4. Set as Default if this is your primary account\n\n### Payment Gateways (Pro)\n\n| Gateway | Regions |\n| --- | --- |\n| **Paystack** | Nigeria, Ghana, South Africa |\n| **Flutterwave** | Africa-wide, global |\n| **Stripe** | Global |\n\nWhen a gateway is enabled, your public invoice page shows a **Pay Now** button. Your invoice is automatically marked as `PAID` via webhook.\n\n---\n\n## 8. Reports\n\n### Financial Summary\n\n- **Total Revenue** \u2014 all-time and by period\n- **Outstanding** \u2014 unpaid invoice totals\n- **Overdue** \u2014 breakdown of what's late\n- **Invoice Count** \u2014 by status\n\n### Charts & Visualisation\n\n- Monthly revenue bar chart\n- Pie chart breakdown (Revenue vs. Outstanding vs. Overdue)\n- Period filters: This Month, Last 3 Months, This Year, All Time\n\n### AI CFO Report (Pro)\n\nClick **Generate CFO Report** for a comprehensive AI-written financial analysis including revenue trends, payment behaviour, and cash flow recommendations.\n\n---\n\n## 9. Email Campaigns\n\nSend bulk emails to your entire client directory.\n\n1. Go to **Campaigns**\n2. Write your subject line and email body\n3. Click **Send to All Clients**\n\n> **Note:** Campaigns are sent via BillReve's email infrastructure. Standard anti-spam rules apply.\n\n---\n\n## 10. Revenue AI (RevenueChat)\n\nRevenueChat is your embedded AI business assistant. Access it via the chat bubble on your dashboard.\n\n### What can it do?\n\n**Financial queries:**\n- \"How much did I earn this month?\"\n- \"Who are my top 5 clients by revenue?\"\n- \"Which invoices are overdue right now?\"\n\n**Action cards:**\n- \"Create an invoice for John Doe for 3 hours of consulting at $150/hr\" \u2192 Opens a pre-filled editor\n- \"Draft a quote for web design \u2014 20 hours at $80\" \u2192 Opens a pre-filled editor\n\n### Quotas\n\n| Plan | Monthly AI Prompts |\n| --- | --- |\n| Free | 20 prompts/month |\n| Pro | Unlimited |\n\n---\n\n## 11. AI Document Drafting\n\nCreate invoices and quotes from natural language.\n\n1. Click the dropdown arrow on **New Invoice** or **New Quote**\n2. Select **Draft with AI**\n3. Describe what you need:\n   - *\"Invoice for Ahmed for 5 hours of logo design at $60/hr, due in 14 days\"*\n4. Review the auto-filled editor and adjust if needed\n\n### Input Modes\n\n- **Text** \u2014 Type your description\n- **Voice** \u2014 Speak your invoice (microphone required)\n- **File Upload** \u2014 Upload an image or PDF; AI extracts line items\n\n---\n\n## 12. Public Payment & Quote Links\n\n### Payment Link (`/pay/:id`)\n\nEvery invoice has a unique public payment link.\n\n**What the client sees:**\n- Your business logo and branding\n- Invoice details (items, amounts, due date)\n- Bank transfer details and/or Pay Now button (Pro)\n\n**Client actions:**\n- Click \"I've transferred the funds\" to mark as `PENDING`\n- Pay online via Paystack or Flutterwave (Pro)\n\n### Quote Link (`/quote/:id`)\n\n- **Accept** the quote\n- **Decline** the quote\n- **Make a Counter Offer** (if enabled)\n\nYou receive an instant notification for each client action.\n\n---\n\n## 13. Settings\n\n### Business Profile\n- Business name, email, phone, address, logo\n- Country and default currency\n\n### Taxes\n- Create reusable tax rules (e.g., \"VAT 7.5%\", \"WHT 5%\")\n- Toggle as addition or deduction\n\n### Preferences\n- **Theme** \u2014 7 preset colour themes or custom hex\n- **Dark Mode** \u2014 Toggle light/dark appearance\n- **Font** \u2014 Choose your typography\n- **Font Size** \u2014 Compact, Normal, or Comfortable\n\n### Sync Status\n- View last sync time, manually trigger a sync\n\n---\n\n## 14. Theming & Personalization\n\n| Theme | Character |\n| --- | --- |\n| **Default (Purple)** | Deep, premium purple \u2014 the BillReve signature look |\n| **Ocean Blue** | Clean, professional blue |\n| **Emerald** | Fresh, natural green |\n| **Wine** | Bold, glossy wine red |\n| **Sunset** | Warm, energetic orange |\n| **Mustard** | Confident, warm yellow |\n| **Cherry** | Sharp, assertive red |\n| **Slate** | Neutral, minimal charcoal |\n\n### Custom Color\n\nPick any hex color. BillReve generates a full 10-shade palette and applies it across the entire app.\n\n---\n\n## 15. Pro Subscription\n\n### Free vs Pro\n\n| Feature | Free | Pro |\n| --- | --- | --- |\n| Invoices | 10/month | Unlimited |\n| Quotes | 10/month | Unlimited |\n| Clients | 10 | Unlimited |\n| AI Prompts | 20/month | Unlimited |\n| Trash retention | 7 days | 30 days |\n| Payment gateways | \u2717 | Paystack, Flutterwave, Stripe |\n| Automated reminders | \u2717 | \u2713 |\n| AI CFO Reports | \u2717 | \u2713 |\n\n### Upgrading\n\nGo to **Settings \u2192 Upgrade** or click any **Pro** badge in the app.\n\nCancel anytime \u2014 your account downgrades gracefully; no data is deleted.\n\n---\n\n## 16. Offline Mode & Sync\n\n### How it works\n\n1. All data is stored locally on your device (IndexedDB via Dexie.js)\n2. Every action writes to local storage first \u2014 instantly, no server wait\n3. A background sync engine runs every 10 seconds, pushing changes to the cloud\n4. When you reconnect after being offline, all queued changes upload automatically\n\n### Conflict Resolution\n\nIf the same record is edited on two devices simultaneously, the **most recently edited version wins**. `PAID` and `ACCEPTED` statuses always take priority.\n\n### Working Offline vs Online\n\n| Available Offline | Requires Connection |\n| --- | --- |\n| Create/edit/delete invoices, quotes, clients | Process online payments |\n| View all existing data | AI features |\n| Generate PDFs | Real-time notifications |\n\n---\n\n## 17. PWA \u2014 Installing BillReve\n\nBillReve is a Progressive Web App. Install it for a native app experience.\n\n### On Mobile (Android / iOS)\n\n- **Android:** Browser menu \u2192 **Add to Home Screen**\n- **iOS (Safari):** Share icon \u2192 **Add to Home Screen**\n\n### On Desktop (Chrome / Edge)\n\n1. Open [billreve.app](https://billreve.app)\n2. Click the install icon in the address bar\n3. Click **Install**\n\nAfter installing: works fully offline, updates automatically.\n\n---\n\n## 18. Trash & Recovery\n\nDeleted items move to **Trash** and are automatically purged after:\n\n| Plan | Retention |\n| --- | --- |\n| Free | 7 days |\n| Pro | 30 days |\n\n### Recovering Items\n\n1. Go to **Trash** in the main navigation\n2. Find the item\n3. Click **Restore**\n\nOnce permanently purged, items **cannot be recovered**.\n\n---\n\n## 19. Security & Privacy\n\n### Row Level Security\n\nEvery Supabase query is enforced with Row Level Security (RLS) policies:\n- You can only access your own data\n- Public invoice/quote links expose only the minimum required data\n- No SQL query can retrieve another user's records\n\n### AI & Privacy\n\nRevenueChat **never** sends sensitive data to AI. Only anonymised, aggregated financial summaries are shared \u2014 never client names, contact details, or bank account numbers.\n\n---\n\n## 20. Frequently Asked Questions\n\n**Q: Can I use BillReve without internet?**\n\nYes. BillReve works fully offline. All your data is stored locally and synced to the cloud when you're back online.\n\n**Q: How do I receive payment from a client?**\n\nShare the payment link from any invoice. Clients pay via bank transfer (all plans) or online gateway (Pro).\n\n**Q: What happens when a client clicks \"I've transferred the funds\"?**\n\nThe invoice status changes to `PENDING` and you receive an in-app notification. Verify the transfer in your bank, then click **Confirm & Mark as Paid**.\n\n**Q: What currencies are supported?**\n\nBillReve supports any currency. Set your default in Business Profile and override per invoice.\n\n**Q: How do automated reminders work?**\n\nPro subscribers: BillReve automatically emails clients at -3 days, due date, +3, +7, and +14 days overdue. Paid invoices are automatically skipped.\n\n**Q: What happens if my Pro subscription expires?**\n\nYour account downgrades to Free gracefully. All data is preserved \u2014 nothing is deleted.\n\n**Q: How do I contact support?**\n\nVisit [billreve.app/support](https://billreve.app/support).\n";

// ─── Sidebar NavItem ──────────────────────────────────────────────────────────
const NavItem: React.FC<{ section: typeof sections[0]; isActive: boolean; onClick: () => void }> = ({
  section, isActive, onClick
}) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 flex items-center gap-2.5 group ${
      isActive
        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
    }`}
  >
    <span className={`text-[10px] font-mono font-bold w-5 flex-shrink-0 ${
      isActive ? 'text-purple-400' : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'
    }`}>
      {section.number}
    </span>
    <span className="truncate leading-snug">{section.label}</span>
    {isActive && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0 text-purple-400" />}
  </button>
);

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const Sidebar: React.FC<{ activeId: string; onNavigate: (id: string) => void }> = ({ activeId, onNavigate }) => (
  <div className="py-4 px-2">
    <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
      Contents
    </p>
    <div className="space-y-0.5">
      {sections.map((s) => (
        <NavItem key={s.id} section={s} isActive={activeId === s.id} onClick={() => onNavigate(s.id)} />
      ))}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Documentation: React.FC = () => {
  const { hash } = useLocation();
  const [activeId, setActiveId] = useState('1-what-is-billreve');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reliable scroll-to with sticky header offset
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT - 16;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveId(id);
  };

  const handleNavigate = (id: string) => {
    scrollToSection(id);
    setMobileNavOpen(false);
  };

  // Scroll to hash on load
  useEffect(() => {
    if (hash) {
      setTimeout(() => scrollToSection(hash.replace('#', '')), 200);
    }
  }, [hash]);

  // Scroll-spy
  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          const topmost = visible.reduce((a, b) =>
            a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
          );
          setActiveId(topmost.target.id);
        }
      },
      { rootMargin: '-15% 0px -65% 0px' }
    );
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <SEO title="Documentation" description="Complete BillReve user & developer guide." />

      {/* ── Sticky Header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <span>BillReve</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">Documentation</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex px-2 py-0.5 text-xs font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full">
              v1.4.1
            </span>
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Nav Sheet ─────────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute top-0 left-0 bottom-0 w-72 bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-900 dark:text-white">Contents</span>
              <button onClick={() => setMobileNavOpen(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <Sidebar activeId={activeId} onNavigate={handleNavigate} />
          </div>
        </div>
      )}

      {/* ── Page Body ────────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">

          {/* Sidebar — sticks under the header for the full page height */}
          <aside className="hidden lg:block w-60 xl:w-64 flex-shrink-0">
            <div
              className="sticky overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              style={{ top: `${HEADER_HEIGHT + 16}px`, maxHeight: `calc(100vh - ${HEADER_HEIGHT + 48}px)` }}
            >
              <Sidebar activeId={activeId} onNavigate={handleNavigate} />
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0">

            {/* Hero Banner */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-0">
              <div className="px-8 sm:px-12 py-10 bg-gradient-to-br from-purple-50 via-white to-slate-50 dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-widest text-purple-500 mb-2">BillReve Docs</p>
                <h1
                  className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3 leading-tight"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  Complete User &amp; Developer Guide
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-2xl">
                  Everything you need to understand, set up, and get the most out of BillReve — from your first invoice to advanced AI workflows and Pro features.
                </p>
                {/* Quick nav pills */}
                <div className="flex flex-wrap gap-2 mt-5">
                  {['Invoices', 'Quotes', 'AI Features', 'Offline Sync', 'Pro Plan'].map((tag) => {
                    const tagId = sections.find(s => s.label.includes(tag.split(' ')[0]))?.id ?? '';
                    return (
                      <button
                        key={tag}
                        onClick={() => tagId && handleNavigate(tagId)}
                        className="px-3 py-1 text-xs font-medium rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-purple-300 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Markdown body — uses proven prose classes */}
              <div className="bg-white dark:bg-slate-900 px-8 sm:px-12 py-10">
                <div
                  className="
                    prose prose-slate dark:prose-invert max-w-none
                    prose-headings:font-bold
                    prose-h2:text-2xl prose-h2:text-slate-900 dark:prose-h2:text-white prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-3 prose-h2:border-b prose-h2:border-slate-200 dark:prose-h2:border-slate-700
                    prose-h3:text-lg prose-h3:text-slate-800 dark:prose-h3:text-slate-200 prose-h3:mt-8 prose-h3:mb-3 prose-h3:font-semibold
                    prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-7 prose-p:mb-4
                    prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-li:leading-7
                    prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-semibold
                    prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline
                    prose-code:text-purple-700 dark:prose-code:text-purple-300 prose-code:bg-purple-50 dark:prose-code:bg-purple-950/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                    prose-pre:bg-slate-900 dark:prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-700 prose-pre:rounded-xl prose-pre:text-sm
                    prose-blockquote:border-l-4 prose-blockquote:border-purple-400 prose-blockquote:bg-purple-50 dark:prose-blockquote:bg-purple-950/20 prose-blockquote:rounded-r-xl prose-blockquote:not-italic prose-blockquote:text-slate-700 dark:prose-blockquote:text-slate-300
                    prose-table:text-sm
                    prose-thead:bg-slate-50 dark:prose-thead:bg-slate-800
                    prose-th:text-slate-700 dark:prose-th:text-slate-300 prose-th:font-semibold prose-th:px-4 prose-th:py-3
                    prose-td:px-4 prose-td:py-3 prose-td:text-slate-700 dark:prose-td:text-slate-300
                    prose-hr:border-slate-200 dark:prose-hr:border-slate-700 prose-hr:my-10
                  "
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
                    {billreveDocMarkdown}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 sm:px-12 py-5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  BillReve Documentation · Version 1.4.1 · September 2026
                </p>
                <a
                  href="https://billreve.app/support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Get Support <ChevronRight className="w-3.5 h-3.5" />
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
