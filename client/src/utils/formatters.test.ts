import { describe, it, expect, vi } from 'vitest';
import { roundMoney, calculatePercentage, formatMoney, formatCompactMinor } from './formatters';

// Mock the zustand store so it doesn't crash on import
vi.mock('../store/useAppStore', () => ({
  useAppStore: {
    getState: () => ({
      businessProfile: { currency: 'NGN' }
    })
  }
}));

describe('formatters', () => {
  it('roundMoney correctly rounds to nearest integer (minor units)', () => {
    // 0.1 + 0.2 normally equals 0.30000000000000004
    // If calculating tax: 3100 cents * 0.075 = 232.5
    expect(roundMoney(232.5)).toBe(233);
    expect(roundMoney(100.1)).toBe(100);
  });

  it('calculatePercentage returns a clean integer', () => {
    expect(calculatePercentage(50, 200)).toBe(25);
    expect(calculatePercentage(0, 100)).toBe(0);
    expect(calculatePercentage(10, 0)).toBe(0); // avoids NaN/Infinity
  });

  describe('formatMoney', () => {
    // This is the function that encodes the minor-units contract for every
    // amount a human ever sees, and it was previously untested.
    it('divides by 100, because its input is MINOR units', () => {
      expect(formatMoney(150050, 'USD')).toBe('$1,500.50');
      expect(formatMoney(100, 'USD')).toBe('$1.00');
      expect(formatMoney(1, 'USD')).toBe('$0.01');
    });

    it('always shows exactly two decimal places', () => {
      // Regression: minimumFractionDigits used to be 0, so 1000.5 rendered as
      // "$1,000.5" on a financial document.
      expect(formatMoney(100000, 'USD')).toBe('$1,000.00');
      expect(formatMoney(100050, 'USD')).toBe('$1,000.50');
    });

    it('falls back to the business profile currency', () => {
      // Store mock above sets NGN.
      expect(formatMoney(150050)).toBe('₦1,500.50');
    });

    it('keeps the naira symbol — the locale is derived from the CURRENCY', () => {
      // Regression: the locale was `undefined`, i.e. the VIEWER's browser, so
      // the same invoice rendered differently for the business and the client.
      // Pinning everything to en-US was the obvious fix but renders NGN as
      // "NGN 1,500.50" and loses the symbol, so the locale follows the currency.
      expect(formatMoney(150050, 'NGN')).toBe('₦1,500.50');
      expect(formatMoney(150050, 'GBP')).toBe('£1,500.50');
      expect(formatMoney(150050, 'EUR')).toBe('€1,500.50');
    });

    it('is deterministic regardless of the ambient system locale', () => {
      // The whole point: two calls with the same currency must agree, so a
      // snapshot test cannot flake on a CI runner with different ICU defaults.
      expect(formatMoney(330, 'USD')).toBe(formatMoney(330, 'USD'));
      expect(formatMoney(330, 'USD')).toBe('$3.30');
    });

    it('handles zero, null-ish and negative amounts', () => {
      expect(formatMoney(0, 'USD')).toBe('$0.00');
      expect(formatMoney(undefined as unknown as number, 'USD')).toBe('$0.00');
      expect(formatMoney(-5000, 'USD')).toBe('-$50.00');
    });
  });

  describe('formatCompactMinor', () => {
    // Regression: chart axis formatters read minor units directly, so 5,000.00
    // rendered as "500k" while the tooltip on the same chart showed the correct
    // figure via formatMoney — the two disagreed by 100x.
    it('converts to major units before abbreviating', () => {
      expect(formatCompactMinor(500000)).toBe('5k');
      expect(formatCompactMinor(150000000)).toBe('1.5M');
    });

    it('leaves small amounts unabbreviated', () => {
      expect(formatCompactMinor(50000)).toBe('500');
      expect(formatCompactMinor(0)).toBe('0');
    });
  });
});
