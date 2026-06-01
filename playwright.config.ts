// Playwright config for liqZAR end-to-end tests.
//
// Pattern lifted from the sibling ArtisanZA project (May 2026):
//
//   role-setup project (UI-logs in via /auth demo buttons, saves storageState)
//        │
//        ▼
//   role-flow project (loads that storageState; tests run pre-authenticated)
//
// Why this matters: liqZAR's /auth page already exposes DEV-only quick-login
// buttons via WEB_TEST_USERS (customer + admin only — driver is mobile-only).
// In `__DEV__` / `MODE !== "production"` mode, `devAutoLogin` short-circuits
// the SMS-OTP flow so we can mint a real authenticated session without any
// SMS provider in the loop. The session token Supabase persists to
// `localStorage["sb-…-auth-token"]` gets captured into `playwright/.auth/*.json`
// and re-attached to every later test that names that storageState — so
// downstream tests start logged-in in <100ms.
//
// Local run:
//   pnpm dev              # in another shell (Vite on :8080)
//   pnpm test:e2e         # or `pnpm test:e2e:smoke` for the 60-second subset
//
// CI: GitHub Actions sets PLAYWRIGHT_BASE_URL=http://localhost:8080 and runs
// the same command. See .github/workflows/e2e.yml.

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080";

// Origin used inside Playwright's `storageState.origins` entries. Must EXACTLY
// match the navigation origin (scheme + host + port, no trailing slash).
const ORIGIN = new URL(BASE_URL).origin;

// liqZAR mounts an <AgeGate> at the App root that blocks every route until the
// user clicks "I'm 18+". The gate persists its decision in localStorage as
// `liqzar-age-verified=true`. Pre-seeding it via storageState skips the modal
// on every test run — same effect as a returning user.
//
// Authed projects also carry their Supabase session in storageState; they get
// this baseline merged with the auth tokens at runtime (setup files reuse this
// state, then save the combined state to disk).
const AGE_VERIFIED_STATE = {
  cookies: [],
  origins: [
    {
      origin: ORIGIN,
      localStorage: [{ name: "liqzar-age-verified", value: "true" }],
    },
  ],
};

export default defineConfig({
  testDir: "./tests/e2e",
  // Match ArtisanZA: 60s per test, 10s per expect — generous so a slow CI
  // runner doesn't cause flakes, but tight enough that a real hang surfaces.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Workers serialised on CI so Supabase rate-limits + Vite HMR don't fight
  // each other. Locally Playwright picks based on core count.
  workers: process.env.CI ? 1 : undefined,
  // Retry on CI only — locally a flaky test should fail loudly so it gets fixed.
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Most setups click the demo button → wait for /admin or / — 15s covers
    // a cold Vite restart + Supabase sign-in roundtrip.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  // Auto-start `pnpm dev` if Playwright is invoked without a running server.
  // Skipped on CI where the workflow spins the server up itself for clearer
  // logs + tighter control over readiness.
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm dev",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },

  projects: [
    // ── Setup: mint storageState per role ────────────────────────────────────
    // These run FIRST (no dependencies). The *-flow projects below depend on
    // them and load the produced JSON via `storageState`.
    {
      name: "setup-customer",
      testMatch: /customer\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"], storageState: AGE_VERIFIED_STATE },
    },
    {
      name: "setup-admin",
      testMatch: /admin\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"], storageState: AGE_VERIFIED_STATE },
    },

    // ── Public-route specs (no auth needed) ──────────────────────────────────
    // These run in parallel with the setup projects. Each carries the
    // age-gate bypass so the modal never blocks the assertion.
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], storageState: AGE_VERIFIED_STATE },
    },
    {
      name: "a11y",
      testMatch: /a11y\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], storageState: AGE_VERIFIED_STATE },
    },
    {
      name: "perf",
      testMatch: /perf-budget\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], storageState: AGE_VERIFIED_STATE },
    },

    // ── Authed role flows ────────────────────────────────────────────────────
    {
      name: "customer-flow",
      testMatch: /customer-flow\.spec\.ts$/,
      dependencies: ["setup-customer"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/customer.json",
      },
    },
    {
      name: "admin-flow",
      testMatch: /admin-flow\.spec\.ts$/,
      dependencies: ["setup-admin"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/admin.json",
      },
    },

    // ── Mobile viewport regression for the customer surface ─────────────────
    // 390×844 = iPhone 14. We don't run a separate iOS engine — Chromium in
    // a mobile viewport catches 95% of touch/layout regressions at 5% of the cost.
    {
      name: "mobile-viewport",
      testMatch: /smoke\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        storageState: AGE_VERIFIED_STATE,
      },
    },
  ],
});
