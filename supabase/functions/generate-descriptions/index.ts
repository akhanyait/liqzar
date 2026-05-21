// @ts-nocheck
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Direct Google AI Studio (Generative Language API) — free tier covers
    // typical catalogue imports (~1,500 req/day on gemini-2.5-flash). Set the
    // key via: supabase secrets set GOOGLE_AI_API_KEY=<key>
    // Fall back to LOVABLE_API_KEY for backward compat if someone preferred
    // routing through Lovable's gateway.
    const googleKey = Deno.env.get('GOOGLE_AI_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const useGoogle = !!googleKey;
    if (!googleKey && !lovableApiKey) {
      return new Response(JSON.stringify({ error: 'No AI key set — set GOOGLE_AI_API_KEY (preferred) or LOVABLE_API_KEY in EF secrets' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { batchSize = 5, offset = 0, productId } = await req.json();

    let productsToProcess: any[] = [];

    if (productId) {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, country, bottle_size, alcohol_pct')
        .eq('id', productId)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Product not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      productsToProcess = [data];
    } else {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category, country, bottle_size, alcohol_pct, description')
        .or('description.is.null,description.eq.')
        .range(offset, offset + batchSize - 1);
      if (error) throw error;
      productsToProcess = data || [];
    }

    if (productsToProcess.length === 0) {
      return new Response(JSON.stringify({ done: true, updated: 0, message: 'All products have descriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Count remaining without descriptions
    const { count: remaining } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .or('description.is.null,description.eq.');

    let updated = 0;

    for (const product of productsToProcess) {
      try {
        const prompt = `Write a concise product description (2-3 sentences) with tasting notes for this beverage product. Include flavor profile, aroma, and suggested pairings. Be specific and appealing.

Product: ${product.name}
Category: ${product.category}
${product.country ? `Country: ${product.country}` : ''}
${product.bottle_size ? `Size: ${product.bottle_size}` : ''}
${product.alcohol_pct ? `ABV: ${product.alcohol_pct}` : ''}

Format: Start with a brief description, then include "Tasting Notes:" followed by flavour descriptors. Keep it under 200 words.`;

        const aiResponse = useGoogle
          ? await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { maxOutputTokens: 300 },
                }),
              },
            )
          : await fetch('https://ai-gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 300,
              }),
            });

        if (!aiResponse.ok) {
          console.error(`AI API error for ${product.name}: ${aiResponse.status}`);
          continue;
        }

        const aiData = await aiResponse.json();
        // Google returns candidates[].content.parts[].text; Lovable returns OpenAI shape.
        const description = useGoogle
          ? aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
          : aiData.choices?.[0]?.message?.content?.trim();

        if (description) {
          await supabase.from('products').update({ description }).eq('id', product.id);
          updated++;
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`Error generating description for ${product.name}:`, err);
      }
    }

    return new Response(JSON.stringify({
      done: productId ? true : (remaining || 0) <= batchSize,
      updated,
      processed: productsToProcess.length,
      remaining: productId ? 0 : Math.max(0, (remaining || 0) - batchSize),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
