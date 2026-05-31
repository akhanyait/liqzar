// @ts-nocheck
/**
 * notify-whatsapp — fires a WhatsApp message to a customer via Twilio when an
 * order's status changes. Called from the order_status_history pg trigger
 * (Phase 2) or directly with an explicit payload (test/dev mode).
 *
 * Environment (set in Supabase EF secrets):
 *   TWILIO_ACCOUNT_SID         — Twilio account SID (AC...)
 *   TWILIO_AUTH_TOKEN          — Twilio auth token (32-char hex)
 *   TWILIO_WHATSAPP_FROM       — Sender. Sandbox: 'whatsapp:+14155238886'.
 *                                Production: 'whatsapp:+27...' (your number).
 *   TWILIO_WHATSAPP_TEMPLATE_* — Production template SIDs (HX...). Sandbox
 *                                ignores these and sends plain text instead.
 *
 * Sandbox behaviour (when TWILIO_WHATSAPP_FROM === sandbox sender):
 *   Plain-text body, no template SID. Only joined sandbox numbers receive.
 *
 * Production behaviour:
 *   Looks up template SID per event_type, sends with contentVariables map.
 *
 * Request body:
 *   { orderId: string, eventType: 'order_confirmed' | 'driver_en_route' |
 *                                 'driver_arrived' | 'delivered' |
 *                                 'order_issue',
 *     to?: string,           // optional override; otherwise derived from
 *                            // profiles.whatsapp_number → auth.users.phone
 *     dryRun?: boolean }     // build the payload but don't actually send
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SANDBOX_SENDER = "whatsapp:+14155238886";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Template registry ─────────────────────────────────────────────────────
// In SANDBOX mode, the `body` is sent as-is (no template SID exists yet).
// In PRODUCTION mode, set TWILIO_WHATSAPP_TEMPLATE_<EVENT> env vars to the
// approved HX... SIDs and the EF sends with contentVariables instead.
//
// The `vars()` function returns the ordered list of {{1}}, {{2}}, etc.
// values for that template, derived from the order/driver/customer record.
interface TemplateDef {
  body: (ctx: any) => string;
  vars: (ctx: any) => Record<string, string>;
}

const TEMPLATES: Record<string, TemplateDef> = {
  order_confirmed: {
    body: (c) =>
      `✨ Your LIQZAR order #${c.order_number} is confirmed!\nWe're preparing it now. Total: R${c.total}.\nWe'll WhatsApp you again when your driver is on the way.`,
    vars: (c) => ({ "1": c.order_number, "2": String(c.total) }),
  },
  driver_en_route: {
    body: (c) =>
      `🛵 Your driver ${c.driver_name} is on the way!\nOrder #${c.order_number} · ETA ~${c.eta_min} min\nTrack live: ${c.track_url}\nHave your PIN ready: ${c.pin}`,
    vars: (c) => ({
      "1": c.driver_name,
      "2": c.order_number,
      "3": String(c.eta_min),
      "4": c.track_url,
      "5": c.pin,
    }),
  },
  driver_arrived: {
    body: (c) =>
      `📍 Your driver is at your door.\nOrder #${c.order_number} · Driver: ${c.driver_name} · Call: ${c.driver_phone}\nPlease share your delivery PIN.`,
    vars: (c) => ({
      "1": c.order_number,
      "2": c.driver_name,
      "3": c.driver_phone,
    }),
  },
  delivered: {
    body: (c) =>
      `🍷 Order #${c.order_number} delivered. Enjoy responsibly.\nRate your driver: ${c.rating_url}\nReorder in one tap: ${c.reorder_url}`,
    vars: (c) => ({
      "1": c.order_number,
      "2": c.rating_url,
      "3": c.reorder_url,
    }),
  },
  order_issue: {
    body: (c) =>
      `⚠️ We hit an issue with your order #${c.order_number}.\nReason: ${c.reason}\nA LIQZAR concierge will be in touch within 15 minutes. Or message us: wa.me/${c.concierge}`,
    vars: (c) => ({
      "1": c.order_number,
      "2": c.reason,
      "3": c.concierge,
    }),
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────

function normaliseE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // SA local 0... → +27...
  if (digits.startsWith("0") && digits.length === 10) return `+27${digits.slice(1)}`;
  // 27... → +27...
  if (digits.startsWith("27") && digits.length === 11) return `+${digits}`;
  // already has + (rare since we stripped)
  if (raw.startsWith("+")) return raw;
  // bare digits with country code, add +
  return `+${digits}`;
}

async function buildContext(
  supabase: any,
  orderId: string,
  eventType: string,
): Promise<{ ctx: any; toPhone: string | null; optedIn: boolean }> {
  // Fetch order
  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select(
      "order_number, total, user_id, status, delivery_address, assigned_driver_id, eta_minutes",
    )
    .eq("id", orderId)
    .single();
  if (oErr || !order) throw new Error(`Order ${orderId} not found: ${oErr?.message}`);

  // Fetch customer profile + opt-in
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, whatsapp_optin, whatsapp_number")
    .eq("id", order.user_id)
    .maybeSingle();

  // Customer phone — prefer profile.whatsapp_number, fall back to auth.users.phone
  // (via delivery_address as a sourced fallback for legacy data).
  let phone: string | null = profile?.whatsapp_number || null;
  if (!phone) {
    const { data: authUser } = await supabase
      .from("auth.users")
      .select("phone")
      .eq("id", order.user_id)
      .maybeSingle();
    phone = authUser?.phone || order.delivery_address?.recipient_phone || null;
  }
  const toPhone = normaliseE164(phone);

  // Driver info if relevant to the event
  let driver: any = {};
  if (
    order.assigned_driver_id &&
    ["driver_en_route", "driver_arrived"].includes(eventType)
  ) {
    const { data: d } = await supabase
      .from("driver_profiles")
      .select("full_name, phone, user_id")
      .eq("user_id", order.assigned_driver_id)
      .maybeSingle();
    driver = d ?? {};
  }

  // Delivery PIN (if it exists on the order — from migration 20260405)
  const { data: pinRow } = await supabase
    .from("orders")
    .select("delivery_pin")
    .eq("id", orderId)
    .maybeSingle();

  const baseUrl = Deno.env.get("LIQZAR_PUBLIC_URL") ?? "https://liqzar.co.za";
  const concierge = (Deno.env.get("LIQZAR_CONCIERGE_WHATSAPP") ?? "27810001234").replace(/\D/g, "");

  const ctx = {
    order_number: order.order_number,
    total: Number(order.total ?? 0).toFixed(2),
    driver_name: driver.full_name ?? "your LIQZAR driver",
    driver_phone: driver.phone ?? "",
    eta_min: order.eta_minutes ?? 15,
    track_url: `${baseUrl}/track/${orderId}`,
    pin: pinRow?.delivery_pin ?? "—",
    rating_url: `${baseUrl}/rate/${orderId}`,
    reorder_url: `${baseUrl}/reorder/${orderId}`,
    reason: order.status === "delivery_failed" ? "Delivery couldn't complete" : "Pending review",
    concierge,
  };

  return { ctx, toPhone, optedIn: !!profile?.whatsapp_optin };
}

// ── Main handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? SANDBOX_SENDER;
    if (!sid || !token) {
      return new Response(
        JSON.stringify({ error: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set in EF secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { orderId, eventType, to: toOverride, dryRun } = await req.json();
    if (!orderId || !eventType) {
      return new Response(JSON.stringify({ error: "orderId + eventType required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const template = TEMPLATES[eventType];
    if (!template) {
      return new Response(
        JSON.stringify({ error: `Unknown eventType: ${eventType}. Known: ${Object.keys(TEMPLATES).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { ctx, toPhone, optedIn } = await buildContext(supabase, orderId, eventType);

    // Opt-in gate — REQUIRED by Meta policy. Skip if customer hasn't opted in
    // UNLESS this is a dryRun OR a `to` override is supplied (dev/test).
    if (!optedIn && !toOverride && !dryRun) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "customer not opted in to WhatsApp" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const recipientRaw = toOverride || toPhone;
    if (!recipientRaw) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no recipient phone resolved" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const recipient = normaliseE164(recipientRaw)!;
    const toWA = recipient.startsWith("whatsapp:") ? recipient : `whatsapp:${recipient}`;

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dryRun: true,
          from,
          to: toWA,
          body: template.body(ctx),
          vars: template.vars(ctx),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Production: use ContentSid + contentVariables if available. Otherwise
    // send plain Body (sandbox + transitional period before templates approved).
    const templateSid = Deno.env.get(
      `TWILIO_WHATSAPP_TEMPLATE_${eventType.toUpperCase()}`,
    );
    const isSandbox = from === SANDBOX_SENDER;

    const body = new URLSearchParams();
    body.set("From", from);
    body.set("To", toWA);
    if (templateSid && !isSandbox) {
      body.set("ContentSid", templateSid);
      body.set("ContentVariables", JSON.stringify(template.vars(ctx)));
    } else {
      body.set("Body", template.body(ctx));
    }

    const creds = btoa(`${sid}:${token}`);
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${creds}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    const payload = await resp.json().catch(() => ({ raw: "non-json response" }));

    if (!resp.ok) {
      console.error("[notify-whatsapp] Twilio error", resp.status, payload);
      return new Response(
        JSON.stringify({ error: "Twilio rejected", status: resp.status, twilio: payload }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sid: payload.sid,
        status: payload.status,
        to: toWA,
        mode: isSandbox ? "sandbox" : templateSid ? "template" : "plain-text",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[notify-whatsapp] unexpected", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
