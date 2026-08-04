import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
}

export const checkPasswordStrength = (password: string) => {
  return {
    hasLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
};

export const isPasswordValid = (password: string) => {
  const strength = checkPasswordStrength(password);
  return Object.values(strength).every(Boolean);
};

const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const strength = checkPasswordStrength(password);
  
  const criteria = [
    { id: 'hasLength', label: 'At least 8 characters', met: strength.hasLength },
    { id: 'hasUpper', label: 'One uppercase letter', met: strength.hasUpper },
    { id: 'hasLower', label: 'One lowercase letter', met: strength.hasLower },
    { id: 'hasNumber', label: 'One number', met: strength.hasNumber },
    { id: 'hasSpecial', label: 'One special character', met: strength.hasSpecial },
  ];

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Password requirements:</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {criteria.map((item) => (
          <div key={item.id} className="flex items-center gap-1.5 text-xs">
            {item.met ? (
              <Check size={14} className="text-emerald-500" />
            ) : (
              <X size={14} className="text-slate-300 dark:text-slate-600" />
            )}
            <span className={item.met ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;
