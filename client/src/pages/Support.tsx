import React from 'react';
import { Card } from '../components/ui';
import { Logo } from '../components/ui/Logo';
import { Mail, Copy, AtSign } from 'lucide-react';
import toast from 'react-hot-toast';

const Support: React.FC = () => {
  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">About & Support</h1>
        <p className="text-slate-500 dark:text-slate-400">Need help? We're here for you.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer bg-purple-50/50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400 rounded-full flex items-center justify-center mb-4">
            <Mail size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Email Support</h3>
          <p className="text-slate-500 text-sm mb-4">
            Get in touch with our support team. We usually respond within 24 hours.
          </p>
          <button 
            onClick={() => {
              navigator.clipboard.writeText('support@billreve.com');
              toast.success('Email address copied to clipboard');
            }}
            className="text-purple-600 dark:text-purple-400 font-semibold text-sm flex items-center gap-1 hover:underline"
          >
            support@billreve.com <Copy size={14} />
          </button>
        </Card>

        <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer bg-pink-50/50 dark:bg-pink-900/10 border-pink-100 dark:border-pink-900/30">
          <div className="w-12 h-12 bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400 rounded-full flex items-center justify-center mb-4">
            <AtSign size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Social Support</h3>
          <p className="text-slate-500 text-sm mb-4">
            Reach out to us via direct message on Instagram for quick assistance.
          </p>
          <a 
            href="https://instagram.com/billreve.app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-pink-600 dark:text-pink-400 font-semibold text-sm flex items-center gap-1 hover:underline"
          >
            @billreve.app
          </a>
        </Card>
      </div>

      <Card className="p-6 text-center mt-8">
        <Logo size="lg" className="mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">BillReve</h2>
        <p className="text-slate-500 text-sm mb-4">Version {import.meta.env.VITE_APP_VERSION || '1.3.0'}</p>
        <p className="text-slate-400 text-xs">
          © {new Date().getFullYear()} BillReve Inc. All rights reserved.
        </p>
      </Card>
    </div>
  );
};

export default Support;
