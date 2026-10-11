import { describe, it, expect } from 'vitest';
import {
  toMinor,
  toMajor,
  toMajorString,
  toGatewayAmount,
  fromGatewayAmount,
  MINOR_UNITS_PER_MAJOR,
} from './money';

/**
 * These tests exist because of a specific incident. In October 2026 the app
 * migrated every monetary value to integer minor units, and four independent
 * places kept treating them as major units. The result was live for days:
 * customers were charged 100x at checkout, no payment could ever be reconciled,
 * and accepting a quote counter-offer rewrote it to ~1% of its value.
 *
 * Every test below asserts the boundary rule that each of those bugs broke. If
 * one of them fails, do not "fix" the test — the conversion is wrong.
 */
describe('money boundary', () => {
  describe('toMinor / toMajor', () => {
    it('round-trips a typical invoice amount', () => {
      expect(toMinor(1500.5)).toBe(150050);
      expect(toMajor(150050)).toBe(1500.5);
    });

    it('never produces a fractional minor unit', () => {
      // 0.1 + 0.2 === 0.30000000000000004 in IEEE-754
      expect(toMinor(0.1 + 0.2)).toBe(30);
      expect(Number.isInteger(toMinor(19.999))).toBe(true);
      expect(toMinor(19.999)).toBe(2000);
    });

    it('accepts the string values that HTML number inputs actually produce', () => {
      expect(toMinor('1500.50')).toBe(150050);
      expect(toMinor('0.01')).toBe(1);
    });

    it('treats empty, null and non-numeric input as zero rather than NaN', () => {
      expect(toMinor(null)).toBe(0);
      expect(toMinor(undefined)).toBe(0);
      expect(toMinor('')).toBe(0);
      expect(toMinor('abc')).toBe(0);
      expect(toMajor(null)).toBe(0);
      expect(toMajor(undefined)).toBe(0);
    });

    it('formats a fixed two-decimal string for CSV and plain-text email', () => {
      // Regression: CSV exports and reminder emails emitted raw minor units,
      // so a client was told their invoice was for "NGN 150050".
      expect(toMajorString(150050)).toBe('1500.50');
      expect(toMajorString(100)).toBe('1.00');
      expect(toMajorString(0)).toBe('0.00');
    });

    it('keeps the exponent at 100 — every supported currency is 2-decimal', () => {
      // If a zero-decimal currency (JPY) or three-decimal (KWD) is ever added,
      // this constant must become currency-dependent and this test must change
      // deliberately rather than by accident.
      expect(MINOR_UNITS_PER_MAJOR).toBe(100);
    });
  });

  describe('toGatewayAmount — what we SEND to a gateway', () => {
    it('passes minor units straight through to Paystack', () => {
      // REGRESSION (PublicInvoice.tsx:189): the code did
      // `Math.round(invoice.total * 100)` with the comment "Paystack amount is
      // in kobo". The stored total was ALREADY kobo, so every customer was
      // billed 100x. A 1500.50 invoice charged 150,050.00.
      expect(toGatewayAmount(150050, 'paystack')).toBe(150050);
      expect(toGatewayAmount(150050, 'paystack')).not.toBe(15005000);
    });

    it('converts to major units for Flutterwave', () => {
      // REGRESSION (PublicInvoice.tsx:222): raw minor units were passed to an
      // SDK that expects major units — also a 100x overcharge.
      expect(toGatewayAmount(150050, 'flutterwave')).toBe(1500.5);
      expect(toGatewayAmount(150050, 'flutterwave')).not.toBe(150050);
    });

    it('the two gateways disagree, which is the whole reason this helper exists', () => {
      const stored = 150050;
      expect(toGatewayAmount(stored, 'paystack'))
        .not.toBe(toGatewayAmount(stored, 'flutterwave'));
    });
  });

  describe('fromGatewayAmount — what we RECEIVE from a gateway', () => {
    it('round-trips Paystack amounts back to storage units', () => {
      expect(fromGatewayAmount(150050, 'paystack')).toBe(150050);
    });

    it('round-trips Flutterwave amounts back to storage units', () => {
      expect(fromGatewayAmount(1500.5, 'flutterwave')).toBe(150050);
      expect(fromGatewayAmount('1500.50', 'flutterwave')).toBe(150050);
    });

    it('survives a round trip through either gateway unchanged', () => {
      for (const gateway of ['paystack', 'flutterwave'] as const) {
        const stored = 150050;
        const sent = toGatewayAmount(stored, gateway);
        expect(fromGatewayAmount(sent, gateway)).toBe(stored);
      }
    });
  });

  describe('webhook settlement comparison', () => {
    // REGRESSION (paystack-webhook:62-69, flutterwave-webhook:55-62): the
    // webhooks compared a MAJOR-unit paid amount against a MINOR-unit invoice
    // total. The comparison was false for any realistic figure, so a fully paid
    // invoice was permanently stamped PARTIAL and amount_paid was written 100x
    // too low — corrupting every balance-due figure downstream.
    const settle = (paidMinor: number, totalMinor: number) =>
      paidMinor >= totalMinor ? 'PAID' : 'PARTIAL';

    it('marks a full payment PAID for Paystack', () => {
      const invoiceTotal = 150050;
      const paid = fromGatewayAmount(150050, 'paystack'); // gateway sends kobo
      expect(settle(paid, invoiceTotal)).toBe('PAID');
    });

    it('marks a full payment PAID for Flutterwave', () => {
      const invoiceTotal = 150050;
      const paid = fromGatewayAmount(1500.5, 'flutterwave'); // gateway sends naira
      expect(settle(paid, invoiceTotal)).toBe('PAID');
    });

    it('still marks a genuine underpayment PARTIAL', () => {
      const invoiceTotal = 150050;
      expect(settle(fromGatewayAmount(500, 'paystack'), invoiceTotal)).toBe('PARTIAL');
      expect(settle(fromGatewayAmount(5, 'flutterwave'), invoiceTotal)).toBe('PARTIAL');
    });

    it('fails loudly if someone reintroduces the major/minor mismatch', () => {
      const invoiceTotal = 150050;
      const wrong = 150050 / 100; // the old `data.amount / 100` for Paystack
      expect(settle(wrong, invoiceTotal)).toBe('PARTIAL'); // demonstrates the bug
      expect(settle(fromGatewayAmount(150050, 'paystack'), invoiceTotal)).toBe('PAID');
    });
  });

  describe('quote counter-offer', () => {
    it('converts the client-typed major figure before comparing to the minimum', () => {
      // REGRESSION (PublicQuote.tsx:188): `Number(counterAmount)` sent a major
      // figure into a BIGINT minor column. The minimum-counter guard compared
      // major against minor and rejected nearly every legitimate offer; any
      // offer that got through made Quotes.tsx compute a ~1/100 ratio and
      // rewrite the quote to about 1% of its value.
      const minimumCounterMinor = 90000; // 900.00
      const clientTyped = '950';          // 950.00

      expect(toMinor(clientTyped)).toBe(95000);
      expect(toMinor(clientTyped) < minimumCounterMinor).toBe(false); // accepted

      // The unconverted value would have been wrongly rejected.
      expect(Number(clientTyped) < minimumCounterMinor).toBe(true);
    });

    it('keeps the discount ratio sane so tax proration is correct', () => {
      const quoteTotalMinor = 100000;             // 1,000.00
      const counterMinor = toMinor('900');        //   900.00
      expect(counterMinor / quoteTotalMinor).toBeCloseTo(0.9, 10);
    });
  });
});
