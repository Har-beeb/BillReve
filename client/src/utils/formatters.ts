/**
 * Utility functions for formatting data in the BillReve application.
 */

import { useAppStore } from '../store/useAppStore';

/**
 * Rounds a monetary minor unit (cents/kobo) to ensure it stays a clean integer.
 */
export const roundMoney = (value: number): number => {
  return Math.round(value);
};

/**
 * Formats a numeric minor unit amount (e.g. cents/kobo) as a localized currency string.
 * @param amountInMinor - The numeric amount in minor units (e.g. 350000 for 3500.00).
 * @param currency - The currency code (defaults to business profile currency or 'NGN').
 * @returns A formatted currency string (e.g., ₦100,000.00).
 */
export const formatMoney = (amountInMinor: number, currency?: string): string => {
  const defaultCurrency = useAppStore.getState().businessProfile?.currency || 'NGN';
  const finalCurrency = currency || defaultCurrency;
  
  return new Intl.NumberFormat(undefined, { 
    style: 'currency', 
    currency: finalCurrency, 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format((amountInMinor || 0) / 100);
};

export const getCurrencySymbol = (currencyCode?: string): string => {
  const defaultCurrency = useAppStore.getState().businessProfile?.currency || 'NGN';
  const finalCurrency = currencyCode || defaultCurrency;
  const parts = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: finalCurrency,
  }).formatToParts(0);
  return parts.find(part => part.type === 'currency')?.value || finalCurrency;
};

/**
 * Calculates a percentage from a partial amount and a total.
 * @param part - The partial amount (e.g., amount paid).
 * @param total - The total amount.
 * @returns The integer percentage (0-100).
 */
export const calculatePercentage = (part: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
};

/**
 * Formats a date string to a localized short date (e.g., Oct 23, 2023).
 * @param dateString - The ISO date string to format.
 * @returns A formatted date string.
 */
export const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '';
  return new Intl.DateTimeFormat('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }).format(new Date(dateString));
};
