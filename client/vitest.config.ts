import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',

    // Worker pool configuration.
    //
    // The default `forks` pool spawns a child PROCESS per test file. On Windows
    // that is expensive on its own, and worse here because the repo path
    // contains a space ("My Document") and antivirus typically scans every
    // spawned process. The observed symptom was
    // "[vitest-pool-runner]: Timeout waiting for worker to respond" — two
    // workers started and the next two timed out, so whole test FILES were
    // skipped while the summary still reported the tests that did run as
    // passing. That is the dangerous failure mode: green-looking output with
    // coverage silently missing. Threads are far cheaper to start than
    // processes. Run took 120s before this change and ~17s after.
    pool: 'threads',
    // `poolOptions.threads.singleThread` was removed in Vitest 4 — these are
    // top-level options now.
    maxWorkers: 1,
    fileParallelism: false,

    // NOTE: vitest suggests `isolate: false` to reuse workers across files and
    // save ~10s. Deliberately not taking it. Several suites use `vi.mock` on
    // shared modules (useAppStore, db, supabase) and disabling isolation shares
    // the module registry between files, so a mock from one file can leak into
    // another. Ten seconds is not worth a class of cross-test contamination
    // that would be very hard to diagnose.

    // A cold jsdom environment plus first-call Intl/ICU initialisation takes
    // about a second here, so the defaults are tight rather than wrong.
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
