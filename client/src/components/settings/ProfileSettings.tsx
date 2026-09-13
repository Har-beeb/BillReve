import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Building2, Upload, Save } from 'lucide-react';
import type { BusinessProfile } from '../../types';

export const ProfileSettings: React.FC = () => {
  const { businessProfile, updateBusinessProfile, user } = useAppStore();
  const [localProfile, setLocalProfile] = useState<BusinessProfile>(businessProfile);

  useEffect(() => {
    setLocalProfile(businessProfile);
  }, [businessProfile]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user?.id) {
      const toastId = toast.loading('Uploading logo...');
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/logo_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, file, { upsert: true });
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('logos')
          .getPublicUrl(fileName);
          
        setLocalProfile({ ...localProfile, logoUrl: publicUrl });
        toast.success('Logo uploaded!', { id: toastId });
      } catch (err: any) {
        console.error('Logo upload error:', err);
        toast.error('Failed to upload logo: ' + err.message, { id: toastId });
      }
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
            logo_url: localProfile.logoUrl || null,
            bank_accounts: localProfile.bankAccounts || null,
            industry: localProfile.industry || null,
            business_description: localProfile.businessDescription || null,
            country: localProfile.country || null,
            currency: localProfile.currency || null,
          })
          .eq('id', user.id);
          
        if (error) throw error;
        
        // Also update Auth metadata so the UI main layout syncs instantly
        await supabase.auth.updateUser({
          data: {
            full_name: localProfile.name,
            name: localProfile.name,
            phone: localProfile.phone,
          }
        });
        
        toast.success('Profile saved successfully!');
      } catch (err: any) {
        console.error('Failed to save profile to DB:', err);
        toast.error('Saved locally, but failed to sync to server: ' + err.message);
      }
    } else {
      toast.error('Profile saved locally!');
    }
  };

  return (
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
            disabled
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 cursor-not-allowed focus:outline-none"
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
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Industry</label>
          <select
            value={localProfile.industry || ''}
            onChange={(e) => setLocalProfile({ ...localProfile, industry: e.target.value })}
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
          >
            <option value="">Select your industry...</option>
            <option value="Freelance & Creative">Freelance & Creative</option>
            <option value="Agency & Consulting">Agency & Consulting</option>
            <option value="Software & Tech">Software & Tech</option>
            <option value="E-commerce & Retail">E-commerce & Retail</option>
            <option value="Real Estate & Construction">Real Estate & Construction</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Education">Education</option>
            <option value="Logistics">Logistics</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Business Description (AI Context)</label>
          <textarea
            value={localProfile.businessDescription || ''}
            onChange={(e) => setLocalProfile({ ...localProfile, businessDescription: e.target.value })}
            rows={3}
            placeholder="e.g. We build custom web applications for healthcare startups..."
            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none"
          />
          <p className="text-xs text-slate-500 mt-1">This helps the AI generate more accurate quotes, insights, and emails tailored to your business. This is NOT shown on your invoices.</p>
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
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Bank Account settings have been moved to the <span className="font-semibold text-purple-600">Payments</span> tab.
            </p>
          </div>
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
  );
};
