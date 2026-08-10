import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { EmptyState, LongPressable } from '../components/ui';
import { v4 as uuidv4 } from 'uuid';
import { useSelection } from '../hooks/useSelection';
import { useAppStore } from '../store/useAppStore';

const Trash: React.FC = () => {
  const { isProUser } = useAppStore();
  const retentionDays = isProUser ? 30 : 7;

  // Auto-purge items older than retention window
  useEffect(() => {
    const purgeExpired = async () => {
      const now = Date.now();
      const cutoff = now - (retentionDays * 24 * 60 * 60 * 1000);

      const tables = [db.clients, db.invoices, db.quotes];
      for (const table of tables) {
        const expiredItems = await table.filter((item: any) => {
          if (!item.deletedAt) return false;
          const deletedTime = new Date(item.deletedAt).getTime();
          return deletedTime < cutoff;
        }).toArray();

        for (const item of expiredItems) {
          const entity = 'invoiceNumber' in item ? 'INVOICE' : 'quoteNumber' in item ? 'QUOTE' : 'CLIENT';
          await table.delete(item.localId);
          await db.syncQueue.add({
            id: uuidv4(), action: 'DELETE', entity,
            payload: { local_id: item.localId }, status: 'pending', createdAt: new Date().toISOString()
          });
        }
      }
    };
    purgeExpired();
  }, [retentionDays]);
  const deletedClients = useLiveQuery(() => db.clients.filter(c => !!c.deletedAt).toArray()) || [];
  const deletedInvoices = useLiveQuery(() => db.invoices.filter(i => !!i.deletedAt).toArray()) || [];
  const deletedQuotes = useLiveQuery(() => db.quotes.filter(q => !!q.deletedAt).toArray()) || [];

  const allItems = [...deletedClients, ...deletedInvoices, ...deletedQuotes];
  const { selectedIds, toggleSelect, clearSelection, setSelectedIds } = useSelection(allItems, (item: any) => item.localId);

  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [modalConfig, setModalConfig] = React.useState<{ isOpen: boolean, type: 'restore' | 'delete', entity: 'CLIENT' | 'INVOICE' | 'QUOTE' | 'BULK', localId: string, itemName: string } | null>(null);

  const confirmAction = async () => {
    if (!modalConfig) return;
    const { type, entity, localId } = modalConfig;
    setProcessingId(localId);
    setModalConfig(null);

    try {
      if (entity === 'BULK') {
        const itemsToProcess = allItems.filter(item => selectedIds.has(item.localId));
        for (const item of itemsToProcess) {
          const itemEntity = 'invoiceNumber' in item ? 'INVOICE' : 'quoteNumber' in item ? 'QUOTE' : 'CLIENT';
          const table = itemEntity === 'INVOICE' ? db.invoices : itemEntity === 'QUOTE' ? db.quotes : db.clients;
          
          if (type === 'restore') {
            await table.update(item.localId, { deletedAt: '', syncStatus: 'pending' });
            await db.syncQueue.add({
              id: uuidv4(), action: 'UPDATE', entity: itemEntity,
              payload: { local_id: item.localId, deleted_at: null }, status: 'pending', createdAt: new Date().toISOString()
            });
          } else if (type === 'delete') {
            await table.delete(item.localId);
            await db.syncQueue.add({
              id: uuidv4(), action: 'DELETE', entity: itemEntity,
              payload: { local_id: item.localId }, status: 'pending', createdAt: new Date().toISOString()
            });
          }
        }
        clearSelection();
      } else {
        if (type === 'restore') {
          if (entity === 'CLIENT') await db.clients.update(localId, { deletedAt: '', syncStatus: 'pending' });
          else if (entity === 'INVOICE') await db.invoices.update(localId, { deletedAt: '', syncStatus: 'pending' });
          else if (entity === 'QUOTE') await db.quotes.update(localId, { deletedAt: '', syncStatus: 'pending' });

          await db.syncQueue.add({
            id: uuidv4(), action: 'UPDATE', entity,
            payload: { local_id: localId, deleted_at: null }, status: 'pending', createdAt: new Date().toISOString()
          });
        } else if (type === 'delete') {
          if (entity === 'CLIENT') await db.clients.delete(localId);
          else if (entity === 'INVOICE') await db.invoices.delete(localId);
          else if (entity === 'QUOTE') await db.quotes.delete(localId);

          await db.syncQueue.add({
            id: uuidv4(), action: 'DELETE', entity,
            payload: { local_id: localId }, status: 'pending', createdAt: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error(`Failed to ${type}:`, err);
    } finally {
      setProcessingId(null);
    }
  };

  const isEmpty = allItems.length === 0;

  const renderItem = (item: any, type: 'CLIENT' | 'INVOICE' | 'QUOTE', identifier: string, dateStr: string) => {
    return (
      <LongPressable
        key={item.id}
        onLongPress={() => toggleSelect(item.localId)}
        onClick={() => { if (selectedIds.size > 0) toggleSelect(item.localId); }}
        className={`group flex flex-col md:grid md:grid-cols-12 md:items-center px-4 md:px-6 py-4 transition-colors gap-2 md:gap-0 ${selectedIds.has(item.localId) ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-l-purple-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-transparent'}`}
      >
        <div className="flex md:hidden items-start gap-3 w-full">
          <div className={`pt-1 transition-all duration-300 overflow-hidden flex-shrink-0 ${selectedIds.size > 0 ? 'w-6 opacity-100 mr-2' : 'w-0 opacity-0 m-0'}`}>
            <input 
              type="checkbox"
              checked={selectedIds.has(item.localId)}
              onChange={(e) => { e.stopPropagation(); toggleSelect(item.localId); }}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
          </div>
          <div className="flex flex-col gap-2 w-full min-w-0">
            <div className="flex items-center gap-3 w-full">
              <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-700/50 rounded text-slate-600 dark:text-slate-400 uppercase tracking-wider flex-shrink-0">{type.charAt(0) + type.slice(1).toLowerCase()}</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-base truncate min-w-0">{identifier}</span>
            </div>
            <div className="flex justify-between items-center md:hidden w-full mt-1">
              <span className="text-sm text-slate-500 font-medium">{dateStr}</span>
              <div className="flex justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); setModalConfig({ isOpen: true, type: 'restore', entity: type, localId: item.localId, itemName: identifier })}} 
                  disabled={processingId === item.localId}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50 transition-colors"
                  title="Restore"
                >
                  <RefreshCw size={18} className={processingId === item.localId && modalConfig?.type === 'restore' ? 'animate-spin' : ''} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setModalConfig({ isOpen: true, type: 'delete', entity: type, localId: item.localId, itemName: identifier })}}
                  disabled={processingId === item.localId}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 transition-colors"
                  title="Delete permanently"
                >
                  <Trash2 size={18} className={processingId === item.localId && modalConfig?.type === 'delete' ? 'animate-bounce' : ''} />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="hidden md:flex items-center md:col-span-1">
          <input 
            type="checkbox"
            checked={selectedIds.has(item.localId)}
            onChange={(e) => { e.stopPropagation(); toggleSelect(item.localId); }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
          />
        </div>
        <div className="hidden md:block md:col-span-2 font-medium text-slate-700 dark:text-slate-300">{type.charAt(0) + type.slice(1).toLowerCase()}</div>
        <div className="hidden md:block md:col-span-4 text-slate-900 dark:text-slate-100">{identifier}</div>
        <div className="hidden md:block md:col-span-3 text-slate-600 dark:text-slate-400">{dateStr}</div>
        
        <div className="hidden md:flex justify-end gap-2 md:col-span-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); setModalConfig({ isOpen: true, type: 'restore', entity: type, localId: item.localId, itemName: identifier })}} 
            disabled={processingId === item.localId}
            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50 transition-colors"
            title="Restore"
          >
            <RefreshCw size={18} className={processingId === item.localId && modalConfig?.type === 'restore' ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setModalConfig({ isOpen: true, type: 'delete', entity: type, localId: item.localId, itemName: identifier })}}
            disabled={processingId === item.localId}
            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 transition-colors"
            title="Delete permanently"
          >
            <Trash2 size={18} className={processingId === item.localId && modalConfig?.type === 'delete' ? 'animate-bounce' : ''} />
          </button>
        </div>
      </LongPressable>
    );
  };

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
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${
                  modalConfig.type === 'restore' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                }`}
                disabled={processingId !== null}
              >
                {processingId && <RefreshCw size={16} className="animate-spin" />}
                {modalConfig.type === 'restore' ? 'Yes, Restore' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="text-red-500" /> Trash
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage your recently deleted items.
          </p>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2">
            <button 
              onClick={() => setModalConfig({ isOpen: true, type: 'restore', entity: 'BULK', localId: 'bulk', itemName: `${selectedIds.size} selected items` })}
              className="px-3 md:px-4 py-2 bg-white dark:bg-slate-800 text-blue-600 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
            >
              Restore ({selectedIds.size})
            </button>
            <button 
              onClick={() => setModalConfig({ isOpen: true, type: 'delete', entity: 'BULK', localId: 'bulk', itemName: `${selectedIds.size} selected items` })}
              className="px-3 md:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
            >
              Delete ({selectedIds.size})
            </button>
          </div>
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-xl p-4 flex gap-3 items-start animate-fade-in">
        <AlertCircle className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="font-medium text-blue-900 dark:text-blue-300 text-sm">Auto-Delete Policy</h4>
          <p className="text-blue-700 dark:text-blue-400/80 text-sm mt-1">
            Items in the trash are automatically deleted forever after <strong>{retentionDays} days</strong>. {isProUser ? '' : 'Upgrade to Pro to extend this to 30 days.'}
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
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-12 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-t-xl items-center">
            <div className="col-span-1">
              <input 
                type="checkbox"
                checked={selectedIds.size > 0 && selectedIds.size === allItems.length}
                ref={input => {
                  if (input) {
                    input.indeterminate = selectedIds.size > 0 && selectedIds.size < allItems.length;
                  }
                }}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(new Set(allItems.map(i => i.localId)));
                  else clearSelection();
                }}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
            </div>
            <div className="col-span-2">Type</div>
            <div className="col-span-4">Name / Identifier</div>
            <div className="col-span-3">Deleted On</div>
            <div className="col-span-2 text-right pr-4">Actions</div>
          </div>
          
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {deletedClients.map(client => renderItem(client, 'CLIENT', client.name, new Date(client.deletedAt as string).toLocaleDateString()))}
            {deletedInvoices.map(invoice => renderItem(invoice, 'INVOICE', invoice.invoiceNumber || 'Draft', new Date(invoice.deletedAt as string).toLocaleDateString()))}
            {deletedQuotes.map(quote => renderItem(quote, 'QUOTE', quote.quoteNumber || 'Draft', new Date(quote.deletedAt as string).toLocaleDateString()))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Trash;
