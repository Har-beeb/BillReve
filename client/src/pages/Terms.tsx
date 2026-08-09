import React from 'react';
import { FileText } from 'lucide-react';

const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            <FileText className="text-purple-600 dark:text-purple-400" size={20} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Terms of Service</h1>
        </div>
        <p className="text-sm text-slate-400 mb-10">Last updated: August 4, 2026</p>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-8 space-y-8 text-slate-700 dark:text-slate-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using BillReve ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service. BillReve reserves the right to update these Terms at any time, and your continued use constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">2. Description of Service</h2>
            <p>
              BillReve is an online invoicing and business management platform for freelancers and small businesses. It allows users to create invoices, quotes, manage clients, and receive payments. The Service includes both a free tier and a paid Pro subscription.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">3. User Accounts</h2>
            <p className="mb-3">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
              <li>Provide accurate and complete registration information.</li>
              <li>Immediately notify us of any unauthorized use of your account.</li>
              <li>Not share your account credentials with any third party.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">4. Subscriptions and Payments</h2>
            <p>
              BillReve Pro is a monthly subscription. Payments are processed via Paystack or Flutterwave. Subscriptions automatically renew unless cancelled before the next billing cycle. All fees are non-refundable except as required by law. We reserve the right to change pricing with 30 days' notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">5. Acceptable Use</h2>
            <p className="mb-3">You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
              <li>Violate any applicable laws or regulations.</li>
              <li>Create fraudulent invoices or misrepresent your business.</li>
              <li>Attempt to gain unauthorized access to any part of the Service.</li>
              <li>Transmit any harmful, offensive, or infringing content.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">6. Intellectual Property</h2>
            <p>
              The Service, including its design, features, and content (excluding user-generated content), is owned by BillReve and protected by intellectual property laws. You retain ownership of the data and content you create using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, BillReve shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits or data, arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">8. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at our sole discretion for violations of these Terms. You may terminate your account at any time by contacting <a href="mailto:support@billreve.app" className="text-purple-600 dark:text-purple-400 hover:underline">support@billreve.app</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">9. Contact</h2>
            <p>
              For questions regarding these Terms, please contact us at <a href="mailto:support@billreve.app" className="text-purple-600 dark:text-purple-400 hover:underline">support@billreve.app</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
