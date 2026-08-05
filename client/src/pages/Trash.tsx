import React from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Trash2, RefreshCw } from 'lucide-react';
import { EmptyState } from '../components/ui';
import { v4 as uuidv4 } from 'uuid';

const Trash: React.FC = () => {
  const deletedClients = useLiveQuery(() => db.clients.filter(c => !!c.deletedAt).toArray()) || [];
  const deletedInvoices = useLiveQuery(() => db.invoices.filter(i => !!i.deletedAt).toArray()) || [];
  const deletedQuotes = useLiveQuery(() => db.quotes.filter(q => !!q.deletedAt).toArray()) || [];

  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [modalConfig, setModalConfig] = React.useState<{ isOpen: boolean, type: 'restore' | 'delete', entity: 'CLIENT' | 'INVOICE' | 'QUOTE', localId: string, itemName: string } | null>(null);

  const confirmAction = async () => {
    if (!modalConfig) return;
    const { type, entity, localId } = modalConfig;
    setProcessingId(localId);
    setModalConfig(null);

    try {
      if (type === 'restore') {
        if (entity === 'CLIENT') {
          await db.clients.update(localId, { deletedAt: '', syncStatus: 'pending' });
        } else if (entity === 'INVOICE') {
          await db.invoices.update(localId, { deletedAt: '', syncStatus: 'pending' });
        } else if (entity === 'QUOTE') {
          await db.quotes.update(localId, { deletedAt: '', syncStatus: 'pending' });
        }

        await db.syncQueue.add({
          id: uuidv4(),
          action: 'UPDATE',
          entity,
          payload: { local_id: localId, deleted_at: null },
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      } else if (type === 'delete') {
        if (entity === 'CLIENT') await db.clients.delete(localId);
        else if (entity === 'INVOICE') await db.invoices.delete(localId);
        else if (entity === 'QUOTE') await db.quotes.delete(localId);

        await db.syncQueue.add({
          id: uuidv4(),
          action: 'DELETE',
          entity,
          payload: { local_id: localId },
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(`Failed to ${type}:`, err);
    } finally {
      setProcessingId(null);
    }
  };

  const isEmpty = deletedClients.length === 0 && deletedInvoices.length === 0 && deletedQuotes.length === 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Confirmation Modal */}
      {modalConfig && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setModalConfig(null)} />
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm relative z-10 p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {modalConfig.type === 'restore' ? 'Restore Item' : 'Permanent Delete'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
              {modalConfig.type === 'restore' 
                ? `Are you sure you want to restore ${modalConfig.itemName}?`
                : `Are you sure you want to permanently delete ${modalConfig.itemName}? This action cannot be undone.`}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModalConfig(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                Cancel
              </button>
              <button 
                onClick={confirmAction} 
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  modalConfig.type === 'restore' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {modalConfig.type === 'restore' ? 'Yes, Restore' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
                  <td className="p-4 text-right whitespace-nowrap space-x-2">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setModalConfig({ isOpen: true, type: 'restore', entity: 'CLIENT', localId: client.localId, itemName: client.name })} 
                        disabled={processingId === client.localId}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50"
                      >
                        <RefreshCw size={18} className={processingId === client.localId && modalConfig?.type === 'restore' ? 'animate-spin' : ''} />
                      </button>
                      <button 
                        onClick={() => setModalConfig({ isOpen: true, type: 'delete', entity: 'CLIENT', localId: client.localId, itemName: client.name })}
                        disabled={processingId === client.localId}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50"
                      >
                        <Trash2 size={18} className={processingId === client.localId && modalConfig?.type === 'delete' ? 'animate-bounce' : ''} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {deletedInvoices.map(invoice => (
                <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Invoice</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{invoice.invoiceNumber || 'Draft'}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-500">{new Date(invoice.deletedAt as string).toLocaleDateString()}</td>
                  <td className="p-4 text-right whitespace-nowrap space-x-2">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setModalConfig({ isOpen: true, type: 'restore', entity: 'INVOICE', localId: invoice.localId, itemName: invoice.invoiceNumber || 'Invoice' })}
                        disabled={processingId === invoice.localId}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50"
                      >
                        <RefreshCw size={18} className={processingId === invoice.localId ? 'animate-spin' : ''} />
                      </button>
                      <button 
                        onClick={() => setModalConfig({ isOpen: true, type: 'delete', entity: 'INVOICE', localId: invoice.localId, itemName: invoice.invoiceNumber || 'Invoice' })}
                        disabled={processingId === invoice.localId}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50"
                      >
                        <Trash2 size={18} className={processingId === invoice.localId ? 'animate-bounce' : ''} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {deletedQuotes.map(quote => (
                <tr key={quote.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="p-4 text-slate-700 dark:text-slate-300 font-medium">Quote</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{quote.quoteNumber || 'Draft'}</td>
                  <td className="p-4 text-slate-500 dark:text-slate-500">{new Date(quote.deletedAt as string).toLocaleDateString()}</td>
                  <td className="p-4 text-right whitespace-nowrap space-x-2">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setModalConfig({ isOpen: true, type: 'restore', entity: 'QUOTE', localId: quote.localId, itemName: quote.quoteNumber || 'Quote' })}
                        disabled={processingId === quote.localId}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50"
                      >
                        <RefreshCw size={18} className={processingId === quote.localId ? 'animate-spin' : ''} />
                      </button>
                      <button 
                        onClick={() => setModalConfig({ isOpen: true, type: 'delete', entity: 'QUOTE', localId: quote.localId, itemName: quote.quoteNumber || 'Quote' })}
                        disabled={processingId === quote.localId}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50"
                      >
                        <Trash2 size={18} className={processingId === quote.localId ? 'animate-bounce' : ''} />
                      </button>
                    </div>
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


