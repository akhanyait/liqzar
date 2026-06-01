// Mints a logged-in Customer session and saves it to
// playwright/.auth/customer.json so later projects (customer-flow) start
// pre-authenticated.
//
// Mechanism: liqZAR's /auth page exposes DEV-only quick-login buttons via
// `WEB_TEST_USERS` (see src/pages/AuthPage.tsx:432). Clicking the "Customer"
// button calls `devAutoLogin("0790771591")` which signs in via real Supabase
// email+password — so auth.uid() is real and RLS-aware code paths work.
//
// If you see this fail in CI, the most likely cause is `import.meta.env.MODE`
// being "production" (which hides the buttons). Build with `pnpm dev`, not
// `pnpm preview` of a prod build.

import { test as setup, expect } from "@playwright/test";

const STATE_FILE = "playwright/.auth/customer.json";

setup("authenticate as Customer", async ({ page }) => {
  await page.goto("/auth");

  // The button label comes from `tu.label` for the test user with role
  // "customer" — that's "Customer" (see TEST_USERS in src/context/AuthContext.tsx).
  // AuthPage renders the demo button in two places (prominent row + footer
  // list); .first() picks the topmost one so we're not subject to layout shuffles.
  const customerBtn = page.getByRole("button", { name: /Customer/ }).first();
  await expect(customerBtn).toBeVisible({ timeout: 10_000 });
  await customerBtn.click();

  // After devAutoLogin succeeds, AuthPage navigates the customer to "/".
  // We assert by URL rather than heading because the homepage Suspense
  // boundary makes any single heading fragile to copy changes.
  await page.waitForURL((url) => url.pathname === "/", { timeout: 20_000 });

  await page.context().storageState({ path: STATE_FILE });
});
