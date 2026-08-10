import React, { useState, useRef, useEffect } from 'react';
import { Building2, Receipt, User, Database, Settings as SettingsIcon } from 'lucide-react';
import { AccountSettings } from '../components/settings/AccountSettings';
import { PreferencesSettings } from '../components/settings/PreferencesSettings';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { TaxSettings } from '../components/settings/TaxSettings';
import { SyncSettings } from '../components/settings/SyncSettings';
import { Swiper, SwiperSlide } from 'swiper/react';
// @ts-ignore
import 'swiper/css';
import type { Swiper as SwiperType } from 'swiper';

const TABS = ['account', 'preferences', 'profile', 'taxes', 'sync'] as const;
type Tab = typeof TABS[number];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const swiperRef = useRef<{ swiper: SwiperType }>(null);

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
    if (swiperRef.current?.swiper) {
      swiperRef.current.swiper.slideTo(TABS.indexOf(tab));
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

        {/* Swipeable Pages */}
        <div className="flex-1 min-h-0 w-full relative">
          <Swiper
            ref={swiperRef}
            onSlideChange={(swiper) => setActiveTab(TABS[swiper.activeIndex])}
            spaceBetween={0}
            slidesPerView={1}
            className="w-full h-full"
            resistanceRatio={0} // Stops bouncy overscroll so it feels native
          >
            <SwiperSlide className="h-full overflow-y-auto p-6 hide-scrollbar">
              <AccountSettings />
            </SwiperSlide>
            <SwiperSlide className="h-full overflow-y-auto p-6 hide-scrollbar">
              <PreferencesSettings />
            </SwiperSlide>
            <SwiperSlide className="h-full overflow-y-auto p-6 hide-scrollbar">
              <ProfileSettings />
            </SwiperSlide>
            <SwiperSlide className="h-full overflow-y-auto p-6 hide-scrollbar">
              <TaxSettings />
            </SwiperSlide>
            <SwiperSlide className="h-full overflow-y-auto p-6 hide-scrollbar">
              <SyncSettings />
            </SwiperSlide>
          </Swiper>
        </div>
      </div>
    </div>
  );
};

export default Settings;
