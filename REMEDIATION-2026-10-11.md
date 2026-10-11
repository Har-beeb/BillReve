# BillReve — Remediation Report

**Work done:** 11 October 2026
**Scope:** every finding in `AUDIT-2026-10-10-verification.md`, plus defects discovered while fixing them
**Verification:** `npx tsc -b --force` exits 0 across the whole client. The money-boundary logic was transpiled and executed standalone — 50 assertions, all passing. See section 6 for what I could *not* verify and what you must run before deploying.

---

## 0. Before you deploy anything, read this

Three things must ship **together**, in this order, or you will trade one money bug for another:

1. **The migration** — `server/supabase/migrations/20261011000000_fix_audit_regressions.sql`
2. **The edge functions** — `paystack-webhook`, `flutterwave-webhook`, `ai`, `email-cron`
3. **The client**

The reason is the checkout/webhook pair. The checkout no longer multiplies by 100, and the webhooks no longer divide by 100. Ship only the client and every payment still fails to reconcile. Ship only the webhooks and customers are still charged 100×. They are two halves of one fix.

There is also a data question, in section 7. If any real customer paid an invoice while the 100× bug was live, you have corrupted rows and possibly money you are not owed. I have not written a blind repair script — the queries in section 7 let you see the damage first.

---

## 1. The structural fix

Four independent places got the same conversion wrong, which told me the problem was not four mistakes but one missing abstraction. So before fixing anything I built the thing that should have existed when the minor-units migration landed.

`client/src/utils/money.ts` is now the single boundary where money changes units, with a mirror at `server/supabase/functions/_shared/money.ts` for Deno (edge functions cannot import the client bundle; the duplication is deliberate and documented in both files).

It exports `toMinor`, `toMajor`, `toMajorString`, and — the important pair — `toGatewayAmount` and `fromGatewayAmount`. Those last two encode the fact that **Paystack and Flutterwave disagree with each other**: Paystack speaks minor units, Flutterwave speaks major. That disagreement is precisely what nobody noticed, and it is now stated once, in a typed function, instead of being re-derived at each call site. The file opens with the rule in plain terms: if you are writing `* 100` or `/ 100` anywhere else, it belongs here.

There is also a note about zero-decimal currencies. Every currency you support today is 100:1, so a constant is fine. If JPY or KWD ever appears, the exponent has to become currency-dependent, and the test asserting `MINOR_UNITS_PER_MAJOR === 100` will force that to be a deliberate decision rather than a silent wrong answer.

---

## 2. The critical payment fixes

**Paystack checkout (N1).** `PublicInvoice.tsx:189` was `Math.round((invoice.total - amount_paid) * 100)` with a comment claiming Paystack wants kobo. It does — and the stored value already *was* kobo. Now there is a single `balanceDueMinor` computed once, handed to `toGatewayAmount(balanceDueMinor, 'paystack')`. Same file, two hundred lines down, renders that same field with a bare `formatMoney` — the two no longer contradict each other.

**Flutterwave checkout (N2).** `:222` passed raw minor units to an SDK expecting major. Now `toGatewayAmount(balanceDueMinor, 'flutterwave')`.

**Both webhooks (N3).** `paystack-webhook/index.ts` computed `data.amount / 100` and compared it against a BIGINT minor total, so the comparison was false for any realistic figure and a fully-paid invoice was permanently stamped `PARTIAL` with `amount_paid` written 100× too low. Both webhooks now convert through `fromGatewayAmount` so **both sides of the comparison are minor units**. I kept your structure untouched — fetching `total` and `currency`, verifying the currency, branching `PAID`/`PARTIAL` — because that structure was correct. Only the units were wrong.

While in there I also replaced `hash !== signature` with a constant-time `timingSafeEqual` comparison in both, and left an explicit `TODO` in the Flutterwave handler about re-verifying via their transactions API. I did not implement that: it needs the merchant's Flutterwave *API secret*, which is a different credential from the `verif-hash` you currently store, so it needs a new column before it can be done honestly.

**Quote counter-offers (N4).** `PublicQuote.tsx:188` sent the client's typed major figure straight into a BIGINT minor column. Now `toMinor(counterAmount)`, which fixes both symptoms at once: the minimum-counter guard compares like with like instead of rejecting nearly every legitimate offer, and `Quotes.tsx:238` computes a sane ratio instead of ~1/100 — so your tax-proration logic, which was always correct, finally receives a correct input. The error message now renders through `formatMoney` instead of printing a raw integer.

**One more I found while reading.** `PublicInvoice.tsx:172` — the "I've transferred the funds" button — passed `p_amount_paid: invoice.amount_paid || 0` into the *additive* RPC. Every click re-added the existing amount to itself. That is live data corruption on a button a client is actively encouraged to press. All three public RPC call sites now send status only. The webhook is the single writer of `amount_paid` and the only thing that may set `PAID`, which is the correct trust boundary: the browser is not a source of payment truth.

---

## 3. The remaining unit leaks

Reminder emails (`email-cron`) interpolated raw minor units, so a client was told their invoice was for "NGN 150050" — now `toMajorString`. Invoice and quote CSV exports passed raw minor units to `exportToCsv`; your earlier fix had covered only the tax report. The Dashboard's two chart axes read minor units while the tooltip on the same chart used `formatMoney`, so they disagreed by 100× — both now use a new shared `formatCompactMinor`, and I refactored `Reports.tsx` to use it too so there is one implementation rather than three.

`RevenueChat.tsx` wrote LLM-returned prices straight to Dexie as minor units, turning "3 hours at ₦150/hr" into a ₦4.50 invoice. Line items and fixed-amount taxes now convert with `toMinor`; percentage taxes multiply an already-minor subtotal so they only needed `roundMoney`.

And a leak nobody had flagged: the AI prompts. `get_ai_context` returns minor units, so your CFO report was describing a ₦1,500.50 invoice as "150050". Rather than instructing the model to divide — language models are unreliable at arithmetic — I added `convertMoneyFieldsToMajor`, which walks the context JSON and converts known money keys deterministically before the model ever sees it. `rate` is deliberately excluded from that key set, because it is a tax percentage, not an amount.

---

## 4. The database and the dropped objects

`20261011000000_fix_audit_regressions.sql` is one idempotent migration in nine commented sections. The headline items:

**`check_and_log_rate_limit` was completely broken** and I think this is the most consequential non-money finding. It still filtered and inserted on `api_logs.user_id`, a column the multi-tenant migration dropped, while `organization_id` is `NOT NULL`. Both statements raised. Its live callers are the `ai` and `send-email` edge functions — so AI *and* transactional email have been failing. I kept the signature byte-identical so no caller needs changing, and moved the user→organization lookup inside. It now fails closed when there is no membership row; previously that path returned `TRUE` without recording the attempt.

**`empty_trash_based_on_plan` was equally broken** — still joining the dropped `profiles` table on the dropped `user_id`. Because the body is PL/pgSQL, `DROP TABLE ... CASCADE` neither dropped nor rewrote it, so the daily `pg_cron` job has been erroring and your 7/30-day retention has silently not run. Rewritten against `organizations`.

**The AI quota (C9) is now real.** The edge function read `profiles.is_pro` (gone) and counted `api_logs.user_id` (gone), so the lookup returned null, *every* user including Pro fell into the free branch, the count errored, `count` came back null, and the limit check evaluated false — **it failed open**. It now resolves tenancy through `organization_members → organizations`, respects `pro_expires_at` rather than just the boolean, counts within the current calendar month, gates `cfo-report` as Pro-only, and **fails closed** on every error path. I also changed the rate-limit check from log-and-continue to fail-closed; it previously only logged, which meant that while the RPC was broken the rate limit was not merely absent but silently bypassed on a metered third-party API.

**The C2 regression is reversed.** `amount_paid` is `= COALESCE(p_amount_paid, amount_paid)` again — set, never increment — and `'PARTIAL'` is out of the public allow-list alongside `'PAID'`. I also added a guard refusing to move an already-settled invoice backwards from a public link. All overloads are dropped before the single definition is created, so the `PGRST203` ambiguity that caused the original regression cannot recur.

**The rate limiter.** It keyed on the whole `X-Forwarded-For` header, which a caller sets themselves and can rotate freely. It now takes only the leftmost token. More importantly, I changed the shape of the protection: keying on `(ip, document)` alone gives a rotating attacker an unbounded budget, while keying on the document alone — the pre-October behaviour — let an attacker burn a legitimate client's five attempts and block them from accepting a quote. Neither works alone, so both now apply: a tight per-source-per-document limit plus a generous per-document ceiling that a real client will never reach.

**Free tier, per your spec: 5 clients, 10 invoices per month, 10 quotes per month.** Worth flagging that this was more wrong than the number suggested. The trigger counted **lifetime** documents, not a monthly window, so it was the wrong *kind* of limit. The cap had also been silently changed from 10 to 5 inside a migration titled "fix remaining legacy triggers". And the branch counting clients was dead code — the trigger was only ever attached to `invoices` and `quotes`, so **your 5-client limit was never enforced server-side at all**. It is now, via a new `enforce_client_quota` trigger, with clients treated as a standing total and documents as a monthly flow. An expired Pro subscription no longer counts as Pro, and a missing organization now raises instead of falling through to no enforcement.

**Security hardening.** `is_member_of` gets `SET search_path` — it was the only `SECURITY DEFINER` function missing it, and the most privileged. I also set its owner explicitly, because the absence of RLS recursion depends entirely on ownership and that was previously an undocumented accident. A companion `is_org_owner` now makes the `role` column mean something: `organization_members` gains owner-gated INSERT/UPDATE/DELETE policies, which both closes the escalation question and makes multi-tenancy *reachable* — it had only a SELECT policy, so no member could ever be added through the API. `get_public_profile` was `SELECT *` over `organizations` callable by `anon`; it now returns an explicit nine-column list, verified against what the public pages actually render. `email`, `phone`, `pro_expires_at` and `email_flags` are no longer exposed. The untenanted three-argument `check_rate_limit` overload — one global bucket shared by every tenant — is dropped.

---

## 5. Tests, CI and monitoring

**Monitoring is real now.** `monitoring.ts` was a stub in which every `init` call was commented out and neither SDK was imported, while logging "Sentry initialized." Both are now genuinely initialised, via dynamic import so they stay out of the main bundle — which matters for an offline-first PWA. `ErrorBoundary.componentDidCatch` now calls `captureError` instead of only `console.error`, so crashes actually leave the browser. There are `trackEvent`, `identifyUser` and `resetUser` helpers ready for funnel work.

Two deliberate choices given this is financial data: `maskAllText` and `blockAllMedia` on session replay, `autocapture: false` and `mask_all_text` on PostHog, and a `beforeSend` hook that redacts document IDs out of error URLs — those IDs act as bearer tokens on public links and must not land in a third-party error report. Both keys are now documented in `.env.example`, which previously listed one feature flag and nothing else.

**CI will now run.** `no-explicit-any` is a warning, `dev-dist` is ignored, and the job order is type-check → test → build → lint, so a style regression can no longer prevent the three steps that matter from reporting. Node is pinned to 22.x because Vite 8 needs ≥20.19/≥22.12 and `20.x` could resolve too low.

**Tests.** `money.test.ts` is new: 50-odd assertions where each regression test is named after the actual bug and carries the `file:line` it came from, so the next person understands *why* it exists. `formatters.test.ts` now covers `formatMoney` — previously untested, despite being the function that encodes the entire minor-units contract.

I also repaired `syncEngine.test.ts`, which I believe was failing. Its Supabase mock lacked `limit` and `single`, so the engine's tenant lookup would have thrown before reaching the code under test, and it asserted `onConflict: 'local_id'` — which matched neither the code nor your completion report. The real unique constraint is `(organization_id, local_id)`, verified in the migration, and `syncEngine.ts:299` had `'organization_id, local_id'` **with a space**. PostgREST wants no whitespace; the space makes it look for a column named `" local_id"`. Your Phase 7 notes said this was fixed — it was not in the file. It is now, and the test asserts it with a comment explaining why the space matters.

**`formatMoney`'s locale.** This closes an original-audit finding and a CI flake together. It passed `undefined`, i.e. *the viewer's* browser locale, so the same invoice rendered differently for you and your client. Pinning to `en-US` was my first fix and it was wrong — I checked, and `en-US` renders NGN as "NGN 1,500.50", dropping the ₦ entirely, which is a visible regression for your primary market. The locale is now derived from the **currency**: NGN→en-NG gives ₦1,500.50, GBP→en-GB gives £1,500.50. Deterministic and correct symbols. I verified every expected string empirically rather than guessing, and updated the committed `DocumentPreview` snapshot from `US$3.00` to `$3.00` to match.

---

## 6. What I could not verify, and one correction

**I could not run vitest.** Your `node_modules` holds Windows-built native binaries for Vite 8's bundler, so it cannot execute in my Linux sandbox. I compensated by transpiling `money.ts` and executing all 50 assertions standalone — they pass, and I verified every `Intl` output string empirically. But **you must run `npm test` and `npm run build` on Windows before pushing**, per your own `.agents/rules/git-push-policy.md`. I expect the suite to pass; I cannot promise it.

**I could not apply the migration.** I have no database access. The SQL is structurally checked — balanced dollar-quoting, nine functions plus one `DO` block, balanced parens — but structurally valid is not the same as correct against your live schema. Run it against a branch or staging database first. Two specific risks: the `ALTER COLUMN ... SET NOT NULL` on `organization_members` will fail if rows reappear with NULLs between my `DELETE` and the `ALTER` (unlikely in one transaction, but it is a shared database), and `DROP FUNCTION get_public_profile ... CASCADE` will drop any dependent object you have created since.

**A correction to my previous report.** I listed the blanket policy drop as destroying three `AS RESTRICTIVE` app-version kill-switches and recommended restoring them. Reading their actual definitions, they pin `x-app-version = '1.3.1'` while your app is 1.5.0 — restoring them verbatim would **deny all reads from the current app**. Dropping them was a fix, not a regression. I have not restored them. If you want a version gate, it needs to be a minimum-version comparison, not equality. I was wrong about that one and you should not act on the earlier recommendation.

**Also worth knowing:** `server/supabase/schema.sql` is stale. It still shows `clients_user_id_local_id_key` and `user_id NOT NULL`, meaning it was dumped *before* the multi-tenant migration. The version-controlled schema does not reflect your live database. Re-dump it after applying this migration, otherwise the gap that made your authorization model unauditable is still open in practice.

---

## 7. Data repair — inspect before you touch anything

If any customer paid while the 100× bug was live, you have bad rows. These queries show you the damage; none of them write. Run them before deciding anything.

```sql
-- 1. Invoices stuck PARTIAL where the recorded payment is suspiciously close to
--    1/100th of the total — the signature of the webhook unit bug.
SELECT local_id, invoice_number, currency, total, amount_paid, status, updated_at
FROM public.invoices
WHERE status = 'PARTIAL'
  AND amount_paid > 0
  AND ABS((amount_paid * 100.0) - total) < (total * 0.02)
ORDER BY updated_at DESC;

-- 2. Any invoice whose amount_paid exceeds its total — the additive-RPC bug,
--    most likely from repeated "I've transferred the funds" clicks.
SELECT local_id, invoice_number, currency, total, amount_paid, status
FROM public.invoices
WHERE amount_paid > total
ORDER BY (amount_paid - total) DESC;

-- 3. Counter-offers stored ~100x too small (quote counter-offer unit bug).
SELECT local_id, quote_number, currency, total, counter_amount, minimum_counter_amount, status
FROM public.quotes
WHERE counter_amount IS NOT NULL
  AND counter_amount > 0
  AND counter_amount < (total / 50)
ORDER BY updated_at DESC;

-- 4. Quotes already ACCEPTED off a bad counter-offer — these have had their
--    totals rewritten and need manual review against what was agreed.
SELECT local_id, quote_number, currency, subtotal, total, counter_amount, updated_at
FROM public.quotes
WHERE status = 'ACCEPTED'
  AND counter_amount IS NOT NULL
  AND total < (subtotal / 2)
ORDER BY updated_at DESC;
```

If query 1 returns rows, cross-check each against the gateway dashboard before correcting — the gateway is the authority on what was actually collected, not your database. **If query 2 returns rows, or if any customer was charged 100×, that is a refund conversation, not a database fix.**

---

## 8. What I deliberately did not do

I did not implement Flutterwave transaction re-verification, because it needs a credential you do not store yet — there is a `TODO` at the call site explaining exactly what is missing.

I did not add webhook transaction-reference idempotency. Both handlers set absolute values rather than incrementing, so replay is not a double-count risk today. Storing the gateway reference would help reconciliation and I would do it next, but it needs a column and I wanted this migration narrow enough to review line by line.

I did not type the ~250 `any` usages. You chose the warning route, which I agree with — doing that mechanically across 46 files in the same pass as payment fixes would have made this diff unreviewable.

I did not touch the manual-transfer checkout, the duplicated quote/invoice pages, or `organization_id` team features beyond making the policies correct. Those are product decisions and architecture work, not defects.

And I did not fix the `s c r a t c h /` line in `.gitignore` — it is UTF-16 bytes from a PowerShell `>>` redirect, same as `env.d.ts` was, so it does not match anything. I rewrote `env.d.ts` as UTF-8 since it was breaking the type check, but left `.gitignore` to you since you added that line deliberately. Use `Out-File -Encoding utf8` or edit in VS Code and it will work.

---

## 9. Files changed

**New:** `client/src/utils/money.ts`, `client/src/utils/money.test.ts`, `server/supabase/functions/_shared/money.ts`, `server/supabase/migrations/20261011000000_fix_audit_regressions.sql`

**Client:** `utils/formatters.ts`, `utils/formatters.test.ts`, `pages/PublicInvoice.tsx`, `pages/PublicQuote.tsx`, `pages/Invoices.tsx`, `pages/Quotes.tsx`, `pages/Dashboard.tsx`, `pages/Reports.tsx`, `components/RevenueChat.tsx`, `components/ErrorBoundary.tsx`, `components/__snapshots__/DocumentPreview.test.tsx.snap`, `services/syncEngine.ts`, `services/syncEngine.test.ts`, `store/useAppStore.ts`, `lib/monitoring.ts`, `src/env.d.ts`, `.env.example`, `eslint.config.js`

**Server:** `functions/paystack-webhook/index.ts`, `functions/flutterwave-webhook/index.ts`, `functions/email-cron/index.ts`, `functions/ai/index.ts`

**Root:** `.github/workflows/ci.yml`

---

## 10. Closing

The pattern from the last report held exactly. Every critical I fixed was a *composition* failure: correct webhook logic fed wrong units, correct tax proration fed a wrong ratio, correct quota control flow querying a dropped table, correct logout cleanup clearing an obsolete key. None of it was bad code. All of it stopped being true when two sweeping migrations moved the ground underneath it.

So the fix that matters most here is not any of the twenty-odd individual repairs. It is `money.ts` plus the tests that assert the boundary, and `monitoring.ts` actually sending data. Those two files are the difference between finding the next one of these in an hour and finding it in a quarter.

Your immediate sequence: run the migration on a branch database, run the section 7 queries against production and look hard at the output, run `npm test` and `npm run build` on Windows, then deploy migration → edge functions → client together. After that, set `VITE_SENTRY_DSN` and `VITE_POSTHOG_KEY` and watch for a week before building anything new.

---

*All changes verified with `npx tsc -b --force` (exit 0) and 50 standalone assertions over the money boundary. Vitest and the migration could not be executed in this environment — section 6 states precisely what that leaves unverified. No `.env` file was opened at any point.*
