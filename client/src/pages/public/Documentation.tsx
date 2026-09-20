import React from 'react';
import { SEO } from '../../components/SEO';
import ReactMarkdown from 'react-markdown';

export const billreveDocMarkdown = 
# BillReve — Complete User & Developer Documentation
*Version 1.4.1 | Updated: September 2026*

---

## Table of Contents

1. [What is BillReve?](#1-what-is-billreve)
2. [Getting Started](#2-getting-started)
3. [Dashboard](#3-dashboard)
4. [Invoices](#4-invoices)
5. [Quotes](#5-quotes)
6. [Clients](#6-clients)
7. [Payments & Bank Accounts](#7-payments--bank-accounts)
8. [Reports](#8-reports)
9. [Email Campaigns](#9-email-campaigns)
10. [Revenue AI (RevenueChat)](#10-revenue-ai-revenuechat)
11. [AI Document Drafting](#11-ai-document-drafting)
12. [Public Payment & Quote Links](#12-public-payment--quote-links)
13. [Settings](#13-settings)
14. [Theming & Personalization](#14-theming--personalization)
15. [Pro Subscription](#15-pro-subscription)
16. [Offline Mode & Sync](#16-offline-mode--sync)
17. [PWA — Installing BillReve](#17-pwa--installing-billreve)
18. [Trash & Recovery](#18-trash--recovery)
19. [Security & Privacy](#19-security--privacy)
20. [Frequently Asked Questions](#20-frequently-asked-questions)

---

## 1. What is BillReve?

BillReve is an **AI-powered invoicing and business management platform** built for freelancers, consultants, and small businesses. It combines the speed of a native app with the reliability of cloud sync — so you can work anywhere, even offline.

### What makes BillReve different?

- **Works offline** — Create and edit invoices, quotes, and client records with no internet connection. Everything syncs automatically when you're back online.
- **AI built in** — Draft professional invoices from a single sentence. Ask your AI assistant "Who owes me money?" and get an instant answer.
- **Client-facing payment links** — Share a payment link. Your client sees a professional invoice page and can pay directly or report a bank transfer.
- **Quote negotiation** — Allow clients to counter-offer on quotes directly from a link. No back-and-forth emails.
- **Automated reminders** — Set it and forget it. BillReve automatically emails your clients before and after due dates.

---

## 2. Getting Started

### Creating Your Account
1. Visit [billreve.app](https://billreve.app) and click **Get Started**
2. Sign up with your email or continue with Google
3. Verify your email address
4. You'll be guided through the **Getting Started Checklist** — a quick 5-step setup

### Getting Started Checklist
The checklist appears on your dashboard until all steps are complete:

| Step | What to do |
|---|---|
| 1. Business Profile | Add your company name, logo, address |
| 2. First Client | Add your first client to the directory |
| 3. First Invoice | Create and send your first invoice |
| 4. Payment Method | Add a bank account for receiving payments |
| 5. Explore AI | Try drafting a document with AI |

---

## 3. Dashboard

The Dashboard is your business control centre. It shows you everything at a glance:

### Greeting Header
Shows a personalised greeting based on your local time ("Good morning, Techieness!") with a live summary of your business today.

### Metric Cards (Swipeable on mobile)
| Card | What it shows |
|---|---|
| **Total Revenue** | Paid invoices this month + month-over-month growth % |
| **Outstanding Balance** | Total value of unpaid, sent invoices |
| **Overdue Amount** | Total value of invoices past their due date |
| **Accepted Quotes** | Total value of accepted quotes this period |

> Tap any card to jump directly to the filtered view in Invoices or Quotes.

### Revenue Chart
A bar chart of your monthly revenue. Switches to a pie chart automatically if no bar chart data is available. Toggle between bar and pie manually using the chart controls.

### Recent Activity
Shows your 5 most recently updated invoices and quotes. Click any row to open its preview panel.

### Action Buttons
- **New Quote** — Create a quote (manually or with AI)
- **New Invoice** — Create an invoice (manually or with AI)

---

## 4. Invoices

### Invoice Lifecycle

``````
DRAFT → SENT → PENDING → PAID
                       ↘ PARTIAL (partial payment recorded)
              → OVERDUE (past due date)
              → VOID
``````

| Status | Meaning |
|---|---|
| ``DRAFT`` | Created but not yet sent to client |
| ``SENT`` | Shared with client via link or email |
| ``PENDING`` | Client has reported a manual bank transfer (awaiting your confirmation) |
| ``PARTIAL`` | Some payment recorded, balance still owed |
| ``PAID`` | Fully paid — triggers notification |
| ``OVERDUE`` | Past due date and still unpaid |
| ``VOID`` | Cancelled/voided |

### Creating an Invoice
1. Click **New Invoice** on Dashboard or Invoices page
2. Select a client (or create one inline)
3. Add line items (description, quantity, unit price)
4. Apply taxes if applicable
5. Set due date, notes, and payment terms
6. Choose **Save Draft** or **Save & Send**

### Quick Actions (Preview Panel)
When you open an invoice's side panel, you'll see contextual buttons based on its status:

| Status | Quick Action |
|---|---|
| DRAFT | Edit Invoice |
| SENT | Copy Payment Link |
| PENDING | ✅ Confirm & Mark as Paid |
| PARTIAL / OVERDUE | Record Payment |
| OVERDUE | Send Reminder |
| Any | Download PDF / Receipt |

### Filtering & Search
- Filter by status: All, Draft, Sent, Pending, Partial, Paid, Overdue, Void
- Search by client name or invoice number
- Sort by date, amount, or status

### Marking as Paid
1. Open the invoice
2. Click **Mark as Paid** (full) or **Record Payment** (partial)
3. Enter the amount and payment method
4. The balance due updates automatically

---

## 5. Quotes

### Quote Lifecycle

``````
DRAFT → SENT → ACCEPTED → Convert to Invoice
                        ↘ DECLINED
             → COUNTERED → Admin: Accept Counter / Decline / Redraft
``````

### The Negotiation Loop
BillReve's counter-offer feature allows true negotiation:

1. You send a quote for $1,000
2. Client opens the quote link and clicks **Make a Counter Offer**
3. Client enters their counter ($800) and a message
4. You see a ``COUNTERED`` badge on your quote
5. You can:
   - **Accept Counter** — Automatically updates the quote total to $800
   - **Decline** — Marks quote as declined
   - **Redraft** — Creates a new DRAFT from the countered quote to continue negotiation

### Converting to Invoice
Once a quote is ``ACCEPTED``, click **Convert to Invoice**. All line items, taxes, and client details carry over automatically.

### Counter-Offer Settings
When creating a quote, you can configure:
- **Allow Counter Offers** — Toggle to enable/disable client counter-offers
- **Minimum Counter Amount** — The lowest counter you'll accept (clients can't go below this)

---

## 6. Clients

### Client Directory
Your client directory stores contact information for everyone you bill. All records sync across devices.

### Adding Clients
- **Manually:** Click **Add Client** and fill in the form
- **CSV Import:** Click the upload icon to import from a spreadsheet. The wizard maps your columns to BillReve fields.

### Client Fields
- Name (required)
- Email
- Phone
- Address

### Soft Delete
Deleting a client moves them to **Trash** — they are not permanently deleted. This preserves the historical record on all invoices and quotes associated with them.

---

## 7. Payments & Bank Accounts

### Bank Accounts (Free)
Store your bank transfer details so clients know exactly where to send money.

**To add a bank account:**
1. Go to **Settings → Payments**
2. Click **Add Bank Account**
3. Enter Bank Name, Account Name, Account Number
4. Set as Default if this is your primary account

You can add multiple accounts (e.g., personal and business). When creating an invoice, you select which account applies.

### Payment Gateways (Pro)
Pro subscribers can enable automated payment collection:

| Gateway | Regions |
|---|---|
| **Paystack** | Nigeria, Ghana, South Africa |
| **Flutterwave** | Africa-wide, global |
| **Stripe** | Global |

When a gateway is enabled, your public invoice page shows a **Pay Now** button. Clients pay directly — no manual verification needed. Your invoice is automatically marked as ``PAID`` via webhook.

---

## 8. Reports

### Financial Summary
The Reports page gives you a bird's eye view of your financial health:

- **Total Revenue** — all-time and by period
- **Outstanding** — unpaid invoice totals
- **Overdue** — breakdown of what's late
- **Invoice Count** — by status

### Charts & Visualisation
- Monthly revenue bar chart
- Pie chart breakdown (Revenue vs. Outstanding vs. Overdue)
- Period filters (This Month, Last 3 Months, This Year, All Time)

### AI CFO Report (Pro)
Click **Generate CFO Report** to get a comprehensive AI-written financial analysis of your business, including:
- Revenue trends
- Payment behaviour analysis
- Recommendations for improving cash flow
- Outstanding risk assessment

### Tax Export
Export a filtered list of paid invoices for your accountant or tax filings.

---

## 9. Email Campaigns

Send promotional or informational emails to your entire client directory in one go.

### Sending a Campaign
1. Go to **Campaigns**
2. Write your subject line and email body
3. Click **Send to All Clients**

### Campaign History
Each sent campaign is logged with:
- Subject
- Date sent
- Number of recipients

> **Note:** Campaigns are sent via BillReve's email infrastructure. Standard anti-spam rules apply.

---

## 10. Revenue AI (RevenueChat)

RevenueChat is your embedded AI business assistant. Access it via the chat bubble on the bottom-right of your dashboard.

### What can it do?

**Financial queries:**
- "How much did I earn this month?"
- "Who are my top 5 clients by revenue?"
- "Which invoices are overdue right now?"
- "What's my outstanding balance?"

**Action cards:**
- "Create an invoice for John Doe for 3 hours of consulting at $150/hr" → Opens a pre-filled invoice editor
- "Draft a quote for web design services — 20 hours at $80" → Opens a pre-filled quote editor

### Privacy
RevenueChat **never** sends sensitive data (client contact details, full bank account numbers) to the AI. Only aggregated, anonymised financial summaries are shared.

### Quotas
| Plan | Monthly AI Prompts |
|---|---|
| Free | 20 prompts/month |
| Pro | Unlimited |

---

## 11. AI Document Drafting

The **AI Draft Modal** lets you create invoices and quotes from natural language.

### How to use it
1. Click the dropdown arrow on **New Invoice** or **New Quote**
2. Select **Draft with AI**
3. Describe what you need in plain English:
   - *"Invoice for Ahmed for 5 hours of logo design at $60/hr, due in 14 days"*
   - *"Quote for Zara Clothing for full website redesign, $3,500 fixed price"*
4. Review the auto-filled editor and adjust if needed

### Input Modes
- **Text** — Type your description
- **Voice** — Speak your invoice (microphone required)
- **File Upload** — Upload an image or PDF; AI extracts the line items

---

## 12. Public Payment & Quote Links

### Payment Link (``/pay/:id``)
Every invoice has a unique public payment link. Share it with your client via email, WhatsApp, or any channel.

**What the client sees:**
- Your business logo and branding
- Invoice details (items, amounts, due date)
- Payment options (bank transfer details and/or payment gateway)

**Payment options:**
- **Bank Transfer:** Client sees your bank account details and can click "I've transferred the funds" to notify you
- **Pay Online (Pro):** Embedded Paystack / Flutterwave payment form

### Quote Link (``/quote/:id``)
Share a quote link to allow clients to review and respond.

**What the client can do:**
- **Accept** the quote
- **Decline** the quote
- **Make a Counter Offer** (if you enabled it)

You receive an instant notification for each client action.

### Security
Public links use Supabase's Row Level Security policies. Clients can only see their specific document — no other data is accessible via the link.

---

## 13. Settings

### Business Profile
- Business name, email, phone, address
- Logo upload
- Country and default currency
- Industry and business description

### Payments
- Bank account management
- Payment gateway configuration (Pro)

### Taxes
- Create reusable tax rules (e.g., "VAT 7.5%", "WHT 5%")
- Toggle tax as addition or deduction
- Apply to specific invoices and quotes

### Preferences
- **Theme** — Choose from 7 preset colour themes or set a custom hex colour
- **Dark Mode** — Toggle light/dark appearance
- **Font** — Choose your preferred typography
- **Font Size** — Compact, Normal, or Comfortable
- **Mobile Navigation** — Bottom bar vs. slide-out sidebar

### Account
- Update your name and email
- Change your password
- Delete your account

### Sync Status
- View last sync time
- Manually trigger a sync
- See any pending or failed sync items

---

## 14. Theming & Personalization

### Available Themes

| Theme | Character |
|---|---|
| **Default (Purple)** | Deep, premium purple — the BillReve signature look |
| **Ocean Blue** | Clean, professional blue |
| **Emerald** | Fresh, natural green |
| **Wine** | Bold, glossy wine red |
| **Sunset** | Warm, energetic orange |
| **Mustard** | Confident, warm yellow |
| **Cherry** | Sharp, assertive red |
| **Slate** | Neutral, minimal charcoal |

### Custom Color
Pick any hex color using the color picker. BillReve automatically generates a full 10-shade palette from your color and applies it across the entire app.

### Dark Mode
Toggle dark mode from Settings → Preferences or via the moon icon in the footer. Your preference is saved and persists across sessions and devices.

---

## 15. Pro Subscription

### Free Plan
| Feature | Limit |
|---|---|
| Invoices | 10/month |
| Quotes | 10/month |
| Clients | 10 |
| AI Prompts | 20/month |
| Trash retention | 7 days |
| Payment gateways | No |
| Automated reminders | No |

### Pro Plan
| Feature | Limit |
|---|---|
| Invoices | Unlimited |
| Quotes | Unlimited |
| Clients | Unlimited |
| AI Prompts | Unlimited |
| Trash retention | 30 days |
| Payment gateways | Paystack, Flutterwave, Stripe |
| Automated reminders | Yes |
| AI CFO Reports | Yes |
| Priority support | Yes |

### Upgrading
Go to **Settings → Upgrade** or click any **Pro** badge in the app. Payment is processed securely via Paystack.

### Billing
- Monthly or annual billing
- Cancel anytime — your account downgrades gracefully at the end of the billing period; no data is deleted

---

## 16. Offline Mode & Sync

### How it works
BillReve uses a local-first architecture powered by IndexedDB (via Dexie.js):

1. All your data is stored locally on your device
2. Every action (create invoice, edit client, etc.) writes to local storage first — instantly, without waiting for a server response
3. A background sync engine runs every 10 seconds, pushing your changes to the cloud
4. When you return to connectivity after being offline, all queued changes upload automatically

### Sync Status Indicator
The cloud icon in the top navigation shows your sync status:
- Cloud icon — Synced and connected
- Spinning — Sync in progress
- Error — One or more items failed to sync (will retry automatically)

### Conflict Resolution
If the same record is edited on two devices simultaneously, the **most recently edited version wins**. Additionally, confirmed statuses (like ``PAID`` or ``ACCEPTED``) always take priority and can never be overwritten by an older edit.

### Working Offline
- Create, edit, and delete invoices, quotes, and clients
- View all your existing data
- Generate PDFs
- Send emails — queued until online
- Process online payments — requires connectivity
- AI features — requires connectivity

---

## 17. PWA — Installing BillReve

BillReve is a Progressive Web App. You can install it on any device for a native app-like experience.

### On Mobile (Android / iOS)
1. Open [billreve.app](https://billreve.app) in your browser
2. On Android: Tap the browser menu → **Add to Home Screen**
3. On iOS (Safari): Tap the Share icon → **Add to Home Screen**

### On Desktop (Chrome / Edge)
1. Open [billreve.app](https://billreve.app)
2. Click the install icon in the address bar
3. Click **Install**

### After Installing
- BillReve runs as a standalone app with no browser chrome
- Works fully offline after first load
- Updates automatically when a new version is available (you'll see a prompt)

---

## 18. Trash & Recovery

### How Trash Works
When you delete an invoice, quote, or client, it moves to **Trash** rather than being permanently deleted.

### Recovering Items
1. Go to **Trash** (accessible from the main navigation)
2. Find the item you want to recover
3. Click **Restore** — it returns to its original state

### Automatic Purge
Items in Trash are automatically and permanently deleted after:
- **Free plan:** 7 days
- **Pro plan:** 30 days

Once purged, items **cannot be recovered**.

### Permanent Delete
You can permanently delete individual items from Trash before the auto-purge timer, or use **Empty Trash** to clear everything at once.

---

## 19. Security & Privacy

### Data Encryption
All data is encrypted in transit (HTTPS/TLS) and at rest in Supabase's managed PostgreSQL database.

### Row Level Security
Every database query is enforced with Supabase's Row Level Security (RLS) policies. This means:
- You can only ever access your own data
- No SQL query, even a direct API call, can retrieve another user's data
- Public invoice/quote links expose only the minimum required data (line items, total, status)

### Public Link Security
Public payment and quote links use a randomly generated document ID. The URL is not guessable. Only the specific document's data is accessible — no client directory, no business financials, no other invoices.

### Your Data
- BillReve does not sell your data to third parties
- AI prompts are processed by Google Gemini. Only anonymised, aggregated financial summaries are sent — never client names, contact details, or bank account numbers
- You can export or delete your data at any time from Settings → Account

---

## 20. Frequently Asked Questions

**Q: Can I use BillReve without internet?**
Yes. BillReve works fully offline. All your data is stored locally and synced to the cloud when you're back online.

**Q: How do I receive payment from a client?**
Share the payment link from any invoice. Clients can pay via your bank account details (all plans) or online payment gateway (Pro). You'll receive a notification when payment is made.

**Q: What happens when a client clicks "I've transferred the funds"?**
The invoice status changes to ``PENDING`` and you receive an in-app notification. You then verify the transfer in your bank and click **Confirm & Mark as Paid** to close the invoice.

**Q: Can multiple devices sync automatically?**
Yes. Log in on any device and your data will sync. Changes from one device appear on other devices within seconds.

**Q: What currencies are supported?**
BillReve supports any currency. Set your default currency in Business Profile, and you can override it per invoice.

**Q: How do automated email reminders work?**
For Pro subscribers, BillReve automatically emails your clients at -3 days (upcoming), due date, +3, +7, and +14 days (overdue). No action needed — it runs in the background.

**Q: How do I stop getting reminders for a paid invoice?**
Once an invoice is marked ``PAID``, the reminder engine automatically skips it. No manual action needed.

**Q: Is there a limit on how many clients I can have?**
Free plan: 10 clients. Pro plan: unlimited.

**Q: Can I customise invoice templates?**
Yes. Choose from 5 document themes (Standard, Professional, Modern, Classic, Monochrome) in the PDF settings. Your business logo and branding are applied automatically.

**Q: What happens if my Pro subscription expires?**
Your account gracefully downgrades to Free. All your existing data is preserved. You'll lose access to Pro-only features (gateways, unlimited records, etc.) but nothing is deleted.

**Q: How do I contact support?**
Use the Support page at [billreve.app/support](https://billreve.app/support) or email support from the Help Centre.

;

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
