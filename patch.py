import os

path = 'client/src/components/RevenueChat.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

if 'import { supabase } from' not in content:
    content = content.replace("import { useAppStore } from '../store/useAppStore';", "import { useAppStore } from '../store/useAppStore';\nimport { supabase } from '../lib/supabase';")

strip_func = '''  const stripSensitiveData = (data: any[], type: 'invoice' | 'quote' | 'client') => {
    return data.map(item => {
      if (type === 'client') {
        return {
          id: item.localId,
          name: item.name
        };
      }
      return {
        id: item.localId,
        clientId: item.clientId,
        status: item.status,
        total: item.total,
        subtotal: item.subtotal,
        currency: item.currency,
        issueDate: item.issueDate,
        dueDate: item.dueDate,
        items: item.items?.map((i: any) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.amount
        }))
      };
    });
  };'''

content = content.replace(strip_func, '')

old_func = '''  const getAiContextData = async () => {
    const rawInvoices = await db.invoices.filter(x => !x.deletedAt).toArray();
    const rawQuotes = await db.quotes.filter(x => !x.deletedAt).toArray();
    const rawClients = await db.clients.filter(x => !x.deletedAt).toArray();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffTime = cutoff.getTime();

    const recentInvoices = rawInvoices.filter(i => new Date(i.createdAt).getTime() >= cutoffTime);
    const recentQuotes = rawQuotes.filter(q => new Date(q.createdAt).getTime() >= cutoffTime);
    const oldInvoices = rawInvoices.filter(i => new Date(i.createdAt).getTime() < cutoffTime);
    const oldQuotes = rawQuotes.filter(q => new Date(q.createdAt).getTime() < cutoffTime);

    return {
      invoices: stripSensitiveData(recentInvoices, 'invoice'),
      quotes: stripSensitiveData(recentQuotes, 'quote'),
      clients: stripSensitiveData(rawClients, 'client'),
      historicalSummary: {
        olderInvoicesCount: oldInvoices.length,
        olderInvoicesTotalValue: oldInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
        olderQuotesCount: oldQuotes.length,
        olderQuotesTotalValue: oldQuotes.reduce((sum, q) => sum + (q.total || 0), 0)
      }
    };
  };'''

new_func = '''  const getAiContextData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_ai_context');
      if (error) {
        console.error('RPC failed:', error);
        return { aggregatedSummary: null };
      }
      return { aggregatedSummary: data };
    } catch (err) {
      console.error('Failed to fetch AI context:', err);
      return { aggregatedSummary: null };
    }
  };'''

content = content.replace(old_func, new_func)

import re
content = re.sub(r'\s*if \(contextData\.historicalSummary && Object\.keys\(contextData\.historicalSummary\)\.length > 0\) \{.*?`;\n\s*\}', '', content, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Patched successfully using python script.')
