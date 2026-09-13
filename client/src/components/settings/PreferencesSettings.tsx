import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ProFeature } from '../ui/ProFeature';
import { ColorPicker } from '../ui/ColorPicker';

export const PreferencesSettings: React.FC = () => {
  const { theme, toggleTheme, mobileNavStyle, setMobileNavStyle, colorTheme, setColorTheme, customColor, setCustomColor, fontFamily, setFontFamily, fontSize, setFontSize, isProUser } = useAppStore();

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-2">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">App Theme</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${theme === 'light' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <div className="flex items-center gap-3">
              <input 
                type="radio" 
                name="theme" 
                value="light" 
                checked={theme === 'light'}
                onChange={toggleTheme}
                className="text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                <Sun size={18} /> Light Mode
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
              Clean and bright interface.
            </p>
          </label>
          
          <label className={`cursor-pointer border rounded-xl p-4 flex flex-col gap-3 transition-colors ${theme === 'dark' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <div className="flex items-center gap-3">
              <input 
                type="radio" 
                name="theme" 
                value="dark" 
                checked={theme === 'dark'}
                onChange={toggleTheme}
                className="text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                <Moon size={18} /> Dark Mode
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
              Easy on the eyes for night time.
            </p>
          </label>
        </div>
      </div>

      <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
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
                <div className="w-4 h-4 shrink-0 rounded-full" style={{ backgroundColor: '#9333ea' }}></div>
                Default Purple
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
              The classic BillReve purple experience.
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
                <div className="w-4 h-4 shrink-0 rounded-full" style={{ backgroundColor: '#831843' }}></div>
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
                <div className="w-4 h-4 shrink-0 rounded-full" style={{ backgroundColor: '#2563eb' }}></div>
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
                <div className="w-4 h-4 shrink-0 rounded-full" style={{ backgroundColor: '#059669' }}></div>
                Emerald Green
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
              Fresh, vibrant, and finance-focused.
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
                <div className="w-4 h-4 shrink-0 rounded-full" style={{ backgroundColor: '#475569' }}></div>
                Minimal Slate
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
              Subdued and professional greyscale.
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
                <div className="w-4 h-4 shrink-0 rounded-full" style={{ backgroundColor: '#ea580c' }}></div>
                Sunset Orange
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
              Warm, energetic, and bold.
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
                <div className="w-4 h-4 shrink-0 rounded-full" style={{ backgroundColor: '#ca8a04' }}></div>
                Golden Mustard
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
              A bright, creative, and distinct yellow.
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
                <div className="w-4 h-4 shrink-0 rounded-full" style={{ backgroundColor: '#dc2626' }}></div>
                Cherry Red
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 ml-7">
              Strong, impactful, and authoritative.
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
                <div className="mt-2 relative z-10" onClick={(e) => e.stopPropagation()}>
                  <ColorPicker 
                    color={customColor || '#8b5cf6'}
                    onChange={(color) => setCustomColor(color)}
                  />
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
                <option value="Outfit">Outfit</option>
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="Roboto">Roboto</option>
                <option value="Lora">Lora (Serif)</option>
                <option value="Playfair Display">Playfair Display (Serif)</option>
                <option value="Fira Code">Fira Code (Monospace)</option>
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
  );
};
