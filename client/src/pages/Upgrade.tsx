import React, { useState } from 'react';
import { PaystackButton } from 'react-paystack';
import { CheckCircle2, Zap, Shield, Globe, Star, Check } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const Upgrade: React.FC = () => {
  const { user, isProUser } = useAppStore();
  const [isSuccess, setIsSuccess] = useState(false);

  // The SaaS Master Key (Read from environment variables)
  const SAAS_PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_YOUR_SAAS_MASTER_KEY';
  
  const PRO_PRICE = 3000;

  const componentProps = {
    email: user?.email || 'user@example.com',
    amount: PRO_PRICE * 100, // Amount in kobo
    metadata: {
      custom_fields: [
         { display_name: "User ID", variable_name: "userId", value: user?.id || '' },
         { display_name: "Payment Type", variable_name: "type", value: "saas_subscription" }
      ]
    },
    publicKey: SAAS_PAYSTACK_PUBLIC_KEY,
    text: "Upgrade to Pro",
    onSuccess: (reference: any) => {
      console.log('Subscription Payment Success:', reference);
      setIsSuccess(true);
    },
    onClose: () => {
      console.log('Payment closed');
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 animate-fade-in-up">
      <div className="max-w-7xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">Simple, transparent pricing</h1>
        <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
          Unlock the full potential of your business with our professional suite. No hidden fees.
        </p>
      </div>

      {isSuccess ? (
        <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-12 text-center animate-scale-in">
          <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Welcome to Pro!</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Your subscription is active. Please log out and back in to see the changes.</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="text-purple-600 font-medium hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
          >
            Return to Dashboard
          </button>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Free Plan */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 flex flex-col">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Free</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 min-h-[40px]">Perfect for freelancers just starting out.</p>
            <div className="mb-6">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white">₦0</span>
              <span className="text-slate-500 dark:text-slate-400">/month</span>
            </div>
            <button 
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-xl transition-colors mb-8"
              onClick={() => window.location.href = '/'}
            >
              Current Plan
            </button>
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3"><Check className="text-green-500 shrink-0" size={18}/><span className="text-sm text-slate-700 dark:text-slate-300">Up to 5 Clients</span></div>
              <div className="flex items-center gap-3"><Check className="text-green-500 shrink-0" size={18}/><span className="text-sm text-slate-700 dark:text-slate-300">Up to 10 Invoices & Quotes</span></div>
              <div className="flex items-center gap-3"><Check className="text-green-500 shrink-0" size={18}/><span className="text-sm text-slate-700 dark:text-slate-300">Basic Templates</span></div>
              <div className="flex items-center gap-3"><Check className="text-green-500 shrink-0" size={18}/><span className="text-sm text-slate-700 dark:text-slate-300">BillReve Branding</span></div>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-b from-purple-900 to-indigo-900 rounded-3xl shadow-xl border border-purple-500 p-8 flex flex-col relative transform md:-translate-y-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold uppercase tracking-wider py-1.5 px-4 rounded-full">
              Most Popular
            </div>
            <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
              <Star className="text-purple-300" size={20} /> Pro
            </h3>
            <p className="text-sm text-purple-200 mb-6 min-h-[40px]">For growing businesses needing automation and AI.</p>
            <div className="mb-6 flex items-end gap-2">
              <span className="text-4xl font-extrabold text-white">₦{PRO_PRICE.toLocaleString()}</span>
              <span className="text-purple-200 pb-1">/month</span>
            </div>
            
            {isProUser ? (
              <button 
                disabled
                className="w-full py-3 px-4 bg-purple-500/50 text-white font-semibold rounded-xl mb-8 cursor-not-allowed"
              >
                Already Subscribed
              </button>
            ) : (
              <div className="mb-8 w-full">
                <PaystackButton 
                  {...componentProps} 
                  className="w-full bg-white hover:bg-slate-100 text-purple-900 font-bold py-3 px-4 rounded-xl shadow-lg transition-all active:scale-95 text-center block"
                />
              </div>
            )}

            <div className="space-y-4 flex-1">
              <div className="flex items-start gap-3"><Check className="text-purple-300 shrink-0 mt-0.5" size={18}/><span className="text-sm text-white">Unlimited Clients, Invoices, & Quotes</span></div>
              <div className="flex items-start gap-3"><Check className="text-purple-300 shrink-0 mt-0.5" size={18}/><span className="text-sm text-white">Online Payments (Paystack, Flutterwave)</span></div>
              <div className="flex items-start gap-3"><Check className="text-purple-300 shrink-0 mt-0.5" size={18}/><span className="text-sm text-white">AI Features (Generation, Chat, Reminders)</span></div>
              <div className="flex items-start gap-3"><Check className="text-purple-300 shrink-0 mt-0.5" size={18}/><span className="text-sm text-white">Remove BillReve Branding</span></div>
              <div className="flex items-start gap-3"><Check className="text-purple-300 shrink-0 mt-0.5" size={18}/><span className="text-sm text-white">Premium Themes & Typography</span></div>
            </div>
          </div>

          {/* Enterprise Plan */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 flex flex-col">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Enterprise</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 min-h-[40px]">Custom solutions for large organizations.</p>
            <div className="mb-6">
              <span className="text-4xl font-extrabold text-slate-900 dark:text-white">Custom</span>
            </div>
            <button 
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-xl transition-colors mb-8"
              onClick={() => alert("Please contact sales@billreve.com to discuss enterprise solutions.")}
            >
              Contact Sales
            </button>
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3"><Check className="text-green-500 shrink-0" size={18}/><span className="text-sm text-slate-700 dark:text-slate-300">Everything in Pro</span></div>
              <div className="flex items-center gap-3"><Check className="text-green-500 shrink-0" size={18}/><span className="text-sm text-slate-700 dark:text-slate-300">Custom Domain</span></div>
              <div className="flex items-center gap-3"><Check className="text-green-500 shrink-0" size={18}/><span className="text-sm text-slate-700 dark:text-slate-300">Dedicated Account Manager</span></div>
              <div className="flex items-center gap-3"><Check className="text-green-500 shrink-0" size={18}/><span className="text-sm text-slate-700 dark:text-slate-300">SLA & Priority Support</span></div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default Upgrade;
