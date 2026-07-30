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
  isProUser: boolean;
  syncStatus: SyncStatus;
  isSidebarExpanded: boolean;
  theme: Theme;
  colorTheme: 'default' | 'wine' | 'ocean' | 'emerald' | 'slate' | 'sunset' | 'mustard' | 'cherry' | 'custom';
  customColor: string;
  fontFamily: 'Inter' | 'Roboto' | 'Playfair Display' | 'monospace';
  fontSize: 'small' | 'medium' | 'large';
  mobileNavStyle: 'drawer' | 'bottom';
  clients: Client[];
  quotes: Quote[];
  invoices: Invoice[];
  businessProfile: BusinessProfile;
  taxSettings: TaxSetting[];
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
 * Zustand global store with persistence.
 * Currently configured to only persist UI settings (theme, sidebar) and 
 * business profile/tax settings to localStorage.
 * 
 * Note: Data entities (invoices, quotes, clients) will eventually be 
 * fetched from the Node.js backend.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isProUser: false, // Default to free tier for MVP
      syncStatus: 'synced',
      isSidebarExpanded: false, // Collapsed by default
      theme: 'light',
      colorTheme: 'default',
      customColor: '#8b5cf6', // default tailwind violet-500
      fontFamily: 'Inter',
      fontSize: 'medium',
      mobileNavStyle: 'drawer', // Default to bottom nav based on user preference
      clients: [],
      quotes: [],
      invoices: [],
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
        return { theme: newTheme };
      }),
      setColorTheme: (colorTheme) => {
        const root = document.documentElement;
        // Clean up previous themes
        root.classList.remove('theme-wine', 'theme-ocean', 'theme-emerald', 'theme-slate', 'theme-sunset', 'theme-mustard', 'theme-cherry', 'theme-custom');
        
        if (colorTheme !== 'default') {
          root.classList.add(`theme-${colorTheme}`);
        }

        // Handle inline custom color logic
        if (colorTheme === 'custom') {
          root.style.setProperty('--color-purple-600', useAppStore.getState().customColor);
        } else {
          root.style.removeProperty('--color-purple-600');
        }

        set({ colorTheme });
      },
      setCustomColor: (customColor) => {
        set({ customColor });
        if (useAppStore.getState().colorTheme === 'custom') {
          document.documentElement.style.setProperty('--color-purple-600', customColor);
        }
      },
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setFontSize: (fontSize) => set({ fontSize }),
      setMobileNavStyle: (style) => set({ mobileNavStyle: style }),
      addClient: (client) => set((state) => ({ clients: [...state.clients, client] })),
      addQuote: (quote) => set((state) => ({ quotes: [...state.quotes, quote] })),
      addInvoice: (invoice) => set((state) => ({ invoices: [...state.invoices, invoice] })),
      updateBusinessProfile: (profile) => set({ businessProfile: profile }),
      updateTaxSettings: (settings) => set({ taxSettings: settings }),
      setSession: (session) => {
        set({ 
          session, 
          user: session?.user || null, 
          isAuthenticated: !!session 
        });
      },
      logout: async () => {
        await supabase.auth.signOut();
        
        // Reset state so Zustand overwrites local storage with clean defaults
        set({ 
          user: null, 
          session: null, 
          isAuthenticated: false,
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
        
        // Clear offline data to prevent data leakage between users
        try {
          // Dynamic import of db to avoid circular dependency issues if any
          const { db } = await import('../db/db');
          await Promise.all([
            db.clients.clear(),
            db.quotes.clear(),
            db.invoices.clear(),
            db.syncQueue.clear()
          ]);
          
          // Clear any remaining storage
          localStorage.removeItem('billflow-storage');
          
          // Delay reload slightly to ensure Zustand finishes writing/clearing
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
          taxSettings: state.taxSettings
        };
      }, // Supabase handles auth session persistence automatically, we don't need to persist it here.
    }
  )
);
