import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Mail, Phone, MapPin, Download, FileText, Users } from 'lucide-react';
import { Badge, EmptyState } from '../components/ui';
import { formatMoney } from '../utils/formatters';
import { Pagination } from '../components/Pagination';
import { PreviewPanel } from '../components/PreviewPanel';
import { useAppStore } from '../store/useAppStore';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Client } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { ActionMenu, LongPressable } from '../components/ui';
import { useSelection } from '../hooks/useSelection';
import { usePagination } from '../hooks/usePagination';
import { useQuota } from '../hooks/useQuota';
import { ConfirmationModal } from '../components/ConfirmationModal';

/**
 * Clients Component
 * 
 * CRM view displaying all clients, their contact info, and lifetime value.
 * Allows creating new clients and viewing detailed histories.
 */
const Clients: React.FC = () => {
  const { invoices } = useAppStore();
  const clients = useLiveQuery(() => db.clients.toArray()) || [];
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client>>({});
  
  // Delete Modal States
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);


  // Derived metrics
  const getClientMetrics = (clientId: string) => {
    const clientInvoices = invoices.filter(i => i.clientId === clientId);
    const totalInvoiced = clientInvoices.reduce((sum, i) => sum + i.total, 0);
    const totalPaid = clientInvoices.reduce((sum, i) => sum + i.amountPaid, 0);
    return { totalInvoiced, totalPaid, invoiceCount: clientInvoices.length, invoices: clientInvoices };
  };

  const filteredClients = clients.filter(c => 
    search === '' || 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email?.toLowerCase().includes(search.toLowerCase())
  );
  
  const { currentPage, setCurrentPage, totalPages, paginatedItems: paginatedClients } = usePagination(filteredClients, 10);
  const { selectedIds, toggleSelect, toggleSelectAll, setSelectedIds } = useSelection(paginatedClients, (c) => c.localId);

  const handleSaveClient = async () => {
    if (!editingClient.name) return alert('Name is required');
    if (editingClient.localId) {
       await db.clients.update(editingClient.localId, editingClient);
    } else {
       await db.clients.add({
         localId: uuidv4(),
         name: editingClient.name,
         email: editingClient.email || '',
         phone: editingClient.phone || '',
         address: editingClient.address || '',
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString(),
         syncStatus: 'pending'
       });
    }
    setIsModalOpen(false);
    setEditingClient({});
  };

  const { checkQuota } = useQuota();

  const openNewClientModal = () => {
    if (checkQuota('client')) {
      setEditingClient({});
      setIsModalOpen(true);
    }
  };

  const handleDeleteClient = async (id: string) => {
    await db.clients.delete(id);
    await db.syncQueue.add({
      id: uuidv4(),
      action: 'DELETE',
      entity: 'CLIENT',
      payload: { local_id: id },
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    if (selectedClient?.localId === id) setSelectedClient(null);
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await db.clients.delete(id);
      await db.syncQueue.add({
        id: uuidv4(),
        action: 'DELETE',
        entity: 'CLIENT',
        payload: { local_id: id },
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    }
    setSelectedIds(new Set());
  };

  const handleBulkExportCsv = () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one client to export.');
      return;
    }
    const selectedClients = clients.filter(c => selectedIds.has(c.localId));
    
    import('../utils/csvGenerator').then(({ exportToCsv }) => {
      const headers = ['Name', 'Email', 'Phone', 'Address', 'Total Invoiced', 'Total Paid'];
      const rows = selectedClients.map(client => {
        const metrics = getClientMetrics(client.localId);
        return [
          client.name,
          client.email || '',
          client.phone || '',
          client.address || '',
          metrics.totalInvoiced,
          metrics.totalPaid
        ];
      });
      exportToCsv(`clients-export-${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
    });
  };

  return (
    <div className="flex flex-col gap-6 relative animate-fade-in-up">
      {/* Sticky Action Bar */}
      <div className="hidden md:flex sticky top-16 z-10 bg-slate-50 dark:bg-slate-900 pt-4 pb-4 -mt-4 border-b border-slate-200 dark:border-slate-800 flex-col md:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          <button onClick={openNewClientModal} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors">
            <Plus size={18} />
            <span>New Client</span>
          </button>
            <button 
              onClick={handleBulkExportCsv}
              disabled={selectedIds.size === 0}
              className={`flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Download size={18} />
              <span>Export CSV</span>
            </button>
        </div>
      </div>

      {/* Mobile Search & FAB handled below */}

      {/* Bulk Actions Bar */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 px-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={paginatedClients.length > 0 && selectedIds.size === paginatedClients.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-medium">Select All</span>
          </label>
          {selectedIds.size > 0 && (
            <div className="ml-2 flex items-center">
                <ActionMenu 
                  items={[
                    { label: 'Export CSV', onClick: handleBulkExportCsv },
                    { label: 'Delete Selected', onClick: () => setBulkDeleteModalOpen(true), variant: 'danger' }
                  ]} 
                />
            </div>
          )}
        </div>
        <div className="text-sm text-slate-500 pr-2">
           {clients.length} Total Clients
        </div>
      </div>

      {/* Client List */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
        <div className="hidden md:grid grid-cols-12 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-t-xl">
          <div className="col-span-1 flex items-center">
             <input 
               type="checkbox" 
               checked={paginatedClients.length > 0 && selectedIds.size === paginatedClients.length}
               onChange={toggleSelectAll}
               className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
             />
          </div>
          <div className="col-span-4">Client Details</div>
          <div className="col-span-4">Contact Info</div>
          <div className="col-span-3 text-right pr-8">Total Billed</div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {paginatedClients.length > 0 ? paginatedClients.map((client, index) => {
            const metrics = getClientMetrics(client.localId);
            return (
              <LongPressable 
                key={client.localId} 
                onLongPress={() => toggleSelect(client.localId)}
                onClick={() => setSelectedClient(client)}
                style={{ animationDelay: `${index * 50}ms` }}
                className={`group px-6 md:px-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm block cursor-pointer animate-fade-in-up ${selectedIds.has(client.localId) ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}
              >
                {/* --- MOBILE VIEW --- */}
                <div className="flex md:hidden gap-3 items-start py-4">
                  <div className="flex-shrink-0 pt-1">
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(client.localId)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(client.localId); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex flex-shrink-0 items-center justify-center text-slate-600 dark:text-slate-400 font-bold">
                           {client.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-base font-bold">{client.name}</span>
                      </div>
                      <div className="font-bold text-base text-slate-900 dark:text-slate-100">
                         {formatMoney(metrics.totalInvoiced)}
                      </div>
                    </div>
                    <div className="text-slate-500 text-sm mt-1">
                      {client.email ? (
                        <div className="flex items-center gap-2"><Mail size={14} className="text-slate-400" /> <span className="truncate">{client.email}</span></div>
                      ) : (
                        <div className="italic text-slate-400">No email</div>
                      )}
                    </div>
                    <div className="flex justify-end mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div onClick={(e) => e.stopPropagation()}>
                        <ActionMenu items={[
                          { label: 'Edit', onClick: () => { setEditingClient(client); setIsModalOpen(true); } },
                          { label: 'Delete', onClick: () => { setClientToDelete(client.localId); setDeleteModalOpen(true); }, variant: 'danger' }
                        ]} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* --- DESKTOP VIEW --- */}
                <div className="hidden md:grid grid-cols-12 items-center w-full py-4">
                  <div className="col-span-1 flex items-center">
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(client.localId)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(client.localId); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </div>
                  
                  <div className="col-span-4 flex items-center gap-3 pr-4">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex flex-shrink-0 items-center justify-center text-slate-600 dark:text-slate-400 font-bold group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                       {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col justify-center truncate">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition-colors truncate">
                        {client.name}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-4 flex flex-col justify-center">
                    {client.email ? (
                      <div className="text-slate-600 dark:text-slate-300 text-sm flex items-center gap-2 truncate">
                        <Mail size={14} className="flex-shrink-0 text-slate-400" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-sm italic">No email</div>
                    )}
                    {client.phone && (
                      <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-2 truncate">
                        <Phone size={12} className="flex-shrink-0 text-slate-400" />
                        <span className="truncate">{client.phone}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="col-span-3 flex items-center justify-end font-semibold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition-colors">
                     {formatMoney(metrics.totalInvoiced)}
                     <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                       <ActionMenu items={[
                         { label: 'Edit', onClick: () => { setEditingClient(client); setIsModalOpen(true); } },
                         { label: 'Delete', onClick: () => { setClientToDelete(client.localId); setDeleteModalOpen(true); }, variant: 'danger' }
                       ]} />
                     </div>
                  </div>
                </div>
              </LongPressable>
            );
          }) : (
             <div className="p-8">
               <EmptyState
                 icon={Users}
                 title="No clients found"
                 description={search ? `No clients match the search "${search}".` : "You haven't added any clients yet. Add a client to start invoicing."}
                 actionLabel={search ? undefined : "Add Client"}
                 onAction={search ? undefined : openNewClientModal}
               />
             </div>
          )}
        </div>
      </div>
      
      {/* Mobile Floating Action Button */}
      {createPortal(
        <button onClick={openNewClientModal} className="md:hidden fixed bottom-24 right-4 z-50 bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 hover:scale-110 active:scale-95 transition-all duration-300">
          <Plus size={24} />
        </button>,
        document.body
      )}
      
      {paginatedClients.length > 0 && (
        <Pagination 
          currentPage={currentPage} 
          totalPages={totalPages} 
          onPageChange={setCurrentPage} 
        />
      )}

      {/* Slide-out Panel */}
      <PreviewPanel 
        isOpen={selectedClient !== null} 
        onClose={() => setSelectedClient(null)}
        title={selectedClient?.name || 'Client Details'}
        actions={
          <button onClick={() => { 
            setEditingClient(selectedClient!); 
            setSelectedClient(null);
            setIsModalOpen(true); 
          }} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700">
            Edit Client
          </button>
        }
      >
        {selectedClient && (
          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                 <Mail size={16} className="text-slate-400"/>
                 {selectedClient.email || 'No email provided'}
              </div>
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                 <Phone size={16} className="text-slate-400"/>
                 {selectedClient.phone || 'No phone provided'}
              </div>
              <div className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                 <MapPin size={16} className="text-slate-400 mt-1"/>
                 {selectedClient.address || 'No address provided'}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Financial Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4">
                  <span className="text-slate-500 text-xs font-semibold uppercase">Total Billed</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {formatMoney(getClientMetrics(selectedClient.localId).totalInvoiced)}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-4 border border-green-100 dark:border-green-900/30">
                  <span className="text-green-600 dark:text-green-400 text-xs font-semibold uppercase">Total Paid</span>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400 mt-1">
                    {formatMoney(getClientMetrics(selectedClient.localId).totalPaid)}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Recent Invoices</h3>
              <div className="space-y-2">
                 {getClientMetrics(selectedClient.localId).invoices.length > 0 ? (
                   getClientMetrics(selectedClient.localId).invoices.map(inv => (
                     <div key={inv.localId} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText size={16} className="text-purple-500"/>
                          <span className="font-medium text-sm">{inv.localId}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-sm">{formatMoney(inv.total, inv.currency)}</span>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          <Badge variant={inv.status.toLowerCase() as any} className="ml-2 scale-75 origin-right">{inv.status}</Badge>
                        </div>
                     </div>
                   ))
                 ) : (
                   <p className="text-sm text-slate-500 italic">No invoices found for this client.</p>
                 )}
              </div>
            </div>
          </div>
        )}
      </PreviewPanel>

      {/* Simple Add Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold">{editingClient.localId ? 'Edit Client' : 'New Client'}</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company / Name *</label>
                <input 
                  type="text" 
                  autoFocus
                  value={editingClient.name || ''}
                  onChange={e => setEditingClient({...editingClient, name: e.target.value})}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-purple-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input 
                  type="email" 
                  value={editingClient.email || ''}
                  onChange={e => setEditingClient({...editingClient, email: e.target.value})}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-purple-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input 
                  type="text" 
                  value={editingClient.phone || ''}
                  onChange={e => setEditingClient({...editingClient, phone: e.target.value})}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-purple-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <textarea 
                  rows={2}
                  value={editingClient.address || ''}
                  onChange={e => setEditingClient({...editingClient, address: e.target.value})}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-purple-500" 
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
               <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors">
                 Cancel
               </button>
               <button onClick={handleSaveClient} className="px-4 py-2 font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition-colors">
                 Save Client
               </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setClientToDelete(null); }}
        onConfirm={() => clientToDelete && handleDeleteClient(clientToDelete)}
        title="Delete Client"
        message="Are you sure you want to delete this client? This action cannot be undone."
      />

      <ConfirmationModal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Clients"
        message={`Are you sure you want to delete ${selectedIds.size} clients? This action cannot be undone.`}
      />
    </div>
  );
};

export default Clients;
