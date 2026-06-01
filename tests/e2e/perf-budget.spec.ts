// Performance budget on the landing page. Catches the kind of regression
// where a lazy-loaded heavyweight (Mapbox, Recharts) accidentally ends up
// in the critical bundle — those changes look harmless in a PR diff but
// can double LCP overnight.
//
// Budgets are deliberately loose enough to pass on a contended GitHub
// Actions runner but tight enough to flag a real regression. Tune in this
// file (not per-test) so a single PR can move the bar with a clear rationale.
//
// Numbers are budget *ceilings*, not targets — the team should aim for ~50%
// of these in practice. If a test is suddenly hovering at 95% of budget,
// that's the signal to investigate before it actually trips.

import { test, expect } from "@playwright/test";

const BUDGET = {
  lcp_ms: 4000, // LIQZAR landing is image-heavy (hero carousel) — 4s is generous
  cls: 0.15, // anything over 0.1 is noticeable; 0.15 leaves a buffer for CI variance
  first_paint_js_kb: 1800, // pre-load JS only (route-level lazy chunks excluded)
};

test("PB1 · landing LCP, CLS, and first-paint JS within budget", async ({
  page,
}) => {
  // Perf budgets are only meaningful against a PRODUCTION build (minified,
  // tree-shaken, no HMR runtime). The default `pnpm test:e2e` boots `pnpm dev`
  // which serves unminified source — so this spec is opt-in for now.
  //
  // To run it locally:
  //   pnpm build && pnpm exec vite preview --port 8080 &
  //   PLAYWRIGHT_AGAINST_PROD_BUILD=1 pnpm test:e2e:perf
  // CI: wire a second workflow that builds first, then runs this project.
  test.skip(
    !process.env.PLAYWRIGHT_AGAINST_PROD_BUILD,
    "Set PLAYWRIGHT_AGAINST_PROD_BUILD=1 and serve `vite preview` first — dev-mode bundles blow the budget.",
  );

  let firstPaintBytes = 0;
  let loadEventFired = false;

  // Sum the bytes of every .js response that arrived BEFORE the load event.
  // Lazy chunks (loaded on route nav) fall outside this window.
  page.on("response", async (res) => {
    if (loadEventFired) return;
    const url = res.url();
    if (url.endsWith(".js") || url.includes(".js?")) {
      try {
        firstPaintBytes += (await res.body()).length;
      } catch {
        /* opaque cross-origin or aborted — ignore */
      }
    }
  });
  page.once("load", () => {
    loadEventFired = true;
  });

  await page.goto("/", { waitUntil: "load" });

  // Wait the typical settle window for LCP (browser fires "final" after ~2.5s
  // of no larger element). PerformanceObserver buffers entries from before
  // we subscribed, so we don't miss the early frames.
  const vitals = await page.evaluate(() => {
    return new Promise<{ lcp: number; cls: number }>((resolve) => {
      let lcp = 0;
      let cls = 0;
      const lcpObs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          lcp = Math.max(lcp, (e as PerformanceEntry & { renderTime?: number }).renderTime ?? e.startTime);
        }
      });
      lcpObs.observe({ type: "largest-contentful-paint", buffered: true });

      const clsObs = new PerformanceObserver((list) => {
        for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
          if (!e.hadRecentInput) cls += e.value;
        }
      });
      clsObs.observe({ type: "layout-shift", buffered: true });

      setTimeout(() => resolve({ lcp, cls }), 2500);
    });
  });

  const firstPaintKb = Math.round(firstPaintBytes / 1024);

  // Always log — passing runs are useful for trend-tracking.
  console.log(`LCP: ${vitals.lcp.toFixed(0)} ms (budget ${BUDGET.lcp_ms})`);
  console.log(`CLS: ${vitals.cls.toFixed(3)} (budget ${BUDGET.cls})`);
  console.log(`First-paint JS: ${firstPaintKb} KB (budget ${BUDGET.first_paint_js_kb})`);

  expect(vitals.lcp).toBeLessThanOrEqual(BUDGET.lcp_ms);
  expect(vitals.cls).toBeLessThanOrEqual(BUDGET.cls);
  expect(firstPaintKb).toBeLessThanOrEqual(BUDGET.first_paint_js_kb);
});
