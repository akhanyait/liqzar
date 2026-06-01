// @ts-nocheck
// LIQZAR AI Sommelier — direct Google Gemini, streaming.
//
// Previously routed through Lovable's gateway as an OpenAI-compatible facade
// over the same Gemini model. The gateway added cost + a 3rd-party dependency
// for no functional benefit. This calls Gemini directly via Google's SDK and
// shims the response into OpenAI-style SSE chunks so the React client
// (src/components/SommelierChat.tsx) doesn't need to change.
//
// Env: GOOGLE_AI_API_KEY  (free tier from https://aistudio.google.com)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai@2.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are LIQZAR's AI Sommelier — a warm, knowledgeable expert on wines, spirits, beers, and cocktails. You help South African customers discover the perfect drink.

Your personality:
- Friendly, approachable, and enthusiastic about drinks
- Use casual South African English when appropriate
- Give concise, practical recommendations (2-4 sentences max per recommendation)
- Always suggest food pairings when relevant
- Mention price ranges in ZAR when recommending products
- If asked about non-drink topics, gently redirect to drinks

Format tips:
- Use **bold** for product names
- Use bullet points for multiple recommendations
- Keep responses under 200 words unless detailed comparison requested`;

/** Wrap each Gemini text chunk in an OpenAI-style SSE frame so the existing
 *  React client (which parses `data: {"choices":[{"delta":{"content"...}}]}`)
 *  keeps working without a code change. */
function geminiToOpenAISSE(geminiStream: AsyncIterable<{ text: string }>) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of geminiStream) {
          const text = chunk?.text ?? "";
          if (!text) continue;
          const sse = `data: ${JSON.stringify({
            choices: [{ delta: { content: text } }],
          })}\n\n`;
          controller.enqueue(encoder.encode(sse));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        console.error("sommelier-chat stream error:", err);
        controller.error(err);
      }
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) throw new Error("GOOGLE_AI_API_KEY is not configured");

    const ai = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

    // OpenAI roles → Gemini roles. Gemini uses "user" + "model"; assistant → model.
    const contents = (messages ?? []).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const stream = await ai.models.generateContentStream({
      model: MODEL,
      contents,
      config: { systemInstruction: SYSTEM_PROMPT },
    });

    return new Response(geminiToOpenAISSE(stream), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("sommelier-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
