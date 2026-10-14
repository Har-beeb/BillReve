/*
 * Shared test setup.
 *
 * Intentionally does NOT import `@testing-library/jest-dom` here.
 *
 * Two reasons. The default test environment is now `node` (jsdom is opted into
 * per-file via a `@vitest-environment jsdom` docblock), so DOM matchers would
 * be loaded for suites that have no document. And jest-dom's type definitions
 * are a global declaration file rather than a module, so a conditional
 * `await import('@testing-library/jest-dom')` fails to type check with
 * TS2306 — the package can only be brought in as a static side-effect import.
 *
 * The DOM suites therefore import it themselves. Matcher *types* are already
 * available everywhere via the `types` array in tsconfig.app.json.
 *
 * Environment-agnostic global setup belongs in this file if any is ever needed.
 */
export {};
