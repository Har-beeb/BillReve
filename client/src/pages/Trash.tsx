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
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-t-xl">
            <div className="col-span-2">Type</div>
            <div className="col-span-5">Name / Identifier</div>
            <div className="col-span-3">Deleted On</div>
            <div className="col-span-2 text-right pr-4">Actions</div>
          </div>
          
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {deletedClients.map(client => (
              <div key={client.id} className="group flex flex-col md:grid md:grid-cols-12 md:items-center px-4 md:px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-3 md:gap-0">
                <div className="flex md:hidden justify-between items-center w-full">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Client</span>
                  <span className="text-xs text-slate-500">{new Date(client.deletedAt as string).toLocaleDateString()}</span>
                </div>
                
                <div className="hidden md:block md:col-span-2 font-medium text-slate-700 dark:text-slate-300">Client</div>
                <div className="md:col-span-5 text-slate-900 dark:text-slate-100 font-semibold md:font-normal text-lg md:text-base">{client.name}</div>
                <div className="hidden md:block md:col-span-3 text-slate-600 dark:text-slate-400">{new Date(client.deletedAt as string).toLocaleDateString()}</div>
                
                <div className="md:col-span-2 flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity mt-1 md:mt-0">
                  <button 
                    onClick={() => setModalConfig({ isOpen: true, type: 'restore', entity: 'CLIENT', localId: client.localId, itemName: client.name })} 
                    disabled={processingId === client.localId}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50 transition-colors"
                    title="Restore"
                  >
                    <RefreshCw size={18} className={processingId === client.localId && modalConfig?.type === 'restore' ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setModalConfig({ isOpen: true, type: 'delete', entity: 'CLIENT', localId: client.localId, itemName: client.name })}
                    disabled={processingId === client.localId}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 transition-colors"
                    title="Delete permanently"
                  >
                    <Trash2 size={18} className={processingId === client.localId && modalConfig?.type === 'delete' ? 'animate-bounce' : ''} />
                  </button>
                </div>
              </div>
            ))}
            
            {deletedInvoices.map(invoice => (
              <div key={invoice.id} className="group flex flex-col md:grid md:grid-cols-12 md:items-center px-4 md:px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-3 md:gap-0">
                <div className="flex md:hidden justify-between items-center w-full">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Invoice</span>
                  <span className="text-xs text-slate-500">{new Date(invoice.deletedAt as string).toLocaleDateString()}</span>
                </div>
                
                <div className="hidden md:block md:col-span-2 font-medium text-slate-700 dark:text-slate-300">Invoice</div>
                <div className="md:col-span-5 text-slate-900 dark:text-slate-100 font-semibold md:font-normal text-lg md:text-base">{invoice.invoiceNumber || 'Draft'}</div>
                <div className="hidden md:block md:col-span-3 text-slate-600 dark:text-slate-400">{new Date(invoice.deletedAt as string).toLocaleDateString()}</div>
                
                <div className="md:col-span-2 flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity mt-1 md:mt-0">
                  <button 
                    onClick={() => setModalConfig({ isOpen: true, type: 'restore', entity: 'INVOICE', localId: invoice.localId, itemName: invoice.invoiceNumber || 'Invoice' })}
                    disabled={processingId === invoice.localId}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50 transition-colors"
                    title="Restore"
                  >
                    <RefreshCw size={18} className={processingId === invoice.localId && modalConfig?.type === 'restore' ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setModalConfig({ isOpen: true, type: 'delete', entity: 'INVOICE', localId: invoice.localId, itemName: invoice.invoiceNumber || 'Invoice' })}
                    disabled={processingId === invoice.localId}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 transition-colors"
                    title="Delete permanently"
                  >
                    <Trash2 size={18} className={processingId === invoice.localId && modalConfig?.type === 'delete' ? 'animate-bounce' : ''} />
                  </button>
                </div>
              </div>
            ))}

            {deletedQuotes.map(quote => (
              <div key={quote.id} className="group flex flex-col md:grid md:grid-cols-12 md:items-center px-4 md:px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-3 md:gap-0">
                <div className="flex md:hidden justify-between items-center w-full">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Quote</span>
                  <span className="text-xs text-slate-500">{new Date(quote.deletedAt as string).toLocaleDateString()}</span>
                </div>
                
                <div className="hidden md:block md:col-span-2 font-medium text-slate-700 dark:text-slate-300">Quote</div>
                <div className="md:col-span-5 text-slate-900 dark:text-slate-100 font-semibold md:font-normal text-lg md:text-base">{quote.quoteNumber || 'Draft'}</div>
                <div className="hidden md:block md:col-span-3 text-slate-600 dark:text-slate-400">{new Date(quote.deletedAt as string).toLocaleDateString()}</div>
                
                <div className="md:col-span-2 flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity mt-1 md:mt-0">
                  <button 
                    onClick={() => setModalConfig({ isOpen: true, type: 'restore', entity: 'QUOTE', localId: quote.localId, itemName: quote.quoteNumber || 'Quote' })}
                    disabled={processingId === quote.localId}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50 transition-colors"
                    title="Restore"
                  >
                    <RefreshCw size={18} className={processingId === quote.localId && modalConfig?.type === 'restore' ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setModalConfig({ isOpen: true, type: 'delete', entity: 'QUOTE', localId: quote.localId, itemName: quote.quoteNumber || 'Quote' })}
                    disabled={processingId === quote.localId}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 transition-colors"
                    title="Delete permanently"
                  >
                    <Trash2 size={18} className={processingId === quote.localId && modalConfig?.type === 'delete' ? 'animate-bounce' : ''} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Trash;


