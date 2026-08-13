import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { db } from '../db/db';

class NotificationService {
  private hasPermission = false;
  private unreadCount = 0;
  private realtimeChannel: any = null;

  constructor() {
    this.checkPermission();
  }

  private checkPermission() {
    if (!('Notification' in window)) return;
    this.hasPermission = Notification.permission === 'granted';
  }

  async requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      this.hasPermission = true;
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      return this.hasPermission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  showNotification(title: string, options?: NotificationOptions) {
    if (!this.hasPermission) return;
    
    try {
      const notification = new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      
      this.incrementBadge();
    } catch (e) {
      console.error('Error showing notification:', e);
    }
  }

  setAppBadge(count: number) {
    this.unreadCount = count;
    try {
      if ('setAppBadge' in navigator) {
        if (count > 0) {
          (navigator as any).setAppBadge(count);
        } else {
          (navigator as any).clearAppBadge();
        }
      }
    } catch (e) {
      console.error('Error setting app badge:', e);
    }
  }

  incrementBadge() {
    this.setAppBadge(this.unreadCount + 1);
  }

  clearBadge() {
    this.setAppBadge(0);
  }

  setupRealtimeListeners(userId: string) {
    if (!userId) return;
    
    // Clean up previous channel if it exists
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
    }

    // Subscribe to updates on invoices and quotes
    this.realtimeChannel = supabase.channel('client-interactions')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'invoices', filter: `user_id=eq.${userId}` },
        (payload) => {
          this.handleDocumentUpdate('Invoice', payload.old, payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quotes', filter: `user_id=eq.${userId}` },
        (payload) => {
          this.handleDocumentUpdate('Quote', payload.old, payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'clients', filter: `user_id=eq.${userId}` },
        (payload) => {
          this.handleDocumentUpdate('Client', payload.old, payload.new);
        }
      )
      .subscribe();
  }

  private async handleDocumentUpdate(type: 'Invoice' | 'Quote' | 'Client', oldDoc: any, newDoc: any) {
    let table: any;
    if (type === 'Invoice') table = db.invoices;
    else if (type === 'Quote') table = db.quotes;
    else table = db.clients;
    
    // Sync if document is being soft-deleted or purged, but don't show notification
    if (newDoc.deleted_at || newDoc.is_purged) {
      await this.syncLocalDatabase(type, newDoc, table);
      return;
    }

    if (newDoc.local_id) {
      const existing: any = await table.get(newDoc.local_id);
      
      // If it exists locally as deleted, but remote says it's not deleted, it's a restore
      if (existing && existing.deletedAt && !newDoc.deleted_at) {
        await this.syncLocalDatabase(type, newDoc, table);
        return;
      }
      
      if (existing && existing.status === newDoc.status) {
        return; // Status hasn't changed, ignore
      }
    } else if (oldDoc.status === newDoc.status) {
      return;
    }

    // Clients don't have a status that triggers notifications
    if (type === 'Client') return;

    const identifier = newDoc.invoice_number || newDoc.quote_number || 'Draft';
    let title = '';
    let body = '';

    if (newDoc.status === 'ACCEPTED') {
      title = `${type} Accepted! 🎉`;
      body = `Your client has accepted ${type.toLowerCase()} ${identifier}.`;
    } else if (newDoc.status === 'COUNTERED') {
      title = `${type} Countered`;
      body = `Your client has requested changes for ${type.toLowerCase()} ${identifier}.`;
    } else if (newDoc.status === 'PAID') {
      title = `Payment Received! 💸`;
      body = `${type} ${identifier} has been marked as paid.`;
    } else {
      // Don't notify for other status changes (like DRAFT -> SENT)
      // but STILL sync the local database!
      this.syncLocalDatabase(type, newDoc, table);
      return;
    }

    // Force sync the local database to get the latest status
    // since the server changed it (e.g. from a public link interaction)
    this.syncLocalDatabase(type, newDoc, table);

    this.showNotification(title, { body });
  }

  private async syncLocalDatabase(type: 'Invoice' | 'Quote' | 'Client', serverDoc: any, table: any) {
    try {
      const localId = serverDoc.local_id;
      
      if (localId) {
        // Find existing local document
        const existing = await table.get(localId);
        
        // Update local status to match the server if the document exists
        if (existing) {
          const updates: any = { updatedAt: serverDoc.updated_at };
          if (serverDoc.status !== undefined) updates.status = serverDoc.status;
          if (serverDoc.deleted_at !== undefined) updates.deletedAt = serverDoc.deleted_at;
          if (serverDoc.is_purged !== undefined) updates.isPurged = serverDoc.is_purged;
          
          await table.update(localId, updates);
          
          // Re-fetch items into Zustand store so the UI updates
          const store = useAppStore.getState();
          
          if (type === 'Invoice') {
            store.setSession(store.session); // Hack to trigger re-render if needed
          }
        }
      }
    } catch (error) {
      console.error('Error auto-syncing local DB after notification:', error);
    }
  }

  cleanup() {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }
}

export const notificationService = new NotificationService();
