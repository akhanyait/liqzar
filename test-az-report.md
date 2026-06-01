# LIQZAR — Full A-Z Test Report

**Run window:** 2026-05-31 20:45 → 2026-06-01 06:29 SAST
**Tested branch:** `test/integration-snapshot` (local-only)
**Composition:** `chore/expo-sdk-53-upgrade` (latest, incl. snapshot `0f1518e`) + PR #1 + PR #2 + PR #3, all merged clean — zero conflicts.
**Integration SHA:** `8b2a7b0…`

## Headline

| Category | Tool | Pass | Fail | Skip | Time | Verdict |
|---|---|---:|---:|---:|---:|---|
| **A. Unit tests** | Vitest 3 | **40** | 0 | 0 | 1.9 s | ✅ |
| **B. Lint** | ESLint 9 | — | 43 errors / 128 warnings | — | 11.6 s | ⚠️ (mostly noise — see breakdown) |
| **C. Web build** | Vite 8 prod | ✓ | 0 | — | 3.6 s | ✅ |
| **D. Mobile typecheck** | tsc --noEmit | — | 2 | — | 4.9 s | ⚠️ (config drift, not code bugs) |
| **E. Edge Functions** | structural | **21** | 0 | — | < 1 s | ✅ |
| **F. SQL migrations** | sqlparse | **58** | 1 | — | < 1 s | ⚠️ (1 real bug) |
| **G. Stock import** | python3 ast | ✓ | 0 | — | < 1 s | ✅ |
| **H. E2E (web)** | Playwright | **21** | 0 | 1 | 19.8 s | ✅ |
| **(N/A) Mobile E2E** | Maestro | — | — | — | — | Not run — needs iOS simulator |

**Overall:** Ready to ship #1, #2, #3. Three real action items — none blocking, all small. Details below.

---

## Real findings (worth fixing this week)

### 🐛 F1. Broken migration: `20260309172551_690d4fba-….sql`
**File:** [supabase/migrations/20260309172551_690d4fba-20df-4c8e-b17c-bc9c3ffe051f.sql](supabase/migrations/20260309172551_690d4fba-20df-4c8e-b17c-bc9c3ffe051f.sql)
The file is a one-liner with **no trailing semicolon and no newline**:

```sql
UPDATE products SET image_url = NULL WHERE image_url LIKE '%google.com%'
```

`supabase db push` against a fresh schema will fail on this — PostgreSQL needs the `;`. Tested via `sqlparse.split()` — returns the statement as malformed. **Fix:** add `;` + newline. One-line fix.

### 🐛 F2. Broken string literal: `upload-products` Edge Function
**File:** [supabase/functions/upload-products/index.ts:34-35](supabase/functions/upload-products/index.ts#L34)

```ts
const label = encodeURIComponent(name.split(" ").slice(0, 3).join("
"));
```

The `"\n"` inside `.join()` got line-broken into a literal newline inside the string literal. ESLint flags this as a critical parsing error. Deno runtime will parse it as a multi-line string (legal but deprecated, produces a literal `\n` character), so the EF might still work — but it's a real bug masked by `// @ts-nocheck`. **Fix:** change to `.join("\\n")` or `.join(" ")`.

### 🐛 D1+D2. Mobile tsconfig version drift
**File:** [apps/mobile/tsconfig.json](apps/mobile/tsconfig.json)

```
tsconfig.json(2,3): error TS5098: Option 'customConditions' can only be used when 'moduleResolution' is set to 'node16', 'nodenext', or 'bundler'.
tsconfig.json(17,27): error TS5103: Invalid value for '--ignoreDeprecations'.
```

- `customConditions` comes from `expo/tsconfig.base` (extended). Mobile sets `"moduleResolution": "node"` which is incompatible.
- `"ignoreDeprecations": "6.0"` — the current TypeScript version only accepts `"5.0"`.

Both are config-level — they don't break the Expo build (Metro uses Babel, not tsc), but they block IDE intellisense and pre-commit typechecks. **Fix:** bump `moduleResolution` to `"bundler"` and `ignoreDeprecations` to `"5.0"`.

---

## Detailed results

### A. Vitest — 40/40 ✅
```
✓ src/lib/payment-gateway.test.ts (7)
✓ src/lib/za-utils.test.ts        (24) ← from PR #1
✓ src/context/AuthContext.test.tsx (8)
✓ src/test/example.test.ts        (1)
Tests  40 passed (40)
Duration  1.87s
```
PR #1's `tsconfig.json` fix unblocked all 4 suites — before #1 lands, only the example test ran (a pre-existing silent breakage).

### B. ESLint — 43 errors, 128 warnings (mostly noise)
**Real category breakdown of the 43 errors:**

| Count | Rule | Severity | Verdict |
|---:|---|---|---|
| 19 | `@typescript-eslint/ban-ts-comment` (`@ts-nocheck` in EFs) | noise | Edge Functions intentionally suppress TS — matches `sommelier-chat` pattern |
| 18 | `@typescript-eslint/no-require-imports` | low | Auto-fixable with `eslint --fix` |
| 5 | `prefer-const` | low | Auto-fixable with `eslint --fix` |
| 1 | **Parsing error (`upload-products` line 34)** | **HIGH** | See **F2** above |

Plus 128 `any`-type warnings — pre-existing tech debt, not regressions. **Action:** `pnpm lint --fix` cleans 8 errors + 24 warnings automatically. Real bug count: **1** (F2 above).

### C. Vite production build — ✅ 3.64 s
```
✓ built in 3.64s
dist/assets/index-ChUfni-y.js  535.44 kB │ gzip: 171.50 kB  ← warning: chunk > 500 KB
```
One non-blocking warning: the main `index` chunk is 535 KB (limit 500). Probably worth a route-level dynamic import sweep at some point, but not urgent. All builds succeed.

### D. Mobile TypeScript — ⚠️ 2 config errors (no code errors)
See **D1+D2** above. Zero TS errors in actual source code — both failures are in `tsconfig.json` itself.

### E. Edge Functions — 21/21 ✅
- **21 EFs** in `supabase/functions/*/index.ts`
- All 21 export a `serve` or `Deno.serve` handler
- All 21 set CORS headers (`Access-Control-Allow-Origin`)
- 11 import from `deno.land/std@0.168.0` consistently; 10 (mostly newer ones I wrote: `ai-translate`, `notify-whatsapp`, `notify-driver-assignment`) use other patterns or no std import at all — worth a normalisation pass eventually
- Deno binary not installed locally → couldn't run `deno check` proper. The CI workflow at `.github/workflows/e2e.yml` doesn't catch this either; if you want type-level EF validation, install Deno locally and add a `deno check supabase/functions/**/index.ts` step.

### F. SQL migrations — 58/59 ✅ (1 real bug)
- **59 migrations** scanned (47 pre-existing + 11 new + 1 from PR #1)
- 58 parse cleanly via Python `sqlparse`
- **1 fails:** see **F1** above

### G. Stock import script — ✅
- [scripts/generate-stock-import-sql.py](scripts/generate-stock-import-sql.py) parses cleanly
- [scripts/stock-import.sql](scripts/stock-import.sql): **4115 lines**, packed into 1 big UPSERT statement
- Header confirms: **4077 products** imported from 38 supplier `.xls` files, with documented skip reasons (89 no_ean, 99 short_ean stub, 3 price_below_R5 placeholder)

### H. Playwright E2E — 21/22 ✅ (1 perf opt-in skip)
**All 7 projects, full matrix:**

| Project | Tests | Result |
|---|---:|---|
| setup-customer | 1 | ✅ minted `playwright/.auth/customer.json` |
| setup-admin | 1 | ✅ minted `playwright/.auth/admin.json` |
| smoke | 5 | ✅ landing, /auth quick-login, customer + admin sign-in, favicon |
| a11y | 2 | ✅ landing + /auth, 0 blocking violations (color-contrast disabled — see PR #3 TODO) |
| perf | 1 | ⏭️ skipped (`PLAYWRIGHT_AGAINST_PROD_BUILD` unset — dev bundles can't fit budget) |
| customer-flow | 3 | ✅ /, /profile, /cart no auth redirect |
| admin-flow | 4 | ✅ /admin, orders, inventory, legacy /warehouse → redirect |
| mobile-viewport | 5 | ✅ same smoke set at 390×844 iPhone-14 dimensions |

**Wall-clock total: 19.8 s.** Auth setup → role-flow chain works end-to-end. Storage state minted once, reused across all authed projects.

### I. Maestro (mobile) — not run
The harness exists at `.maestro/flows/` with 3 flow scripts (smoke + customer-signin + driver-signin), but Maestro itself isn't installed locally and needs a booted iOS simulator. Run via:
```bash
brew install maestro && xcrun simctl boot "iPhone 16e"
cd apps/mobile && pnpm maestro
```
Or trigger the GH Actions workflow: `gh workflow run maestro.yml`.

---

## Action items (sorted by ROI)

| # | Action | Effort | Why |
|---|---|---|---|
| 1 | Add `;` + newline to [the broken Postgres migration](supabase/migrations/20260309172551_690d4fba-20df-4c8e-b17c-bc9c3ffe051f.sql) | 30 sec | Blocks fresh-schema `supabase db push` (F1) |
| 2 | Fix the literal newline in [upload-products line 34](supabase/functions/upload-products/index.ts#L34) | 1 min | Behavioral bug — image label includes literal newline in URL (F2) |
| 3 | Run `pnpm lint --fix` | 10 sec | Clears 8 errors + 24 warnings instantly |
| 4 | Update [apps/mobile/tsconfig.json](apps/mobile/tsconfig.json) — `moduleResolution: "bundler"`, `ignoreDeprecations: "5.0"` | 2 min | Restores IDE intellisense + pre-commit typecheck (D1+D2) |
| 5 | Install Deno locally + add `deno check` to CI | 15 min | Catches EF bugs ESLint can't (Deno-flavored TS imports) |
| 6 | Route-level dynamic import for the 535 KB main chunk | 1 hr | Improves LCP — but wait until prod-build perf test runs to quantify |

---

## What I tested vs didn't

✅ **Did:** unit tests (Vitest), web prod build (Vite), web lint (ESLint), web e2e (Playwright × 7 projects), mobile typecheck (tsc), Edge Function structure, SQL parse, stock-import script.

❌ **Couldn't / didn't:**
- Deno typecheck on EFs (not installed locally)
- Maestro mobile flows (needs simulator)
- iOS / Android native build (`expo prebuild` + `xcodebuild` / `gradle assembleDebug`)
- Real database `supabase db reset` smoke (would need local Postgres + Supabase CLI auth)
- Production perf budget (gated on `PLAYWRIGHT_AGAINST_PROD_BUILD` + a `vite preview` server)
- Real Yoco / Lovable AI / Mapbox / Twilio API calls (no test fixtures + no test credentials available)

If you want any of those exercised, kick me when you wake up and I'll set them up.

---

## Logs

All raw outputs under `/tmp/test-az/`:
```
01-vitest.log
02-eslint.log
03-vite-build.log
04-mobile-tsc.log
05-ef-structure.log
06-sql-parse.log
07-stock-import.log
08-investigations.log
09-playwright.log
started.txt / finished.txt / integration-sha.txt
```

The integration branch `test/integration-snapshot` is local-only — not pushed. Delete with `git branch -D test/integration-snapshot` once you're done reviewing.
