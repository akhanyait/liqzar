// Authenticated admin journey. The fixture loads `playwright/.auth/admin.json`
// so we start on /admin without going through the demo button.
//
// As with customer-flow.spec.ts, this is the harness drop — kept thin on
// purpose. Add deeper coverage (orders list filters, inventory adjustment,
// driver assignment) as part of the feature PRs that touch those surfaces.

import { test, expect } from "@playwright/test";

test.describe("Admin (authenticated)", () => {
  test("A1 · /admin loads the dashboard layout", async ({ page }) => {
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/auth\b/);
  });

  test("A2 · /admin/orders is reachable", async ({ page }) => {
    const res = await page.goto("/admin/orders");
    expect(res?.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/auth\b/);
  });

  test("A3 · /admin/inventory is reachable (replaces legacy /warehouse)", async ({
    page,
  }) => {
    const res = await page.goto("/admin/inventory");
    expect(res?.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/auth\b/);
  });

  test("A4 · legacy /warehouse path redirects to /admin/inventory", async ({
    page,
  }) => {
    await page.goto("/warehouse");
    await page.waitForURL(/\/admin\/inventory\b/, { timeout: 10_000 });
  });
});
