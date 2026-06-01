// @ts-nocheck
// Validate that each product's image actually depicts the product.
// Uses Gemini's multimodal vision — fetches the image bytes, sends them as
// inline base64 along with the product name, and asks the model to judge.
//
// Was previously routed through Lovable's gateway (OpenAI-compatible chat
// completions with `image_url`). Now calls Gemini directly.
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

/** Download an image URL and convert to base64 + mime — what Gemini wants. */
async function fetchImageAsInline(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    const buf = new Uint8Array(await res.arrayBuffer());
    // Base64-encode without blowing the stack on large images (chunked).
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    }
    return { data: btoa(bin), mimeType };
  } catch {
    return null;
  }
}

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

    const { batchSize = 10, offset = 0 } = await req.json().catch(() => ({}));

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

    const CHUNK = 5;
    let flaggedCount = 0;
    const flaggedProducts: string[] = [];

    for (let i = 0; i < products.length; i += CHUNK) {
      const chunk = products.slice(i, i + CHUNK);

      const validationPromises = chunk.map(async (product) => {
        try {
          const image = await fetchImageAsInline(product.image_url);
          if (!image) {
            // Couldn't fetch the image at all — flag it for re-scrape.
            console.log(`Could not fetch image for ${product.name}`);
            return { id: product.id, name: product.name, reason: "image fetch failed" };
          }

          const response = await ai.models.generateContent({
            model: MODEL,
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `You are a product image validator for a liquor delivery platform. Look at this image and determine if it shows the correct product bottle/packaging for "${product.name}" (category: ${product.category}).

Rules:
- If the image shows a bottle or product that matches or could reasonably be "${product.name}", mark as valid.
- If the image is a placeholder, generic image, completely wrong product, broken image, or shows text only (like "Clase Azul Reposado" on a colored background), mark as invalid.
- If you cannot see the image clearly, mark as invalid.`,
                  },
                  { inlineData: { data: image.data, mimeType: image.mimeType } },
                ],
              },
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  valid: { type: Type.BOOLEAN },
                  reason: { type: Type.STRING },
                },
                required: ["valid", "reason"],
              },
            },
          });

          const parsed = JSON.parse(response.text ?? '{"valid":true}');
          if (!parsed.valid) {
            console.log(`Image invalid for ${product.name}: ${parsed.reason}`);
            return { id: product.id, name: product.name, reason: parsed.reason };
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

    // For flagged products, trigger the scraper to re-fetch
    if (flaggedProducts.length > 0) {
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("validate-product-images error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
