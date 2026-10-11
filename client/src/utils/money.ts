/**
 * Money unit boundary.
 *
 * ---------------------------------------------------------------------------
 * THE ONE RULE: every monetary value inside BillReve is an INTEGER in MINOR
 * UNITS (kobo, cents, pesewas). Nothing stored, synced, calculated or compared
 * is ever a major-unit float.
 * ---------------------------------------------------------------------------
 *
 * Minor units are used in: Postgres (BIGINT columns), Dexie/IndexedDB, Zustand,
 * all arithmetic, and all internal comparisons.
 *
 * Major units appear in exactly three places, and each one must cross this
 * boundary through a function in this file:
 *
 *   1. Human input      - what a user or client types into a form
 *   2. Human output      - display, PDFs, emails, CSV exports
 *   3. Third-party APIs  - payment gateways, each with its own convention
 *
 * If you find yourself writing `* 100` or `/ 100` anywhere else in the
 * codebase, it belongs here instead. Four separate 100x billing bugs reached
 * production in October 2026 precisely because this file did not exist.
 *
 * Note on zero-decimal currencies: every currency BillReve supports (NGN, GHS,
 * ZAR, KES, USD, EUR, GBP, CAD) has a 100:1 minor unit. If a zero-decimal
 * currency such as JPY or a three-decimal one such as KWD is ever added, the
 * exponent must become currency-dependent and these helpers must take a
 * currency argument.
 */

export const MINOR_UNITS_PER_MAJOR = 100;

/**
 * Convert a human-entered or external major-unit amount into stored minor units.
 * Always rounds, so fractional input can never produce a non-integer.
 *
 * @example toMinor(1500.50) === 150050
 */
export const toMinor = (major: number | string | null | undefined): number => {
  const n = typeof major === 'string' ? parseFloat(major) : major;
  if (n === null || n === undefined || !Number.isFinite(n)) return 0;
  return Math.round(n * MINOR_UNITS_PER_MAJOR);
};

/**
 * Convert stored minor units into a major-unit number, for display or for an
 * API that expects major units. The result may be fractional — that is correct
 * and expected, because it is leaving the integer domain.
 *
 * @example toMajor(150050) === 1500.5
 */
export const toMajor = (minor: number | null | undefined): number => {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return 0;
  return minor / MINOR_UNITS_PER_MAJOR;
};

/**
 * Fixed two-decimal major-unit string, for CSV cells and plain-text emails
 * where `formatMoney`'s currency symbols and locale grouping are unwanted.
 *
 * @example toMajorString(150050) === "1500.50"
 */
export const toMajorString = (minor: number | null | undefined): string => {
  return toMajor(minor).toFixed(2);
};

/**
 * Payment gateways supported by BillReve, and the unit each one speaks.
 *
 * - Paystack expects the SMALLEST currency unit (kobo). Same as our storage,
 *   so this is a pass-through. Verified against Paystack's Accept Payment docs.
 * - Flutterwave expects the MAJOR unit (naira). Corroborated by our own
 *   flutterwave-webhook, which reads `data.amount` as major.
 */
export type PaymentGateway = 'paystack' | 'flutterwave';

const GATEWAY_EXPECTS_MINOR: Record<PaymentGateway, boolean> = {
  paystack: true,
  flutterwave: false,
};

/**
 * Convert a stored minor-unit amount into the unit a gateway's checkout SDK
 * expects. Use this for every amount handed to a gateway — never convert inline.
 *
 * @example toGatewayAmount(150050, 'paystack')    === 150050   // kobo
 * @example toGatewayAmount(150050, 'flutterwave') === 1500.5   // naira
 */
export const toGatewayAmount = (minor: number, gateway: PaymentGateway): number => {
  return GATEWAY_EXPECTS_MINOR[gateway] ? Math.round(minor) : toMajor(minor);
};

/**
 * Convert an amount received FROM a gateway (webhook payload, verify response)
 * back into stored minor units, so it can be compared against an invoice total.
 *
 * Comparing a gateway amount against a stored total without this call is the
 * exact bug that made every paid invoice read as PARTIAL in October 2026.
 *
 * @example fromGatewayAmount(150050, 'paystack')  === 150050
 * @example fromGatewayAmount(1500.5, 'flutterwave') === 150050
 */
export const fromGatewayAmount = (
  gatewayAmount: number | string,
  gateway: PaymentGateway
): number => {
  const n = typeof gatewayAmount === 'string' ? parseFloat(gatewayAmount) : gatewayAmount;
  if (!Number.isFinite(n)) return 0;
  return GATEWAY_EXPECTS_MINOR[gateway] ? Math.round(n) : toMinor(n);
};
