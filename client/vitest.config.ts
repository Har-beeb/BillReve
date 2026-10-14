import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    /*
     * Default to the `node` environment, NOT jsdom.
     *
     * jsdom was the global default, and building it cost ~14s per test file on
     * a Windows checkout — vitest reported 59% of total runtime in
     * "environment" and two of five files timed out with
     * "[vitest-pool-runner]: Timeout waiting for worker to respond", so whole
     * files silently never ran while the summary still showed green.
     *
     * Only two suites actually need a DOM, and they opt in with a
     * `@vitest-environment jsdom` docblock at the top of the file:
     *   - components/DocumentPreview.test.tsx  (renders React)
     *   - services/syncEngine.test.ts          (uses localStorage)
     *
     * Everything else is pure logic and runs far faster without a DOM.
     */
    environment: 'node',
    globals: true,
    setupFiles: './src/setupTests.ts',

    /*
     * Threads rather than the default `forks` pool: starting a process per file
     * is expensive on Windows, and worse here because the repo path contains a
     * space ("My Document") and antivirus typically scans each spawn.
     */
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,

    /*
     * NOTE: vitest suggests `isolate: false` to reuse workers across files.
     * Deliberately not taking it. Several suites `vi.mock` shared modules
     * (useAppStore, db, supabase) and disabling isolation shares the module
     * registry between files, so a mock from one file can leak into another.
     * Switching the default environment to `node` addresses the same startup
     * cost without risking cross-test contamination.
     */

    // A cold jsdom environment plus first-call Intl/ICU initialisation takes
    // about a second, so the defaults are tight rather than wrong.
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
