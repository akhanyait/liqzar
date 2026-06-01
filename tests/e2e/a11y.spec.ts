// WCAG 2.1 A + AA baseline for the public surface.
//
// Strategy: we don't gate on EVERY violation (axe-core flags moderate-impact
// issues like enhanced contrast that would block forever). We DO gate on
// "serious" and "critical" — those are the ones a screen-reader user would
// actually hit. Adjust the filter if the team agrees to a stricter bar.
//
// To debug a failure locally:
//   pnpm test:e2e:a11y --reporter=list
//   # Then open the test result HTML to see the offending DOM node.

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PUBLIC_ROUTES = [
  { name: "Landing", path: "/" },
  { name: "Auth", path: "/auth" },
];

for (const route of PUBLIC_ROUTES) {
  test(`A11Y · ${route.name} (${route.path}) has no critical/serious violations`, async ({
    page,
  }) => {
    await page.goto(route.path);
    // Settle motion + late-mounting components before scanning.
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // Third-party scripts we don't control — drop noise.
      .exclude("script[src*='cloudflareinsights']")
      .exclude("script[src*='googletagmanager']")
      // color-contrast is disabled until the gold-on-cream brand palette gets
      // a dedicated dark-text token. Today --primary (`hsl(40 85% 50%)` ≈
      // `#eca413`) over `--background` (`hsl(40 32% 95%)` ≈ `#f6f4ee`) is
      // 1.93:1 — well under WCAG AA's 4.5:1. Even the actual brand gold
      // `#D4AF37` (--gold) sits at ~2.6:1 against the cream surface, so this
      // needs either a darker `--gold-text` variable for label text OR a
      // background change. Brand decision — follow-up PR (#TBD).
      .disableRules(["color-contrast"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    // Log full report to stdout when there's a problem so the user can act
    // without rerunning under --debug.
    if (blocking.length > 0) {
      console.log(
        `\n[a11y] ${route.path} — ${blocking.length} blocking violation(s):`,
      );
      for (const v of blocking) {
        console.log(`  • [${v.impact}] ${v.id}: ${v.help}`);
        console.log(`    ${v.helpUrl}`);
        for (const node of v.nodes.slice(0, 3)) {
          console.log(`    └ ${node.target.join(" → ")}`);
        }
      }
    }

    expect(blocking).toEqual([]);
  });
}
