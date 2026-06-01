// Fast smoke suite — runs in under a minute, covers the surfaces that have
// to work for the app to be considered "up". Designed to be the first thing
// CI runs on every PR + the only thing the scheduled production check runs
// every 15 minutes.
//
// Any failure here is a P0 — the rest of the suite is allowed to be flaky;
// this one isn't.

import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("S1 · landing returns 200 with the LIQZAR title", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/LIQZAR|Liqzar/);
  });

  test("S2 · /auth renders quick-login buttons in dev mode", async ({ page }) => {
    const res = await page.goto("/auth");
    expect(res?.status()).toBe(200);
    // Driver is mobile-only; web exposes only Customer + Back-Office Admin.
    // AuthPage renders the demo buttons twice (prominent row + footer list)
    // so we use .first() to disambiguate from Playwright's strict mode.
    await expect(page.getByRole("button", { name: /Customer/ }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Back-Office Admin/ }).first(),
    ).toBeVisible();
  });

  test("S3 · Customer demo sign-in lands on the homepage", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: /Customer/ }).first().click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 20_000 });
  });

  test("S4 · Admin demo sign-in lands on /admin", async ({ page }) => {
    await page.goto("/auth");
    await page.getByRole("button", { name: /Back-Office Admin/ }).first().click();
    await page.waitForURL(/\/admin\b/, { timeout: 20_000 });
  });

  test("S5 · favicon is served", async ({ request }) => {
    const ico = await request.get("/favicon.ico");
    expect(ico.status()).toBe(200);
  });
});
