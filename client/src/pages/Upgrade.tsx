import React, { useState } from 'react';
import { PaystackButton } from 'react-paystack';
import { CheckCircle2, Star, Check, Zap, Palette, FileSpreadsheet, Bot, Send } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const Upgrade: React.FC = () => {
  const { user, isProUser } = useAppStore();
  const [isSuccess, setIsSuccess] = useState(false);

  // The SaaS Master Key (Read from environment variables)
  const SAAS_PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_YOUR_SAAS_MASTER_KEY';
  
  const PRO_PRICE = 3500;
  const ORIGINAL_PRICE = 5000;

  const componentProps = {
    email: user?.email || 'user@example.com',
    amount: PRO_PRICE * 100, // Amount in kobo
    metadata: {
      custom_fields: [
         { display_name: "User ID", variable_name: "userId", value: user?.id || '' },
         { display_name: "Payment Type", variable_name: "type", value: "saas_subscription" }
      ]
    },
    // 'account' = merchant bears the fee, user pays exactly ₦3,500
    bearer: 'account' as 'account' | 'subaccount',
    publicKey: SAAS_PAYSTACK_PUBLIC_KEY,
    text: "Upgrade to Pro Now",
    onSuccess: (reference: any) => {
      console.log('Subscription Payment Success:', reference);
      setIsSuccess(true);
    },
    onClose: () => {
      console.log('Payment closed');
    },
  };

  const features = [
    { icon: <Bot className="text-purple-400 w-6 h-6" />, title: "AI Document Drafting", desc: "Generate professional quotes and invoices instantly with AI." },
    { icon: <FileSpreadsheet className="text-emerald-400 w-6 h-6" />, title: "Advanced CSV & Excel Exports", desc: "Export your financial data cleanly for accounting and migrations." },
    { icon: <Palette className="text-pink-400 w-6 h-6" />, title: "Custom Brand Colors & Logos", desc: "Remove BillReve branding and fully customize your documents." },
    { icon: <Zap className="text-amber-400 w-6 h-6" />, title: "Unlimited Clients & Invoices", desc: "No caps. Grow your business without restrictions." },
    { icon: <Send className="text-blue-400 w-6 h-6" />, title: "Automated Email Reminders", desc: "Never chase payments manually again. We handle it." },
    { icon: <Star className="text-yellow-400 w-6 h-6" />, title: "Email Campaigns", desc: "Send targeted promotional campaigns to your clients." }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex items-center justify-center">
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 dark:bg-purple-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 dark:bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl w-full z-10 animate-fade-in-up">
        {isSuccess ? (
          <div className="max-w-lg mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-12 text-center animate-scale-in">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-3">Welcome to Pro!</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
              Your subscription is active. Please log out and back in to sync your new premium capabilities.
            </p>
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white font-bold rounded-xl transition-all shadow-lg"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            
            {/* Left Side: Value Prop & Features */}
            <div className="flex flex-col justify-center p-8 lg:p-12">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold text-sm mb-6 w-max border border-purple-200 dark:border-purple-800/50">
                <Star size={16} className="fill-purple-700 dark:fill-purple-300" /> BillReve Pro
              </div>
              <h1 className="text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
                Unlock the full power of <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400">BillReve</span>
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-10 leading-relaxed">
                Step up to professional grade. Automate your workflow, customize your branding, and harness AI to grow your business faster.
              </p>

              <div className="space-y-6">
                {features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                      {feat.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{feat.title}</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side: Pricing Card */}
            <div className="relative flex items-center justify-center p-4 lg:p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-[2.5rem] transform rotate-3 scale-[0.98] opacity-70 blur-sm mix-blend-multiply dark:mix-blend-screen transition-transform hover:rotate-6 duration-500" />
              
              <div className="relative w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/50 dark:border-slate-700/50 p-10 flex flex-col items-center text-center transform transition-all hover:-translate-y-2 duration-500">
                
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 mt-4">Pro Subscription</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">Everything you need to scale.</p>
                
                <div className="mb-8 flex flex-col items-center justify-center gap-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg text-slate-400 dark:text-slate-500 line-through decoration-red-500/50 decoration-2 font-bold">
                      ₦{ORIGINAL_PRICE.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      30% Off
                    </span>
                  </div>
                  <div className="flex items-end justify-center gap-1">
                    <span className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                      ₦{PRO_PRICE.toLocaleString()}
                    </span>
                    <span className="text-lg text-slate-500 dark:text-slate-400 mb-2 font-medium">/mo</span>
                  </div>
                </div>

                <div className="w-full space-y-4 mb-10 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                      <Check className="text-green-600 dark:text-green-400" size={14} strokeWidth={3} />
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Cancel anytime</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                      <Check className="text-green-600 dark:text-green-400" size={14} strokeWidth={3} />
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">No hidden fees</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                      <Check className="text-green-600 dark:text-green-400" size={14} strokeWidth={3} />
                    </div>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Instant activation</span>
                  </div>
                </div>
                
                {isProUser ? (
                  <button 
                    disabled
                    className="w-full py-4 px-6 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold rounded-xl cursor-not-allowed border border-slate-200 dark:border-slate-700"
                  >
                    You are already Pro
                  </button>
                ) : (
                  <div className="w-full">
                    <PaystackButton 
                      {...componentProps} 
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-xl shadow-[0_8px_30px_rgb(147,51,234,0.3)] transition-all active:scale-[0.98] text-lg"
                    />
                  </div>
                )}
                
                <p className="text-xs text-slate-400 mt-6 font-medium">
                  Secure payment processing by Paystack
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Upgrade;
