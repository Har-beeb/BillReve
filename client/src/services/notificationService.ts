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
      .subscribe();
  }

  private handleDocumentUpdate(type: 'Invoice' | 'Quote', oldDoc: any, newDoc: any) {
    // Only trigger if status changed
    if (oldDoc.status === newDoc.status) return;

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
      // Don't notify for other status changes (like DRAFT -> PENDING)
      return;
    }

    // Force sync the local database to get the latest status
    // since the server changed it (e.g. from a public link interaction)
    this.syncLocalDatabase(type, newDoc);

    this.showNotification(title, { body });
  }

  private async syncLocalDatabase(type: 'Invoice' | 'Quote', serverDoc: any) {
    try {
      const table = type === 'Invoice' ? db.invoices : db.quotes;
      const localId = serverDoc.local_id;
      
      if (localId) {
        // Find existing local document
        const existing = await table.get(localId);
        
        // Update local status to match the server if the document exists
        if (existing) {
          await table.update(localId, { status: serverDoc.status, updatedAt: serverDoc.updated_at });
          
          // Re-fetch items into Zustand store so the UI updates
          const store = useAppStore.getState();
          
          if (type === 'Invoice') {
            store.setSession(store.session); // Hack to trigger re-render if needed, though Zustand array mutation handles it better
            // A better way is to update the item in the array if we expose an update function
            // For now, we will rely on SyncEngine which runs periodically to catch this up,
            // but the status is instantly patched in Dexie.
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
