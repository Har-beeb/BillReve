import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import MainLayout from './layouts/MainLayout';
import PublicLayout from './layouts/PublicLayout';
import { useLocation } from 'react-router-dom';
import { UpdatePrompt } from './components/ui/UpdatePrompt';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Quotes = React.lazy(() => import('./pages/Quotes'));
const Invoices = React.lazy(() => import('./pages/Invoices'));
const Clients = React.lazy(() => import('./pages/Clients'));
const Settings = React.lazy(() => import('./pages/Settings'));
const DocumentEditor = React.lazy(() => import('./pages/DocumentEditor'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/ResetPassword'));
const PublicInvoice = React.lazy(() => import('./pages/PublicInvoice'));
const PublicQuote = React.lazy(() => import('./pages/PublicQuote'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Campaigns = React.lazy(() => import('./pages/Campaigns'));
const Trash = React.lazy(() => import('./pages/Trash'));
const Payments = React.lazy(() => import('./pages/Payments'));
const Support = React.lazy(() => import('./pages/Support'));
const Upgrade = React.lazy(() => import('./pages/Upgrade'));
const Privacy = React.lazy(() => import('./pages/Privacy'));
const Terms = React.lazy(() => import('./pages/Terms'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const PublicAbout = React.lazy(() => import('./pages/public/About'));
const Changelog = React.lazy(() => import('./pages/public/Changelog'));
const HelpCenter = React.lazy(() => import('./pages/public/HelpCenter'));
const Documentation = React.lazy(() => import('./pages/public/Documentation'));
const Guides = React.lazy(() => import('./pages/public/Guides'));
const Templates = React.lazy(() => import('./pages/public/Templates'));
const Contact = React.lazy(() => import('./pages/public/Contact'));
import { useAppStore } from './store/useAppStore';
import { supabase } from './lib/supabase';
import { syncEngine } from './services/syncEngine';
import { notificationService } from './services/notificationService';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" />;
};

const ThemeController = () => {
  const { pathname } = useLocation();
  const theme = useAppStore(state => state.theme);
  const colorTheme = useAppStore(state => state.colorTheme);
  const fontSize = useAppStore(state => state.fontSize);

  useEffect(() => {
    // Dark mode applies everywhere
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const root = document.documentElement;
    root.classList.remove('theme-wine', 'theme-ocean', 'theme-emerald', 'theme-slate', 'theme-sunset', 'theme-mustard', 'theme-cherry', 'theme-custom');
    root.style.removeProperty('--color-purple-600');
    
    // Apply font size globally
    if (fontSize === 'small') {
      root.style.fontSize = '14px';
    } else if (fontSize === 'large') {
      root.style.fontSize = '18px';
    } else {
      root.style.fontSize = '16px';
    }

    const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/', '/privacy', '/terms', '/about', '/changelog', '/help', '/guides', '/templates', '/contact'];
    const isPublicRoute = publicPaths.includes(pathname) || pathname.startsWith('/pay/') || pathname.startsWith('/quote/');

    if (!isPublicRoute) {
      if (colorTheme !== 'default') {
        root.classList.add(`theme-${colorTheme}`);
      }

      if (colorTheme === 'custom') {
        root.style.setProperty('--color-purple-600', useAppStore.getState().customColor);
      }
    }
  }, [pathname, theme, colorTheme, fontSize]);

  return null;
};

function App() {
  const setSession = useAppStore(state => state.setSession);
  const isInitialized = useAppStore(state => state.isInitialized);

  useEffect(() => {
    const fetchProfile = async (sessionUser: any) => {
      if (sessionUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_pro, pro_expires_at, name, email, phone, address, bank_name, account_name, account_number, country, currency, logo_url, industry, business_description')
          .eq('id', sessionUser.id)
          .single();
          
        if (profile) {
          const isProActive = profile.is_pro && (!profile.pro_expires_at || new Date(profile.pro_expires_at) > new Date());
          useAppStore.getState().setProUser(isProActive);
          
          // Hydrate business profile from database
          const store = useAppStore.getState();
          store.updateBusinessProfile({
            ...store.businessProfile,
            name: profile.name || store.businessProfile.name,
            email: profile.email || store.businessProfile.email,
            phone: profile.phone || store.businessProfile.phone,
            address: profile.address || store.businessProfile.address,
            country: profile.country || store.businessProfile.country,
            currency: profile.currency || store.businessProfile.currency,
            logoUrl: profile.logo_url || store.businessProfile.logoUrl,
            industry: profile.industry || store.businessProfile.industry,
            businessDescription: profile.business_description || store.businessProfile.businessDescription,
            bankAccounts: profile.bank_name ? [
              {
                id: '1',
                bankName: profile.bank_name || '',
                accountName: profile.account_name || '',
                accountNumber: profile.account_number || '',
                isDefault: true
              }
            ] : []
          });
        }
      } else {
        useAppStore.getState().setProUser(false);
      }
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      fetchProfile(session?.user).finally(() => {
        useAppStore.getState().setInitialized(true);
      });
    });

    // Listen for auth changes (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      fetchProfile(session?.user);
      if (session) {
        syncEngine.start();
        notificationService.setupRealtimeListeners(session.user.id);
        notificationService.requestPermission(); // Request on login
      } else {
        syncEngine.stop();
        notificationService.cleanup();
      }
    });

    // Start sync engine if already have session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        syncEngine.start();
        notificationService.setupRealtimeListeners(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
      syncEngine.stop();
      notificationService.cleanup();
    };
  }, [setSession]);



  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <BrowserRouter>
        <ThemeController />
        <Toaster position="bottom-right" />
        <UpdatePrompt />
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          <Routes>
            {/* Fully Open Routes with Layout */}
            <Route element={<PublicLayout />}>
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/about" element={<PublicAbout />} />
              <Route path="/changelog" element={<Changelog />} />
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/documentation" element={<Documentation />} />
              <Route path="/guides" element={<Guides />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/contact" element={<Contact />} />
            </Route>
            
            {/* Fully Open Routes without Layout */}
            <Route path="/pay/:id" element={<PublicInvoice />} />
            <Route path="/quote/:id" element={<PublicQuote />} />
            {/* Auth Routes */}
            <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Private Routes */}
            <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/quotes" element={<Quotes />} />
              <Route path="/quotes/new" element={<DocumentEditor type="QUOTE" />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="invoices/new" element={<DocumentEditor type="INVOICE" />} />
              <Route path="clients" element={<Clients />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="settings" element={<Settings />} />
              <Route path="reports" element={<Reports />} />
              <Route path="trash" element={<Trash />} />
              <Route path="payments" element={<Payments />} />
              <Route path="upgrade" element={<Upgrade />} />
              <Route path="support" element={<Support />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;

