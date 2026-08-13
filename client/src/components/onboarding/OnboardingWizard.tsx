import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Globe2, Palette, Upload, CheckCircle2, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Logo } from '../ui/Logo';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 1000 : -1000,
    opacity: 0
  })
};

export const OnboardingWizard: React.FC = () => {
  const { businessProfile, updateBusinessProfile, setHasSkippedOnboarding, colorTheme, setColorTheme, customColor, setCustomColor } = useAppStore();
  
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward
  
  // Local state for the wizard
  const [profile, setProfile] = useState({
    name: businessProfile.name || '',
    email: businessProfile.email || '',
    phone: businessProfile.phone || '',
    industry: businessProfile.industry || 'Software & Tech',
    businessDescription: businessProfile.businessDescription || '',
    country: businessProfile.country || 'Nigeria',
    currency: businessProfile.currency || 'NGN',
    logoUrl: businessProfile.logoUrl || '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const nextStep = () => {
    if (step === 0 && !profile.name.trim()) {
      toast.error('Business Name is required');
      return;
    }
    setDirection(1);
    setStep(prev => prev + 1);
  };

  const prevStep = () => {
    setDirection(-1);
    setStep(prev => prev - 1);
  };

  const handleSkip = () => {
    setHasSkippedOnboarding(true);
    toast.success('You can complete your profile later in Settings.');
  };

  const handleComplete = async () => {
    updateBusinessProfile({
      ...businessProfile,
      ...profile,
    });
    setHasSkippedOnboarding(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from('profiles').update({
          name: profile.name,
          phone: profile.phone,
          industry: profile.industry,
          business_description: profile.businessDescription,
          country: profile.country,
          currency: profile.currency,
          logo_url: profile.logoUrl || null,
        }).eq('id', session.user.id);
      }
    } catch (e) {
      console.error('Error saving profile to database during onboarding:', e);
    }
    
    toast.success('Business Profile created! Welcome to BillReve.');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Logo must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const THEMES = [
    { id: 'default', name: 'Purple', class: 'bg-[#9333ea]' },
    { id: 'wine', name: 'Wine', class: 'bg-[#881337]' },
    { id: 'ocean', name: 'Ocean', class: 'bg-[#2563eb]' },
    { id: 'emerald', name: 'Emerald', class: 'bg-[#059669]' },
    { id: 'slate', name: 'Slate', class: 'bg-[#1e293b]' },
    { id: 'sunset', name: 'Sunset', class: 'bg-[#f97316]' },
    { id: 'mustard', name: 'Mustard', class: 'bg-[#eab308]' },
    { id: 'cherry', name: 'Cherry', class: 'bg-[#dc2626]' },
  ] as const;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-start md:justify-center p-4 sm:p-8 overflow-y-auto overflow-x-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-2xl relative z-10">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Logo className="w-32" />
          <button 
            onClick={handleSkip}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            Skip for now
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[0, 1, 2].map(i => (
              <div 
                key={i} 
                className={`flex-1 h-1.5 mx-1 rounded-full transition-colors duration-300 ${
                  i <= step ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500 font-medium text-center uppercase tracking-wider">
            Step {step + 1} of 3
          </p>
        </div>

        {/* Content Container */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden">
          <div className="relative min-h-[500px] overflow-hidden">
            <AnimatePresence initial={false} custom={direction}>
              
              {/* STEP 0: Basics */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                  className="absolute inset-0 p-8 flex flex-col h-full overflow-y-auto"
                >
                  <div className="flex items-center gap-3 mb-6 shrink-0">
                    <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Business Details</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Let's start with the basics.</p>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Business Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={e => setProfile({...profile, name: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="e.g. Acme Corp"
                        autoFocus
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                        <input
                          type="email"
                          value={profile.email}
                          onChange={e => setProfile({...profile, email: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="hello@acme.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={profile.phone}
                          onChange={e => setProfile({...profile, phone: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="+1 234 567 890"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Industry</label>
                      <select
                        value={profile.industry}
                        onChange={e => setProfile({...profile, industry: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
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

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Business Description <span className="text-slate-400 font-normal">(optional)</span></label>
                      <textarea
                        value={profile.businessDescription}
                        onChange={e => setProfile({...profile, businessDescription: e.target.value})}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                        placeholder="e.g. We build custom software for SMEs in Africa"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 1: Location */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                  className="absolute inset-0 p-8 flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      <Globe2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Localization</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Where are you based?</p>
                    </div>
                  </div>

                  <div className="space-y-6 flex-1">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Country</label>
                      <select
                        value={profile.country}
                        onChange={e => setProfile({...profile, country: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="Nigeria">Nigeria</option>
                        <option value="United States">United States</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="Canada">Canada</option>
                        <option value="Australia">Australia</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Default Currency</label>
                      <select
                        value={profile.currency}
                        onChange={e => setProfile({...profile, currency: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="NGN">NGN (₦) - Nigerian Naira</option>
                        <option value="USD">USD ($) - US Dollar</option>
                        <option value="GBP">GBP (£) - British Pound</option>
                        <option value="EUR">EUR (€) - Euro</option>
                      </select>
                      <p className="mt-2 text-xs text-slate-500">This will be the default currency for all your invoices.</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Branding */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                  className="absolute inset-0 p-8 flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-lg bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400">
                      <Palette className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Brand Identity</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Make it yours.</p>
                    </div>
                  </div>

                  <div className="space-y-6 flex-1">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Company Logo</label>
                      <div 
                        className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-purple-500 dark:hover:border-purple-500 transition-colors cursor-pointer group"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {profile.logoUrl ? (
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-white flex items-center justify-center shrink-0">
                            <img src={profile.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-purple-50 dark:group-hover:bg-purple-900/20 transition-colors">
                            <Upload className="w-6 h-6 text-slate-400 group-hover:text-purple-600" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                            {profile.logoUrl ? 'Change logo' : 'Upload logo'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 2MB. Recommeded size: 512x512px</p>
                        </div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleLogoUpload}
                          accept="image/png, image/jpeg"
                          className="hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">App Theme Color</label>
                      <div className="flex flex-wrap gap-3">
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setColorTheme(t.id as any)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${t.class} ${
                              colorTheme === t.id ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-current' : ''
                            }`}
                            title={t.name}
                          >
                            {colorTheme === t.id && <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md" />}
                          </button>
                        ))}
                        
                        <div className="relative group flex shrink-0">
                          <button
                            onClick={() => setColorTheme('custom')}
                            style={{ backgroundColor: colorTheme === 'custom' ? customColor : '#ffffff' }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 overflow-hidden ${
                              colorTheme === 'custom' ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-purple-600 dark:ring-purple-400' : 'border border-slate-300 dark:border-slate-600 border-dashed'
                            }`}
                            title="Custom Color"
                          >
                            {colorTheme === 'custom' ? (
                               <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md" />
                            ) : (
                               <div className="w-full h-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 opacity-80 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                 <Palette className="w-4 h-4 text-white drop-shadow-md" />
                               </div>
                            )}
                          </button>
                          {colorTheme === 'custom' && (
                            <input
                              type="color"
                              value={customColor}
                              onChange={(e) => setCustomColor(e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-full"
                              title="Pick a custom color"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Controls */}
          <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={prevStep}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors ${
                step === 0 ? 'opacity-0 pointer-events-none' : ''
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            
            {step < 2 ? (
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-sm"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm shadow-purple-600/20"
              >
                Finish Setup
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
