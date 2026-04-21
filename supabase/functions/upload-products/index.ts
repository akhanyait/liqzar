// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseZARPrice(raw: string): number | null {
  if (!raw || raw.trim() === "") return null;
  const cleaned = raw.replace(/R/gi, "").replace(/[\s ]/g, "").replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function buildPlaceholderImageUrl(name: string, category?: string | null) {
  const colors: Record<string, string> = {
    "Whisky - Blended Scotch": "8B4513",
    "Whisky - Single Malt Scotch": "A0522D",
    "Whisky - Bourbon & American": "D2691E",
    "Whisky - Japanese & World": "CD853F",
    "Whisky - Irish": "DAA520",
    "Cognac & Brandy": "6B3FA0",
    Vodka: "4682B4",
    Gin: "2E8B57",
    "Tequila & Mezcal": "BDB76B",
    Rum: "B22222",
    "Beer - Premium": "1C1C1C",
    "Champagne & Sparkling": "C41E3A",
    "Wine - Premium": "722F37",
    "Liqueurs & Cream": "008080",
  };
  const color = colors[category || ""] || "2c3e50";
  const label = encodeURIComponent(name.split(" ").slice(0, 3).join("
"));
  return `https://placehold.co/400x500/${color}/ffffff?text=${label}&font=raleway`;
}

function buildFallbackDescription(name: string, category: string, bottle_size?: string | null, country?: string | null) {
  const details = [category, bottle_size, country].filter(Boolean).join(" · ");
  return `${name} is part of the LIQZAR premium collection.${details ? ` ${details}.` : ""} Price comparison is included across major South African retailers for easy benchmarking.`;
}

function parseSemicolonCSV(text: string) {
  const lines = text.split("
").map((l) => l.trim()).filter(Boolean);
  let headerIdx = lines.findIndex((l) => l.includes("Product Name"));
  if (headerIdx === -1) headerIdx = 4;

  const dataLines = lines.slice(headerIdx + 1);
  const products: any[] = [];

  for (const line of dataLines) {
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ';' && !inQuotes) {
        parts.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    parts.push(current.trim());

    const name = parts[0];
    if (!name) continue;

    const category = parts[1] || "Uncategorised";
    const bottle_size = parts[2] || null;
    const country = parts[3] || null;
    const alcohol_pct = parts[4] || null;
    const csvCheapest = parseZARPrice(parts[5]);
    const csvCheapestRetailer = parts[6] || null;
    const checkers_price = parseZARPrice(parts[7]);
    const pnp_price = parseZARPrice(parts[8]);
    const tops_price = parseZARPrice(parts[9]);
    const woolworths_price = parseZARPrice(parts[10]);
    const norman_price = parseZARPrice(parts[11]);
    const image_search_url = parts[12] || null;
    const product_search_url = parts[13] || null;

    const retailerPrices = [
      { retailer: "Checkers", price: checkers_price },
      { retailer: "Pick n Pay", price: pnp_price },
      { retailer: "TOPS", price: tops_price },
      { retailer: "Woolworths", price: woolworths_price },
      { retailer: "Norman Goodfellows", price: norman_price },
    ].filter((item): item is { retailer: string; price: number } => item.price !== null && item.price > 0)
      .sort((a, b) => a.price - b.price);

    const cheapest = retailerPrices[0];
    const price = cheapest?.price || csvCheapest || 0;
    const cheapest_retailer = cheapest?.retailer || csvCheapestRetailer;
    const image_url = image_search_url && /^https?:\/\//i.test(image_search_url)
      ? image_search_url
      : buildPlaceholderImageUrl(name, category);

    products.push({
      name,
      category,
      bottle_size,
      country,
      alcohol_pct,
      price,
      cheapest_retailer,
      checkers_price,
      pnp_price,
      tops_price,
      woolworths_price,
      norman_price,
      image_search_url,
      product_search_url,
      image_url,
      description: buildFallbackDescription(name, category, bottle_size, country),
      in_stock: true,
      rating: 4.5,
      review_count: 0,
    });
  }
  return products;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { csvText, deleteExisting } = await req.json();
    if (!csvText) {
      return new Response(JSON.stringify({ error: "No CSV data provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const products = parseSemicolonCSV(csvText);

    if (deleteExisting) {
      await supabase.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    const batchSize = 50;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const { error } = await supabase.from("products").insert(batch);
      if (error) {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(JSON.stringify({ success: true, total_parsed: products.length, inserted, errors: errors.length > 0 ? errors : undefined }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
