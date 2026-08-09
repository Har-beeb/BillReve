import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

const Privacy: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
            <Shield className="text-purple-600 dark:text-purple-400" size={20} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Privacy Policy</h1>
        </div>
        <p className="text-sm text-slate-400 mb-10">Last updated: August 4, 2026</p>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-8 space-y-8 text-slate-700 dark:text-slate-300 leading-relaxed">
          
          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">1. Introduction</h2>
            <p>
              BillReve ("we", "us", or "our") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our invoicing and business management platform at billreve.app ("Service").
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">2. Information We Collect</h2>
            <p className="mb-3">We may collect information about you in a variety of ways, including:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
              <li><strong className="text-slate-800 dark:text-slate-200">Account Data:</strong> Name, email address, business name, phone number, and address provided during registration.</li>
              <li><strong className="text-slate-800 dark:text-slate-200">Business Data:</strong> Client records, invoices, quotes, and financial documents you create within the Service.</li>
              <li><strong className="text-slate-800 dark:text-slate-200">Payment Data:</strong> We do not store your card details. Payment processing is handled by Paystack or Flutterwave, who are PCI-DSS compliant.</li>
              <li><strong className="text-slate-800 dark:text-slate-200">Usage Data:</strong> Log data, device information, and interactions with the Service for diagnostic purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
              <li>Create and manage your account.</li>
              <li>Provide and improve the Service.</li>
              <li>Process transactions and send you related information.</li>
              <li>Send administrative information, such as updates or security alerts.</li>
              <li>Respond to support requests and inquiries.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">4. Data Storage and Security</h2>
            <p>
              Your data is stored securely on Supabase infrastructure with Row Level Security (RLS) enforced at the database level, ensuring your business data is only accessible by you. We implement industry-standard security measures including encryption in transit (TLS) and at rest.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">5. Third-Party Services</h2>
            <p>
              We use the following third-party services: <strong>Supabase</strong> (database & authentication), <strong>Paystack</strong> and <strong>Flutterwave</strong> (payment processing), and <strong>Resend</strong> (email delivery). Each third party has its own privacy policy governing its use of your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">6. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to provide the Service. You may request deletion of your account and associated data at any time by contacting support@billreve.app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">7. Your Rights</h2>
            <p>
              Depending on your location, you may have rights to access, correct, or delete your personal data. Please contact us at <a href="mailto:support@billreve.app" className="text-purple-600 dark:text-purple-400 hover:underline">support@billreve.app</a> to exercise your rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">8. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@billreve.app" className="text-purple-600 dark:text-purple-400 hover:underline">support@billreve.app</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
