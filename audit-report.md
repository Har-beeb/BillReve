# 🔍 BillReve — Audit Reports

This document logs all technical audits performed on the BillReve codebase, tracking what was found, what was fixed, and what remains.

---

## Audit #1 — September 29, 2026

**Auditor**: AI-assisted full codebase review  
**Branch**: `master`  
**Version**: 1.4.1  
**Scope**: Full stack — frontend, backend, database, security, performance

---

### Summary

A comprehensive audit covering all pages, components, edge functions, database schema, sync engine, AI integration, and security. All 4 previously-documented tech debt items from the README have been confirmed **resolved**.

---

### Tech Debt — Resolved ✅

| # | Issue | Fix | File(s) |
|---|---|---|---|
| 1 | `logo_url` stored as base64 in DB | Auto-migration on login uploads base64 to `logos` bucket, saves public URL | `client/src/App.tsx` |
| 2 | AI context size grows with invoice count | Time-boxed to 90 days; older data aggregated into `historicalSummary` | `client/src/components/RevenueChat.tsx` |
| 3 | Client clock drift affects LWW resolution | `syncServerTime()` fetches server `Date` header to compute `serverTimeOffsetMs` | `client/src/services/syncEngine.ts` |
| 4 | `is_pro` not swept for expired subscriptions | Failsafe cron sweep sets `is_pro = false` when `pro_expires_at < now()` | `server/supabase/functions/email-cron/index.ts` |

---

### Bugs Fixed During This Cycle

| # | Bug | Root Cause | Fix |
|---|---|---|---|
| 1 | `401 Unauthorized` loop on `/auth/v1/health` | `apikey` header was stripped from the health check fetch | Re-added `headers: { apikey }` to `syncServerTime()` |
| 2 | `500 Internal Server Error` on AI chat | Chat history sent non-alternating `user/model` messages to Gemini | Added `sanitizeHistory()` to guarantee strict alternation |
| 3 | `500` on all AI features (insights + draft-email) | Google Gemini `503 UNAVAILABLE` — free tier congestion | Transient; resolved itself. No code change needed |
| 4 | README logo not displaying on GitHub | Pointed to `logo192.png` which doesn't exist; actual file is `pwa-192x192.png` | Changed to relative path `./client/public/pwa-192x192.png` |

---

### Current Issues — Open

| # | Issue | Severity | Details |
|---|---|---|---|
| 1 | Public RPCs have no rate limiting | 🔴 Critical | `update_invoice_status_public` and `update_quote_status_public` can be called by anyone without throttling or CAPTCHA |
| 2 | Bank account referential integrity | 🟡 Medium | Invoices reference bank account IDs from `profiles.bank_accounts` JSON. If a user deletes a bank account, historic invoices silently lose payment context |
| 3 | `Upgrade.tsx` dead code | 🟢 Low | Large blocks of commented-out Paystack integration code clutter the component |

---

### Performance Optimization Opportunities

| # | Optimization | Impact | Effort |
|---|---|---|---|
| 1 | Move `html2pdf.js` to a Web Worker | 🔴 High — prevents UI freeze on mobile | Medium |
| 2 | Add exponential backoff to sync retries | 🟡 Medium — prevents tight loops on flaky connections | Low |
| 3 | Pre-aggregate AI context server-side via RPC | 🟡 Medium — reduces payload and token cost | Medium |
| 4 | Adaptive sync polling (10s active → 60s idle) | 🟢 Low — reduces Supabase log ingestion | Low |
| 5 | Code-split `pdfGenerator` chunk (938 KB) | 🟡 Medium — heaviest JS bundle | Low |

---

### Security Review

| Area | Status | Notes |
|---|---|---|
| Row Level Security (RLS) | ✅ Active | All tables have RLS policies |
| API key exposure | ✅ Safe | Gemini, Resend, Paystack keys are server-side only (Edge Functions) |
| Public RPCs | ⚠️ At Risk | No rate limiting or CAPTCHA on public mutation endpoints |
| Auth sessions | ✅ Secure | Supabase native JWT session handling |
| CORS | ✅ Configured | `Access-Control-Allow-Origin: *` on Edge Functions (standard for SPA) |

---

### Prioritized Action Items

#### 🔴 Critical
1. Add rate limiting / Cloudflare Turnstile CAPTCHA on public RPC endpoints

#### 🟠 High Priority
2. Snapshot bank account details into invoice record at creation time
3. Clean up `Upgrade.tsx` — extract Paystack code into feature-flagged component

#### 🟡 Medium Priority
4. Move PDF generation to a Web Worker
5. Add Supabase DB constraint rejecting `data:image` strings in `logo_url`
6. Code-split the `pdfGenerator` chunk

#### 🟢 Nice-to-Have
7. Add exponential backoff to sync engine retries
8. Implement adaptive sync polling intervals (10s active → 60s idle)
9. Pre-aggregate AI context data server-side

---

### Architecture Health Score

| Category | Rating |
|---|---|
| **Overall Architecture** | ⭐⭐⭐⭐⭐ Excellent |
| **Sync Engine** | ⭐⭐⭐⭐⭐ Excellent — LWW with clock drift correction |
| **TypeScript Coverage** | ⭐⭐⭐⭐ Good — full type coverage |
| **Component Modularity** | ⭐⭐⭐⭐ Good — Settings/Editor broken into subcomponents |
| **Security** | ⭐⭐⭐⭐ Good — RLS everywhere, but public RPCs need hardening |
| **Performance** | ⭐⭐⭐ Adequate — PDF generation and bundle size need attention |
| **Code Cleanliness** | ⭐⭐⭐⭐ Good — minor dead code in Upgrade.tsx |

---

*Next audit recommended after implementing the Critical and High Priority action items.*
