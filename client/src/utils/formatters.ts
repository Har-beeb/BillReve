/**
 * Utility functions for formatting data in the Billflow application.
 */

import { useAppStore } from '../store/useAppStore';

/**
 * Formats a numeric amount as a localized currency string.
 * @param amount - The numeric amount to format.
 * @param currency - The currency code (defaults to business profile currency or 'NGN').
 * @returns A formatted currency string (e.g., ₦100,000).
 */
export const formatMoney = (amount: number, currency?: string): string => {
  const defaultCurrency = useAppStore.getState().businessProfile?.currency || 'NGN';
  const finalCurrency = currency || defaultCurrency;
  
  return new Intl.NumberFormat(undefined, { 
    style: 'currency', 
    currency: finalCurrency, 
    minimumFractionDigits: 0 
  }).format(amount);
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
