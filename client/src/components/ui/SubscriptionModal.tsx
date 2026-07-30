import React, { useEffect } from 'react';
import { X, CheckCircle2, Sparkles, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpgrade = () => {
    onClose();
    navigate('/upgrade');
  };

  const proFeatures = [
    'AI Document Drafting',
    'Advanced CSV & Excel Exports',
    'Custom Brand Colors & Logos on PDFs',
    'Unlimited Clients & Invoices',
    'Automated Email Reminders',
    'Priority Support'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header / Banner */}
        <div className="relative bg-gradient-to-br from-purple-600 to-purple-800 dark:from-purple-700 dark:to-purple-900 p-8 sm:p-10 text-center">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          
          <div className="mx-auto w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 ring-4 ring-white/10">
            <Crown className="text-white drop-shadow-md" size={32} />
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight drop-shadow-sm">
            Upgrade to BillReve Pro
          </h2>
          <p className="text-purple-100 text-lg sm:text-xl max-w-lg mx-auto leading-relaxed">
            Unlock advanced tools to automate your invoicing and scale your business effortlessly.
          </p>
        </div>

        {/* Content */}
        <div className="p-8 sm:p-10 flex flex-col items-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 mb-10 w-full">
            {proFeatures.map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="text-purple-500 flex-shrink-0" size={20} />
                <span className="text-slate-700 dark:text-slate-300 font-medium">{feature}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mx-auto">
            <div className="text-center sm:text-left flex-1">
              <div className="flex items-baseline justify-center sm:justify-start gap-1">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white">₦5,000</span>
                <span className="text-slate-500 dark:text-slate-400 font-medium">/mo</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Billed annually or ₦6k/mo</p>
            </div>
            
            <button 
              onClick={handleUpgrade}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white border-0 shadow-md rounded-xl font-bold text-lg shadow-lg shadow-purple-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              <Sparkles size={20} />
              Upgrade Now
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;
