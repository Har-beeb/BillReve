import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';


export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'QUOTE_ACCEPTED' | 'QUOTE_DECLINED' | 'QUOTE_COUNTERED' | 'INVOICE_PAID' | 'INVOICE_PARTIAL' | string;
  entity_id: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let channel: any;

    const fetchNotifications = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (isMounted) setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error && error.code !== '42P01') { 
          console.error(error);
        }
        
        if (isMounted) {
          setNotifications(data || []);
          setUnreadCount((data || []).filter(n => !n.is_read).length);

          // Use Math.random() for guaranteed uniqueness in StrictMode
          channel = supabase.channel(`notifications-${Math.random()}`);
          
          channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${session.user.id}`
            },
            (payload: any) => {
              if (payload.eventType === 'INSERT') {
                setNotifications(prev => [payload.new as Notification, ...prev]);
                // Trigger a sync when a client interacts (e.g. quote accepted)
                import('../services/syncEngine').then(({ syncEngine }) => {
                  // Clear last_sync_time to ensure we fetch the latest changes despite clock skew
                  localStorage.removeItem('last_sync_time');
                  syncEngine.sync();
                });
              } else if (payload.eventType === 'UPDATE') {
                setNotifications(prev => prev.map(n => n.id === payload.new.id ? (payload.new as Notification) : n));
              } else if (payload.eventType === 'DELETE') {
                setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
              }
            }
          ).subscribe();
        }

      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchNotifications();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Sync unread count whenever notifications change to ensure accuracy
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.is_read).length);
  }, [notifications]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
  };

  const clearAll = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    setNotifications([]);
    setUnreadCount(0);
    
    await supabase.from('notifications').delete().eq('user_id', session.user.id);
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    clearAll
  };
}
