// Mints a logged-in Back-Office Admin session and saves it to
// playwright/.auth/admin.json. Same mechanism as customer.setup.ts — see
// that file for the full explanation.
//
// The Admin button shows the label "Back-Office Admin" (per ROLE_LABELS),
// matching tu.label for the admin entry in TEST_USERS.

import { test as setup, expect } from "@playwright/test";

const STATE_FILE = "playwright/.auth/admin.json";

setup("authenticate as Back-Office Admin", async ({ page }) => {
  await page.goto("/auth");

  // AuthPage renders the demo button twice; .first() disambiguates.
  const adminBtn = page.getByRole("button", { name: /Back-Office Admin/ }).first();
  await expect(adminBtn).toBeVisible({ timeout: 10_000 });
  await adminBtn.click();

  await page.waitForURL(/\/admin\b/, { timeout: 20_000 });

  await page.context().storageState({ path: STATE_FILE });
});
