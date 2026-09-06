import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

const PRESET_SWATCHES = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e', '#000000', '#334155', '#64748b'
];

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  const [hexInput, setHexInput] = useState(color);

  useEffect(() => {
    setHexInput(color);
  }, [color]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onChange(val);
    } else if (/^[0-9A-Fa-f]{6}$/.test(val)) {
      onChange('#' + val);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm mt-3 w-full max-w-[280px]">
      <div className="grid grid-cols-6 gap-2">
        {PRESET_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            onClick={(e) => {
              e.preventDefault();
              onChange(swatch);
            }}
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-transform hover:scale-110 shadow-sm"
            style={{ backgroundColor: swatch }}
            title={swatch}
          >
            {color.toLowerCase() === swatch.toLowerCase() && (
              <Check size={16} className={['#ffffff', '#f8fafc'].includes(swatch.toLowerCase()) ? 'text-slate-900' : 'text-white'} />
            )}
          </button>
        ))}
      </div>
      
      <div className="flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner flex-shrink-0 relative overflow-hidden"
          style={{ backgroundColor: color }}
        >
          {/* Fallback native color picker invisible over the div to allow OS native picker if desired */}
          <input 
            type="color" 
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </div>
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">#</span>
          <input
            type="text"
            value={hexInput.replace('#', '')}
            onChange={handleHexChange}
            placeholder="8b5cf6"
            maxLength={6}
            className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white uppercase"
          />
        </div>
      </div>
    </div>
  );
};
