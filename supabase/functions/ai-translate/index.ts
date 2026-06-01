// @ts-nocheck
// AI Translate — UI string translation across South Africa's 11 official
// languages, powered by the same Lovable AI gateway that backs sommelier-chat
// (so it shares LOVABLE_API_KEY + billing).
//
// Adapted from ArtisanZA's `ai-translate` Edge Function. Differences:
//   - Calls https://ai.gateway.lovable.dev (vs Google Gemini SDK) so a single
//     API key powers every AI feature in liqZAR.
//   - System prompt is liqzar-flavoured (preserves "R" amounts, wine/spirit
//     terminology, brand names like "LIQZAR" untouched).
//   - JSON-mode response so the client gets a stable `{ translations: [...] }`
//     shape it can map back to the input array.
//
// Called by src/context/LanguageContext.tsx via supabase.functions.invoke()
// with body: { texts: string[], targetLang: string } for batch mode, or
// { text: string, targetLang: string } for single-message mode (used by
// future chat translation, e.g. driver↔customer messaging).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-3-flash-preview";

const UI_SYSTEM_PROMPT = (target: string) =>
  `You localise the UI of LIQZAR, a South African premium wine & spirits e-commerce app, into ${target}. Translate naturally and concisely (UI labels, headings, buttons). Keep brand names like "LIQZAR" as-is, keep emoji, keep ZAR amounts and the "R" symbol untouched (e.g. "R 1 500" stays "R 1 500"). Keep wine/spirit terminology accurate (Cabernet, Chenin Blanc, single malt, etc.). Return ONLY a JSON object of the form {"translations": ["...", "..."]} with exactly one translation per input string, in order — no commentary, no markdown fences.`;

const CHAT_SYSTEM_PROMPT = (target: string) =>
  `You translate chat messages on LIQZAR, a South African premium wine & spirits app (used by customers, drivers, and back-office staff). Translate the user's message into ${target}. Preserve meaning and tone. Keep ZAR amounts and "R" symbols as-is. Do not add commentary. Return ONLY a JSON object of the form {"translated": "...", "detected_language": "...", "target_language": "..."}.`;

async function callGateway(systemPrompt: string, userContent: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI gateway ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("AI gateway returned empty content");
  return text as string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, texts, targetLang } = await req.json();
    const target = typeof targetLang === "string" && targetLang.trim() ? targetLang.trim() : "English";

    // ── Batch mode: translate an array of UI strings in one call ──
    if (Array.isArray(texts)) {
      const items = texts.filter((t) => typeof t === "string").slice(0, 80);
      if (items.length === 0) {
        return new Response(JSON.stringify({ translations: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userContent = `Translate each of these app UI strings into ${target}. Return them in the SAME ORDER.\n${JSON.stringify(items)}`;
      const raw = await callGateway(UI_SYSTEM_PROMPT(target), userContent);

      // Parse defensively — fall back to English if the model returns garbage.
      let parsed: { translations?: string[] } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        return new Response(JSON.stringify({ translations: items }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const translations = Array.isArray(parsed.translations)
        ? parsed.translations.map((t, i) => (typeof t === "string" && t ? t : items[i]))
        : items;
      return new Response(JSON.stringify({ translations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Single-message mode: translate one chat message ──
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "text or texts is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const raw = await callGateway(CHAT_SYSTEM_PROMPT(target), text.slice(0, 2000));
    return new Response(raw, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-translate error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
