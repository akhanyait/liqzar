// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all products with relevant data
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

    // Build a summary for AI to classify — process in chunks
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

      const prompt = `You are a product classification AI for a premium South African liquor delivery platform.

Analyze each product and classify it into categories. A product can belong to multiple categories:

**Trending**: Products that would be popular right now — consider high ratings (4.3+), good review counts, popular categories (gin, whisky, tequila), and mid-to-premium price points.

**Best Seller**: Products likely to have the highest sales volume — consider high review counts (20+), competitive pricing, well-known brands, and broad appeal categories.

**New Arrival**: Products added recently (created_at within the last 30 days from today ${new Date().toISOString().split("T")[0]}). If created_at is NULL or very old, it is NOT a new arrival.

Today's date: ${new Date().toISOString().split("T")[0]}

Return a JSON array with objects: { "id": "uuid", "trending": true/false, "best_seller": true/false, "new_arrival": true/false }

Aim for roughly:
- 15-20% of products as trending
- 10-15% as best sellers  
- Only products genuinely added in the last 30 days as new arrivals (if none qualify, mark none)

Products to classify:
${JSON.stringify(productSummary)}`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          tools: [
            {
              type: "function",
              function: {
                name: "classify_products",
                description: "Classify products into trending, best_seller, and new_arrival categories",
                parameters: {
                  type: "object",
                  properties: {
                    classifications: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          trending: { type: "boolean" },
                          best_seller: { type: "boolean" },
                          new_arrival: { type: "boolean" },
                        },
                        required: ["id", "trending", "best_seller", "new_arrival"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["classifications"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "classify_products" } },
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`AI error (chunk ${i}):`, aiResponse.status, errText);
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        continue;
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        console.error("No tool call in AI response for chunk", i);
        continue;
      }

      const parsed = JSON.parse(toolCall.function.arguments);
      for (const c of parsed.classifications) {
        allClassifications[c.id] = {
          trending: c.trending,
          best_seller: c.best_seller,
          new_arrival: c.new_arrival,
        };
      }

      console.log(`Classified chunk ${i}-${i + chunk.length}: ${parsed.classifications.length} products`);
    }

    // Reset all flags first
    await supabase.from("products").update({ is_trending: false, is_best_seller: false, is_new_arrival: false }).neq("id", "00000000-0000-0000-0000-000000000000");

    // Apply classifications
    let trendingCount = 0, bestSellerCount = 0, newArrivalCount = 0;

    for (const [id, flags] of Object.entries(allClassifications)) {
      const updates: Record<string, boolean> = {};
      if (flags.trending) { updates.is_trending = true; trendingCount++; }
      if (flags.best_seller) { updates.is_best_seller = true; bestSellerCount++; }
      if (flags.new_arrival) { updates.is_new_arrival = true; newArrivalCount++; }

      if (Object.keys(updates).length > 0) {
        await supabase.from("products").update(updates).eq("id", id);
      }
    }

    console.log(`Classification complete: ${trendingCount} trending, ${bestSellerCount} best sellers, ${newArrivalCount} new arrivals`);

    return new Response(
      JSON.stringify({
        success: true,
        classified: Object.keys(allClassifications).length,
        trending: trendingCount,
        best_sellers: bestSellerCount,
        new_arrivals: newArrivalCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("classify-products error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
