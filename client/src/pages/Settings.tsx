import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Save, Upload, Trash2, Plus, Building2, Receipt, User, Database, Settings as SettingsIcon, Cloud, RefreshCw, FileUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { BusinessProfile, TaxSetting } from '../types';
import { syncEngine } from '../services/syncEngine';
import { supabase } from '../lib/supabase';
import { ProFeature } from '../components/ui/ProFeature';
import { CsvImportWizard } from '../components/CsvImportWizard';
import { useFeatureFlags } from '../hooks/useFeatureFlags';

const Settings: React.FC = () => {
  const { businessProfile, taxSettings, updateBusinessProfile, updateTaxSettings, user, syncStatus, mobileNavStyle, setMobileNavStyle, colorTheme, setColorTheme, customColor, setCustomColor, fontFamily, setFontFamily, fontSize, setFontSize, isProUser } = useAppStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'account' | 'profile' | 'taxes' | 'sync' | 'preferences'>('account');
  const { enableCsvImport } = useFeatureFlags();
  const [showImportWizard, setShowImportWizard] = useState(false);
  
  const [localProfile, setLocalProfile] = useState<BusinessProfile>(businessProfile);
  const [localTaxes, setLocalTaxes] = useState<TaxSetting[]>(taxSettings);

  useEffect(() => {
    setLocalProfile(businessProfile);
  }, [businessProfile]);

  useEffect(() => {
    setLocalTaxes(taxSettings);
  }, [taxSettings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_WIDTH = 800;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            setLocalProfile({ ...localProfile, logoUrl: compressedBase64 });
          } else {
            setLocalProfile({ ...localProfile, logoUrl: reader.result as string });
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    updateBusinessProfile(localProfile);
    
    if (user?.id) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: localProfile.name,
            phone: localProfile.phone,
            address: localProfile.address,
            bank_name: localProfile.bankAccounts?.[0]?.bankName || null,
            account_name: localProfile.bankAccounts?.[0]?.accountName || null,
            account_number: localProfile.bankAccounts?.[0]?.accountNumber || null,
          })
          .eq('id', user.id);
          
        if (error) throw error;
        alert('Profile saved successfully!');
      } catch (err: any) {
        console.error('Failed to save profile to DB:', err);
        alert('Saved locally, but failed to sync to server: ' + err.message);
      }
    } else {
      alert('Profile saved locally!');
    }
  };

  const handleSaveTaxes = () => {
    updateTaxSettings(localTaxes);
    alert('Tax settings saved successfully!');
  };

  const addTaxRule = () => {
    setLocalTaxes([...localTaxes, { id: uuidv4(), name: 'New Tax', rate: 0, isDeduction: false, isActive: true }]);
  };

  const removeTaxRule = (id: string) => {
    setLocalTaxes(localTaxes.filter(t => t.id !== id));
  };

  const updateTaxRule = (id: string, field: keyof TaxSetting, value: string | number | boolean) => {
    setLocalTaxes(localTaxes.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const addBankAccount = () => {
    setLocalProfile({
      ...localProfile,
      bankAccounts: [
        ...(localProfile.bankAccounts || []),
        { id: uuidv4(), bankName: '', accountName: '', accountNumber: '', isDefault: (localProfile.bankAccounts?.length || 0) === 0 }
      ]
    });
  };

  const removeBankAccount = (id: string) => {
    const updated = (localProfile.bankAccounts || []).filter(b => b.id !== id);
    if (updated.length > 0 && !updated.some(b => b.isDefault)) {
      updated[0].isDefault = true;
    }
    setLocalProfile({ ...localProfile, bankAccounts: updated });
  };

  const setBankAccountDefault = (id: string) => {
    setLocalProfile({
      ...localProfile,
      bankAccounts: (localProfile.bankAccounts || []).map(b => ({ ...b, isDefault: b.id === id }))
    });
  };

  const updateBankAccount = (id: string, field: 'bankName' | 'accountName' | 'accountNumber', value: string) => {
    setLocalProfile({
      ...localProfile,
      bankAccounts: (localProfile.bankAccounts || []).map(b => b.id === id ? { ...b, [field]: value } : b)
    });
  };

  

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'account' 
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <User size={18} />
            User Account
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'preferences' 
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <SettingsIcon size={18} />
            Preferences
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'profile' 
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Building2 size={18} />
            Business Profile
          </button>
          <button
            onClick={() => setActiveTab('taxes')}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'taxes' 
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Receipt size={18} />
            Tax Settings
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'sync' 
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Database size={18} />
            Data & Sync
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'account' && (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              <div className="flex items-start gap-6">
                <div className="w-24 h-24 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 overflow-hidden text-3xl font-bold">
                  {(() => {
                    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
                    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
                    const initial = fullName.charAt(0).toUpperCase();
                    if (avatarUrl) {
                      return <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />;
                    }
                    return <span>{initial}</span>;
                  })()}
                </div>
                <div className="flex-1 space-y-2 pt-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}
                  </h3>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 mt-2">
                    {user?.app_metadata?.provider === 'google' ? 'Google Account' : 'Email Account'}
                  </div>
                </div>
              </div>
              {!isProUser && (
                <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-4">
                  <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl p-6 text-white flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg">
                    <div>
                      <h4 className="text-xl font-bold mb-1">Upgrade to BillReve Pro 🚀</h4>
                      <p className="text-purple-200 text-sm">Accept global payments, remove branding, and automate reminders.</p>
                    </div>
                    <button onClick={() => navigate('/upgrade')} className="bg-white text-purple-900 hover:bg-slate-100 font-bold py-2.5 px-6 rounded-lg transition-colors whitespace-nowrap">View Pro Plan</button>
                  </div>
                </div>
              )}
              <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-500">
                  Your personal account details are managed by your authentication provider. 
                  To update your name or profile picture, please update your Google account.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Mobile Navigation Style</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${mobileNavStyle === 'drawer' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="mobileNav" 
                        value="drawer" 
                        checked={mobileNavStyle === 'drawer'}
                        onChange={() => setMobileNavStyle('drawer')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900 dark:text-white">Side Drawer (Menu)</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
                      A sleek hamburger menu in the top header that opens a full side drawer.
                    </p>
                  </label>
                  
                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${mobileNavStyle === 'bottom' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="mobileNav" 
                        value="bottom" 
                        checked={mobileNavStyle === 'bottom'}
                        onChange={() => setMobileNavStyle('bottom')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900 dark:text-white">Bottom Bar</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
                      A fixed navigation bar at the bottom of the screen with quick icons.
                    </p>
                  </label>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Color Theme</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${colorTheme === 'default' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="colorTheme" 
                        value="default" 
                        checked={colorTheme === 'default'}
                        onChange={() => setColorTheme('default')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-4 h-4 shrink-0 rounded-full bg-[#9333ea]"></div>
                        Vibrant Violet
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
                      The default BillReve vibrant violet and slate theme.
                    </p>
                  </label>
                  
                  <ProFeature isProUser={isProUser} className="sm:col-span-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${colorTheme === 'wine' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="colorTheme" 
                        value="wine" 
                        checked={colorTheme === 'wine'}
                        onChange={() => setColorTheme('wine')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-4 h-4 shrink-0 rounded-full bg-pink-800"></div>
                        Glossy Wine
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
                      A premium, luxurious wine and black aesthetic.
                    </p>
                  </label>

                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${colorTheme === 'ocean' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="colorTheme" 
                        value="ocean" 
                        checked={colorTheme === 'ocean'}
                        onChange={() => setColorTheme('ocean')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-4 h-4 shrink-0 rounded-full bg-blue-600"></div>
                        Ocean Blue
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
                      A calm, professional, and trustworthy blue.
                    </p>
                  </label>

                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${colorTheme === 'emerald' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="colorTheme" 
                        value="emerald" 
                        checked={colorTheme === 'emerald'}
                        onChange={() => setColorTheme('emerald')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-4 h-4 shrink-0 rounded-full bg-emerald-600"></div>
                        Emerald Green
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
                      A crisp, financial-focused green theme.
                    </p>
                  </label>

                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${colorTheme === 'slate' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="colorTheme" 
                        value="slate" 
                        checked={colorTheme === 'slate'}
                        onChange={() => setColorTheme('slate')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-4 h-4 shrink-0 rounded-full bg-slate-700"></div>
                        Midnight Slate
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
                      A sleek, minimal grayscale theme for focus.
                    </p>
                  </label>
                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${colorTheme === 'sunset' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="colorTheme" 
                        value="sunset" 
                        checked={colorTheme === 'sunset'}
                        onChange={() => setColorTheme('sunset')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-4 h-4 shrink-0 rounded-full bg-orange-500"></div>
                        Sunset Orange
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
                      A warm, energetic orange theme.
                    </p>
                  </label>

                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${colorTheme === 'mustard' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="colorTheme" 
                        value="mustard" 
                        checked={colorTheme === 'mustard'}
                        onChange={() => setColorTheme('mustard')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-4 h-4 shrink-0 rounded-full bg-yellow-500"></div>
                        Mustard Yellow
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
                      A bright, creative yellow theme.
                    </p>
                  </label>

                  <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${colorTheme === 'cherry' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="colorTheme" 
                        value="cherry" 
                        checked={colorTheme === 'cherry'}
                        onChange={() => setColorTheme('cherry')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-4 h-4 shrink-0 rounded-full bg-red-600"></div>
                        Cherry Red
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
                      A bold, passionate red theme.
                    </p>
                  </label>

                  <div className={`border rounded-xl p-4 flex flex-col gap-3 transition-colors ${colorTheme === 'custom' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input 
                        type="radio" 
                        name="colorTheme" 
                        value="custom" 
                        checked={colorTheme === 'custom'}
                        onChange={() => setColorTheme('custom')}
                        className="text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <div className="w-4 h-4 shrink-0 rounded-full" style={{ backgroundColor: customColor || '#8b5cf6' }}></div>
                        Custom Color
                      </span>
                    </label>
                    <div className="ml-7 flex flex-col gap-2">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Pick your own brand color.
                      </p>
                      {colorTheme === 'custom' && (
                        <div className="flex items-center gap-3 mt-2">
                          <input 
                            type="color" 
                            value={customColor || '#8b5cf6'}
                            onChange={(e) => setCustomColor(e.target.value)}
                            className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                          />
                          <span className="text-sm font-mono text-slate-500 uppercase">{customColor || '#8b5cf6'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                    </div>
                  </ProFeature>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Typography</h3>
                  
                  <ProFeature isProUser={isProUser}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Font Family</label>
                      <select 
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
                      >
                        <option value="Inter">Inter (Default)</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Playfair Display">Playfair Display (Serif)</option>
                        <option value="monospace">Monospace</option>
                      </select>
                      <p className="mt-2 text-xs text-slate-500">Affects your dashboard, invoices, and quotes.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Font Size (Invoices)</label>
                      <select 
                        value={fontSize}
                        onChange={(e) => setFontSize(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                      <p className="mt-2 text-xs text-slate-500">Adjust the base font size for your public documents.</p>
                    </div>
                    </div>
                  </ProFeature>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Company Logo</label>
                <div className="flex items-start gap-6">
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-900 overflow-hidden">
                    {localProfile.logoUrl ? (
                      <img src={localProfile.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="text-slate-400" size={32} />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors w-max font-medium text-sm">
                      <Upload size={16} />
                      Upload Logo
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                    <p className="text-xs text-slate-500">Recommended size: 256x256px. PNG, JPG or SVG.</p>
                    {localProfile.logoUrl && (
                      <button 
                        onClick={() => setLocalProfile({ ...localProfile, logoUrl: undefined })}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
                  <input 
                    type="text" 
                    value={localProfile.name}
                    onChange={(e) => setLocalProfile({...localProfile, name: e.target.value})}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    value={localProfile.email}
                    onChange={(e) => setLocalProfile({...localProfile, email: e.target.value})}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                  <input 
                    type="text" 
                    value={localProfile.phone}
                    onChange={(e) => setLocalProfile({...localProfile, phone: e.target.value})}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Business Address</label>
                  <textarea 
                    value={localProfile.address}
                    onChange={(e) => setLocalProfile({...localProfile, address: e.target.value})}
                    rows={3}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Country</label>
                  <select 
                    value={localProfile.country || 'NG'}
                    onChange={(e) => setLocalProfile({...localProfile, country: e.target.value})}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="NG">Nigeria</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="CA">Canada</option>
                    <option value="ZA">South Africa</option>
                    <option value="KE">Kenya</option>
                    <option value="GH">Ghana</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Default Currency</label>
                  <select 
                    value={localProfile.currency || 'NGN'}
                    onChange={(e) => setLocalProfile({...localProfile, currency: e.target.value})}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="NGN">NGN - Nigerian Naira</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="ZAR">ZAR - South African Rand</option>
                    <option value="KES">KES - Kenyan Shilling</option>
                    <option value="GHS">GHS - Ghanaian Cedi</option>
                    <option value="EUR">EUR - Euro</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Bank Accounts</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Add your bank details for manual transfers. You can choose which account to display on an invoice.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {(localProfile.bankAccounts || []).map((account, index) => (
                    <div key={account.id} className={`p-4 rounded-lg border ${account.isDefault ? 'border-purple-500 bg-purple-50/30 dark:bg-purple-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50'}`}>
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm">Account {index + 1}</span>
                          {account.isDefault && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">Default</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {!account.isDefault && (
                            <button onClick={() => setBankAccountDefault(account.id)} className="text-xs text-purple-600 hover:underline">Set as Default</button>
                          )}
                          <button onClick={() => removeBankAccount(account.id)} className="text-slate-400 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Bank Name</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Chase Bank"
                            value={account.bankName}
                            onChange={(e) => updateBankAccount(account.id, 'bankName', e.target.value)}
                            className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Account Name</label>
                          <input 
                            type="text" 
                            placeholder="e.g. John Doe / Business LLC"
                            value={account.accountName}
                            onChange={(e) => updateBankAccount(account.id, 'accountName', e.target.value)}
                            className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Account Number</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 1234567890"
                            value={account.accountNumber}
                            onChange={(e) => updateBankAccount(account.id, 'accountNumber', e.target.value)}
                            className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button 
                    onClick={addBankAccount}
                    className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium hover:text-purple-700 transition-colors text-sm mt-2"
                  >
                    <Plus size={16} /> Add Another Bank Account
                  </button>
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                <button 
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  <Save size={18} />
                  Save Profile
                </button>
                
              </div>
            </div>
          )}

          {activeTab === 'taxes' && (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Define the default tax rules available when creating Quotes and Invoices.
                </p>
                
                {localTaxes.map((tax) => (
                  <div key={tax.id} className="flex gap-4 items-start p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Tax Name</label>
                        <input 
                          type="text" 
                          value={tax.name}
                          onChange={(e) => updateTaxRule(tax.id, 'name', e.target.value)}
                          placeholder="e.g. VAT"
                          className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Rate (%)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={tax.rate}
                          onChange={(e) => updateTaxRule(tax.id, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <label className="flex items-center gap-2 cursor-pointer mt-6 text-sm text-slate-600 dark:text-slate-400">
                        <input 
                          type="checkbox" 
                          checked={tax.isDeduction}
                          onChange={(e) => updateTaxRule(tax.id, 'isDeduction', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        Is Deduction?
                      </label>
                      <button 
                        onClick={() => removeTaxRule(tax.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title="Remove Tax"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}

                <button 
                  onClick={addTaxRule}
                  className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium hover:text-purple-700 transition-colors text-sm"
                >
                  <Plus size={16} /> Add Tax Rule
                </button>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <button 
                  onClick={handleSaveTaxes}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                >
                  <Save size={18} />
                  Save Taxes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-4">
                  <Cloud size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Cloud Sync</h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6 text-sm">
                  BillReve works offline-first. Your data is saved locally on this device and automatically syncs to the cloud when you are online.
                </p>

                <div className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
                  <div>
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Current Status</div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-1">
                      {syncStatus === 'synced' && <span className="text-green-600 dark:text-green-400">● All data synced</span>}
                      {syncStatus === 'syncing' && <span className="text-purple-600 dark:text-purple-400">● Syncing to cloud...</span>}
                      {syncStatus === 'pending' && <span className="text-amber-600 dark:text-amber-400">● Offline - Changes pending</span>}
                      {syncStatus === 'failed' && <span className="text-red-600 dark:text-red-400">● Sync failed</span>}
                    </div>
                  </div>
                  <button 
                    onClick={() => syncEngine.sync()}
                    disabled={syncStatus === 'syncing'}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
                  >
                    <RefreshCw size={16} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                    Force Sync
                  </button>
                </div>
                
                {/* Developer Tools for Mocking Data */}
                <div className="w-full bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/50 rounded-lg p-4 mt-2 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 text-left">
                  <div>
                    <div className="text-sm font-medium text-purple-700 dark:text-purple-400">Developer Tools</div>
                    <div className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">
                      Instantly populate your account with 15 clients, 25 invoices, and 10 quotes for testing.
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                    <button 
                      onClick={async () => {
                        if (!user) return;
                        const { clearAllData } = await import('../utils/mockDataGenerator');
                        await clearAllData(user.id);
                      }}
                      className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-red-600 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap w-full sm:w-auto"
                    >
                      <Trash2 size={16} />
                      Clear Data
                    </button>
                    <button 
                      onClick={async () => {
                        if (!user) return;
                        const { generateMockData } = await import('../utils/mockDataGenerator');
                        await generateMockData(user.id);
                      }}
                      className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap w-full sm:w-auto"
                    >
                      <Database size={16} />
                      Generate Mock Data
                    </button>
                  </div>
                </div>

                {/* Data Migration */}
                {enableCsvImport && (
                  <div className="w-full bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 mt-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 text-left">
                    <div>
                      <div className="text-sm font-medium text-blue-700 dark:text-blue-400">Data Migration</div>
                      <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1 max-w-lg">
                        Import your clients, invoices, or quotes from QuickBooks, Wave, or any other system using our CSV Import Wizard.
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                      <button 
                        onClick={() => setShowImportWizard(true)}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap w-full sm:w-auto"
                      >
                        <FileUp size={16} />
                        Import CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showImportWizard && (
        <CsvImportWizard onClose={() => setShowImportWizard(false)} />
      )}
    </div>
  );
};


export default Settings;



