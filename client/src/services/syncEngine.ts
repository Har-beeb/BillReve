import { db } from '../db/db';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

import toast from 'react-hot-toast';

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
      
      const syncStartTime = new Date().toISOString();
      await this.pullRemoteChanges();
      localStorage.setItem('last_sync_time', syncStartTime);
      
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

  private isAuthError(error: any): boolean {
    if (!error) return false;
    const msg = error.message?.toLowerCase() || '';
    return error.code === 'PGRST301' || msg.includes('jwt expired') || msg.includes('unauthorized') || error.status === 401;
  }

  private handleAuthError() {
    toast.error('Your online session has expired. Please sign in to resume cloud backups.', { id: 'auth-expired', duration: 6000 });
    // Update store state
    useAppStore.getState().setSession(null);
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
        
        if (this.isAuthError(error)) {
          this.handleAuthError();
          throw error; // Abort further sync this cycle
        }
        
        await db.syncQueue.update(item.id, { status: 'failed', error: String(error.message || error) });
      }
    }
  }

  private async pullRemoteChanges() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const userId = session.user.id;

    const lastSyncTime = localStorage.getItem('last_sync_time');

    // Helper to fetch in batches of 500 to prevent memory crashes on large datasets
    const fetchPaginated = async (table: string) => {
      let allData: any[] = [];
      let from = 0;
      const limit = 500;
      
      while (true) {
        let query = supabase
          .from(table)
          .select('*')
          .eq('user_id', userId);
          
        if (lastSyncTime) {
          query = query.gte('updated_at', lastSyncTime);
        }
        
        const { data, error } = await query.range(from, from + limit - 1);
          
        if (error) {
          if (this.isAuthError(error)) {
            this.handleAuthError();
            throw error;
          }
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

    const processRemoteData = async (table: any, remoteData: any[]) => {
      if (!remoteData || remoteData.length === 0) return;
      
      const remoteItems = remoteData.map(toCamelCase);
      const toDeleteLocally: string[] = [];
      const toPutLocally: any[] = [];

      for (const remote of remoteItems) {
        if (remote.isPurged) {
          toDeleteLocally.push(remote.localId);
          continue;
        }

        // Propagate soft-deletes across devices
        if (remote.deletedAt) {
          const local = await table.get(remote.localId);
          if (local && !local.deletedAt) {
            // Remote has been soft-deleted but local doesn't know yet
            toPutLocally.push({ ...remote, syncStatus: 'synced' });
          } else if (!local) {
            // Item doesn't exist locally yet but is deleted remotely — no need to create it
          } else {
            // Both sides know it's deleted, keep remote version
            toPutLocally.push({ ...remote, syncStatus: 'synced' });
          }
          continue;
        }

        const local = await table.get(remote.localId);
        if (local && local.syncStatus === 'pending') {

          // LWW: Last-Write-Wins logic
          const remoteTime = new Date(remote.updatedAt).getTime();
          const localTime = new Date(local.updatedAt).getTime();
          
          // Priority statuses from client interactions override local stale edits
          const isPriorityStatus = remote.status === 'ACCEPTED' || remote.status === 'COUNTERED' || remote.status === 'PAID' || remote.status === 'DECLINED';
          
          if (remoteTime > localTime || isPriorityStatus) {
            toPutLocally.push({ ...remote, syncStatus: 'synced' });
          }
          // else local wins, do nothing, it will push next cycle
        } else {
          toPutLocally.push({ ...remote, syncStatus: 'synced' });
        }
      }

      if (toDeleteLocally.length > 0) await table.bulkDelete(toDeleteLocally);
      if (toPutLocally.length > 0) await table.bulkPut(toPutLocally);
    };

    await Promise.all([
      processRemoteData(db.clients, clientsRes.data || []),
      processRemoteData(db.invoices, invoicesRes.data || []),
      processRemoteData(db.quotes, quotesRes.data || [])
    ]);
  }
}

export const syncEngine = new SyncEngine();

