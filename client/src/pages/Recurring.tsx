import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ConfirmationModal } from '../components/ConfirmationModal';

import { db } from '../db/db';
import { Search, Plus, Play, Pause, Trash2 , Eye } from 'lucide-react';
import { EmptyState, Card, Badge } from '../components/ui';
import { useAppStore } from '../store/useAppStore';
import { formatMoney, formatDate } from '../utils/formatters';
import { usePagination } from '../hooks/usePagination';
import { Pagination } from '../components/Pagination';
import { v4 as uuidv4 } from 'uuid';

export default function Recurring() {
  const navigate = useNavigate();
  const isProUser = useAppStore((state) => state.isProUser);
  const allSchedules = useLiveQuery(() => db.recurringSchedules.filter(s => !s.deletedAt).toArray()) || [];
  const allClients = useLiveQuery(() => db.clients.toArray()) || [];
  const allInvoices = useLiveQuery(() => db.invoices.toArray()) || [];
  
    const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  if (!isProUser) {
    return (
      <div className="flex flex-col gap-6 relative animate-fade-in-up items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Play size={32} />
          </div>
          <h2 className="text-2xl font-bold">Automate your billing</h2>
          <p className="text-slate-500">Upgrade to Pro to create recurring invoices that automatically generate and email themselves to your clients.</p>
          <button onClick={() => navigate('/upgrade')} className="mt-4 bg-purple-600 text-white px-6 py-3 rounded-xl font-bold w-full hover:bg-purple-700 transition-colors">
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  const filtered = useMemo(() => allSchedules.filter(s => {
    const client = allClients.find(c => c.localId === s.clientId);
    return client?.name?.toLowerCase().includes(search.toLowerCase());
  }), [allSchedules, allClients, search]);

  const { currentPage, setCurrentPage, totalPages, paginatedItems } = usePagination(filtered, 9);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const schedule = allSchedules.find(s => s.localId === id || s.id === id);
    if (!schedule) return;

    const updated: any = { ...schedule, status: newStatus, updatedAt: new Date().toISOString() };
    await db.recurringSchedules.put(updated);
    await db.syncQueue.add({
      id: uuidv4(),
      action: 'UPDATE',
      entity: 'RECURRING_SCHEDULE',
      payload: updated,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  };

  const deleteSchedule = (id: string) => {
    setScheduleToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!scheduleToDelete) return;
    const schedule = allSchedules.find(s => s.localId === scheduleToDelete || s.id === scheduleToDelete);
    if (!schedule) {
      setDeleteModalOpen(false);
      return;
    }
    const deleted = { ...schedule, deletedAt: new Date().toISOString() };
    await db.recurringSchedules.put(deleted);
    await db.syncQueue.add({
      id: uuidv4(),
      action: 'UPDATE',
      entity: 'RECURRING_SCHEDULE',
      payload: deleted,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    setDeleteModalOpen(false);
    setScheduleToDelete(null);
  };

  return (
    <div className="flex flex-col gap-6 relative animate-fade-in-up">
      {/* Desktop Header */}
      <div className="hidden md:flex sticky -top-4 md:-top-6 z-10 bg-slate-50 dark:bg-slate-900 pt-4 md:pt-6 pb-4 -mx-4 px-4 md:-mx-6 md:px-6 border-b border-slate-200 dark:border-slate-800 flex-col md:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search recurring schedules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 pb-2 md:pb-0">
          <button 
            onClick={() => navigate('/invoices/new', { state: { defaultRecurring: true } })}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          >
            <Plus size={18} />
            <span>New Recurring</span>
          </button>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden sticky -top-4 md:-top-6 z-10 bg-slate-50 dark:bg-slate-900 pt-4 md:pt-6 pb-4 -mx-4 px-4 md:-mx-6 md:px-6 border-b border-slate-200 dark:border-slate-800 flex gap-2">
         <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search recurring..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
        </div>
        
        <div className="flex-shrink-0 flex items-center">
          <button 
            onClick={() => navigate('/invoices/new', { state: { defaultRecurring: true } })}
            className="flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white w-10 h-10 rounded-lg transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState 
          icon={Play}
          title="No recurring schedules"
          description="You haven't set up any recurring invoices yet. Create an invoice and toggle 'Make Recurring' to automate it."
        />
      ) : (
        <div className="space-y-6">
          <div className={`grid grid-cols-1 gap-6 ${
            paginatedItems.length === 1 ? 'md:grid-cols-1 lg:max-w-3xl' :
            paginatedItems.length === 2 ? 'md:grid-cols-2' :
            'md:grid-cols-2 lg:grid-cols-3'
          }`}>
            {paginatedItems.map(schedule => {
            const client = allClients.find(c => c.localId === schedule.clientId);
            const template = allInvoices.find(i => i.localId === schedule.templateInvoiceId);
            
            return (
              <Card key={schedule.localId || schedule.id} className="p-5 space-y-4 hover:border-purple-300 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{client?.name || 'Unknown Client'}</h3>
                    <p className="text-sm text-slate-500">{schedule.frequency} Schedule</p>
                  </div>
                  <Badge variant={schedule.status === 'ACTIVE' ? 'paid' : schedule.status === 'PAUSED' ? 'pending' : 'default'}>
                    {schedule.status}
                  </Badge>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount:</span>
                    <span className="font-bold">{template ? formatMoney(template.total, template.currency) : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Next Issue:</span>
                    <span className="font-medium">{formatDate(schedule.nextRunDate)}</span>
                  </div>
                  {schedule.endDate && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Ends On:</span>
                      <span className="font-medium">{formatDate(schedule.endDate)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                  <button 
                    onClick={() => navigate('/invoices', { state: { openPreviewId: schedule.templateInvoiceId } })}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 transition-colors"
                  >
                    <Eye size={14} />
                    View Template
                  </button>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleStatus(schedule.localId as string, schedule.status)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-600 dark:text-slate-400"
                    title={schedule.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                  >
                    {schedule.status === 'ACTIVE' ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button 
                    onClick={() => deleteSchedule(schedule.localId as string)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </Card>
            );
          })}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex justify-end">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          )}
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setScheduleToDelete(null); }}
        onConfirm={handleConfirmDelete}
        title="Delete Recurring Schedule"
        message="Are you sure you want to stop and delete this recurring schedule? This action cannot be undone."
      />
    </div>
  );
}
