// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ProductRecord = {
  id: string;
  name: string;
  category: string;
  bottle_size?: string | null;
  country?: string | null;
  image_url?: string | null;
  image_search_url?: string | null;
  product_search_url?: string | null;
};

// ─── Helper: Download an external image and upload permanently to Supabase Storage ───

async function downloadAndStore(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const resp = await fetch(imageUrl, {
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    if (!resp.ok) return null;

    const contentType = resp.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    const buffer = await resp.arrayBuffer();
    // Reject suspiciously small responses (likely error pages, not real images)
    if (buffer.byteLength < 3000) return null;

    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const filename = `products/${productId}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(filename, buffer, { contentType, upsert: true });

    if (error) {
      console.error(`Storage upload error for ${productId}:`, error.message);
      return null;
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filename);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.warn("downloadAndStore failed:", err);
    return null;
  }
}

// ─── Strategy 1: Extract og:image from any product page URL ──────────────────

async function extractOgImage(pageUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(pageUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]?.startsWith("http")) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Strategy 2: DuckDuckGo Image Search — no API key required ───────────────

async function duckDuckGoImages(query: string): Promise<string[]> {
  try {
    // Step 1: GET the search page to harvest the VQD token DDG embeds
    const pageResp = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
      {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
    );
    if (!pageResp.ok) return [];
    const html = await pageResp.text();

    // Multiple extraction patterns as DDG changes their embedding format
    const vqdPatterns = [
      /vqd=["']([^"'&\s]+)["']/,
      /vqd%3D([^&%\s"']+)/,
      /vqd=([A-Za-z0-9\-_]+)/,
    ];
    let vqd: string | null = null;
    for (const p of vqdPatterns) {
      const m = html.match(p);
      if (m?.[1]) { vqd = m[1]; break; }
    }
    if (!vqd) return [];

    // Step 2: Fetch image results JSON
    const imgResp = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&p=1&s=0&u=bing&f=,,,`,
      {
        signal: AbortSignal.timeout(8000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://duckduckgo.com/",
          Accept: "application/json, text/javascript, */*",
        },
      },
    );
    if (!imgResp.ok) return [];

    type DdgResult = {
      image?: string;
      width?: number;
      height?: number;
    };
    const data: { results?: DdgResult[] } = await imgResp.json();

    return (data.results ?? [])
      .filter(
        (r) =>
          r.image?.startsWith("http") &&
          (r.width ?? 0) >= 120 &&
          (r.height ?? 0) >= 120,
      )
      .map((r) => r.image!)
      .slice(0, 8);
  } catch (err) {
    console.warn("DuckDuckGo search failed:", err);
    return [];
  }
}

// ─── Strategy 3: Wikipedia thumbnail — free, reliable for major brands ────────

async function wikipediaImage(productName: string): Promise<string | null> {
  try {
    // Strip volume descriptors so we hit the brand article, not a size page
    const clean = productName
      .replace(/\s*\d+\s*m[Ll]/g, "")
      .replace(/\s+\d+[Ll]/g, "")
      .trim();

    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`,
      {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: "application/json" },
      },
    );
    if (!resp.ok) return null;
    const data: {
      thumbnail?: { source?: string };
      type?: string;
    } = await resp.json();

    if (
      data.thumbnail?.source &&
      data.type !== "disambiguation"
    ) {
      return data.thumbnail.source;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Strategy 4: Firecrawl web search (if FIRECRAWL_API_KEY configured) ───────

async function firecrawlSearch(
  product: ProductRecord,
  apiKey: string,
): Promise<string | null> {
  try {
    const query = `"${product.name}" ${product.bottle_size ?? ""} bottle site:makro.co.za OR site:checkers.co.za OR site:tops.co.za`;
    const resp = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: 3 }),
    });
    if (!resp.ok) return null;

    const data: {
      data?: Array<{
        url?: string;
        metadata?: { ogImage?: string; image?: string };
      }>;
    } = await resp.json();

    for (const result of data.data ?? []) {
      const og = result.metadata?.ogImage ?? result.metadata?.image;
      if (og?.startsWith("http")) return og;
      if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(result.url ?? ""))
        return result.url!;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Strategy 5: Generate high-quality SVG bottle — guaranteed fallback ───────

const CATEGORY_PALETTE: Record<string, readonly [string, string, string]> = {
  "Whisky - Blended Scotch":    ["#7B3F00", "#C8860A", "#F5D060"],
  "Whisky - Single Malt Scotch":["#6B3000", "#B8680A", "#FFD700"],
  "Whisky - Bourbon & American":["#9A3A10", "#D06020", "#F5E050"],
  "Whisky - Japanese & World":  ["#704820", "#C08030", "#FFE890"],
  "Whisky - Irish":             ["#1E5A32", "#2E8B57", "#90D8A0"],
  "Cognac & Brandy":            ["#4A1878", "#8040C0", "#C890FF"],
  "Vodka":                      ["#101028", "#2838A0", "#A0B8E0"],
  "Gin":                        ["#0A3A20", "#1E7A48", "#80E8A0"],
  "Tequila & Mezcal":           ["#3A4010", "#708020", "#D8E060"],
  "Rum":                        ["#680000", "#B01818", "#FF8080"],
  "Beer - Premium":             ["#1C1200", "#503808", "#C89020"],
  "Champagne & Sparkling":      ["#580018", "#900830", "#FFD050"],
  "Wine - Premium":             ["#380018", "#600828", "#E0A0B0"],
  "Liqueurs & Cream":           ["#003838", "#006868", "#60D8D8"],
  "Premium Non-Alcoholic":      ["#0A2850", "#1848A8", "#80C0F8"],
  "Ready-to-Drink (RTD)":       ["#2A1858", "#5840A8", "#B8A8F0"],
  "Ciders & Flavoured Alcoholic Beverages": ["#502000", "#A84000", "#FFB850"],
};

function buildBottleSvg(product: ProductRecord): string {
  const [darkC, midC, lightC] =
    CATEGORY_PALETTE[product.category] ?? ["#1a1a2e", "#3040a0", "#90a8d0"];

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const rawName = product.name ?? "Product";
  const nameLine1 = esc(rawName.substring(0, 16));
  const nameLine2 = rawName.length > 16 ? esc(rawName.substring(16, 30)) : null;
  const catShort = esc(
    (product.category ?? "").split(" - ").pop()?.substring(0, 15) ?? "",
  );
  const size = esc(product.bottle_size ?? "750ml");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 600" width="240" height="600">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d0d1a"/>
      <stop offset="100%" stop-color="#1a1828"/>
    </linearGradient>
    <linearGradient id="body" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${darkC}" stop-opacity="0.55"/>
      <stop offset="20%"  stop-color="${darkC}"/>
      <stop offset="55%"  stop-color="${midC}"/>
      <stop offset="80%"  stop-color="${darkC}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#000"    stop-opacity="0.75"/>
    </linearGradient>
    <linearGradient id="neck" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${darkC}" stop-opacity="0.7"/>
      <stop offset="50%"  stop-color="${midC}"/>
      <stop offset="100%" stop-color="#000"   stop-opacity="0.6"/>
    </linearGradient>
    <linearGradient id="cap" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#777"/>
      <stop offset="30%"  stop-color="#e0e0e0"/>
      <stop offset="70%"  stop-color="#a0a0a0"/>
      <stop offset="100%" stop-color="#444"/>
    </linearGradient>
    <linearGradient id="lbl" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"   stop-color="${lightC}" stop-opacity="0.97"/>
      <stop offset="100%" stop-color="${midC}"   stop-opacity="0.88"/>
    </linearGradient>
    <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#fff" stop-opacity="0"/>
      <stop offset="25%"  stop-color="#fff" stop-opacity="0.22"/>
      <stop offset="55%"  stop-color="#fff" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="dropshadow">
      <feDropShadow dx="6" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Page background -->
  <rect width="240" height="600" fill="url(#bg)" rx="14"/>

  <!-- Ground ellipse shadow -->
  <ellipse cx="121" cy="572" rx="50" ry="11" fill="#000" opacity="0.22"/>

  <!-- ── Bottle body ── -->
  <path d="M88,180 L80,214 Q66,240 64,278 L64,512 Q64,544 100,548 L140,548 Q176,544 176,512 L176,278 Q174,240 160,214 L152,180 Z"
        fill="url(#body)" filter="url(#dropshadow)"/>

  <!-- Base rim highlight -->
  <ellipse cx="120" cy="544" rx="38" ry="6.5" fill="${darkC}" opacity="0.95"/>
  <ellipse cx="120" cy="541" rx="32" ry="4.5" fill="${midC}"  opacity="0.55"/>

  <!-- ── Neck ── -->
  <rect x="100" y="108" width="40" height="76" rx="9" fill="url(#neck)"/>

  <!-- Shoulder curve (decorative) -->
  <path d="M88,180 Q102,168 120,166 Q138,168 152,180"
        fill="none" stroke="${midC}" stroke-width="2" opacity="0.4"/>

  <!-- Foil wrap below neck -->
  <rect x="100" y="172" width="40" height="16" rx="4" fill="${midC}" opacity="0.6"/>

  <!-- Foil capsule on neck -->
  <rect x="100" y="106" width="40" height="28" rx="5" fill="${lightC}" opacity="0.75"/>
  <rect x="102" y="108" width="36" height="24" rx="4"
        fill="none" stroke="${darkC}" stroke-width="0.8" opacity="0.35"/>

  <!-- ── Cap ── -->
  <rect x="104" y="76"  width="32" height="36" rx="7" fill="url(#cap)"/>
  <rect x="106" y="68"  width="28" height="14" rx="4" fill="#c8c8c8"/>
  <rect x="109" y="64"  width="22" height="9"  rx="3" fill="#aaaaaa"/>

  <!-- ── Main label ── -->
  <rect x="73" y="288" width="94" height="150" rx="9" fill="url(#lbl)"/>
  <!-- Outer border -->
  <rect x="75" y="290" width="90" height="146" rx="8"
        fill="none" stroke="${darkC}" stroke-width="1.8" opacity="0.5"/>
  <!-- Inner decorative rule lines -->
  <line x1="81" y1="308" x2="159" y2="308" stroke="${darkC}" stroke-width="0.8" opacity="0.35"/>
  <line x1="81" y1="404" x2="159" y2="404" stroke="${darkC}" stroke-width="0.8" opacity="0.35"/>

  <!-- Brand mark -->
  <text x="120" y="327"
        text-anchor="middle"
        font-family="Georgia,'Times New Roman',serif"
        font-size="11" font-weight="bold" letter-spacing="3"
        fill="${darkC}" opacity="0.88">LIQZAR</text>

  <!-- Small diamond divider -->
  <polygon points="120,336 124.5,340 120,344 115.5,340"
           fill="${darkC}" opacity="0.4"/>

  <!-- Product name (up to 2 lines) -->
  <text x="120" y="360"
        text-anchor="middle"
        font-family="Georgia,'Times New Roman',serif"
        font-size="10" font-weight="bold"
        fill="${darkC}">${nameLine1}</text>
  ${nameLine2 ? `<text x="120" y="373" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="10" font-weight="bold" fill="${darkC}">${nameLine2}</text>` : ""}

  <!-- Category -->
  <text x="120" y="${nameLine2 ? "390" : "380"}"
        text-anchor="middle"
        font-family="Arial,Helvetica,sans-serif"
        font-size="8.5" letter-spacing="0.5"
        fill="${darkC}" opacity="0.7">${catShort}</text>

  <!-- Size -->
  <text x="120" y="418"
        text-anchor="middle"
        font-family="Arial,Helvetica,sans-serif"
        font-size="8.5"
        fill="${darkC}" opacity="0.6">${size}</text>

  <!-- ── Shine / specular highlight ── -->
  <!-- Body shine -->
  <path d="M88,180 L80,214 Q66,240 64,278 L64,512 Q64,544 100,548 L104,548 Q70,544 70,512 L70,278 Q72,240 86,214 L94,180 Z"
        fill="url(#shine)"/>
  <!-- Neck shine -->
  <rect x="100" y="108" width="11" height="76" rx="5" fill="url(#shine)" opacity="0.75"/>
</svg>`;
}

async function uploadSvgToStorage(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  svg: string,
): Promise<string | null> {
  try {
    const bytes = new TextEncoder().encode(svg);
    const filename = `products/generated-${productId}.svg`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(filename, bytes.buffer, {
        contentType: "image/svg+xml",
        upsert: true,
      });
    if (error) { console.error("SVG upload error:", error.message); return null; }
    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(filename);
    return data?.publicUrl ?? null;
  } catch (err) {
    console.warn("SVG upload failed:", err);
    return null;
  }
}

// ─── Validate a URL is an actual image before storing it ─────────────────────

async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LiqzarImageBot/1.0)",
      },
    });
    const ct = resp.headers.get("content-type") ?? "";
    return resp.ok && ct.startsWith("image/");
  } catch {
    return false;
  }
}

// ─── Core: run all strategies for a single product ───────────────────────────

async function processProduct(
  product: ProductRecord,
  supabase: ReturnType<typeof createClient>,
  firecrawlKey: string | undefined,
  forceRefresh: boolean,
): Promise<string | null> {
  const cur = product.image_url ?? "";

  // A real photo stored in our own bucket: skip unless force-refresh
  const isOwnStoredPhoto =
    cur.includes("supabase.co/storage") && !cur.includes("generated-");
  if (!forceRefresh && isOwnStoredPhoto) return cur;

  console.log(`[${product.name}] Starting image search...`);
  let foundUrl: string | null = null;

  // ── 1. OG image from product/image search URLs already in DB ─────────
  if (product.product_search_url && !foundUrl) {
    foundUrl = await extractOgImage(product.product_search_url);
    if (foundUrl) console.log(`[${product.name}] ✓ product_search_url`);
  }
  if (product.image_search_url && !foundUrl) {
    foundUrl = await extractOgImage(product.image_search_url);
    if (foundUrl) console.log(`[${product.name}] ✓ image_search_url`);
  }

  // ── 2. DuckDuckGo image search — no API key ──────────────────────────
  if (!foundUrl) {
    const q = `${product.name} ${product.bottle_size ?? ""} bottle product photo`.trim();
    console.log(`[${product.name}] DDG query: "${q}"`);
    const candidates = await duckDuckGoImages(q);
    for (const c of candidates) {
      if (await validateImageUrl(c)) {
        foundUrl = c;
        console.log(`[${product.name}] ✓ DuckDuckGo: ${c}`);
        break;
      }
    }
  }

  // ── 3. Wikipedia thumbnail — great for major international brands ────
  if (!foundUrl) {
    const wikiImg = await wikipediaImage(product.name);
    if (wikiImg) {
      foundUrl = wikiImg;
      console.log(`[${product.name}] ✓ Wikipedia: ${wikiImg}`);
    }
  }

  // ── 4. Firecrawl (optional — only if FIRECRAWL_API_KEY is set) ───────
  if (!foundUrl && firecrawlKey) {
    foundUrl = await firecrawlSearch(product, firecrawlKey);
    if (foundUrl) console.log(`[${product.name}] ✓ Firecrawl: ${foundUrl}`);
  }

  // If we found any URL, download and store it permanently in our bucket
  let finalUrl: string | null = null;
  if (foundUrl) {
    console.log(`[${product.name}] Downloading image...`);
    finalUrl = await downloadAndStore(supabase, product.id, foundUrl);
    if (!finalUrl) console.warn(`[${product.name}] Download failed, falling back to SVG`);
  }

  // ── 5. Generate branded SVG bottle — guaranteed result ───────────────
  if (!finalUrl) {
    console.log(`[${product.name}] Generating SVG bottle...`);
    const svg = buildBottleSvg(product);
    finalUrl = await uploadSvgToStorage(supabase, product.id, svg);
  }

  // Persist to DB
  if (finalUrl) {
    await supabase
      .from("products")
      .update({ image_url: finalUrl, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    console.log(`[${product.name}] DB updated ✓`);
  }

  return finalUrl;
}

// ─── Edge Function entry point ────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      batchSize = 3,
      offset = 0,
      productId,
      forceRefresh = false,
      preview = false,
    } = await req.json();

    // ── Single product mode ──────────────────────────────────────────────
    if (productId) {
      const { data: product, error } = await supabase
        .from("products")
        .select(
          "id, name, category, bottle_size, country, image_url, image_search_url, product_search_url",
        )
        .eq("id", productId)
        .single();

      if (error || !product) {
        return new Response(JSON.stringify({ error: "Product not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (preview) {
        // Collect candidate URLs without writing to DB
        const candidates: string[] = [];

        if (product.product_search_url) {
          const u = await extractOgImage(product.product_search_url);
          if (u) candidates.push(u);
        }
        const ddg = await duckDuckGoImages(
          `${product.name} bottle transparent`,
        );
        candidates.push(...ddg);
        const wiki = await wikipediaImage(product.name);
        if (wiki) candidates.push(wiki);
        if (firecrawlKey) {
          const fc = await firecrawlSearch(product, firecrawlKey);
          if (fc) candidates.push(fc);
        }

        return new Response(
          JSON.stringify({
            done: true,
            candidate_urls: candidates.slice(0, 6),
            processed: 1,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const imageUrl = await processProduct(
        product,
        supabase,
        firecrawlKey,
        forceRefresh,
      );
      return new Response(
        JSON.stringify({
          done: true,
          updated: imageUrl ? 1 : 0,
          processed: 1,
          image_url: imageUrl,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Batch mode ───────────────────────────────────────────────────────
    let q = supabase
      .from("products")
      .select(
        "id, name, category, bottle_size, country, image_url, image_search_url, product_search_url",
      )
      .order("name");

    if (!forceRefresh) {
      // Target: no image, empty string, or old inline data: URIs from before storage migration
      q = q.or('image_url.is.null,image_url.eq."",image_url.like.data:%');
    }

    const { data: products, error: batchErr } = await q.range(
      offset,
      offset + batchSize - 1,
    );
    if (batchErr) throw batchErr;

    if (!products?.length) {
      return new Response(
        JSON.stringify({ done: true, updated: 0, processed: 0, remaining: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let cntQ = supabase
      .from("products")
      .select("id", { count: "exact", head: true });
    if (!forceRefresh)
      cntQ = cntQ.or('image_url.is.null,image_url.eq."",image_url.like.data:%');
    const { count: remaining } = await cntQ;

    let updated = 0;
    for (const product of products) {
      const url = await processProduct(
        product,
        supabase,
        firecrawlKey,
        forceRefresh,
      );
      if (url) updated++;
    }

    return new Response(
      JSON.stringify({
        done: (remaining ?? 0) <= offset + batchSize,
        updated,
        processed: products.length,
        remaining: Math.max(0, (remaining ?? 0) - (offset + batchSize)),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
