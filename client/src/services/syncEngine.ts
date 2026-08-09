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

/**
 * SyncEngine is responsible for managing the bidirectional synchronization 
 * between the local IndexedDB and the remote Supabase PostgreSQL database.
 * It operates with an "offline-first" architecture, meaning local writes 
 * are prioritized and pushed to the cloud whenever connectivity is available.
 */
class SyncEngine {
  private isSyncing = false;
  private hasPendingSync = false;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private retryCount = 0;
  private maxRetries = 5;

  /**
   * Initializes the synchronization process and starts listening for changes.
   * 1. Performs an initial sync.
   * 2. Subscribes to remote Postgres changes via Supabase Realtime.
   * 3. Hooks into the local IndexedDB queue to trigger syncs on new local writes.
   * 4. Listens for browser 'online' events to resume syncing.
   */
  async start() {
    await this.sync();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    if (!this.channel) {
      this.channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          () => {
            this.sync();
          }
        )
        .subscribe();
    }

    // Auto-trigger sync when local changes are queued
    db.syncQueue.hook('creating', (_primKey, _obj, trans) => {
      trans.on('complete', () => {
        // Debounce slightly to prevent thrashing on rapid additions
        setTimeout(() => this.sync(), 500);
      });
    });

    window.addEventListener('online', () => {
      this.retryCount = 0;
      this.sync();
    });
  }

  /**
   * Stops all active subscriptions and listeners. Should be called upon logout 
   * or when the application unmounts to prevent memory leaks.
   */
  stop() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /**
   * Manually triggers a bi-directional synchronization.
   * Prevents concurrent syncs by marking pending attempts and processing them sequentially.
   * Handles both pushing local offline queue and pulling remote cloud changes.
   */
  async sync() {
    if (this.isSyncing) {
      this.hasPendingSync = true;
      return;
    }
    if (!navigator.onLine) return;
    
    this.isSyncing = true;
    useAppStore.getState().setSyncStatus('syncing');

    try {
      await this.pushLocalChanges();
      await this.pullRemoteChanges();
      
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
      if (this.hasPendingSync) {
        this.hasPendingSync = false;
        setTimeout(() => this.sync(), 100);
      }
    }
  }

  private async pushLocalChanges() {
    // Check if authenticated with Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const pendingItems = await db.syncQueue.where('status').equals('pending').sortBy('createdAt');
    
    for (const item of pendingItems) {
      try {
        const tableName = item.entity.toLowerCase() + 's'; // e.g. CLIENT -> clients
        const payloadSnakeCase = toSnakeCase(item.payload);
        
        // We always use local_id to match rows in Supabase
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

        // Successfully pushed to server, remove from queue
        await db.syncQueue.delete(item.id);
        
        // Update local status of the entity to synced
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

    // Helper to fetch in batches of 500 to prevent memory crashes on large datasets
    const fetchPaginated = async (table: string) => {
      let allData: any[] = [];
      let from = 0;
      const limit = 500;
      
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', userId)
          .range(from, from + limit - 1);
          
        if (error) {
          console.error(`Error paginating ${table}:`, error);
          break;
        }
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < limit) break;
        from += limit;
      }
      return { data: allData };
    };

    // Pull paginated data from Supabase for this user
    const [clientsRes, invoicesRes, quotesRes] = await Promise.all([
      fetchPaginated('clients'),
      fetchPaginated('invoices'),
      fetchPaginated('quotes')
    ]);

    if (clientsRes.data) {
      const remoteClients = clientsRes.data.map(toCamelCase);
      const remoteIds = new Set(remoteClients.map((c: any) => c.localId));
      const localSynced = await db.clients.where('syncStatus').equals('synced').toArray();
      const toDelete = localSynced.filter(c => !remoteIds.has(c.localId)).map(c => c.localId);
      if (toDelete.length > 0) await db.clients.bulkDelete(toDelete);
      
      await db.clients.bulkPut(remoteClients.map((c: Client) => ({ ...c, syncStatus: 'synced' })));
    }
    
    if (invoicesRes.data) {
      const remoteInvoices = invoicesRes.data.map(toCamelCase);
      const remoteIds = new Set(remoteInvoices.map((i: any) => i.localId));
      const localSynced = await db.invoices.where('syncStatus').equals('synced').toArray();
      const toDelete = localSynced.filter(i => !remoteIds.has(i.localId)).map(i => i.localId);
      if (toDelete.length > 0) await db.invoices.bulkDelete(toDelete);

      await db.invoices.bulkPut(remoteInvoices.map((i: Invoice) => ({ ...i, syncStatus: 'synced' })));
    }

    if (quotesRes.data) {
      const remoteQuotes = quotesRes.data.map(toCamelCase);
      const remoteIds = new Set(remoteQuotes.map((q: any) => q.localId));
      const localSynced = await db.quotes.where('syncStatus').equals('synced').toArray();
      const toDelete = localSynced.filter(q => !remoteIds.has(q.localId)).map(q => q.localId);
      if (toDelete.length > 0) await db.quotes.bulkDelete(toDelete);

      await db.quotes.bulkPut(remoteQuotes.map((q: Quote) => ({ ...q, syncStatus: 'synced' })));
    }
  }
}

export const syncEngine = new SyncEngine();

