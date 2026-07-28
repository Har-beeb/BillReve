import React, { useState } from 'react';
import { PaystackButton } from 'react-paystack';
import { CheckCircle2, Zap, Shield, Globe } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const Upgrade: React.FC = () => {
  const { user, businessProfile } = useAppStore();
  const [isSuccess, setIsSuccess] = useState(false);

  // The SaaS Master Key (Read from environment variables)
  const SAAS_PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_YOUR_SAAS_MASTER_KEY';

  const componentProps = {
    email: user?.email || 'user@example.com',
    amount: 5000 * 100, // 5,000 NGN or $5 equivalent in kobo
    metadata: {
      custom_fields: [
         { display_name: "User ID", variable_name: "userId", value: user?.id || '' },
         { display_name: "Payment Type", variable_name: "type", value: "saas_subscription" }
      ]
    },
    publicKey: SAAS_PAYSTACK_PUBLIC_KEY,
    text: "Upgrade Now",
    onSuccess: (reference: any) => {
      console.log('Subscription Payment Success:', reference);
      setIsSuccess(true);
    },
    onClose: () => {
      console.log('Payment closed');
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center animate-fade-in-up">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Left Side - Details */}
        <div className="p-8 md:p-12 bg-purple-900 text-white flex flex-col justify-center">
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Go Pro.</h1>
          <p className="text-purple-200 mb-8 text-lg">Unlock the full potential of your business with our professional suite.</p>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-800 flex items-center justify-center shrink-0">
                <Globe className="text-purple-300" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Accept International Payments</h3>
                <p className="text-purple-300 text-sm">Connect Flutterwave to receive USD, GBP, and EUR instantly.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-800 flex items-center justify-center shrink-0">
                <Zap className="text-purple-300" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Automated Email Reminders</h3>
                <p className="text-purple-300 text-sm">Let our system chase overdue invoices automatically.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-800 flex items-center justify-center shrink-0">
                <Shield className="text-purple-300" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Remove Branding</h3>
                <p className="text-purple-300 text-sm">Send professional invoices with only your business logo.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Checkout */}
        <div className="p-8 md:p-12 flex flex-col justify-center items-center text-center">
          {isSuccess ? (
            <div className="animate-scale-in">
              <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Pro!</h2>
              <p className="text-slate-500 mb-6">Your subscription is active. Please log out and back in to see the changes.</p>
              <button 
                onClick={() => window.location.href = '/'}
                className="text-purple-600 font-medium hover:text-purple-700"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Pro Plan</h2>
                <div className="flex items-end justify-center gap-1 mb-2">
                  <span className="text-4xl font-extrabold text-slate-900">₦5,000</span>
                  <span className="text-slate-500 font-medium pb-1">/month</span>
                </div>
                <p className="text-sm text-slate-500">Billed monthly. Cancel anytime.</p>
              </div>
              
              <div className="w-full space-y-4">
                <PaystackButton 
                  {...componentProps} 
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all active:scale-95"
                />
                <p className="text-xs text-slate-400">Payments securely processed by Paystack.</p>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default Upgrade;
