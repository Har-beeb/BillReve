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

/**
 * Start of the current calendar month in UTC.
 *
 * Must match the server, which uses `date_trunc('month', now())` in
 * `check_user_quota()` and `Date.UTC(...)` in the `ai` edge function. Using
 * local time here would disagree with the server for a few hours either side
 * of a month boundary.
 */
const monthStartUtc = (): string => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
};

export const useQuota = () => {
  const { isProUser } = useAppStore();
  const navigate = useNavigate();

  // Invoices and quotes are a MONTHLY flow; clients are a standing total.
  // Both must exclude soft-deleted rows, because the server-side
  // check_user_quota() trigger filters on `deleted_at IS NULL`. Counting
  // lifetime rows here meant a free user was blocked in the UI forever after
  // 10 invoices, even though the server would have allowed 10 more next month.
  const invoiceCount = useLiveQuery(() => {
    const since = monthStartUtc();
    return db.invoices
      .filter(i => !i.deletedAt && (i.createdAt ?? '') >= since)
      .count();
  }) || 0;

  const quoteCount = useLiveQuery(() => {
    const since = monthStartUtc();
    return db.quotes
      .filter(q => !q.deletedAt && (q.createdAt ?? '') >= since)
      .count();
  }) || 0;

  const clientCount = useLiveQuery(
    () => db.clients.filter(c => !c.deletedAt).count()
  ) || 0;

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

    const displayNames = {
      invoice: 'invoices this month',
      quote: 'quotes this month',
      client: 'clients',
      ai_prompt: 'AI assistant requests this month'
    };

    if (current >= limit) {
      toast((t) => (
        <div className="flex flex-col gap-2">
          <span className="font-semibold text-slate-900 dark:text-white">Limit Reached</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            You've reached the free limit of {limit} {displayNames[type]}.
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
