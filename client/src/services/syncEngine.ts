import { db } from '../db/db';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { SyncQueueItem } from '../types';

import toast from 'react-hot-toast';

export let serverTimeOffsetMs = 0;

export const getAccurateIsoDate = () => {
  return new Date(Date.now() + serverTimeOffsetMs).toISOString();
};

export const syncServerTime = async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }
    });
    const dateHeader = res.headers.get('Date');
    if (dateHeader) {
      serverTimeOffsetMs = new Date(dateHeader).getTime() - Date.now();
    }
  } catch (e) {
    // Fail silently, use local time
  }
};

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
  private isStarted = false; // Guard: prevents duplicate listeners from registering
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private retryCount = 0;
  private maxRetries = 5;
  private maxQueueRetries = 5;
  private syncDebounceTimer: any = null;
  private pollingInterval: any = null;
  private queueRetryTimer: ReturnType<typeof setTimeout> | null = null;
  
  // References for cleanup
  private onlineListener: (() => void) | null = null;
  private dexieHookListener: any = null;
  private visibilityListener: (() => void) | null = null;

  /**
   * Initializes the synchronization process and starts listening for changes.
   * This method is IDEMPOTENT — it is safe to call multiple times. All listener
   * registration is guarded by isStarted so they only register once per session.
   * Steps:
   * 1. Performs initial sync of local queue and remote db.
   * 2. Opens real-time channel to listen for row-level Postgres changes.
   * 3. Hooks into Dexie IndexedDB to auto-queue user's local edits for sync.
   * 4. Listens for browser 'online' events to resume syncing.
   */
  async start() {
    // Run an initial sync on every call (App mount, auth state change, etc.)
    // This is intentional and safe because sync() has its own isSyncing guard.
    await this.sync();

    // BUT only register listeners once per session lifetime.
    if (this.isStarted) return;
    this.isStarted = true;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    const { data: orgMember } = await supabase.from('organization_members').select('organization_id').eq('user_id', session.user.id).limit(1).single();
    if (!orgMember) return;
    const orgId = orgMember.organization_id;
    
    await syncServerTime();
    
    if (!this.channel) {
      this.channel = supabase
        .channel(`user-changes-${session.user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'clients', filter: `organization_id=eq.${orgId}` },
          () => {
            this.sync();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'invoices', filter: `organization_id=eq.${orgId}` },
          () => {
            this.sync();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quotes', filter: `organization_id=eq.${orgId}` },
          () => {
            this.sync();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'recurring_schedules', filter: `organization_id=eq.${orgId}` },
          () => {
            this.sync();
          }
        )
        .subscribe();
    }

    // Auto-trigger sync when local changes are queued
    this.dexieHookListener = (_primKey: any, _obj: any, trans: any) => {
      trans.on('complete', () => {
        // Proper debounce to prevent thrashing on rapid additions
        if (this.syncDebounceTimer) {
          clearTimeout(this.syncDebounceTimer);
        }
        this.syncDebounceTimer = setTimeout(() => this.sync(), 500);
      });
    };
    db.syncQueue.hook('creating', this.dexieHookListener);

    this.onlineListener = () => {
      this.retryCount = 0;
      this.sync();
    };
    window.addEventListener('online', this.onlineListener);

    // Heartbeat fallback polling (Adaptive based on visibility)
    if (!this.visibilityListener) {
      this.visibilityListener = () => {
        if (document.hidden) {
          // Stop polling entirely when the tab is hidden.
          // A slow interval still causes Chrome to queue up all "missed" ticks
          // and fire them in a rapid burst when the tab returns.
          // Stopping completely + one immediate sync on return is cleaner.
          if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
          }
          if (this.queueRetryTimer) {
            clearTimeout(this.queueRetryTimer);
            this.queueRetryTimer = null;
          }
        } else {
          // Tab is visible again — do one immediate sync, then restart normal polling.
          this.sync();
          if (this.pollingInterval) clearInterval(this.pollingInterval);
          this.pollingInterval = setInterval(() => this.sync(), 10000);
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);
    }
    
    // Initial interval
    this.pollingInterval = setInterval(() => {
      this.sync();
    }, 10000);
  }

  /**
   * Stops all active subscriptions and listeners. Should be called upon logout 
   * or when the application unmounts to prevent memory leaks.
   * Resets isStarted so start() can be called again on next login.
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener);
      this.onlineListener = null;
    }
    if (this.dexieHookListener) {
      db.syncQueue.hook('creating').unsubscribe(this.dexieHookListener);
      this.dexieHookListener = null;
    }
    if (this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
    this.isStarted = false; // Allow re-registration on next login
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
      
      const failedQueueItems = await db.syncQueue.where('status').equals('failed').count();
      useAppStore.getState().setSyncStatus(failedQueueItems > 0 ? 'failed' : 'synced');
      await this.scheduleQueueRetry();
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
    if (!session?.user) return;
    const { data: orgMember } = await supabase.from('organization_members').select('organization_id').eq('user_id', session.user.id).limit(1).single();
    if (!orgMember) return;
    const orgId = orgMember.organization_id;

    const now = Date.now();
    const queuedItems = await db.syncQueue.toArray();
    const pendingItems = queuedItems
      .filter((item) => {
        if (item.status === 'pending') {
          return !item.nextRetryAt || new Date(item.nextRetryAt).getTime() <= now;
        }

        if (item.status === 'failed') {
          return (item.retryCount || 0) < this.maxQueueRetries &&
            Boolean(item.nextRetryAt) &&
            new Date(item.nextRetryAt as string).getTime() <= now;
        }
        return false;
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    
    for (const item of pendingItems) {
      try {
        const tableName = item.entity.toLowerCase() + 's'; // e.g. CLIENT -> clients
        const payloadSnakeCase = toSnakeCase(item.payload);
        
        // Strip out invalid columns if they accidentally got into the queue
        if (tableName === 'invoices') {
          delete payloadSnakeCase.minimum_counter_amount;
          delete payloadSnakeCase.allow_counter_offer;
        }
        if (tableName === 'quotes') {
          // quotes table does not have bank_account_snapshot — strip it to prevent PGRST204
          delete payloadSnakeCase.bank_account_snapshot;
        }

        // We always use local_id to match rows in Supabase
        if (item.action === 'CREATE') {
          const { error } = await supabase
            .from(tableName)
            .upsert({ ...payloadSnakeCase, organization_id: orgId }, { onConflict: 'organization_id,local_id' });
            
          if (error) throw error;
          
        } else if (item.action === 'UPDATE') {
          // Force updated_at so that remote pulls (which filter by updated_at) will catch this change
          payloadSnakeCase.updated_at = getAccurateIsoDate();
          
          const { error } = await supabase
            .from(tableName)
            .update({ ...payloadSnakeCase, organization_id: orgId })
            .eq('local_id', payloadSnakeCase.local_id)
            .eq('organization_id', orgId);
            
          if (error) throw error;
          
        } else if (item.action === 'DELETE') {
          const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('local_id', payloadSnakeCase.local_id)
            .eq('organization_id', orgId);
            
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
          } else if (item.entity === 'RECURRING_SCHEDULE') {
            await db.recurringSchedules.update(entityId as string, { syncStatus: 'synced' });
          }
        }

      } catch (error: any) {
        console.error(`Failed to push queue item ${item.id}`, error);
        
        if (this.isAuthError(error)) {
          this.handleAuthError();
          throw error; // Abort further sync this cycle
        }
        
        const retryCount = (item.retryCount || 0) + 1;
        const canRetry = retryCount < this.maxQueueRetries;
        await db.syncQueue.update(item.id, {
          status: 'failed',
          error: String(error.message || error),
          retryCount,
          lastAttemptAt: getAccurateIsoDate(),
          nextRetryAt: canRetry
            ? new Date(Date.now() + Math.pow(2, retryCount - 1) * 5000).toISOString()
            : undefined,
        });
      }
    }
  }

  async discardFailedItem(item: SyncQueueItem) {
    if (item.status !== 'failed') {
      throw new Error('Only failed sync items can be discarded.');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('You must be signed in to discard a failed sync item.');

    const { data: orgMember, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .limit(1)
      .single();
    if (membershipError || !orgMember) {
      throw new Error('Unable to resolve your organization.');
    }

    const tableNameByEntity = {
      CLIENT: 'clients',
      INVOICE: 'invoices',
      QUOTE: 'quotes',
      RECURRING_SCHEDULE: 'recurring_schedules',
    } as const;
    const tableName = tableNameByEntity[item.entity];
    const localId = item.payload.local_id || item.payload.localId;
    if (typeof localId !== 'string' || !localId) {
      throw new Error('Failed sync item has no local record ID.');
    }

    const { data: remote, error: remoteError } = await supabase
      .from(tableName)
      .select('*')
      .eq('organization_id', orgMember.organization_id)
      .eq('local_id', localId)
      .maybeSingle();
    if (remoteError) {
      throw new Error(`Unable to reconcile failed sync item: ${remoteError.message}`);
    }

    const restored = remote ? { ...toCamelCase(remote), syncStatus: 'synced' } : null;
    if (item.entity === 'CLIENT') {
      if (restored) await db.clients.put(restored);
      else await db.clients.delete(localId);
    } else if (item.entity === 'INVOICE') {
      if (restored) await db.invoices.put(restored);
      else await db.invoices.delete(localId);
    } else if (item.entity === 'QUOTE') {
      if (restored) await db.quotes.put(restored);
      else await db.quotes.delete(localId);
    } else {
      if (restored) await db.recurringSchedules.put(restored);
      else await db.recurringSchedules.delete(localId);
    }

    await db.syncQueue.delete(item.id);
  }

  private async scheduleQueueRetry() {
    if (this.queueRetryTimer) {
      clearTimeout(this.queueRetryTimer);
      this.queueRetryTimer = null;
    }

    const now = Date.now();
    const retryTimes = (await db.syncQueue.where('status').equals('failed').toArray())
      .filter((item) =>
        (item.retryCount || 0) < this.maxQueueRetries &&
        Boolean(item.nextRetryAt)
      )
      .map((item) => new Date(item.nextRetryAt as string).getTime())
      .filter((time) => Number.isFinite(time) && time > now);

    if (retryTimes.length === 0 || !navigator.onLine) return;

    const delay = Math.max(Math.min(...retryTimes) - now, 1000);
    this.queueRetryTimer = setTimeout(() => {
      this.queueRetryTimer = null;
      this.sync();
    }, delay);
  }

  private async pullRemoteChanges() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data: orgMember } = await supabase.from('organization_members').select('organization_id').eq('user_id', session.user.id).limit(1).single();
    if (!orgMember) return;
    const orgId = orgMember.organization_id;

    // Helper to fetch in batches of 500 to prevent memory crashes on large datasets
    const fetchPaginated = async (table: string) => {
      const lastSyncTime = localStorage.getItem(`last_sync_time_${table}`);
      let allData: any[] = [];
      let from = 0;
      const limit = 500;
      
      while (true) {
        let query = supabase
          .from(table)
          .select('*')
          .eq('organization_id', orgId)
          .order('updated_at', { ascending: true })
          .order('local_id', { ascending: true });
          
        if (lastSyncTime) {
          query = query.gt('updated_at', lastSyncTime);
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
        
        allData.push(...data);
        if (data.length < limit) break;
        from += limit;
      }
      return { data: allData };
    };

    // Pull paginated data from Supabase for this user.
    //
    // recurring_schedules MUST be included. It was pushed but never pulled,
    // so a schedule created on one device existed in Postgres but could never
    // come back down — it vanished on logout (which clears Dexie) and never
    // appeared on a second device. The Dashboard MRR card reads from the local
    // table, so it silently read zero.
    const [clientsRes, invoicesRes, quotesRes, recurringRes] = await Promise.all([
      fetchPaginated('clients'),
      fetchPaginated('invoices'),
      fetchPaginated('quotes'),
      fetchPaginated('recurring_schedules')
    ]);

    const processRemoteData = async (tableName: string, table: any, remoteData: any[]) => {
      let maxUpdatedAt = localStorage.getItem(`last_sync_time_${tableName}`) || '';
      
      if (!remoteData || remoteData.length === 0) {
        if (!localStorage.getItem(`last_sync_time_${tableName}`)) {
          localStorage.setItem(`last_sync_time_${tableName}`, getAccurateIsoDate());
        }
        return;
      }
      
      const remoteItems = remoteData.map(toCamelCase);
      const toDeleteLocally: string[] = [];
      const toPutLocally: any[] = [];

      for (const remote of remoteItems) {
        const remoteTime = remote.updatedAt; // Use raw ISO string to preserve microsecond precision
        if (remoteTime > maxUpdatedAt) {
          maxUpdatedAt = remoteTime;
        }

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
            // Item doesn't exist locally yet but is deleted remotely — create it so it shows in Trash
            toPutLocally.push({ ...remote, syncStatus: 'synced' });
          } else {
            // Both sides know it's deleted, keep remote version
            toPutLocally.push({ ...remote, syncStatus: 'synced' });
          }
          continue;
        }

        const local = await table.get(remote.localId);
        if (local && local.syncStatus === 'pending') {

          // LWW: Last-Write-Wins logic (adjusted for local clock drift)
          const localTime = new Date(local.updatedAt).getTime() + serverTimeOffsetMs;
          const remoteTimeMs = new Date(remoteTime).getTime();
          
          // Priority statuses from client interactions override local stale edits
          const isPriorityStatus = remote.status === 'ACCEPTED' || remote.status === 'COUNTERED' || remote.status === 'PAID' || remote.status === 'DECLINED';
          
          if (remoteTimeMs > localTime || isPriorityStatus) {
            toPutLocally.push({ ...remote, syncStatus: 'synced' });
          }
          // else local wins, do nothing, it will push next cycle
        } else {
          toPutLocally.push({ ...remote, syncStatus: 'synced' });
        }
      }

      if (toDeleteLocally.length > 0) await table.bulkDelete(toDeleteLocally);
      if (toPutLocally.length > 0) await table.bulkPut(toPutLocally);
      
      if (maxUpdatedAt !== '') {
        localStorage.setItem(`last_sync_time_${tableName}`, maxUpdatedAt);
      }
    };

    await Promise.all([
      processRemoteData('clients', db.clients, clientsRes.data || []),
      processRemoteData('invoices', db.invoices, invoicesRes.data || []),
      processRemoteData('quotes', db.quotes, quotesRes.data || []),
      processRemoteData('recurring_schedules', db.recurringSchedules, recurringRes.data || [])
    ]);
  }
}

export const syncEngine = new SyncEngine();
