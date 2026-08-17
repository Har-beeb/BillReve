import { useAppStore } from '../store/useAppStore';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const FREE_TIER_LIMITS = {
  invoices: 10,
  quotes: 10,
  clients: 5,
  ai_prompts: 10
};

export const useQuota = () => {
  const { isProUser } = useAppStore();
  const navigate = useNavigate();

  const invoiceCount = useLiveQuery(() => db.invoices.count()) || 0;
  const quoteCount = useLiveQuery(() => db.quotes.count()) || 0;
  const clientCount = useLiveQuery(() => db.clients.count()) || 0;
  const aiPromptsCount = useAppStore(state => state.aiPromptsUsed) || 0;

  const checkQuota = (type: 'invoice' | 'quote' | 'client' | 'ai_prompt'): boolean => {
    if (isProUser) return true;

    let limit = 0;
    let current = 0;

    switch (type) {
      case 'invoice':
        limit = FREE_TIER_LIMITS.invoices;
        current = invoiceCount;
        break;
      case 'quote':
        limit = FREE_TIER_LIMITS.quotes;
        current = quoteCount;
        break;
      case 'client':
        limit = FREE_TIER_LIMITS.clients;
        current = clientCount;
        break;
      case 'ai_prompt':
        limit = FREE_TIER_LIMITS.ai_prompts;
        current = aiPromptsCount;
        break;
    }

    if (current >= limit) {
      toast((t) => (
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-slate-900 dark:text-white">Limit Reached</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            You've reached the free limit of {limit} {type}s.
          </span>
          <button 
            onClick={() => {
              toast.dismiss(t.id);
              navigate('/upgrade');
            }} 
            className="mt-1 bg-purple-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-purple-700 transition-colors w-max"
          >
            Upgrade to Pro
          </button>
        </div>
      ), { duration: 5000, style: { minWidth: '300px', border: '1px solid #e2e8f0' } });
      return false;
    }

    return true;
  };

  return { checkQuota };
};
