/**
 * Utility functions for formatting data in the BillReve application.
 */

import { useAppStore } from '../store/useAppStore';
import { toMajor } from './money';

/**
 * Rounds a monetary minor unit (cents/kobo) to ensure it stays a clean integer.
 */
export const roundMoney = (value: number): number => {
  return Math.round(value);
};

/**
 * Formatting locale, derived from the CURRENCY rather than the viewer.
 *
 * `Intl.NumberFormat(undefined, ...)` resolves to the viewer's browser locale,
 * which meant the same invoice rendered differently depending on who opened it,
 * and made the DocumentPreview snapshot fail on CI runners whose ICU resolved
 * differently ("US$3.00" vs "$3.00"). A financial document must look identical
 * to the business that issued it and the client who receives it.
 *
 * Pinning everything to a single locale was the obvious fix but a bad one:
 * `en-US` renders NGN as "NGN 1,500.50" and drops the ₦ entirely, which is
 * wrong for BillReve's primary market. Deriving the locale from the currency
 * keeps output deterministic AND gives each currency its native symbol.
 */
const CURRENCY_LOCALE: Record<string, string> = {
  NGN: 'en-NG', // ₦1,500.50
  GHS: 'en-GH', // GH₵1,500.50
  ZAR: 'en-ZA', // R 1 500,50
  KES: 'en-KE', // Ksh 1,500.50
  USD: 'en-US', // $1,500.50
  EUR: 'en-IE', // €1,500.50
  GBP: 'en-GB', // £1,500.50
  CAD: 'en-CA', // $1,500.50
};

const DEFAULT_LOCALE = 'en-US';

const localeForCurrency = (currency: string): string =>
  CURRENCY_LOCALE[currency?.toUpperCase()] || DEFAULT_LOCALE;

/**
 * Formats a numeric minor unit amount (e.g. cents/kobo) as a localized currency string.
 * @param amountInMinor - The numeric amount in minor units (e.g. 350000 for 3500.00).
 * @param currency - The currency code (defaults to business profile currency or 'NGN').
 * @returns A formatted currency string (e.g., ₦100,000.00).
 */
export const formatMoney = (amountInMinor: number, currency?: string): string => {
  const defaultCurrency = useAppStore.getState().businessProfile?.currency || 'NGN';
  const finalCurrency = currency || defaultCurrency;

  return new Intl.NumberFormat(localeForCurrency(finalCurrency), {
    style: 'currency',
    currency: finalCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format((amountInMinor || 0) / 100);
};

/**
 * Abbreviated major-unit label for chart axes, from a MINOR-unit input.
 * Keeps axis ticks and tooltips on the same chart in agreement — they drifted
 * by 100x after the minor-units migration because the axis formatters were
 * hand-rolled per chart.
 *
 * @example formatCompactMinor(500000) === "5k"   // 5,000.00
 */
export const formatCompactMinor = (amountInMinor: number): string => {
  const major = toMajor(amountInMinor);
  const abs = Math.abs(major);
  if (abs >= 1_000_000) return `${(major / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(major / 1_000).toFixed(0)}k`;
  return major.toFixed(0);
};

export const getCurrencySymbol = (currencyCode?: string): string => {  const defaultCurrency = useAppStore.getState().businessProfile?.currency || 'NGN';
  const finalCurrency = currencyCode || defaultCurrency;
  const parts = new Intl.NumberFormat(localeForCurrency(finalCurrency), {
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
 * Formats a date as an unambiguous short date (e.g. Oct 23, 2023).
 *
 * The spelled-out month is deliberate. A numeric date is genuinely ambiguous
 * across locales — "09/10/2026" reads as 9 October to a British or Nigerian
 * recipient and 10 September to an American one. On an invoice due date that is
 * a month's difference in when someone believes they owe money, so numeric
 * formats are not acceptable on anything a client sees.
 *
 * The locale is pinned for the same reason `formatMoney`'s is: a raw
 * `toLocaleDateString()` renders differently depending on who opens the
 * document. That also made the DocumentPreview snapshot fail in CI, where the
 * runner resolved US format and the authoring machine did not.
 */
export const formatDate = (date?: string | number | Date | null): string => {
  if (date === null || date === undefined || date === '') return '';
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(parsed);
};

/**
 * ISO calendar date (YYYY-MM-DD), for CSV exports.
 *
 * Spreadsheets parse ISO reliably and sort it correctly even as text. A
 * localised date in a CSV either imports as the wrong day or not as a date at
 * all, depending on the machine opening it.
 */
export const formatDateIso = (date?: string | number | Date | null): string => {
  if (date === null || date === undefined || date === '') return '';
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};
