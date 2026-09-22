import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO } from '../../components/SEO';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { ChevronRight, Menu, X, BookOpen } from 'lucide-react';
import type { Components } from 'react-markdown';

/* ─── Navigation ──────────────────────────────────────────────────────────── */
const sections = [
  { id: '1-what-is-billreve',             label: 'What is BillReve?',         n: '01' },
  { id: '2-getting-started',              label: 'Getting Started',            n: '02' },
  { id: '3-dashboard',                    label: 'Dashboard',                  n: '03' },
  { id: '4-invoices',                     label: 'Invoices',                   n: '04' },
  { id: '5-quotes',                       label: 'Quotes',                     n: '05' },
  { id: '6-clients',                      label: 'Clients',                    n: '06' },
  { id: '7-payments--bank-accounts',      label: 'Payments & Bank Accounts',   n: '07' },
  { id: '8-reports',                      label: 'Reports',                    n: '08' },
  { id: '9-email-campaigns',              label: 'Email Campaigns',            n: '09' },
  { id: '10-revenue-ai-revenuechat',      label: 'Revenue AI',                 n: '10' },
  { id: '11-ai-document-drafting',        label: 'AI Document Drafting',       n: '11' },
  { id: '12-public-payment--quote-links', label: 'Public Links',               n: '12' },
  { id: '13-settings',                    label: 'Settings',                   n: '13' },
  { id: '14-theming--personalization',    label: 'Theming',                    n: '14' },
  { id: '15-pro-subscription',            label: 'Pro Subscription',           n: '15' },
  { id: '16-offline-mode--sync',          label: 'Offline Mode & Sync',        n: '16' },
  { id: '17-pwa--installing-billreve',    label: 'PWA — Installing',           n: '17' },
  { id: '18-trash--recovery',             label: 'Trash & Recovery',           n: '18' },
  { id: '19-security--privacy',           label: 'Security & Privacy',         n: '19' },
  { id: '20-frequently-asked-questions',  label: 'FAQ',                        n: '20' },
];

const HEADER_H = 64; // sticky header px

/* ─── Markdown Content ────────────────────────────────────────────────────── */
export const billreveDocMarkdown = "## 1. What is BillReve?\n\nBillReve is an **AI-powered invoicing and business management platform** built for freelancers, consultants, and small businesses. It combines the speed of a native app with the reliability of cloud sync \u2014 so you can work anywhere, even offline.\n\n### What makes BillReve different?\n\n- **Works offline** \u2014 Create and edit invoices, quotes, and client records with no internet connection. Everything syncs automatically when you're back online.\n- **AI built in** \u2014 Draft professional invoices from a single sentence. Ask your AI assistant \"Who owes me money?\" and get an instant answer.\n- **Client-facing payment links** \u2014 Share a payment link. Your client sees a professional invoice page and can pay directly or report a bank transfer.\n- **Quote negotiation** \u2014 Allow clients to counter-offer on quotes directly from a link. No back-and-forth emails.\n- **Automated reminders** \u2014 Set it and forget it. BillReve automatically emails your clients before and after due dates.\n\n---\n\n## 2. Getting Started\n\n### Creating Your Account\n\n1. Visit [billreve.app](https://billreve.app) and click **Get Started**\n2. Sign up with your email or continue with Google\n3. Verify your email address\n4. You'll be guided through the **Getting Started Checklist** \u2014 a quick 5-step setup\n\n### Getting Started Checklist\n\nThe checklist appears on your dashboard until all steps are complete:\n\n| Step | What to do |\n| --- | --- |\n| 1. Business Profile | Add your company name, logo, address |\n| 2. First Client | Add your first client to the directory |\n| 3. First Invoice | Create and send your first invoice |\n| 4. Payment Method | Add a bank account for receiving payments |\n| 5. Explore AI | Try drafting a document with AI |\n\n---\n\n## 3. Dashboard\n\nThe Dashboard is your business control centre. It shows you everything at a glance.\n\n### Greeting Header\n\nShows a personalised greeting based on your local time (\"Good morning, Techieness!\") with a live summary of your business today.\n\n### Metric Cards\n\n| Card | What it shows |\n| --- | --- |\n| **Total Revenue** | Paid invoices this month + month-over-month growth % |\n| **Outstanding Balance** | Total value of unpaid, sent invoices |\n| **Overdue Amount** | Total value of invoices past their due date |\n| **Accepted Quotes** | Total value of accepted quotes this period |\n\n> Tap any card to jump directly to the filtered view in Invoices or Quotes.\n\n### Revenue Chart\n\nA bar chart of your monthly revenue. Switches to a pie chart automatically if no bar chart data is available.\n\n### Recent Activity\n\nShows your 5 most recently updated invoices and quotes. Click any row to open its preview panel.\n\n---\n\n## 4. Invoices\n\n### Invoice Lifecycle\n\n```\nDRAFT \u2192 SENT \u2192 PENDING \u2192 PAID\n                       \u2198 PARTIAL (partial payment recorded)\n              \u2192 OVERDUE (past due date)\n              \u2192 VOID\n```\n\n### Invoice Statuses\n\n| Status | Meaning |\n| --- | --- |\n| `DRAFT` | Created but not yet sent to client |\n| `SENT` | Shared with client via link or email |\n| `PENDING` | Client has reported a manual bank transfer (awaiting your confirmation) |\n| `PARTIAL` | Some payment recorded, balance still owed |\n| `PAID` | Fully paid \u2014 triggers notification |\n| `OVERDUE` | Past due date and still unpaid |\n| `VOID` | Cancelled / voided |\n\n### Creating an Invoice\n\n1. Click **New Invoice** on Dashboard or Invoices page\n2. Select a client (or create one inline)\n3. Add line items (description, quantity, unit price)\n4. Apply taxes if applicable\n5. Set due date, notes, and payment terms\n6. Choose **Save Draft** or **Save & Send**\n\n### Quick Actions (Preview Panel)\n\n| Status | Quick Action |\n| --- | --- |\n| DRAFT | Edit Invoice |\n| SENT | Copy Payment Link |\n| PENDING | \u2705 Confirm & Mark as Paid |\n| PARTIAL / OVERDUE | Record Payment |\n| OVERDUE | Send Reminder |\n| Any | Download PDF / Receipt |\n\n---\n\n## 5. Quotes\n\n### Quote Lifecycle\n\n```\nDRAFT \u2192 SENT \u2192 ACCEPTED \u2192 Convert to Invoice\n                        \u2198 DECLINED\n             \u2192 COUNTERED \u2192 Accept Counter / Decline / Redraft\n```\n\n### The Negotiation Loop\n\n1. You send a quote for $1,000\n2. Client opens the quote link and clicks **Make a Counter Offer**\n3. Client enters their counter ($800) and a message\n4. You see a `COUNTERED` badge on your quote\n5. You can **Accept Counter**, **Decline**, or **Redraft** to continue negotiation\n\n### Converting to Invoice\n\nOnce a quote is `ACCEPTED`, click **Convert to Invoice**. All line items, taxes, and client details carry over automatically.\n\n### Counter-Offer Settings\n\n- **Allow Counter Offers** \u2014 Toggle to enable/disable client counter-offers\n- **Minimum Counter Amount** \u2014 The lowest counter you'll accept\n\n---\n\n## 6. Clients\n\n### Client Directory\n\nYour client directory stores contact information for everyone you bill. All records sync across devices.\n\n### Adding Clients\n\n- **Manually:** Click **Add Client** and fill in the form\n- **CSV Import:** Click the upload icon to import from a spreadsheet\n\n### Soft Delete\n\nDeleting a client moves them to **Trash** \u2014 not permanently deleted. All historical invoices and quotes are preserved.\n\n---\n\n## 7. Payments & Bank Accounts\n\n### Bank Accounts (Free)\n\n1. Go to **Settings \u2192 Payments**\n2. Click **Add Bank Account**\n3. Enter Bank Name, Account Name, Account Number\n4. Set as Default if this is your primary account\n\n### Payment Gateways (Pro)\n\n| Gateway | Regions |\n| --- | --- |\n| **Paystack** | Nigeria, Ghana, South Africa |\n| **Flutterwave** | Africa-wide, global |\n| **Stripe** | Global |\n\nWhen a gateway is enabled, your public invoice page shows a **Pay Now** button. Your invoice is automatically marked as `PAID` via webhook.\n\n---\n\n## 8. Reports\n\n### Financial Summary\n\n- **Total Revenue** \u2014 all-time and by period\n- **Outstanding** \u2014 unpaid invoice totals\n- **Overdue** \u2014 breakdown of what's late\n- **Invoice Count** \u2014 by status\n\n### Charts & Visualisation\n\n- Monthly revenue bar chart\n- Pie chart breakdown (Revenue vs. Outstanding vs. Overdue)\n- Period filters: This Month, Last 3 Months, This Year, All Time\n\n### AI CFO Report (Pro)\n\nClick **Generate CFO Report** for a comprehensive AI-written financial analysis including revenue trends, payment behaviour, and cash flow recommendations.\n\n---\n\n## 9. Email Campaigns\n\nSend bulk emails to your entire client directory.\n\n1. Go to **Campaigns**\n2. Write your subject line and email body\n3. Click **Send to All Clients**\n\n> **Note:** Campaigns are sent via BillReve's email infrastructure. Standard anti-spam rules apply.\n\n---\n\n## 10. Revenue AI (RevenueChat)\n\nRevenueChat is your embedded AI business assistant. Access it via the chat bubble on your dashboard.\n\n### What can it do?\n\n**Financial queries:**\n\n- \"How much did I earn this month?\"\n- \"Who are my top 5 clients by revenue?\"\n- \"Which invoices are overdue right now?\"\n\n**Action cards:**\n\n- \"Create an invoice for John Doe for 3 hours of consulting at $150/hr\" \u2192 Opens a pre-filled editor\n- \"Draft a quote for web design \u2014 20 hours at $80\" \u2192 Opens a pre-filled editor\n\n### Quotas\n\n| Plan | Monthly AI Prompts |\n| --- | --- |\n| Free | 20 prompts/month |\n| Pro | Unlimited |\n\n---\n\n## 11. AI Document Drafting\n\nCreate invoices and quotes from natural language.\n\n1. Click the dropdown arrow on **New Invoice** or **New Quote**\n2. Select **Draft with AI**\n3. Describe what you need, for example: *\"Invoice for Ahmed for 5 hours of logo design at $60/hr, due in 14 days\"*\n4. Review the auto-filled editor and adjust if needed\n\n### Input Modes\n\n- **Text** \u2014 Type your description\n- **Voice** \u2014 Speak your invoice (microphone required)\n- **File Upload** \u2014 Upload an image or PDF; AI extracts line items\n\n---\n\n## 12. Public Payment & Quote Links\n\n### Payment Link\n\nEvery invoice has a unique public payment link at `/pay/:id`.\n\n**What the client sees:**\n\n- Your business logo and branding\n- Invoice details (items, amounts, due date)\n- Bank transfer details and/or Pay Now button (Pro)\n\n### Quote Link\n\nShare a quote link at `/quote/:id`. The client can:\n\n- **Accept** the quote\n- **Decline** the quote\n- **Make a Counter Offer** (if enabled)\n\nYou receive an instant notification for each client action.\n\n---\n\n## 13. Settings\n\n### Business Profile\n\n- Business name, email, phone, address, logo\n- Country and default currency\n\n### Taxes\n\n- Create reusable tax rules (e.g., \"VAT 7.5%\", \"WHT 5%\")\n- Toggle as addition or deduction\n\n### Preferences\n\n- **Theme** \u2014 7 preset colour themes or custom hex\n- **Dark Mode** \u2014 Toggle light/dark appearance\n- **Font** \u2014 Choose your typography\n- **Font Size** \u2014 Compact, Normal, or Comfortable\n\n### Sync Status\n\n- View last sync time and manually trigger a sync\n\n---\n\n## 14. Theming & Personalization\n\n| Theme | Character |\n| --- | --- |\n| **Default (Purple)** | Deep, premium purple \u2014 the BillReve signature look |\n| **Ocean Blue** | Clean, professional blue |\n| **Emerald** | Fresh, natural green |\n| **Wine** | Bold, glossy wine red |\n| **Sunset** | Warm, energetic orange |\n| **Mustard** | Confident, warm yellow |\n| **Cherry** | Sharp, assertive red |\n| **Slate** | Neutral, minimal charcoal |\n\n### Custom Color\n\nPick any hex color. BillReve generates a full 10-shade palette and applies it across the entire app.\n\n---\n\n## 15. Pro Subscription\n\n### Free vs Pro\n\n| Feature | Free | Pro |\n| --- | --- | --- |\n| Invoices | 10/month | Unlimited |\n| Quotes | 10/month | Unlimited |\n| Clients | 10 | Unlimited |\n| AI Prompts | 20/month | Unlimited |\n| Trash retention | 7 days | 30 days |\n| Payment gateways | \u2717 | Paystack, Flutterwave, Stripe |\n| Automated reminders | \u2717 | \u2713 |\n| AI CFO Reports | \u2717 | \u2713 |\n\n### Upgrading\n\nGo to **Settings \u2192 Upgrade** or click any **Pro** badge in the app.\n\nCancel anytime \u2014 your account downgrades gracefully at the end of the billing period. No data is deleted.\n\n---\n\n## 16. Offline Mode & Sync\n\n### How it works\n\n1. All data is stored locally on your device (IndexedDB via Dexie.js)\n2. Every action writes to local storage first \u2014 instantly, no server wait\n3. A background sync engine runs every 10 seconds, pushing changes to the cloud\n4. When you reconnect after being offline, all queued changes upload automatically\n\n### Conflict Resolution\n\nIf the same record is edited on two devices simultaneously, the **most recently edited version wins**. `PAID` and `ACCEPTED` statuses always take priority and can never be overwritten by an older edit.\n\n### Working Offline vs Online\n\n| Available Offline | Requires Connection |\n| --- | --- |\n| Create/edit/delete invoices, quotes, clients | Process online payments |\n| View all existing data | AI features (RevenueChat, AI Drafting) |\n| Generate PDFs | Real-time notifications |\n| Send emails (queued until online) | Webhook-triggered status updates |\n\n---\n\n## 17. PWA \u2014 Installing BillReve\n\nBillReve is a Progressive Web App. Install it for a native app experience on any device.\n\n### On Mobile (Android / iOS)\n\n- **Android:** Browser menu \u2192 **Add to Home Screen**\n- **iOS (Safari):** Share icon \u2192 **Add to Home Screen**\n\n### On Desktop (Chrome / Edge)\n\n1. Open [billreve.app](https://billreve.app)\n2. Click the install icon in the address bar\n3. Click **Install**\n\nAfter installing: works fully offline, updates automatically when a new version is available.\n\n---\n\n## 18. Trash & Recovery\n\nDeleted items move to **Trash** and are automatically purged after:\n\n| Plan | Retention |\n| --- | --- |\n| Free | 7 days |\n| Pro | 30 days |\n\n### Recovering Items\n\n1. Go to **Trash** in the main navigation\n2. Find the item you want to recover\n3. Click **Restore** \u2014 it returns to its original state\n\nOnce permanently purged, items **cannot be recovered**.\n\n---\n\n## 19. Security & Privacy\n\n### Row Level Security\n\nEvery Supabase query is enforced with Row Level Security (RLS) policies:\n\n- You can only access your own data\n- Public invoice/quote links expose only the minimum required data\n- No SQL query can retrieve another user's records\n\n### AI & Privacy\n\nRevenueChat **never** sends sensitive data to AI. Only anonymised, aggregated financial summaries are shared \u2014 never client names, contact details, or bank account numbers.\n\n---\n\n## 20. Frequently Asked Questions\n\n**Q: Can I use BillReve without internet?**\n\nYes. BillReve works fully offline. All your data is stored locally and synced to the cloud when you're back online.\n\n---\n\n**Q: How do I receive payment from a client?**\n\nShare the payment link from any invoice. Clients pay via bank transfer (all plans) or online gateway (Pro). You receive a notification when payment is made.\n\n---\n\n**Q: What happens when a client clicks \"I've transferred the funds\"?**\n\nThe invoice status changes to `PENDING` and you receive an in-app notification. Verify the transfer in your bank, then click **Confirm & Mark as Paid** to close the invoice.\n\n---\n\n**Q: What currencies are supported?**\n\nBillReve supports any currency. Set your default in Business Profile and override per invoice.\n\n---\n\n**Q: How do automated reminders work?**\n\nFor Pro subscribers, BillReve automatically emails clients at -3 days, due date, +3, +7, and +14 days overdue. Paid invoices are automatically skipped.\n\n---\n\n**Q: What happens if my Pro subscription expires?**\n\nYour account downgrades to Free gracefully. All data is preserved \u2014 nothing is deleted.\n\n---\n\n**Q: How do I contact support?**\n\nVisit [billreve.app/support](https://billreve.app/support).\n";

/* ─── Custom Markdown Components ─────────────────────────────────────────── */
const mdComponents: Components = {
  // ── Headings ──────────────────────────────────────────────────────────────
  h2: ({ children, id }) => (
    <div id={id} style={{ scrollMarginTop: `${HEADER_H + 20}px` }}>
      <div style={{ marginTop: '3.5rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '2px solid #f1f0fe' }}>
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'inherit',
          lineHeight: 1.3,
          margin: 0,
        }}>
          {children}
        </h2>
      </div>
    </div>
  ),
  h3: ({ children, id }) => (
    <h3 id={id} style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontSize: '1.05rem',
      fontWeight: 700,
      color: '#7c3aed',
      marginTop: '2rem',
      marginBottom: '0.75rem',
      paddingLeft: '0.875rem',
      borderLeft: '3px solid #8b5cf6',
      letterSpacing: '-0.01em',
      scrollMarginTop: `${HEADER_H + 20}px`,
    }}>
      {children}
    </h3>
  ),

  // ── Paragraphs ────────────────────────────────────────────────────────────
  p: ({ children }) => (
    <p style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      fontSize: '0.9375rem',
      lineHeight: '1.85',
      color: 'var(--doc-text, #374151)',
      marginBottom: '1.1rem',
    }}>
      {children}
    </p>
  ),

  // ── Lists ─────────────────────────────────────────────────────────────────
  ul: ({ children }) => (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem 0' }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 1.25rem 0', counterReset: 'doc-counter' }}>
      {children}
    </ol>
  ),
  li: ({ children }) => {
    return (
      <li style={{
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
        fontSize: '0.9375rem',
        lineHeight: '1.8',
        color: 'var(--doc-text, #374151)',
        marginBottom: '0.5rem',
        counterIncrement: 'doc-counter',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        <span style={{
          flexShrink: 0,
          marginTop: '0.45rem',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: '#8b5cf6',
          display: 'inline-block',
        }} />
        <span style={{ flex: 1 }}>{children}</span>
      </li>
    );
  },

  // ── HR separator ──────────────────────────────────────────────────────────
  hr: () => (
    <div style={{ margin: '3rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{ flex: 1, height: '1px', backgroundColor: '#f1f5f9' }} />
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#c4b5fd' }} />
      <div style={{ flex: 1, height: '1px', backgroundColor: '#f1f5f9' }} />
    </div>
  ),

  // ── Blockquote ────────────────────────────────────────────────────────────
  blockquote: ({ children }) => (
    <div style={{
      margin: '1.5rem 0',
      padding: '1rem 1.25rem',
      borderLeft: '4px solid #8b5cf6',
      borderRadius: '0 0.75rem 0.75rem 0',
      backgroundColor: '#faf5ff',
    }}>
      <div style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: '0.9rem',
        lineHeight: '1.7',
        color: '#6d28d9',
        fontStyle: 'normal',
      }}>
        {children}
      </div>
    </div>
  ),

  // ── Code blocks & inline code ──────────────────────────────────────────────
  pre: ({ children }) => (
    <div style={{
      margin: '1.5rem 0',
      borderRadius: '0.75rem',
      overflow: 'hidden',
      border: '1px solid #334155',
    }}>
      <pre style={{
        margin: 0,
        padding: '1.25rem 1.5rem',
        backgroundColor: '#0f172a',
        overflowX: 'auto',
        fontFamily: "'Fira Code', 'JetBrains Mono', 'Courier New', monospace",
        fontSize: '0.8125rem',
        lineHeight: '1.8',
        color: '#94a3b8',
        whiteSpace: 'pre',
      }}>
        {children}
      </pre>
    </div>
  ),
  code: ({ children, className }) => {
    // Code inside a fenced block will pass through the `pre` override above.
    // Here we only style inline code (no className = likely inline).
    if (className) {
      return <code className={className} style={{ fontFamily: "'Fira Code', monospace", fontSize: '0.8125rem', color: '#94a3b8' }}>{children}</code>;
    }
    return (
      <code style={{
        fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
        fontSize: '0.8125rem',
        fontWeight: 500,
        padding: '0.15rem 0.45rem',
        borderRadius: '0.3rem',
        backgroundColor: '#faf5ff',
        color: '#7c3aed',
        border: '1px solid #ede9fe',
      }}>
        {children}
      </code>
    );
  },

  // ── Strong / Em ───────────────────────────────────────────────────────────
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: 'inherit' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ fontStyle: 'italic', color: '#6b7280' }}>{children}</em>
  ),

  // ── Links ─────────────────────────────────────────────────────────────────
  a: ({ children, href }) => (
    <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
      style={{ color: '#7c3aed', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
      {children}
    </a>
  ),

  // ── Tables ────────────────────────────────────────────────────────────────
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '1.5rem 0', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: '0.875rem',
      }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ backgroundColor: '#f8fafc' }}>{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fafafa')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th style={{
      textAlign: 'left',
      padding: '0.75rem 1.25rem',
      fontSize: '0.75rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: '#64748b',
      borderBottom: '2px solid #e2e8f0',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{
      padding: '0.75rem 1.25rem',
      color: '#374151',
      verticalAlign: 'top',
      lineHeight: '1.6',
    }}>
      {children}
    </td>
  ),
};

/* ─── Dark-mode overrides via a wrapper class ────────────────────────────── */
const docBodyStyle = `
  .doc-body { color: #374151; }
  .dark .doc-body { color: #cbd5e1; }
  .dark .doc-body h2 { color: #f8fafc; border-color: #312e81 !important; }
  .dark .doc-body h3 { color: #a78bfa !important; }
  .dark .doc-body p, .dark .doc-body li, .dark .doc-body td { color: #cbd5e1; }
  .dark .doc-body blockquote { background: rgba(109,40,217,0.12) !important; }
  .dark .doc-body code:not(pre code) { background: rgba(109,40,217,0.25) !important; color: #c4b5fd !important; border-color: rgba(109,40,217,0.3) !important; }
  .dark .doc-body table { border-color: #334155 !important; }
  .dark .doc-body thead { background: #1e293b !important; }
  .dark .doc-body th { color: #94a3b8 !important; border-color: #334155 !important; }
  .dark .doc-body td { color: #cbd5e1 !important; }
  .dark .doc-body tr { border-color: #1e293b !important; }
  .dark .doc-body hr > div { background: #1e293b !important; }
  .dark .doc-body hr > div:nth-child(2) { background: #6d28d9 !important; }
`;

/* ─── Sidebar ─────────────────────────────────────────────────────────────── */
const Sidebar: React.FC<{ activeId: string; onNavigate: (id: string) => void }> = ({ activeId, onNavigate }) => (
  <div style={{ padding: '1.25rem 0.625rem' }}>
    <p style={{
      padding: '0 0.75rem',
      paddingBottom: '0.75rem',
      fontSize: '0.625rem',
      fontWeight: 800,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: '#94a3b8',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      Contents
    </p>
    {sections.map((s) => {
      const active = activeId === s.id;
      return (
        <button
          key={s.id}
          onClick={() => onNavigate(s.id)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.75rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '0.8125rem',
            fontWeight: active ? 600 : 400,
            color: active ? '#7c3aed' : '#64748b',
            backgroundColor: active ? '#faf5ff' : 'transparent',
            transition: 'all 0.12s',
            marginBottom: '0.125rem',
          }}
          onMouseEnter={e => {
            if (!active) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8fafc';
              (e.currentTarget as HTMLButtonElement).style.color = '#1e293b';
            }
          }}
          onMouseLeave={e => {
            if (!active) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
            }
          }}
        >
          <span style={{
            fontSize: '0.625rem',
            fontFamily: "'Fira Code', monospace",
            fontWeight: 700,
            color: active ? '#a78bfa' : '#cbd5e1',
            flexShrink: 0,
            width: '1.5rem',
          }}>
            {s.n}
          </span>
          <span style={{ flex: 1, lineHeight: 1.35 }}>{s.label}</span>
          {active && <ChevronRight size={12} style={{ color: '#a78bfa', flexShrink: 0 }} />}
        </button>
      );
    })}
  </div>
);

/* ─── Main Component ─────────────────────────────────────────────────────── */
const Documentation: React.FC = () => {
  const { hash } = useLocation();
  const [activeId, setActiveId] = useState('1-what-is-billreve');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - HEADER_H - 20;
    window.scrollTo({ top, behavior: 'smooth' });
    setActiveId(id);
  };

  const handleNavigate = (id: string) => {
    scrollToSection(id);
    setMobileNavOpen(false);
  };

  useEffect(() => {
    if (hash) setTimeout(() => scrollToSection(hash.replace('#', '')), 200);
  }, [hash]);

  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          const top = visible.reduce((a, b) => a.boundingClientRect.top <= b.boundingClientRect.top ? a : b);
          setActiveId(top.target.id);
        }
      },
      { rootMargin: '-12% 0px -62% 0px' }
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

      {/* Inject dark mode CSS overrides */}
      <style>{docBodyStyle}</style>

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm" style={{ height: `${HEADER_H}px` }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <BookOpen size={15} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>BillReve</span>
                <ChevronRight size={11} />
                <span className="text-slate-700 dark:text-slate-200 font-semibold">Documentation</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex px-2 py-0.5 text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full tracking-wide">
              v1.4.1
            </span>
            <button onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
              <Menu size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Nav ────────────────────────────────────────────────────── */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute top-0 left-0 bottom-0 w-72 bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div style={{ height: `${HEADER_H}px` }} className="px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white text-sm">Contents</span>
              <button onClick={() => setMobileNavOpen(false)}><X size={18} className="text-slate-500" /></button>
            </div>
            <Sidebar activeId={activeId} onNavigate={handleNavigate} />
          </div>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">

          {/* Sidebar — no internal scroll, full list always visible */}
          <aside className="hidden lg:block w-56 xl:w-60 flex-shrink-0">
            <div
              className="sticky rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              style={{ top: `${HEADER_H + 16}px` }}
            >
              <Sidebar activeId={activeId} onNavigate={handleNavigate} />
            </div>
          </aside>

          {/* Content Card */}
          <main className="flex-1 min-w-0">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">

              {/* Hero */}
              <div style={{
                padding: '2.5rem 3rem',
                background: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 50%, #f8fafc 100%)',
                borderBottom: '1px solid #f1f5f9',
              }}
                className="dark:bg-gradient-to-br dark:from-purple-950/30 dark:via-slate-900 dark:to-slate-900 dark:border-slate-800"
              >
                <p style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#8b5cf6',
                  marginBottom: '0.75rem',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                  BillReve Documentation
                </p>
                <h1 style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
                  fontWeight: 700,
                  lineHeight: 1.25,
                  marginBottom: '0.875rem',
                  letterSpacing: '-0.02em',
                }}
                  className="text-slate-900 dark:text-white"
                >
                  Complete User &amp; Developer Guide
                </h1>
                <p style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: '0.9375rem',
                  lineHeight: '1.7',
                  color: '#64748b',
                  maxWidth: '540px',
                  marginBottom: '1.5rem',
                }}>
                  Everything you need to understand, set up, and get the most out of BillReve — from your first invoice to advanced AI workflows and Pro features.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {[
                    { label: 'Invoices', id: '4-invoices' },
                    { label: 'Quotes', id: '5-quotes' },
                    { label: 'Revenue AI', id: '10-revenue-ai-revenuechat' },
                    { label: 'Offline Sync', id: '16-offline-mode--sync' },
                    { label: 'Pro Plan', id: '15-pro-subscription' },
                  ].map(tag => (
                    <button key={tag.id} onClick={() => handleNavigate(tag.id)} style={{
                      padding: '0.3rem 0.875rem',
                      borderRadius: '9999px',
                      border: '1px solid #e2e8f0',
                      background: 'white',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      color: '#475569',
                      cursor: 'pointer',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#a78bfa';
                        (e.currentTarget as HTMLButtonElement).style.color = '#7c3aed';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
                        (e.currentTarget as HTMLButtonElement).style.color = '#475569';
                      }}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Markdown */}
              <div className="doc-body" style={{ padding: '0.5rem 3rem 3rem' }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSlug]}
                  components={mdComponents}
                >
                  {billreveDocMarkdown}
                </ReactMarkdown>
              </div>

              {/* Footer */}
              <div style={{ padding: '1.25rem 3rem', borderTop: '1px solid #f1f5f9' }}
                className="bg-slate-50 dark:bg-slate-900/50 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.8125rem', color: '#94a3b8' }}>
                  BillReve Documentation · v1.4.1 · September 2026
                </p>
                <a href="https://billreve.app/support" target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
                    backgroundColor: '#7c3aed', color: 'white',
                    fontSize: '0.875rem', fontWeight: 600,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    textDecoration: 'none', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#6d28d9')}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#7c3aed')}
                >
                  Get Support <ChevronRight size={14} />
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
