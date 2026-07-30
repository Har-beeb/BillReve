import { useAppStore } from '../store/useAppStore';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';

const FREE_TIER_LIMITS = {
  invoices: 10,
  quotes: 10,
  clients: 5
};

export const useQuota = () => {
  const { isProUser } = useAppStore();
  const navigate = useNavigate();

  const invoiceCount = useLiveQuery(() => db.invoices.count()) || 0;
  const quoteCount = useLiveQuery(() => db.quotes.count()) || 0;
  const clientCount = useLiveQuery(() => db.clients.count()) || 0;

  const checkQuota = (type: 'invoice' | 'quote' | 'client'): boolean => {
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
    }

    if (current >= limit) {
      const confirmUpgrade = window.confirm(`You've reached the free limit of ${limit} ${type}s. Upgrade to Pro for unlimited access.`);
      if (confirmUpgrade) {
        navigate('/upgrade');
      }
      return false;
    }

    return true;
  };

  return { checkQuota };
};
