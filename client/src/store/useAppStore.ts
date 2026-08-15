import { toast } from 'react-hot-toast';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Client, Quote, Invoice, BusinessProfile, TaxSetting } from '../types';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Theme = 'light' | 'dark';
type SyncStatus = 'synced' | 'syncing' | 'pending' | 'failed';

/**
 * Global application state interface.
 * Contains both data (clients, invoices) and UI state (theme, sidebar).
 */
interface AppState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isProUser: boolean;
  hasSkippedOnboarding: boolean;
  syncStatus: SyncStatus;
  isSidebarExpanded: boolean;
  theme: Theme;
  colorTheme: 'default' | 'wine' | 'ocean' | 'emerald' | 'slate' | 'sunset' | 'mustard' | 'cherry' | 'custom';
  customColor: string;
  fontFamily: 'Inter' | 'Roboto' | 'Playfair Display' | 'monospace' | 'Outfit' | 'Plus Jakarta Sans' | 'Lora' | 'Fira Code';
  fontSize: 'small' | 'medium' | 'large';
  mobileNavStyle: 'drawer' | 'bottom';
  clients: Client[];
  quotes: Quote[];
  invoices: Invoice[];
  businessProfile: BusinessProfile;
  taxSettings: TaxSetting[];
  userPreferences: Record<string, any>;
  setInitialized: (initialized: boolean) => void;
  setHasSkippedOnboarding: (skipped: boolean) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setProUser: (isPro: boolean) => void;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  setColorTheme: (theme: 'default' | 'wine' | 'ocean' | 'emerald' | 'slate' | 'sunset' | 'mustard' | 'cherry' | 'custom') => void;
  setCustomColor: (color: string) => void;
  setFontFamily: (font: AppState['fontFamily']) => void;
  setFontSize: (size: AppState['fontSize']) => void;
  setMobileNavStyle: (style: 'drawer' | 'bottom') => void;
  addClient: (client: Client) => void;
  addQuote: (quote: Quote) => void;
  addInvoice: (invoice: Invoice) => void;
  updateBusinessProfile: (profile: BusinessProfile) => void;
  updateTaxSettings: (settings: TaxSetting[]) => void;
  setSession: (session: Session | null) => void;
  logout: () => Promise<void>;
}

/**
 * Zustand global store with persistence for UI settings.
 * 
 * Note on Architecture: This store only manages non-volatile UI state (theme, sidebar),
 * authenticated user session, and business profiles. 
 * Data entities (invoices, quotes, clients) are managed entirely by IndexedDB (Dexie) 
 * via the SyncEngine for offline-first capabilities, and are NOT stored here to prevent 
 * Zustand persistence bloat.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isInitialized: false,
      isProUser: false, // Default to free tier for MVP
      hasSkippedOnboarding: false,
      syncStatus: 'synced',
      isSidebarExpanded: true, // Collapsed by default
      theme: 'light',
      colorTheme: 'default',
      customColor: '#8b5cf6', // default tailwind violet-500
      fontFamily: 'Inter',
      fontSize: 'medium',
      mobileNavStyle: 'drawer', // Default to bottom nav based on user preference
      clients: [],
      quotes: [],
      invoices: [],
      userPreferences: {},
      businessProfile: {
        name: 'BillReve',
        email: 'hello@billreve.app',
        phone: '+234 123 456 7890',
        address: 'Lagos, Nigeria',
        bankAccounts: [],
        country: 'NG',
        currency: 'NGN'
      },
      taxSettings: [
        { id: '1', name: 'VAT (7.5%)', rate: 7.5, isDeduction: false, isActive: false },
        { id: '2', name: 'WHT (5%)', rate: 5, isDeduction: true, isActive: false }
      ],
      setInitialized: (initialized) => set({ isInitialized: initialized }),
      setHasSkippedOnboarding: (skipped) => set({ hasSkippedOnboarding: skipped }),
      setSyncStatus: (status) => set({ syncStatus: status }),
      setProUser: (isPro) => set({ isProUser: isPro }),
      toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
      toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        const userId = state.user?.id || 'default';
        const prefs = state.userPreferences[userId] || {};
        return { 
          theme: newTheme,
          userPreferences: {
            ...state.userPreferences,
            [userId]: { ...prefs, theme: newTheme }
          }
        };
      }),
      setColorTheme: (colorTheme) => set((state) => {
        const root = document.documentElement;
        root.classList.remove('theme-wine', 'theme-ocean', 'theme-emerald', 'theme-slate', 'theme-sunset', 'theme-mustard', 'theme-cherry', 'theme-custom');
        if (colorTheme !== 'default') root.classList.add(`theme-${colorTheme}`);
        if (colorTheme === 'custom') {
          root.style.setProperty('--color-purple-600', state.customColor);
        } else {
          root.style.removeProperty('--color-purple-600');
        }
        
        const userId = state.user?.id || 'default';
        const prefs = state.userPreferences[userId] || {};
        return { 
          colorTheme,
          userPreferences: {
            ...state.userPreferences,
            [userId]: { ...prefs, colorTheme }
          }
        };
      }),
      setCustomColor: (customColor) => set((state) => {
        if (state.colorTheme === 'custom') {
          document.documentElement.style.setProperty('--color-purple-600', customColor);
        }
        const userId = state.user?.id || 'default';
        const prefs = state.userPreferences[userId] || {};
        return { 
          customColor,
          userPreferences: {
            ...state.userPreferences,
            [userId]: { ...prefs, customColor }
          }
        };
      }),
      setFontFamily: (fontFamily) => set((state) => {
        const userId = state.user?.id || 'default';
        const prefs = state.userPreferences[userId] || {};
        return { fontFamily, userPreferences: { ...state.userPreferences, [userId]: { ...prefs, fontFamily } } };
      }),
      setFontSize: (fontSize) => set((state) => {
        const userId = state.user?.id || 'default';
        const prefs = state.userPreferences[userId] || {};
        return { fontSize, userPreferences: { ...state.userPreferences, [userId]: { ...prefs, fontSize } } };
      }),
      setMobileNavStyle: (style) => set((state) => {
        const userId = state.user?.id || 'default';
        const prefs = state.userPreferences[userId] || {};
        return { mobileNavStyle: style, userPreferences: { ...state.userPreferences, [userId]: { ...prefs, mobileNavStyle: style } } };
      }),
      addClient: (client) => set((state) => ({ clients: [...state.clients, client] })),
      addQuote: (quote) => set((state) => ({ quotes: [...state.quotes, quote] })),
      addInvoice: (invoice) => set((state) => ({ invoices: [...state.invoices, invoice] })),
      updateBusinessProfile: (profile) => set({ businessProfile: profile }),
      updateTaxSettings: (settings) => set({ taxSettings: settings }),
      setSession: (session) => set((state) => {
        const userId = session?.user?.id;
        const newUpdates: any = {
          session,
          user: session?.user || null,
          isAuthenticated: !!session
        };
        
        if (userId) {
          const prefs = state.userPreferences[userId];
          if (prefs) {
            if (prefs.theme) newUpdates.theme = prefs.theme;
            if (prefs.colorTheme) newUpdates.colorTheme = prefs.colorTheme;
            if (prefs.customColor) newUpdates.customColor = prefs.customColor;
            if (prefs.fontFamily) newUpdates.fontFamily = prefs.fontFamily;
            if (prefs.fontSize) newUpdates.fontSize = prefs.fontSize;
            if (prefs.mobileNavStyle) newUpdates.mobileNavStyle = prefs.mobileNavStyle;
            
            if (prefs.theme === 'dark') document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
            
            const root = document.documentElement;
            root.classList.remove('theme-wine', 'theme-ocean', 'theme-emerald', 'theme-slate', 'theme-sunset', 'theme-mustard', 'theme-cherry', 'theme-custom');
            if (prefs.colorTheme && prefs.colorTheme !== 'default') {
              root.classList.add(`theme-${prefs.colorTheme}`);
            }
            if (prefs.colorTheme === 'custom' && prefs.customColor) {
              root.style.setProperty('--color-purple-600', prefs.customColor);
            } else {
              root.style.removeProperty('--color-purple-600');
            }
          }
        }
        
        return newUpdates;
      }),
      logout: async () => {
        try {
          const { syncEngine } = await import('../services/syncEngine');
          const { db } = await import('../db/db');
          
          toast.loading("Syncing data before logout...", { id: "logout-sync" });
          await syncEngine.sync();
          
          const pendingSyncs = await db.syncQueue.count();
          if (pendingSyncs > 0) {
            toast.error("Cannot logout: You have unsynced data and appear to be offline. Please connect to the internet first.", { id: "logout-sync", duration: 5000 });
            return;
          }
          toast.success("Sync complete.", { id: "logout-sync" });
        } catch (e) {
          console.error("Sync before logout failed", e);
          toast.error("Failed to sync data before logout. Please check your connection.", { id: "logout-sync", duration: 5000 });
          return;
        }
        
        await supabase.auth.signOut();
        
        document.documentElement.classList.remove('dark', 'theme-wine', 'theme-ocean', 'theme-emerald', 'theme-slate', 'theme-sunset', 'theme-mustard', 'theme-cherry', 'theme-custom');
        document.documentElement.style.removeProperty('--color-purple-600');
        
        set({ 
          user: null, 
          session: null, 
          isAuthenticated: false,
          theme: 'light',
          colorTheme: 'default',
          customColor: '#8b5cf6',
          fontFamily: 'Inter',
          fontSize: 'medium',
          mobileNavStyle: 'drawer',
          businessProfile: {
            name: 'BillReve',
            email: 'hello@billreve.app',
            phone: '+234 123 456 7890',
            address: 'Lagos, Nigeria',
            country: 'Nigeria',
            currency: 'NGN',
            bankAccounts: []
          },
          taxSettings: [
            { id: '1', name: 'VAT (7.5%)', rate: 7.5, isDeduction: false, isActive: false },
            { id: '2', name: 'WHT (5%)', rate: 5, isDeduction: true, isActive: false }
          ]
        });
        
        try {
          const { db } = await import('../db/db');
          await Promise.all([
            db.clients.clear(),
            db.quotes.clear(),
            db.invoices.clear(),
            db.syncQueue.clear()
          ]);
          
          localStorage.removeItem('last_sync_time');
          
          setTimeout(() => {
             window.location.reload(); 
          }, 100);
        } catch (e) {
          console.error("Failed to clear local DB on logout:", e);
        }
      }
    }),
    {
      name: 'billreve-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => {
        // Migration for bankAccounts
        const profile: any = { ...state.businessProfile };
        if (!profile.bankAccounts) {
          profile.bankAccounts = [];
          if (profile.bankName || profile.accountName || profile.accountNumber) {
            profile.bankAccounts.push({
              id: 'default',
              bankName: profile.bankName || '',
              accountName: profile.accountName || '',
              accountNumber: profile.accountNumber || '',
              isDefault: true
            });
            delete profile.bankName;
            delete profile.accountName;
            delete profile.accountNumber;
          }
        }
        
        return {
          theme: state.theme,
          colorTheme: state.colorTheme,
          customColor: state.customColor,
          fontFamily: state.fontFamily,
          fontSize: state.fontSize,
          mobileNavStyle: state.mobileNavStyle,
          isSidebarExpanded: state.isSidebarExpanded,
          businessProfile: profile as BusinessProfile,
          taxSettings: state.taxSettings,
          isProUser: state.isProUser,
          hasSkippedOnboarding: state.hasSkippedOnboarding,
          userPreferences: state.userPreferences
        };
      }, // Supabase handles auth session persistence automatically, we don't need to persist it here.
    }
  )
);
