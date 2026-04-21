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

    const { batchSize = 10, offset = 0 } = await req.json().catch(() => ({}));

    // Fetch featured/trending/best-seller/new-arrival products that have images
    const { data: products, error: fetchErr } = await supabase
      .from("products")
      .select("id, name, category, image_url")
      .or("is_featured.eq.true,is_trending.eq.true,is_best_seller.eq.true,is_new_arrival.eq.true")
      .not("image_url", "is", null)
      .not("image_url", "like", "%placehold%")
      .order("name")
      .range(offset, offset + batchSize - 1);

    if (fetchErr) throw fetchErr;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ done: true, validated: 0, flagged: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI vision to validate each image matches the product
    const CHUNK = 5;
    let flaggedCount = 0;
    const flaggedProducts: string[] = [];

    for (let i = 0; i < products.length; i += CHUNK) {
      const chunk = products.slice(i, i + CHUNK);

      const validationPromises = chunk.map(async (product) => {
        try {
          // Ask AI to validate if image matches the product name
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: `You are a product image validator for a liquor delivery platform. Look at this image and determine if it shows the correct product bottle/packaging for "${product.name}" (category: ${product.category}).

Respond with ONLY a JSON object: {"valid": true/false, "reason": "brief explanation"}

Rules:
- If the image shows a bottle or product that matches or could reasonably be "${product.name}", mark as valid.
- If the image is a placeholder, generic image, completely wrong product, broken image, or shows text only (like "Clase Azul Reposado" on a colored background), mark as invalid.
- If you cannot load or see the image, mark as invalid.`,
                    },
                    {
                      type: "image_url",
                      image_url: { url: product.image_url },
                    },
                  ],
                },
              ],
            }),
          });

          if (!aiResponse.ok) {
            console.error(`AI validation failed for ${product.name}: ${aiResponse.status}`);
            return null;
          }

          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";

          // Parse the response
          const jsonMatch = content.match(/\{[^}]+\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            if (!result.valid) {
              console.log(`Image invalid for ${product.name}: ${result.reason}`);
              return { id: product.id, name: product.name, reason: result.reason };
            }
          }
          return null;
        } catch (err) {
          console.error(`Validation error for ${product.name}:`, err);
          return null;
        }
      });

      const results = await Promise.allSettled(validationPromises);
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          flaggedProducts.push(r.value.id);
          flaggedCount++;
        }
      }
    }

    // For flagged products, clear their image so scraper can re-fetch
    if (flaggedProducts.length > 0) {
      // Trigger scraper for each flagged product
      const scrapeUrl = `${supabaseUrl}/functions/v1/scrape-product-images`;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

      for (const productId of flaggedProducts) {
        try {
          await fetch(scrapeUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ productId, forceRefresh: true }),
          });
          console.log(`Re-scraped image for product ${productId}`);
        } catch (err) {
          console.error(`Re-scrape failed for ${productId}:`, err);
        }
      }
    }

    const totalCount = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .or("is_featured.eq.true,is_trending.eq.true,is_best_seller.eq.true,is_new_arrival.eq.true")
      .not("image_url", "is", null)
      .not("image_url", "like", "%placehold%");

    const remaining = Math.max(0, (totalCount.count || 0) - (offset + batchSize));

    return new Response(
      JSON.stringify({
        done: remaining <= 0,
        validated: products.length,
        flagged: flaggedCount,
        remaining,
        flaggedProducts,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("validate-product-images error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
