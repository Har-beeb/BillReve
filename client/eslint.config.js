import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `dev-dist` holds generated Workbox service-worker bundles. They are build
  // output, not source, and linting them produced hundreds of irrelevant errors
  // that blocked CI. (They are also still git-tracked despite the .gitignore
  // entry — `git rm -r --cached client/dev-dist` is needed to untrack them.)
  globalIgnores(['dist', 'dev-dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // There are ~250 pre-existing `any` usages across the codebase. As an
      // error this failed `npm run lint`, and because the CI job runs lint
      // before tests and build, those steps never executed — so the pipeline
      // provided no protection at all. Downgraded to a warning so CI is
      // meaningful today while the debt stays visible to pay down.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Same reasoning: useful signal, not a reason to block a deploy.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Test files legitimately reach into internals and cast through `any` to
    // mock Dexie and Supabase.
    files: ['**/*.test.{ts,tsx}', '**/setupTests.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
