import React, { useState, useRef, useEffect } from 'react';
import { Building2, Receipt, User, Database, Settings as SettingsIcon } from 'lucide-react';
import { AccountSettings } from '../components/settings/AccountSettings';
import { PreferencesSettings } from '../components/settings/PreferencesSettings';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { TaxSettings } from '../components/settings/TaxSettings';
import { SyncSettings } from '../components/settings/SyncSettings';



const TABS = ['account', 'preferences', 'profile', 'taxes', 'sync'] as const;
type Tab = typeof TABS[number];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const activeIndex = TABS.indexOf(activeTab);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  
  const isProgrammaticScroll = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const btn = tabRefs.current[activeTab];
    if (btn && scrollContainerRef.current) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  const handleTabClick = (tab: Tab) => {
    isProgrammaticScroll.current = true;
    setActiveTab(tab);
    
    const index = TABS.indexOf(tab);
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollTo({
        left: index * contentContainerRef.current.clientWidth,
        behavior: 'smooth'
      });
      
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 600);
    }
  };

  const getTabIcon = (tab: Tab) => {
    switch(tab) {
      case 'account': return <User size={18} />;
      case 'preferences': return <SettingsIcon size={18} />;
      case 'profile': return <Building2 size={18} />;
      case 'taxes': return <Receipt size={18} />;
      case 'sync': return <Database size={18} />;
    }
  };

  const getTabLabel = (tab: Tab) => {
    switch(tab) {
      case 'account': return 'User Account';
      case 'preferences': return 'Preferences';
      case 'profile': return 'Business Profile';
      case 'taxes': return 'Tax Settings';
      case 'sync': return 'Data & Sync';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        
        {/* Tab Headers */}
        <div 
          ref={scrollContainerRef}
          className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto hide-scrollbar scroll-smooth"
        >
          {TABS.map(tab => (
            <button
              key={tab}
              ref={el => { tabRefs.current[tab] = el; }}
              onClick={() => handleTabClick(tab)}
              className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab 
                  ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              {getTabIcon(tab)}
              {getTabLabel(tab)}
            </button>
          ))}
        </div>

        <div 
          ref={contentContainerRef}
          className="flex w-full overflow-x-auto snap-x snap-mandatory hide-scrollbar touch-pan-x smooth-scroll"
          onScroll={(e) => {
            if (isProgrammaticScroll.current) return;
            
            const container = e.currentTarget;
            const scrollLeft = container.scrollLeft;
            const width = container.clientWidth;
            if (width > 0) {
              const newIndex = Math.round(scrollLeft / width);
              if (newIndex !== activeIndex && TABS[newIndex]) {
                setActiveTab(TABS[newIndex]);
              }
            }
          }}
        >
          <div className="w-full shrink-0 snap-center p-6"><AccountSettings /></div>
          <div className="w-full shrink-0 snap-center p-6"><PreferencesSettings /></div>
          <div className="w-full shrink-0 snap-center p-6"><ProfileSettings /></div>
          <div className="w-full shrink-0 snap-center p-6"><TaxSettings /></div>
          <div className="w-full shrink-0 snap-center p-6"><SyncSettings /></div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
