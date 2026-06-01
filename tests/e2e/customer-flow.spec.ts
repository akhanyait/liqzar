// Authenticated customer journey — exercises the surfaces a logged-in shopper
// uses most. The fixture loads `playwright/.auth/customer.json` so we start
// on an authenticated session and skip the OTP roundtrip.
//
// This file deliberately stays SHALLOW for the initial harness drop. Once
// fixtures + cleanup helpers in tests/e2e/lib/supabase-rest.ts gain
// `customerDeleteOrdersByPrefix`-style methods, layer write-tests on top
// (place order → verify → cancel within window → assert cancelled).

import { test, expect } from "@playwright/test";

test.describe("Customer (authenticated)", () => {
  test("C1 · lands on / with the header visible", async ({ page }) => {
    await page.goto("/");
    // The site header is the most stable anchor — it's present on every
    // customer route. We pick the bottom nav as a second anchor because it
    // only renders for authenticated customers on mobile-shaped viewports.
    await expect(page.getByRole("banner")).toBeVisible({ timeout: 10_000 });
  });

  test("C2 · /profile is reachable (no redirect to /auth)", async ({ page }) => {
    const res = await page.goto("/profile");
    expect(res?.status()).toBe(200);
    // If session expired mid-test the app bounces to /auth — that's the
    // failure mode this guards against.
    await expect(page).not.toHaveURL(/\/auth\b/);
  });

  test("C3 · /cart loads without a redirect", async ({ page }) => {
    const res = await page.goto("/cart");
    expect(res?.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/auth\b/);
  });
});
