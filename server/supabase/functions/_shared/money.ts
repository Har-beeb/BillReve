/**
 * Money unit boundary for Edge Functions.
 *
 * Deno-side mirror of `client/src/utils/money.ts`. Edge functions cannot import
 * from the Vite client bundle, so this is duplicated deliberately. If you change
 * the conversion rules, change BOTH files.
 *
 * THE ONE RULE: every monetary value in BillReve's database is an INTEGER in
 * MINOR UNITS (kobo, cents). The `invoices.total`, `invoices.amount_paid`,
 * `quotes.total` and `quotes.counter_amount` columns are all BIGINT minor units
 * as of migration 20261009010000.
 *
 * Gateway conventions, which are NOT the same as each other:
 *   - Paystack  sends and expects the SMALLEST unit (kobo) -> pass-through
 *   - Flutterwave sends and expects the MAJOR unit (naira) -> x100 / /100
 *
 * Comparing a raw gateway amount against a stored total without converting is
 * what made every fully-paid invoice read as PARTIAL in October 2026.
 */

export const MINOR_UNITS_PER_MAJOR = 100;

export type PaymentGateway = 'paystack' | 'flutterwave';

const GATEWAY_EXPECTS_MINOR: Record<PaymentGateway, boolean> = {
  paystack: true,
  flutterwave: false,
};

/** Major units -> stored minor units. Always rounds to an integer. */
export const toMinor = (major: number | string | null | undefined): number => {
  const n = typeof major === 'string' ? parseFloat(major) : major;
  if (n === null || n === undefined || !Number.isFinite(n)) return 0;
  return Math.round(n * MINOR_UNITS_PER_MAJOR);
};

/** Stored minor units -> major units, for display or a major-unit API. */
export const toMajor = (minor: number | null | undefined): number => {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return 0;
  return minor / MINOR_UNITS_PER_MAJOR;
};

/** Stored minor units -> fixed two-decimal string, for emails and plain text. */
export const toMajorString = (minor: number | null | undefined): string => {
  return toMajor(minor).toFixed(2);
};

/**
 * An amount received FROM a gateway -> stored minor units.
 * Use before any comparison against an invoice total.
 */
export const fromGatewayAmount = (
  gatewayAmount: number | string,
  gateway: PaymentGateway
): number => {
  const n = typeof gatewayAmount === 'string' ? parseFloat(gatewayAmount) : gatewayAmount;
  if (!Number.isFinite(n)) return 0;
  return GATEWAY_EXPECTS_MINOR[gateway] ? Math.round(n) : toMinor(n);
};

/** Stored minor units -> the unit a gateway expects to be sent. */
export const toGatewayAmount = (minor: number, gateway: PaymentGateway): number => {
  return GATEWAY_EXPECTS_MINOR[gateway] ? Math.round(minor) : toMajor(minor);
};

/**
 * Keys that hold a monetary value in the JSON we hand to the LLM. `rate` is
 * deliberately absent — it is a tax percentage, not an amount.
 */
const MONEY_KEYS = new Set([
  'total', 'subtotal', 'amount', 'amount_paid', 'amountPaid',
  'counter_amount', 'counterAmount',
  'minimum_counter_amount', 'minimumCounterAmount',
  'unitPrice', 'unit_price',
  'totalRevenue', 'outstandingBalance', 'totalTaxCollected',
  'balance', 'balanceDue', 'balance_due',
  // Added with the enriched get_ai_context payload (20261013000000):
  // per-client aggregates and the headline outstanding figure.
  'outstanding', 'totalPaid', 'overdueAmount',
]);

/**
 * Recursively convert monetary fields from stored MINOR units into MAJOR units,
 * for anything a human or an LLM will read.
 *
 * Language models are unreliable at arithmetic, so we convert deterministically
 * here rather than instructing the model to divide by 100. Without this, an AI
 * report describes a 1,500.50 invoice as "150050".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const convertMoneyFieldsToMajor = (input: any): any => {
  if (Array.isArray(input)) return input.map(convertMoneyFieldsToMajor);
  if (input === null || typeof input !== 'object') return input;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    if (MONEY_KEYS.has(key) && typeof value === 'number') {
      out[key] = toMajor(value);
    } else {
      out[key] = convertMoneyFieldsToMajor(value);
    }
  }
  return out;
};
