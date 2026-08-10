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
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  
  // Native touch handling
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Smooth scroll the header tabs horizontally without scrolling the whole page down
  useEffect(() => {
    const btn = tabRefs.current[activeTab];
    const container = scrollContainerRef.current;
    if (btn && container) {
      const scrollLeft = btn.offsetLeft - container.offsetWidth / 2 + btn.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [activeTab]);

  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary pointer (usually left click or first touch)
    if (!e.isPrimary) return;
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
  };

  const handlePointerUp = (e: React.TouchEvent | React.PointerEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    // Support both TouchEvent and PointerEvent
    let touchEndX = 0;
    let touchEndY = 0;
    
    if ('changedTouches' in e) {
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
    } else {
      touchEndX = (e as React.PointerEvent).clientX;
      touchEndY = (e as React.PointerEvent).clientY;
    }
    
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;
    
    // Ensure it's a horizontal swipe (deltaX is dominant) and long enough (> 50px)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0 && activeIndex < TABS.length - 1) {
        // Swiped left, go to next tab
        setActiveTab(TABS[activeIndex + 1]);
      } else if (deltaX < 0 && activeIndex > 0) {
        // Swiped right, go to prev tab
        setActiveTab(TABS[activeIndex - 1]);
      }
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
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

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-[600px] sm:h-[700px] overflow-hidden">
        
        {/* Tab Headers */}
        <div 
          ref={scrollContainerRef}
          className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto hide-scrollbar scroll-smooth shrink-0"
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

        {/* Swipeable Pages Container */}
        <div 
          className="flex-1 min-h-0 w-full relative overflow-hidden"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onTouchEnd={handlePointerUp} // Fallback for pure touch devices that might not fire pointer events perfectly
        >
          <div 
            className="w-full h-full flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            <div className="w-full h-full flex-shrink-0 overflow-y-auto p-6 hide-scrollbar"><AccountSettings /></div>
            <div className="w-full h-full flex-shrink-0 overflow-y-auto p-6 hide-scrollbar"><PreferencesSettings /></div>
            <div className="w-full h-full flex-shrink-0 overflow-y-auto p-6 hide-scrollbar"><ProfileSettings /></div>
            <div className="w-full h-full flex-shrink-0 overflow-y-auto p-6 hide-scrollbar"><TaxSettings /></div>
            <div className="w-full h-full flex-shrink-0 overflow-y-auto p-6 hide-scrollbar"><SyncSettings /></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
