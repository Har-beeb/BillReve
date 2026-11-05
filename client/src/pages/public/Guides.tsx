import React from 'react';
import { SEO } from '../../components/SEO';
import { ArrowRight, BookOpen, PenTool, LayoutTemplate } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

type GuideSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

type Guide = {
  slug: string;
  title: string;
  description: string;
  readTime: string;
  author: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  sections: GuideSection[];
};

const GUIDES = [
  {
    slug: 'professional-invoice',
    title: 'How to Write a Professional Invoice',
    description: 'Learn the essential elements every invoice needs to ensure you get paid on time, every time.',
    readTime: '6 min read',
    author: 'BillReve Team',
    icon: <PenTool className="text-purple-500" size={24} />,
    color: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
    sections: [
      {
        heading: 'An invoice is part of your client experience',
        paragraphs: [
          'A professional invoice does more than request payment. It confirms what was agreed, makes the next step obvious, and gives your client a reliable record for their own bookkeeping. Clear presentation signals that your business is organised before the payment is even made.',
          'The goal is not to make your invoice complicated. It is to make it complete, easy to scan, and specific enough that a client never has to ask what a charge means.'
        ]
      },
      {
        heading: 'The essential elements',
        bullets: [
          'Your business name, contact details, and logo so the invoice is immediately identifiable.',
          'A unique invoice number and issue date for simple tracking and follow-up.',
          'The client or organisation name, billing contact, and relevant address or tax details.',
          'A concise description of each service, with quantity, rate, subtotal, tax, discount, and total shown separately.',
          'Payment terms, accepted payment methods, currency, and the exact due date.',
          'A short note thanking the client or explaining the next step after payment.'
        ]
      },
      {
        heading: 'Write descriptions that remove doubt',
        paragraphs: [
          'Avoid vague lines such as “design work” or “consulting.” Describe the deliverable and the period it covers: “Homepage redesign and responsive mobile layouts - April project milestone.” A useful description protects the relationship because both sides can see what the amount relates to.',
          'For recurring work, keep the wording consistent from month to month. Consistency makes invoices faster to review and gives you a dependable paper trail.'
        ]
      },
      {
        heading: 'Set payment terms with confidence',
        paragraphs: [
          'Choose terms you can enforce consistently, such as payment due on receipt, within 7 days, or within 14 days. Put the due date in a prominent position rather than hiding it in a paragraph. If a deposit or milestone payment is required, state that before the work begins and repeat it on the invoice.',
          'When an invoice becomes overdue, follow up politely with the invoice number, amount due, original due date, and a payment link or bank detail. A clear process is more effective than an emotional reminder.'
        ]
      },
      {
        heading: 'A final quality check',
        bullets: [
          'The client name, email, invoice number, and currency are correct.',
          'The totals add up and taxes or discounts are labelled clearly.',
          'The due date matches the agreed terms.',
          'The payment instructions are complete and easy to find.',
          'The PDF or online view looks good on a phone as well as a desktop.'
        ]
      }
    ]
  },
  {
    slug: 'freelancer-taxes',
    title: 'The Freelancer\'s Guide to Taxes',
    description: 'A comprehensive overview of managing withholding taxes, VAT, and end-of-year reporting.',
    readTime: '8 min read',
    author: 'BillReve Team',
    icon: <BookOpen className="text-emerald-500" size={24} />,
    color: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    sections: [
      {
        heading: 'Make tax readiness part of your workflow',
        paragraphs: [
          'Tax season is easier when your records are already organised. As a freelancer, you are responsible for understanding what you earn, what you spend to deliver your work, and which taxes or filings may apply to your business. Good records turn a stressful scramble into a routine review.',
          'Start with one source of truth for invoices, expenses, payment status, and supporting documents. Keep business and personal transactions separate wherever possible, and reconcile your records regularly rather than waiting until year-end.'
        ]
      },
      {
        heading: 'Know the terms that appear in your work',
        bullets: [
          'Income tax generally relates to the profit or income of your business and is usually reported through the applicable tax authority.',
          'VAT is a consumption tax that may apply to eligible goods or services, depending on your registration status, threshold, and local rules.',
          'Withholding tax may be deducted by a client before payment. Keep the withholding certificate or other evidence so the deduction can be reconciled correctly.',
          'A tax identification number and compliant invoice details may be required when working with larger organisations or public-sector clients.'
        ]
      },
      {
        heading: 'Build a record-keeping habit',
        paragraphs: [
          'For every project, keep the quote, approval, invoice, proof of payment, receipts, and relevant contract together. Record the date, client, description, amount, currency, and status. If a client pays in instalments or deducts withholding tax, record the gross amount and the amount received separately.',
          'Review your records monthly. Look for unpaid invoices, missing receipts, unusual expenses, and income that has not yet been allocated to a project. This small habit helps you price future work more accurately and spot cash-flow problems early.'
        ]
      },
      {
        heading: 'Plan for tax before the deadline',
        bullets: [
          'Keep a separate reserve for expected tax instead of treating every payment as spendable income.',
          'Use your actual records to estimate obligations; do not rely on memory or bank statements alone.',
          'Confirm filing dates, rates, thresholds, and allowable expenses with your local tax authority or a qualified adviser.',
          'Ask for professional help when your business crosses borders, hires staff, registers for VAT, or operates through a company.'
        ]
      },
      {
        heading: 'Important note',
        paragraphs: [
          'Tax rules vary by country, state, business structure, industry, and turnover, and they can change. This guide is for general record-keeping and planning only; it is not tax, legal, or accounting advice. Confirm your obligations with the relevant authority or a qualified professional.'
        ]
      }
    ]
  },
  {
    slug: 'project-quotes',
    title: 'Structuring Project Quotes',
    description: 'Stop underpricing. Discover how to structure your quotes to communicate value and win better clients.',
    readTime: '7 min read',
    author: 'BillReve Team',
    icon: <LayoutTemplate className="text-amber-500" size={24} />,
    color: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
    sections: [
      {
        heading: 'A strong quote creates alignment',
        paragraphs: [
          'A quote is not just a price on a page. It is the first shared version of the project plan. It helps a client understand what they are buying, what success looks like, and what decisions are needed before work can begin.',
          'The strongest quotes make value visible without making promises you cannot control. They are specific about scope, flexible about options, and clear about the commercial terms.'
        ]
      },
      {
        heading: 'Start with the client outcome',
        paragraphs: [
          'Open with a short summary of the client objective. Then connect your deliverables to that objective. “Three social media graphics” is a task; “three campaign-ready graphics for the product launch” explains the purpose and creates a stronger basis for the price.',
          'Use plain language. Your client should be able to explain what they approved without translating industry jargon.'
        ]
      },
      {
        heading: 'Separate scope into clear deliverables',
        bullets: [
          'List each major deliverable and what is included in it.',
          'State the number of concepts, pages, revisions, meetings, or hours where those limits matter.',
          'Name what the client must provide, such as copy, images, access, or approvals.',
          'Add a short “not included” section for likely points of confusion.',
          'Show milestones or phases when the project will be delivered in stages.'
        ]
      },
      {
        heading: 'Price for the work, not only the hours',
        paragraphs: [
          'Hourly pricing can be useful internally, but a client-facing quote should help the client understand the value and outcome. Consider a fixed project fee for a well-defined scope, or present a clear range when discovery is still required. Include a deposit or milestone schedule so your cash flow does not depend on completing every part of a long project before receiving payment.',
          'If there are meaningful differences in speed, access, or support, offer two or three packages. Keep the comparison simple and make your recommended option easy to identify.'
        ]
      },
      {
        heading: 'Protect the agreement',
        bullets: [
          'Include the quote validity period and the date work can begin.',
          'Define the payment schedule and what happens when an approval or payment is late.',
          'State how additional work or scope changes will be priced and approved.',
          'Include ownership, usage rights, cancellation, and handover terms where relevant.',
          'Ask the client to approve the exact quote before starting work.'
        ]
      },
      {
        heading: 'The professional close',
        paragraphs: [
          'End with a direct next step: approve the quote, pay the deposit, or book a discovery call. A confident close reduces back-and-forth and gives a good-fit client a simple path forward. Once approved, convert the agreed scope into milestones and use it as the reference point for your invoices.'
        ]
      }
    ]
  }
] satisfies Guide[];

const GuideArticle: React.FC<{ guide: Guide }> = ({ guide }) => (
  <article className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-12">
    <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 pb-8 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
          BillReve guide
        </p>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white font-['Outfit']">
          {guide.title}
        </h1>
        <p className="mt-4 text-slate-600 dark:text-slate-400">{guide.description}</p>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          By <span className="font-semibold">{guide.author}</span> · {guide.readTime}
        </p>
      </div>
    </div>

    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="space-y-8">
        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">{section.heading}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mb-3 leading-8 text-slate-600 dark:text-slate-400">{paragraph}</p>
            ))}
            {section.bullets && (
              <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                {section.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 leading-7">
                    <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-purple-500" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <aside className="h-fit rounded-2xl bg-slate-50 p-6 dark:bg-slate-800/60">
        <p className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Keep it simple</p>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          Clear records, clear terms, and clear next steps help independent businesses work with confidence.
        </p>
      </aside>
    </div>
  </article>
);

const CollaborationCard: React.FC = () => (
  <div className="mt-16 rounded-3xl border border-purple-200 bg-purple-50 p-8 text-center dark:border-purple-900 dark:bg-purple-900/20 sm:p-10">
    <h2 className="text-2xl font-black text-slate-900 dark:text-white font-['Outfit']">Have an idea worth sharing?</h2>
    <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600 dark:text-slate-300">
      We welcome practical, experience-led writing from freelancers, founders, accountants, and small-business operators.
      Send us your topic or draft and the BillReve team will review it for a future guide.
    </p>
    <a href="mailto:hello@billreve.app?subject=BillReve%20guide%20contribution" className="mt-6 inline-flex items-center gap-2 rounded-full bg-purple-600 px-6 py-3 font-bold text-white transition-colors hover:bg-purple-700">
      Pitch a guide <ArrowRight size={16} />
    </a>
  </div>
);

const Guides: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const selectedGuide = GUIDES.find((guide) => guide.slug === slug);

  if (slug && selectedGuide) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <SEO title={`${selectedGuide.title} | BillReve Guides`} description={selectedGuide.description} />
        <Link to="/guides" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400">
          ← All guides
        </Link>
        <GuideArticle guide={selectedGuide} />
        <div className="mt-12 rounded-3xl bg-slate-900 p-8 text-center dark:bg-slate-800 sm:p-10">
          <h2 className="text-2xl font-black text-white font-['Outfit']">Put this into practice with BillReve</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">Create polished invoices, quotes, and client records in one focused workspace.</p>
          <Link to="/register" className="mt-6 inline-flex rounded-full bg-purple-600 px-7 py-3 font-bold text-white hover:bg-purple-700">Get started for free</Link>
        </div>
        <CollaborationCard />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <SEO title="Guides" />
      <div className="text-center mb-16 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-['Outfit'] font-black text-slate-900 dark:text-white mb-6">
          Invoicing Guides
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Master the art of freelance billing, client management, and financial organization with our curated guides and best practices.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {GUIDES.map((guide) => (
          <Link to={`/guides/${guide.slug}`} key={guide.slug} className={`rounded-3xl border ${guide.borderColor} bg-white dark:bg-slate-900 overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col`}>
            <div className={`h-32 ${guide.color} flex items-center justify-center`}>
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                {guide.icon}
              </div>
            </div>
            <div className="p-8 flex-1 flex flex-col">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{guide.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4 flex-1 leading-relaxed">
                {guide.description}
              </p>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">By {guide.author} · {guide.readTime}</p>
              <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Read Guide <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <CollaborationCard />

      <div className="mt-24 bg-slate-900 dark:bg-slate-800 rounded-3xl p-12 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />
        <h2 className="text-3xl font-black text-white mb-6 font-['Outfit']">Put this knowledge into practice</h2>
        <p className="text-slate-300 mb-8 max-w-xl mx-auto">
          Start generating professional invoices in seconds using our offline-first platform and Revenue AI.
        </p>
        <Link to="/register" className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-lg hover:shadow-purple-500/25">
          Get Started for Free
        </Link>
      </div>
    </div>
  );
};

export default Guides;
