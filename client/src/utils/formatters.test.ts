import { describe, it, expect, vi } from 'vitest';
import { roundMoney, calculatePercentage } from './formatters';

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
});
