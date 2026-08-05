import { db } from '../db/db';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { Client, Invoice, Quote } from '../types';

// Helper to convert camelCase keys to snake_case for Supabase
const toSnakeCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => toSnakeCase(v));
  } else if (obj && typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce(
      (result, key) => ({
        ...result,
        [key.replace(/([A-Z])/g, "_$1").toLowerCase()]: toSnakeCase(obj[key])
      }),
      {}
    );
  }
  return obj;
};

// Helper to convert snake_case keys to camelCase for local DB
const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v));
  } else if (obj && typeof obj === 'object' && obj.constructor === Object) {
    return Object.keys(obj).reduce(
      (result, key) => ({
        ...result,
        [key.replace(/_([a-z])/g, g => g[1].toUpperCase())]: toCamelCase(obj[key])
      }),
      {}
    );
  }
  return obj;
};

const LAST_SYNC_KEY = 'billreve_last_synced_at';

class SyncEngine {
  private isSyncing = false;
  private channels: ReturnType<typeof supabase.channel>[] = [];
  private retryCount = 0;
  private maxRetries = 5;

  async start() {
    await this.sync();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    this.subscribeToRealtime(session.user.id);

    window.addEventListener('online', () => {
      this.retryCount = 0;
      this.sync();
    });
  }

  private subscribeToRealtime(userId: string) {
    // Stop any existing channels first
    this.stop();

    // Subscribe per-table, scoped to the logged-in user only
    const tables = ['clients', 'invoices', 'quotes'] as const;

    for (const table of tables) {
      const channel = supabase
        .channel(`user-${table}-changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: `user_id=eq.${userId}`
          },
          () => {
            this.sync();
          }
        )
        .subscribe();

      this.channels.push(channel);
    }
  }

  stop() {
    for (const channel of this.channels) {
      supabase.removeChannel(channel);
    }
    this.channels = [];
  }

  async sync() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;
    useAppStore.getState().setSyncStatus('syncing');

    try {
      await this.pushLocalChanges();
      await this.pullRemoteChanges();

      // Save the time this sync completed
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

      useAppStore.getState().setSyncStatus('synced');
      this.retryCount = 0;
    } catch (error) {
      console.error('Sync failed:', error);
      useAppStore.getState().setSyncStatus('failed');

      if (this.retryCount < this.maxRetries) {
        const delay = Math.pow(2, this.retryCount) * 2000; // 2s, 4s, 8s, 16s, 32s
        this.retryCount++;
        setTimeout(() => this.sync(), delay);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async pushLocalChanges() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const pendingItems = await db.syncQueue.where('status').equals('pending').sortBy('createdAt');

    for (const item of pendingItems) {
      try {
        const tableName = item.entity.toLowerCase() + 's'; // e.g. CLIENT -> clients
        const payloadSnakeCase = toSnakeCase(item.payload);

        if (item.action === 'CREATE') {
          const { error } = await supabase
            .from(tableName)
            .upsert({ ...payloadSnakeCase, user_id: session.user.id }, { onConflict: 'user_id, local_id' });

          if (error) throw error;

        } else if (item.action === 'UPDATE') {
          const { error } = await supabase
            .from(tableName)
            .update({ ...payloadSnakeCase, user_id: session.user.id })
            .eq('local_id', payloadSnakeCase.local_id);

          if (error) throw error;

        } else if (item.action === 'DELETE') {
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('local_id', payloadSnakeCase.local_id);

          if (error) throw error;
        }

        await db.syncQueue.delete(item.id);

        const entityId = item.payload.local_id || item.payload.localId;

        if (item.action !== 'DELETE' && entityId) {
          if (item.entity === 'CLIENT') {
            await db.clients.update(entityId as string, { syncStatus: 'synced' });
          } else if (item.entity === 'INVOICE') {
            await db.invoices.update(entityId as string, { syncStatus: 'synced' });
          } else if (item.entity === 'QUOTE') {
            await db.quotes.update(entityId as string, { syncStatus: 'synced' });
          }
        }

      } catch (error: any) {
        console.error(`Failed to push queue item ${item.id}`, error);
        await db.syncQueue.update(item.id, { status: 'failed', error: String(error.message || error) });
      }
    }
  }

  private async pullRemoteChanges() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;

    // Delta sync: only pull rows updated since our last successful sync.
    // On first sync (no stored timestamp), pull everything.
    const lastSyncedAt = localStorage.getItem(LAST_SYNC_KEY);

    const buildQuery = (table: string) => {
      let q = supabase.from(table).select('*').eq('user_id', userId);
      if (lastSyncedAt) {
        // Pull anything updated at or after the last sync time
        q = q.gte('updated_at', lastSyncedAt);
      }
      return q;
    };

    const [clientsRes, invoicesRes, quotesRes] = await Promise.all([
      buildQuery('clients'),
      buildQuery('invoices'),
      buildQuery('quotes'),
    ]);

    if (clientsRes.data && clientsRes.data.length > 0) {
      const remoteClients = clientsRes.data.map(toCamelCase);

      if (!lastSyncedAt) {
        // First sync: reconcile deletions
        const remoteIds = new Set(remoteClients.map((c: any) => c.localId));
        const localSynced = await db.clients.where('syncStatus').equals('synced').toArray();
        const toDelete = localSynced.filter(c => !remoteIds.has(c.localId)).map(c => c.localId);
        if (toDelete.length > 0) await db.clients.bulkDelete(toDelete);
      }

      await db.clients.bulkPut(remoteClients.map((c: Client) => ({ ...c, syncStatus: 'synced' })));
    }

    if (invoicesRes.data && invoicesRes.data.length > 0) {
      const remoteInvoices = invoicesRes.data.map(toCamelCase);

      if (!lastSyncedAt) {
        const remoteIds = new Set(remoteInvoices.map((i: any) => i.localId));
        const localSynced = await db.invoices.where('syncStatus').equals('synced').toArray();
        const toDelete = localSynced.filter(i => !remoteIds.has(i.localId)).map(i => i.localId);
        if (toDelete.length > 0) await db.invoices.bulkDelete(toDelete);
      }

      await db.invoices.bulkPut(remoteInvoices.map((i: Invoice) => ({ ...i, syncStatus: 'synced' })));
    }

    if (quotesRes.data && quotesRes.data.length > 0) {
      const remoteQuotes = quotesRes.data.map(toCamelCase);

      if (!lastSyncedAt) {
        const remoteIds = new Set(remoteQuotes.map((q: any) => q.localId));
        const localSynced = await db.quotes.where('syncStatus').equals('synced').toArray();
        const toDelete = localSynced.filter(q => !remoteIds.has(q.localId)).map(q => q.localId);
        if (toDelete.length > 0) await db.quotes.bulkDelete(toDelete);
      }

      await db.quotes.bulkPut(remoteQuotes.map((q: Quote) => ({ ...q, syncStatus: 'synced' })));
    }
  }
}

export const syncEngine = new SyncEngine();
