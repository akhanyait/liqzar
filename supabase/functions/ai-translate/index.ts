// @ts-nocheck
// AI Translate — UI string translation across South Africa's 11 official
// languages, direct Google Gemini (no gateway middleman).
//
// Two modes, same endpoint:
//   • Batch UI strings: { texts: string[], targetLang }
//     → { translations: string[] }      (used by src/context/LanguageContext.tsx)
//   • Single chat message: { text, targetLang }
//     → { translated, detected_language, target_language }   (future driver↔customer)
//
// Env: GOOGLE_AI_API_KEY  (free tier from https://aistudio.google.com)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI, Type } from "npm:@google/genai@2.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "gemini-2.5-flash";

const UI_SYSTEM_PROMPT = (target: string) =>
  `You localise the UI of LIQZAR, a South African premium wine & spirits e-commerce app, into ${target}. Translate naturally and concisely (UI labels, headings, buttons). Keep brand names like "LIQZAR" as-is, keep emoji, keep ZAR amounts and the "R" symbol untouched (e.g. "R 1 500" stays "R 1 500"). Keep wine/spirit terminology accurate (Cabernet, Chenin Blanc, single malt, etc.). Return exactly one translation per input string, in order.`;

const CHAT_SYSTEM_PROMPT = (target: string) =>
  `You translate chat messages on LIQZAR, a South African premium wine & spirits app (used by customers, drivers, and back-office staff). Translate the user's message into ${target}. Preserve meaning and tone. Keep ZAR amounts and "R" symbols as-is. Do not add commentary. Detect the source language (one of South Africa's 11 official languages or other).`;

function getClient() {
  const key = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!key) throw new Error("GOOGLE_AI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey: key });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, texts, targetLang } = await req.json();
    const target = typeof targetLang === "string" && targetLang.trim() ? targetLang.trim() : "English";
    const ai = getClient();

    // ── Batch mode ──────────────────────────────────────────────────────────
    if (Array.isArray(texts)) {
      const items = texts.filter((t) => typeof t === "string").slice(0, 80);
      if (items.length === 0) {
        return new Response(JSON.stringify({ translations: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await ai.models.generateContent({
        model: MODEL,
        contents: `Translate each of these app UI strings into ${target}. Return them in the SAME ORDER.\n${JSON.stringify(items)}`,
        config: {
          systemInstruction: UI_SYSTEM_PROMPT(target),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translations: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["translations"],
          },
        },
      });

      // Parse defensively — fall back to English if the model returns garbage.
      let parsed: { translations?: string[] } = {};
      try {
        parsed = JSON.parse(response.text ?? "{}");
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

    // ── Single-message mode ────────────────────────────────────────────────
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "text or texts is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: text.slice(0, 2000),
      config: {
        systemInstruction: CHAT_SYSTEM_PROMPT(target),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translated: { type: Type.STRING, description: `Message translated into ${target}` },
            detected_language: { type: Type.STRING, description: "Detected source language name in English" },
            target_language: { type: Type.STRING, description: "Target language name" },
          },
          required: ["translated", "detected_language", "target_language"],
        },
      },
    });

    return new Response(response.text ?? '{"translated":"","detected_language":"","target_language":""}', {
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
