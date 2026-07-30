import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Trash2, RefreshCw } from 'lucide-react';
import { EmptyState } from '../components/ui';
import { v4 as uuidv4 } from 'uuid';

const Trash: React.FC = () => {
  const deletedClients = useLiveQuery(() => db.clients.filter(c => !!c.deletedAt).toArray()) || [];
  const deletedInvoices = useLiveQuery(() => db.invoices.filter(i => !!i.deletedAt).toArray()) || [];
  const deletedQuotes = useLiveQuery(() => db.quotes.filter(q => !!q.deletedAt).toArray()) || [];

  const handleRestore = async (entity: 'CLIENT' | 'INVOICE' | 'QUOTE', id: string, localId: string) => {
    try {
      if (entity === 'CLIENT') {
        await db.clients.update(id, { deletedAt: undefined, syncStatus: 'pending' });
      } else if (entity === 'INVOICE') {
        await db.invoices.update(id, { deletedAt: undefined, syncStatus: 'pending' });
      } else if (entity === 'QUOTE') {
        await db.quotes.update(id, { deletedAt: undefined, syncStatus: 'pending' });
      }

      await db.syncQueue.add({
        id: uuidv4(),
        action: 'UPDATE',
        entity,
        payload: { local_id: localId, deleted_at: null },
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to restore:', err);
    }
  };

  const handlePermanentDelete = async (entity: 'CLIENT' | 'INVOICE' | 'QUOTE', id: string, localId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this? This action cannot be undone.')) return;

    try {
      if (entity === 'CLIENT') await db.clients.delete(id);
      else if (entity === 'INVOICE') await db.invoices.delete(id);
      else if (entity === 'QUOTE') await db.quotes.delete(id);

      await db.syncQueue.add({
        id: uuidv4(),
        action: 'DELETE',
        entity,
        payload: { local_id: localId },
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to delete permanently:', err);
    }
  };

  const isEmpty = deletedClients.length === 0 && deletedInvoices.length === 0 && deletedQuotes.length === 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="text-red-500" /> Trash
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage your recently deleted items.
          </p>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState 
          icon={Trash2}
          title="Trash is empty"
          description="You haven't deleted any items yet."
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Type</th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Name / Identifier</th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Deleted On</th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {deletedClients.map(client => (
                <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Client</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{client.name}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-500">{new Date(client.deletedAt as string).toLocaleDateString()}</td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => handleRestore('CLIENT', client.id as string, client.localId)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><RefreshCw size={18} /></button>
                    <button onClick={() => handlePermanentDelete('CLIENT', client.id as string, client.localId)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {deletedInvoices.map(invoice => (
                <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Invoice</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{invoice.invoiceNumber || 'Draft'}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-500">{new Date(invoice.deletedAt as string).toLocaleDateString()}</td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => handleRestore('INVOICE', invoice.id as string, invoice.localId)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><RefreshCw size={18} /></button>
                    <button onClick={() => handlePermanentDelete('INVOICE', invoice.id as string, invoice.localId)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
              {deletedQuotes.map(quote => (
                <tr key={quote.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Quote</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{quote.quoteNumber || 'Draft'}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-500">{new Date(quote.deletedAt as string).toLocaleDateString()}</td>
                  <td className="p-4 text-right space-x-2">
                    <button onClick={() => handleRestore('QUOTE', quote.id as string, quote.localId)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"><RefreshCw size={18} /></button>
                    <button onClick={() => handlePermanentDelete('QUOTE', quote.id as string, quote.localId)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Trash;


