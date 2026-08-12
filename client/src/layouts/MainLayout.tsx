import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, FileText, FileSignature, Users, Settings, 
  RefreshCw, CheckCircle2, Clock, XCircle, 
  Sun, Moon, LogOut, User, CreditCard,
  BarChart3, WalletCards, Info, Crown, Menu, Bell, Check, MoreHorizontal, Trash2, Mail
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { syncEngine } from '../services/syncEngine';
import { useNotifications } from '../hooks/useNotifications';
import { Logo } from '../components/ui/Logo';
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard';

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(x => {
  const hex = x.toString(16);
  return hex.length === 1 ? '0' + hex : hex;
}).join('');

const mix = (color1: any, color2: any, weight: number) => {
  const w = weight / 100;
  return {
    r: Math.round(color1.r * w + color2.r * (1 - w)),
    g: Math.round(color1.g * w + color2.g * (1 - w)),
    b: Math.round(color1.b * w + color2.b * (1 - w))
  };
};

const generatePalette = (hex: string) => {
  const base = hexToRgb(hex);
  if (!base) return {};
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  
  return {
    '--color-purple-50': rgbToHex(mix(base, white, 10).r, mix(base, white, 10).g, mix(base, white, 10).b),
    '--color-purple-100': rgbToHex(mix(base, white, 20).r, mix(base, white, 20).g, mix(base, white, 20).b),
    '--color-purple-200': rgbToHex(mix(base, white, 40).r, mix(base, white, 40).g, mix(base, white, 40).b),
    '--color-purple-300': rgbToHex(mix(base, white, 60).r, mix(base, white, 60).g, mix(base, white, 60).b),
    '--color-purple-400': rgbToHex(mix(base, white, 80).r, mix(base, white, 80).g, mix(base, white, 80).b),
    '--color-purple-500': rgbToHex(base.r, base.g, base.b),
    '--color-purple-600': rgbToHex(mix(base, black, 80).r, mix(base, black, 80).g, mix(base, black, 80).b),
    '--color-purple-700': rgbToHex(mix(base, black, 60).r, mix(base, black, 60).g, mix(base, black, 60).b),
    '--color-purple-800': rgbToHex(mix(base, black, 40).r, mix(base, black, 40).g, mix(base, black, 40).b),
    '--color-purple-900': rgbToHex(mix(base, black, 20).r, mix(base, black, 20).g, mix(base, black, 20).b),
    '--color-purple-950': rgbToHex(mix(base, black, 10).r, mix(base, black, 10).g, mix(base, black, 10).b),
  } as React.CSSProperties;
};

const MainLayout: React.FC = () => {
  const { syncStatus, theme, colorTheme, customColor, fontFamily, toggleTheme, user, logout, isProUser, mobileNavStyle, businessProfile, hasSkippedOnboarding } = useAppStore();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Start Sync Engine and Theme initialization
  useEffect(() => {
    syncEngine.start();
    
    const handleOnline = () => {
      setIsOnline(true);
      syncEngine.sync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncEngine.sync();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      syncEngine.stop();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    // Close mobile menu on route change
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Quotes', path: '/quotes', icon: <FileSignature size={20} /> },
    { name: 'Invoices', path: '/invoices', icon: <FileText size={20} /> },
    { name: 'Clients', path: '/clients', icon: <Users size={20} /> },
    { name: 'Campaigns', path: '/campaigns', icon: <Mail size={20} />, isPro: true },
    { name: 'Reports', path: '/reports', icon: <BarChart3 size={20} />, isPro: true },
    { name: 'Payments', path: '/payments', icon: <WalletCards size={20} />, isPro: true },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} /> },
    { name: 'Support', path: '/support', icon: <Info size={20} /> },
    { name: 'Trash', path: '/trash', icon: <Trash2 size={20} /> },
  ];

  const renderSyncIcon = () => {
    if (!isOnline) {
      return <Clock className="text-amber-500" size={18} />;
    }
    switch (syncStatus) {
      case 'synced': return <CheckCircle2 className="text-green-500" size={18} />;
      case 'syncing': return <RefreshCw className="text-purple-500 animate-spin" size={18} />;
      case 'pending': return <Clock className="text-amber-500" size={18} />;
      case 'failed': return <XCircle className="text-red-500" size={18} />;
      default: return null;
    }
  };

  const renderSyncText = () => {
    if (!isOnline) return 'Offline Mode';
    switch (syncStatus) {
      case 'synced': return 'All data synced';
      case 'syncing': return 'Syncing...';
      case 'pending': return 'Changes pending';
      case 'failed': return 'Sync failed';
      default: return '';
    }
  };

  const themeClass = colorTheme !== 'default' ? `theme-${colorTheme}` : '';
  const customStyles: React.CSSProperties = {
    ...(colorTheme === 'custom' ? generatePalette(customColor) : {}),
    fontFamily: fontFamily === 'Inter' ? undefined : fontFamily
  };

  const showOnboarding = (!businessProfile.name || !businessProfile.industry || !businessProfile.businessDescription) && !hasSkippedOnboarding;

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-200 ${themeClass}`} style={customStyles}>
      {showOnboarding && <OnboardingWizard />}
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside 
        className={`hidden md:flex flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 sticky top-0 h-screen transition-[width] duration-300 ease-in-out will-change-[width] relative z-30 ${isSidebarExpanded ? 'w-64' : 'w-20'}`}
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
      >
        <div 
          className={`absolute -right-3 top-5 w-6 h-6 transition-colors transform rotate-45 z-40
            ${isSidebarExpanded 
              ? 'bg-white dark:bg-slate-800 border-b border-l border-slate-200 dark:border-slate-700' 
              : 'bg-white dark:bg-slate-800 border-t border-r border-slate-200 dark:border-slate-700 shadow-[2px_2px_4px_rgba(0,0,0,0.02)]'
            }`}
        />

        <div className={`p-6 font-bold text-2xl text-[#9333ea] flex items-center justify-start h-20`}>
          <Logo size="sm" className="flex-shrink-0" />
          <span className={`font-['Outfit'] font-black overflow-hidden whitespace-nowrap text-2xl transition-all duration-300 ease-out ${isSidebarExpanded ? 'max-w-[150px] opacity-100 ml-3 translate-x-0' : 'max-w-0 opacity-0 ml-0 -translate-x-4'}`}>
            BillReve
          </span>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isLocked = item.isPro && !isProUser;
            
            return (
              <NavLink
                key={item.path}
                to={isLocked ? '#' : item.path}
                onClick={(e) => {
                  if (isLocked) {
                    e.preventDefault();
                    navigate('/upgrade');
                  }
                }}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-lg transition-colors justify-between group ${
                    isActive && !isLocked
                      ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  } ${isLocked ? 'cursor-pointer' : ''}`
                }
                title={!isSidebarExpanded ? item.name : undefined}
              >
                <div className={`flex items-center ${isLocked ? 'blur-[2.5px] opacity-70 group-hover:blur-none group-hover:opacity-100 transition-all duration-300' : ''}`}>
                  <div className="flex-shrink-0">{item.icon}</div>
                  <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${isSidebarExpanded ? 'max-w-[150px] opacity-100 ml-3 translate-x-0' : 'max-w-0 opacity-0 ml-0 -translate-x-2'}`}>
                    {item.name}
                  </span>
                </div>
                {isLocked && isSidebarExpanded && (
                  <span className="text-[9px] uppercase font-bold tracking-wider bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded ml-2">Pro</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Upgrade Card at bottom of sidebar */}
        {!isProUser && isSidebarExpanded && (
          <div className="mt-4 mb-6 mx-4 flex-shrink-0">
            <button 
              onClick={() => navigate('/upgrade')}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white text-sm font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <Crown size={18} className="text-yellow-100" />
              Upgrade
            </button>
          </div>
        )}
        {!isProUser && !isSidebarExpanded && (
          <div className="mt-4 mb-6 mx-auto cursor-pointer flex-shrink-0" onClick={() => navigate('/upgrade')}>
            <div className="w-10 h-10 bg-gradient-to-tr from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md">
              <Crown size={20} />
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0 min-w-0">
        {/* Header */}
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 h-16 md:h-20 flex items-center px-4 md:px-8 justify-between sticky top-0 z-20 transition-colors duration-200 pt-safe">
          <div className="flex items-center gap-4 md:hidden">
            {mobileNavStyle === 'drawer' && (
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
            )}
            <div className="flex items-center gap-2">
              {mobileNavStyle === 'bottom' && (
                <Logo size="sm" className="flex-shrink-0" />
              )}
              {mobileNavStyle === 'drawer' && (
                <span className="font-['Outfit'] font-black text-2xl text-[#9333ea] tracking-tight">BillReve</span>
              )}
            </div>
          </div>
          <div className="flex-1 hidden md:flex">
            {/* Desktop search placeholder */}
          </div>
          <div className="flex items-center gap-4">
            <div 
              onClick={() => isOnline && syncEngine.sync()}
              className={`hidden md:flex items-center text-sm gap-2 px-3 py-1.5 rounded-full cursor-pointer transition-colors ${!isOnline ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
            >
              {renderSyncIcon()}
              <span>{renderSyncText()}</span>
            </div>
            {/* Mobile sync icon only */}
            <div 
              onClick={() => isOnline && syncEngine.sync()}
              className={`md:hidden flex items-center p-2 rounded-full cursor-pointer transition-colors ${!isOnline ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              title={renderSyncText()}
            >
               {renderSyncIcon()}
            </div>
            
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notificationsRef}>
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                aria-label="Notifications"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
                )}
              </button>
              
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 rounded-t-xl">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Notifications</h3>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="text-xs text-[#9333ea] dark:text-[#a855f7] hover:underline flex items-center gap-1">
                          <Check size={12} /> Mark read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button onClick={clearAll} className="text-xs text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1">
                          <Trash2 size={12} /> Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="max-h-[60vh] overflow-y-auto">
                    {notifications.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {notifications.map((notification) => (
                          <div 
                            key={notification.id} 
                            onClick={() => {
                              if (!notification.is_read) markAsRead(notification.id);
                              setIsNotificationsOpen(false);
                              if (notification.type.startsWith('QUOTE')) navigate(`/quotes?preview=${notification.entity_id}`);
                              if (notification.type.startsWith('INVOICE')) navigate(`/invoices?preview=${notification.entity_id}`);
                            }}
                            className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors flex gap-3 ${!notification.is_read ? 'bg-purple-50/30 dark:bg-purple-900/10' : ''}`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {!notification.is_read ? (
                                <div className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-400 mt-1.5"></div>
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-transparent mt-1.5 border border-slate-300 dark:border-slate-600"></div>
                              )}
                            </div>
                            <div>
                              <p className={`text-sm ${!notification.is_read ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                {notification.title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                {notification.message}
                              </p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
                                {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                        <Bell size={24} className="mb-2 opacity-20" />
                        <p className="text-sm">No notifications yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Dropdown */}
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold hover:bg-purple-200 dark:hover:bg-purple-900 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 overflow-hidden ring-2 ring-transparent"
                aria-label="User menu"
              >
                {(() => {
                  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
                  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
                  const initial = fullName.charAt(0).toUpperCase();
                  if (avatarUrl) {
                    return <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />;
                  }
                  return <span>{initial}</span>;
                })()}
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {user?.email}
                    </p>
                  </div>
                  
                  <div className="p-1">
                    <button 
                      onClick={() => { setIsUserMenuOpen(false); navigate('/settings'); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-left"
                    >
                      <User size={16} className="text-slate-400" />
                      Profile & Settings
                    </button>
                    {!isProUser && (
                      <button 
                        onClick={() => { setIsUserMenuOpen(false); navigate('/upgrade'); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-left"
                      >
                        <CreditCard size={16} className="text-slate-400" />
                        Billing (Pro)
                      </button>
                    )}
                  </div>
                  
                  <div className="p-1 border-t border-slate-100 dark:border-slate-700/50">
                    <button 
                      onClick={() => { setIsUserMenuOpen(false); logout(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left font-medium"
                    >
                      <LogOut size={16} />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div key={location.pathname} className="p-4 md:p-6 flex-1 mx-auto w-full max-w-7xl animate-page-transition min-w-0">
          <Outlet />
        </div>
      </main>

      {/* Mobile Slide-out Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Drawer */}
          <div className="relative flex w-full max-w-xs flex-col overflow-y-auto bg-white dark:bg-slate-800 pb-12 shadow-xl animate-in slide-in-from-left duration-300 z-10">
            <div className="flex px-4 pt-5 pb-2 justify-between items-center border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Logo size="sm" className="!mb-0 flex-shrink-0" />
                <span className="font-['Outfit'] font-black text-2xl text-[#9333ea] mt-0.5">BillReve</span>
              </div>
              <button
                type="button"
                className="relative -m-2 inline-flex items-center justify-center rounded-md p-2 text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <XCircle size={24} aria-hidden="true" />
              </button>
            </div>
            
            <div className="space-y-1 px-4 py-6">
              {navItems.map((item) => {
                const isLocked = item.isPro && !isProUser;
                return (
                    <NavLink
                      key={item.path}
                      to={isLocked ? '#' : item.path}
                      onClick={(e) => {
                        if (isLocked) {
                          e.preventDefault();
                          navigate('/upgrade');
                        } else {
                          setIsMobileMenuOpen(false);
                        }
                      }}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-3 rounded-lg transition-colors gap-4 ${
                        isActive && !isLocked
                          ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`
                    }
                  >
                    <div className={isLocked ? 'blur-[1.5px] opacity-70' : ''}>
                      {item.icon}
                    </div>
                    <span className={isLocked ? 'blur-[1.5px] opacity-70' : ''}>{item.name}</span>
                    {isLocked && (
                      <span className="ml-auto text-[10px] uppercase font-bold tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-2 py-0.5 rounded">Pro</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
            
            {/* Mobile Upgrade Card */}
            {!isProUser && (
              <div className="mt-4 mb-4 mx-4 flex-shrink-0">
                <button 
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    navigate('/upgrade');
                  }}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white text-sm font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <Crown size={18} className="text-yellow-100" />
                  Upgrade
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      {mobileNavStyle === 'bottom' && (
        <div className="md:hidden">
          {/* Animated "More" Panel */}
          <div 
            className={`fixed inset-x-0 bottom-[64px] bg-white dark:bg-slate-800 rounded-t-3xl shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.3)] border-t border-slate-200 dark:border-slate-700 transition-transform duration-200 ease-out z-[70] overflow-y-auto max-h-[70vh] ${
              isMoreMenuOpen ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <div className="p-4 pb-6 space-y-2">
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />
              {navItems.slice(4).map((item) => {
                const isLocked = item.isPro && !isProUser;
                return (
                  <NavLink
                    key={item.path}
                    to={isLocked ? '#' : item.path}
                    onClick={(e) => {
                      if (isLocked) {
                        e.preventDefault();
                        navigate('/upgrade');
                      } else {
                        setIsMoreMenuOpen(false);
                      }
                    }}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-3.5 rounded-xl transition-colors gap-4 ${
                        isActive && !isLocked
                          ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium' 
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`
                    }
                  >
                    <div className={isLocked ? 'blur-[1.5px] opacity-70' : ''}>
                      {item.icon}
                    </div>
                    <span className={isLocked ? 'blur-[1.5px] opacity-70 font-medium' : 'font-medium'}>{item.name}</span>
                    {isLocked && (
                      <span className="ml-auto text-[10px] uppercase font-bold tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-2 py-0.5 rounded">Pro</span>
                    )}
                  </NavLink>
                );
              })}
              
              {!isProUser && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-slate-700 dark:to-slate-800/50 border border-purple-100 dark:border-slate-600 p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Crown size={18} className="text-[#9333ea] dark:text-[#a855f7]" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Upgrade to Pro</h4>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Unlock advanced features</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        navigate('/upgrade');
                      }}
                      className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-purple-700 transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <nav className="fixed bottom-0 w-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 flex justify-around items-center h-16 pb-safe z-[75]">
            {navItems.slice(0, 4).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMoreMenuOpen(false)}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center w-full h-full space-y-1 ${
                    isActive && !isMoreMenuOpen
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400'
                  }`
                }
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.name}</span>
              </NavLink>
            ))}
            <button
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isMoreMenuOpen
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400'
              }`}
            >
              <MoreHorizontal size={20} className={`transition-transform duration-300 ${isMoreMenuOpen ? 'rotate-90' : 'rotate-0'}`} />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </nav>
          
          {isMoreMenuOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[65]"
              onClick={() => setIsMoreMenuOpen(false)}
            />
          )}
        </div>
      )}

      
    </div>
  );
};

export default MainLayout;

