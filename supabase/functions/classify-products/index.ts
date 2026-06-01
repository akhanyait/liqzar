// @ts-nocheck
// Product classifier — flags products as trending / best-seller / new-arrival
// based on rating, review-count, category, age, and price.
//
// Direct Google Gemini (was routed through Lovable's gateway as an
// OpenAI-compatible facade). Gemini's `responseSchema` replaces the OpenAI
// tool-calling pattern with native structured-JSON output.
//
// Env: GOOGLE_AI_API_KEY  (free tier from https://aistudio.google.com)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleGenAI, Type } from "npm:@google/genai@2.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "gemini-2.5-flash";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY not configured");
    const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: products, error: fetchErr } = await supabase
      .from("products")
      .select("id, name, category, price, rating, review_count, created_at, in_stock")
      .order("name");

    if (fetchErr) throw fetchErr;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No products to classify" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const CHUNK_SIZE = 50;
    const allClassifications: Record<string, { trending: boolean; best_seller: boolean; new_arrival: boolean }> = {};

    for (let i = 0; i < products.length; i += CHUNK_SIZE) {
      const chunk = products.slice(i, i + CHUNK_SIZE);
      const productSummary = chunk.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: p.price,
        rating: p.rating,
        review_count: p.review_count,
        created_at: p.created_at,
        in_stock: p.in_stock,
      }));

      const today = new Date().toISOString().split("T")[0];
      const prompt = `You are a product classification AI for a premium South African liquor delivery platform.

Analyze each product and classify it into categories. A product can belong to multiple categories:

**Trending**: Products that would be popular right now — consider high ratings (4.3+), good review counts, popular categories (gin, whisky, tequila), and mid-to-premium price points.

**Best Seller**: Products likely to have the highest sales volume — consider high review counts (20+), competitive pricing, well-known brands, and broad appeal categories.

**New Arrival**: Products added recently (created_at within the last 30 days from today ${today}). If created_at is NULL or very old, it is NOT a new arrival.

Today's date: ${today}

Aim for roughly:
- 15-20% of products as trending
- 10-15% as best sellers
- Only products genuinely added in the last 30 days as new arrivals (if none qualify, mark none)

Products to classify:
${JSON.stringify(productSummary)}`;

      let response;
      try {
        response = await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                classifications: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      trending: { type: Type.BOOLEAN },
                      best_seller: { type: Type.BOOLEAN },
                      new_arrival: { type: Type.BOOLEAN },
                    },
                    required: ["id", "trending", "best_seller", "new_arrival"],
                  },
                },
              },
              required: ["classifications"],
            },
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`AI error (chunk ${i}):`, message);
        // Gemini rate-limit errors typically carry "429" or "RESOURCE_EXHAUSTED".
        if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
          return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        continue;
      }

      let parsed: { classifications?: Array<{ id: string; trending: boolean; best_seller: boolean; new_arrival: boolean }> };
      try {
        parsed = JSON.parse(response.text ?? "{}");
      } catch {
        console.error("Failed to parse classification JSON for chunk", i);
        continue;
      }

      for (const c of parsed.classifications ?? []) {
        allClassifications[c.id] = {
          trending: c.trending,
          best_seller: c.best_seller,
          new_arrival: c.new_arrival,
        };
      }

      console.log(`Classified chunk ${i}-${i + chunk.length}: ${(parsed.classifications ?? []).length} products`);
    }

    // Reset all flags first
    await supabase
      .from("products")
      .update({ is_trending: false, is_best_seller: false, is_new_arrival: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    // Apply classifications
    let trendingCount = 0,
      bestSellerCount = 0,
      newArrivalCount = 0;

    for (const [id, flags] of Object.entries(allClassifications)) {
      const updates: Record<string, boolean> = {};
      if (flags.trending) {
        updates.is_trending = true;
        trendingCount++;
      }
      if (flags.best_seller) {
        updates.is_best_seller = true;
        bestSellerCount++;
      }
      if (flags.new_arrival) {
        updates.is_new_arrival = true;
        newArrivalCount++;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("products").update(updates).eq("id", id);
      }
    }

    console.log(
      `Classification complete: ${trendingCount} trending, ${bestSellerCount} best sellers, ${newArrivalCount} new arrivals`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        classified: Object.keys(allClassifications).length,
        trending: trendingCount,
        best_sellers: bestSellerCount,
        new_arrivals: newArrivalCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("classify-products error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
