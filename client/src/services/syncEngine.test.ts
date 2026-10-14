/**
 * @vitest-environment jsdom
 *
 * Needs a DOM for `localStorage`, which the sync watermark assertions read and
 * write. Everything else in this suite is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncEngine } from './syncEngine';
import { db } from '../db/db';
import { supabase } from '../lib/supabase';

vi.mock('../db/db', () => ({
  db: {
    syncQueue: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      sortBy: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      hook: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    },
    clients: { update: vi.fn(), get: vi.fn(), bulkDelete: vi.fn(), bulkPut: vi.fn() },
    invoices: { update: vi.fn(), get: vi.fn(), bulkDelete: vi.fn(), bulkPut: vi.fn() },
    quotes: { update: vi.fn(), get: vi.fn(), bulkDelete: vi.fn(), bulkPut: vi.fn() },
    recurringSchedules: { update: vi.fn(), get: vi.fn(), bulkDelete: vi.fn(), bulkPut: vi.fn() },
  }
}));

const mockSupabaseQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  // The sync engine resolves the caller's tenant via
  // from('organization_members').select('organization_id').eq(...).limit(1).single()
  // before every push and pull, so the mock must satisfy that chain or the
  // engine throws before it reaches the code under test.
  single: vi.fn().mockResolvedValue({ data: { organization_id: 'org-1' }, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: { organization_id: 'org-1' }, error: null }),
} as any;
// Use Promise-like resolution explicitly rather than trying to assign .then
mockSupabaseQuery.then = (resolve: any) => resolve({ data: [], error: null });

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    },
    from: vi.fn().mockImplementation(() => mockSupabaseQuery),
    channel: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
    removeChannel: vi.fn()
  }
}));

vi.mock('../store/useAppStore', () => ({
  useAppStore: {
    getState: vi.fn().mockReturnValue({
      setSyncStatus: vi.fn(),
      setSession: vi.fn()
    })
  }
}));

// Mock fetch for syncServerTime
global.fetch = vi.fn().mockResolvedValue({
  headers: {
    get: vi.fn().mockReturnValue(new Date().toUTCString())
  }
} as any);

describe('syncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('pushLocalChanges', () => {
    it('pushes CREATED items using upsert keyed on the real composite unique index', async () => {
      const mockItems = [
        { id: 1, action: 'CREATE', entity: 'CLIENT', status: 'pending', payload: { localId: 'client-1', name: 'Test Client' } }
      ];
      (db.syncQueue as any).sortBy.mockResolvedValue(mockItems);
      mockSupabaseQuery.upsert.mockResolvedValue({ error: null });

      await (syncEngine as any).pushLocalChanges();

      expect(supabase.from).toHaveBeenCalledWith('clients');
      // The unique constraint is UNIQUE (organization_id, local_id). PostgREST
      // requires the column list comma-separated with NO whitespace — a space
      // makes it look for a column literally named " local_id" and every
      // CREATE push fails into the dead-letter queue.
      expect(mockSupabaseQuery.upsert).toHaveBeenCalledWith(
        { local_id: 'client-1', name: 'Test Client', organization_id: 'org-1' },
        { onConflict: 'organization_id,local_id' }
      );
      expect(db.syncQueue.delete).toHaveBeenCalledWith(1);
      expect(db.clients.update).toHaveBeenCalledWith('client-1', { syncStatus: 'synced' });
    });

    it('pushes UPDATED items, sets updated_at, and scopes to the organization', async () => {
      const mockItems = [
        { id: 2, action: 'UPDATE', entity: 'INVOICE', status: 'pending', payload: { localId: 'inv-1', total: 100 } }
      ];
      (db.syncQueue as any).sortBy.mockResolvedValue(mockItems);

      await (syncEngine as any).pushLocalChanges();

      expect(supabase.from).toHaveBeenCalledWith('invoices');
      expect(mockSupabaseQuery.update).toHaveBeenCalled();
      const updateArgs = mockSupabaseQuery.update.mock.calls[0][0];
      expect(updateArgs.local_id).toBe('inv-1');
      expect(updateArgs.total).toBe(100);
      expect(updateArgs.updated_at).toBeDefined(); // updated_at is appended
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('local_id', 'inv-1');
      // Defence in depth: never rely on RLS alone for a cross-tenant write.
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('organization_id', 'org-1');
    });

    it('pushes DELETED items scoped to the organization', async () => {
      const mockItems = [
        { id: 3, action: 'DELETE', entity: 'QUOTE', status: 'pending', payload: { localId: 'quote-1' } }
      ];
      (db.syncQueue as any).sortBy.mockResolvedValue(mockItems);

      await (syncEngine as any).pushLocalChanges();

      expect(supabase.from).toHaveBeenCalledWith('quotes');
      expect(mockSupabaseQuery.delete).toHaveBeenCalled();
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('local_id', 'quote-1');
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('organization_id', 'org-1');
    });
  });

  describe('pullRemoteChanges', () => {
    it('uses last_sync_time watermark and updates it', async () => {
      localStorage.setItem('last_sync_time_clients', '2023-01-01T00:00:00.000Z');
      
      // Mock from() to return a specialized range for different tables if needed
      // Actually we can just have range return some data once and empty afterwards
      mockSupabaseQuery.range.mockImplementation(function (this: any, from: number) {
        // Just return one data set then empty to avoid infinite loops
        if (from > 0) return Promise.resolve({ data: [], error: null });
        return Promise.resolve({ data: [{ local_id: 'client-2', updated_at: '2023-01-02T00:00:00.000Z', is_purged: false }], error: null });
      });

      await (syncEngine as any).pullRemoteChanges();

      expect(mockSupabaseQuery.gt).toHaveBeenCalledWith('updated_at', '2023-01-01T00:00:00.000Z');
      // The watermark should be updated
      expect(localStorage.getItem('last_sync_time_clients')).toBe('2023-01-02T00:00:00.000Z');
      expect(db.clients.bulkPut).toHaveBeenCalledWith([{ localId: 'client-2', updatedAt: '2023-01-02T00:00:00.000Z', isPurged: false, syncStatus: 'synced' }]);
    });
  });
});
