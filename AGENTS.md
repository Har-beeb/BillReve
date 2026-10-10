# AGENTS.md

Instructions for AI coding agents working in this repository. Applies to all tools (Claude Code, Cursor, Codex, Gemini CLI, Copilot, Zed, and the Claude desktop app).

## What this project is

BillReve is a live, offline-first invoicing and quoting SaaS for freelancers and SMEs, at billreve.app. It is built and operated by one person. Treat production as real: users have financial data in it.

Two source trees, no root `package.json` — this is not a workspace monorepo.

- `client/` — React 19 + Vite 8 + TypeScript 6 (strict), Tailwind v4, Zustand 5, Dexie 4 (IndexedDB), PWA via Workbox. All app code is in `client/src`.
- `server/supabase/` — `functions/` holds 7 Deno edge functions, `migrations/` holds the SQL.

Cloud is Supabase (Postgres, RLS, Realtime, Edge Functions, Storage). Payments are Paystack and Flutterwave. AI is Google Gemini, proxied through an edge function.

## Start here

Before doing anything non-trivial, read `.agents/context/README.md` and the files it points to. That folder carries the accumulated working context: what the system does, the open defect register with a live status field per item, the current task, and how to search this repo. It is deliberately kept out of git — read it from disk.

Also read `.agents/rules/git-push-policy.md`.

## Hard rules

**Never write directly to Supabase from a component.** Always write to Dexie (IndexedDB) and let `client/src/services/syncEngine.ts` replicate to the cloud. The sync engine is the single choke point for entity data and bypassing it causes silent divergence between devices. The only tolerated exceptions today are `profiles` writes in `App.tsx` and `OnboardingWizard.tsx`, because `profiles` is not a synced entity — do not add more.

**Never set `is_pro` or `pro_expires_at` from the client.** They are set by the `saas-webhook` edge function and protected by a Postgres trigger. Client-side writes to them are silently discarded.

**Use `purple-*` for accent colours, never `blue-*`.** This is the product's visual identity and it is easy to break by copying a snippet.

**Do not run `git push` while a build is running, and only push if `npm run build` exited 0.** There is no CI to catch a broken build, so the local build is the only gate.

**Verify before you assert.** `README.md`, `working.md` and `audit-report.md` are all stale and contradict each other and the code — on the version number, on which tech debt is fixed, and on which security controls exist. Read the source. If you find a doc claim that is wrong, fix the doc.

## Commands

Run from `client/`:

    npm run dev        # Vite dev server
    npm run build      # tsc -b && vite build — the only correctness gate that exists
    npm run lint       # ESLint, not wired into the build
    npm run preview

There is no `npm test`. There are no tests in this repository, no CI, no error monitoring and no analytics. Assume nothing will catch a regression for you, and weight your own caution accordingly.

## Searching this repo

Globbing or grepping the repo **root will time out** because of `node_modules`. Always scope to a subdirectory — `client/src/pages`, `server/supabase/migrations`, and so on. Scoped searches are fast and reliable.

## Working style

Cite exact `file:line` when reporting a finding. Sequence recommendations by impact-per-effort and separate what should be fixed now from what is longer-horizon architecture — this is a solo project with limited time, not an enterprise codebase. Do not soften real problems, but do not pad the list with style preferences either.
