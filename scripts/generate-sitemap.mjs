#!/usr/bin/env node
/**
 * Build-time sitemap generator for LIQZAR.
 *
 * Pulls all in-stock product IDs + categories from Supabase, combines with
 * the static routes, and writes public/sitemap.xml + public/sitemap-index.xml.
 *
 * Run before `vite build` (wire into package.json "build" script).
 *
 * Env vars (with sensible fallbacks for local builds):
 *   SUPABASE_URL — defaults to LIQZAR Pro project
 *   SUPABASE_ANON_KEY — required to query products
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_URL = "https://liqzar.co.za";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = resolve(__dirname, "..", "public");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://deiewcktyzzeviszukqj.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlaWV3Y2t0eXp6ZXZpc3p1a3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTc1OTQsImV4cCI6MjA5MTI5MzU5NH0.n5CmlkLXrF-qAtIPNLVurhjf9vWFawFt8T7NEb--qHs";

// ─── Static routes (high-priority customer-facing pages only) ──────────────
const STATIC_ROUTES = [
  { path: "/", priority: 1.0, changefreq: "daily" },
  { path: "/catalogue", priority: 0.9, changefreq: "daily" },
  { path: "/editorial", priority: 0.8, changefreq: "weekly" },
  { path: "/gift-cards", priority: 0.7, changefreq: "weekly" },
  { path: "/bulk-order", priority: 0.6, changefreq: "monthly" },
  { path: "/cellar-club", priority: 0.6, changefreq: "monthly" },
  { path: "/corporate", priority: 0.6, changefreq: "monthly" },
  { path: "/loyalty", priority: 0.5, changefreq: "monthly" },
  { path: "/referral", priority: 0.5, changefreq: "monthly" },
  { path: "/support", priority: 0.4, changefreq: "monthly" },
  { path: "/legal", priority: 0.3, changefreq: "yearly" },
  { path: "/privacy", priority: 0.3, changefreq: "yearly" },
];

// Pages that are deliberately NOT in the sitemap:
// /auth, /checkout, /payment/*, /admin/*, /profile, /orders, /track/*,
// /addresses, /payments, /security, /settings, /wishlist, /reviews,
// /notifications, /my-cellar, /account-deletion, /trip/*

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${xmlEscape(lastmod)}</lastmod>` : null,
    changefreq ? `    <changefreq>${xmlEscape(changefreq)}</changefreq>` : null,
    priority != null ? `    <priority>${priority.toFixed(1)}</priority>` : null,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  console.log("→ Generating LIQZAR sitemap.xml");
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Pull in-stock products (only what's actually buyable)
  const { data: products, error } = await sb
    .from("products")
    .select("id, updated_at, in_stock, category")
    .eq("in_stock", true)
    .order("updated_at", { ascending: false })
    .limit(50000);

  if (error) {
    console.warn(`⚠️  Supabase fetch failed (${error.message}); generating sitemap with static routes only`);
  }

  const today = new Date().toISOString().split("T")[0];

  const staticUrls = STATIC_ROUTES.map((r) =>
    urlEntry({
      loc: `${SITE_URL}${r.path}`,
      lastmod: today,
      changefreq: r.changefreq,
      priority: r.priority,
    }),
  );

  // Category landing pages from distinct in-stock categories
  const categorySet = new Set((products ?? []).map((p) => p.category).filter(Boolean));
  const categoryUrls = [...categorySet].sort().map((cat) =>
    urlEntry({
      loc: `${SITE_URL}/catalogue?category=${encodeURIComponent(cat)}`,
      lastmod: today,
      changefreq: "weekly",
      priority: 0.7,
    }),
  );

  // Product detail pages
  const productUrls = (products ?? []).map((p) =>
    urlEntry({
      loc: `${SITE_URL}/product/${p.id}`,
      lastmod: (p.updated_at || today).split("T")[0],
      changefreq: "weekly",
      priority: 0.6,
    }),
  );

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...staticUrls,
    ...categoryUrls,
    ...productUrls,
    `</urlset>`,
  ].join("\n");

  writeFileSync(resolve(PUBLIC_DIR, "sitemap.xml"), xml, "utf8");

  console.log(`✓ sitemap.xml written: ${staticUrls.length} static + ${categoryUrls.length} categories + ${productUrls.length} products = ${staticUrls.length + categoryUrls.length + productUrls.length} URLs`);
}

main().catch((err) => {
  console.error("Sitemap generation failed:", err);
  process.exit(1);
});
