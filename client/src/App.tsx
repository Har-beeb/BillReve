import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Quotes from './pages/Quotes';
import Invoices from './pages/Invoices';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import DocumentEditor from './pages/DocumentEditor';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PublicInvoice from './pages/PublicInvoice';
import PublicQuote from './pages/PublicQuote';
import Reports from './pages/Reports';
import Payments from './pages/Payments';
import About from './pages/About';
import Upgrade from './pages/Upgrade';
import { useAppStore } from './store/useAppStore';
import { supabase } from './lib/supabase';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" />;
};

function App() {
  const setSession = useAppStore(state => state.setSession);
  const colorTheme = useAppStore(state => state.colorTheme);
  const theme = useAppStore(state => state.theme);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const fetchProfile = async (sessionUser: any) => {
      if (sessionUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_pro, name, email, phone, address, bank_name, account_name, account_number, country, currency')
          .eq('id', sessionUser.id)
          .single();
          
        if (profile) {
          useAppStore.getState().setProUser(profile.is_pro || false);
          
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
      fetchProfile(session?.user);
      setIsInitializing(false);
    });

    // Listen for auth changes (login, logout, refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      fetchProfile(session?.user);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  useEffect(() => {
    // Handle dark mode
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Handle color themes
    document.documentElement.classList.remove('theme-wine', 'theme-ocean', 'theme-emerald', 'theme-slate', 'theme-sunset', 'theme-mustard', 'theme-cherry', 'theme-custom');
    if (colorTheme !== 'default') {
      document.documentElement.classList.add(`theme-${colorTheme}`);
    }
    
    // Handle custom color inline style
    if (colorTheme === 'custom') {
      document.documentElement.style.setProperty('--color-purple-600', useAppStore.getState().customColor);
    } else {
      document.documentElement.style.removeProperty('--color-purple-600');
    }
  }, [theme, colorTheme]);

  if (isInitializing) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/pay/:id" element={<PublicInvoice />} />
        <Route path="/quote/:id" element={<PublicQuote />} />

        {/* Private Routes */}
        <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="quotes" element={<Quotes />} />
          <Route path="quotes/new" element={<DocumentEditor type="QUOTE" />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<DocumentEditor type="INVOICE" />} />
          <Route path="clients" element={<Clients />} />
          <Route path="settings" element={<Settings />} />
          <Route path="reports" element={<Reports />} />
          <Route path="payments" element={<Payments />} />
          <Route path="upgrade" element={<Upgrade />} />
          <Route path="about" element={<About />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
