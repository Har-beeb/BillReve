import React, { useState, useEffect } from 'react';

interface CurrencyInputProps {
  valueInMinor: number;
  onChangeMinor: (minor: number) => void;
  className?: string;
  placeholder?: string;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({ 
  valueInMinor, 
  onChangeMinor, 
  className = '', 
  placeholder = '0.00' 
}) => {
  // Keep local string state so users can type decimals ("10.", "10.0", "10.05") freely without React stripping them
  const [localValue, setLocalValue] = useState<string>(valueInMinor === 0 ? '' : (valueInMinor / 100).toString());

  // Sync from props if external state changes significantly (not during active typing)
  useEffect(() => {
    const expectedDecimal = valueInMinor / 100;
    if (parseFloat(localValue) !== expectedDecimal && !(localValue === '' && valueInMinor === 0)) {
      setLocalValue(valueInMinor === 0 ? '' : expectedDecimal.toString());
    }
  }, [valueInMinor]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      onChangeMinor(Math.round(parsed * 100));
    } else if (val === '') {
      onChangeMinor(0);
    }
  };

  return (
    <input
      type="number"
      min="0"
      step="0.01"
      placeholder={placeholder}
      value={localValue}
      onChange={handleChange}
      onFocus={(e) => e.target.select()}
      className={className}
    />
  );
};
