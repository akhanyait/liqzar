// @ts-nocheck
/**
 * issue-call-token — Supabase Edge Function
 *
 * Creates (or re-uses) a Daily.co video room for an in-app call between a
 * customer and the driver assigned to their order. Returns a per-participant
 * meeting token so only the two parties can join.
 *
 * Env vars:
 *   DAILY_API_KEY    — server-side key from https://dashboard.daily.co/
 *   DAILY_DOMAIN     — e.g. "liqzar.daily.co" (optional; default is the key's domain)
 *
 * Request:
 *   POST /issue-call-token
 *   body { orderId: string }   ← authenticated caller (customer or driver)
 *
 * Response 200:
 *   { ok: true, roomUrl, token, expiresAt }
 *   The client should navigate to `${roomUrl}?t=${token}`.
 *
 * Authorization is enforced in two layers:
 *   1. The gateway validates the Supabase JWT (verify_jwt = true).
 *   2. We cross-check that the caller's uid is either orders.user_id OR
 *      orders.assigned_driver_id. Anyone else gets a 403.
 *
 * Rooms expire 30 min after creation and support a max of 2 participants.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dailyKey = Deno.env.get("DAILY_API_KEY");
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: "Server misconfigured" }, 500);
    }
    if (!dailyKey) {
      return json(
        {
          ok: false,
          error:
            "Video calls are not configured yet. Set DAILY_API_KEY in Supabase secrets.",
        },
        501,
      );
    }

    // Identify the caller from the JWT carried through by the gateway.
    const authHeader = req.headers.get("Authorization") || "";
    const authed = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData.user) {
      return json({ ok: false, error: "Not authenticated" }, 401);
    }
    const uid = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body?.orderId;
    if (!orderId) return json({ ok: false, error: "orderId required" }, 400);

    // Authorize caller against the order (service role bypasses RLS).
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const { data: order } = await admin
      .from("orders")
      .select("id, order_number, user_id, assigned_driver_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return json({ ok: false, error: "Order not found" }, 404);
    const isCustomer = order.user_id === uid;
    const isDriver = order.assigned_driver_id === uid;
    if (!isCustomer && !isDriver) {
      return json({ ok: false, error: "Not a party to this delivery" }, 403);
    }

    // Short, stable per-order room name so both participants converge.
    const roomName = `liqzar-${order.order_number || order.id.slice(0, 8)}`.toLowerCase();

    // Idempotent room create — 200 on success, 409 if it already exists.
    const expMs = Date.now() + 30 * 60 * 1000;
    const createRes = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dailyKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        privacy: "private",
        properties: {
          max_participants: 2,
          enable_chat: true,
          enable_screenshare: false,
          exp: Math.floor(expMs / 1000),
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    });
    if (!createRes.ok && createRes.status !== 409) {
      const text = await createRes.text();
      console.warn("[issue-call-token] daily create failed", text);
      return json({ ok: false, error: "Could not open call room" }, 502);
    }

    const domain = Deno.env.get("DAILY_DOMAIN");
    const roomUrl = domain
      ? `https://${domain}/${roomName}`
      : (await createRes
          .clone()
          .json()
          .catch(() => ({})))?.url ||
        `https://${dailyKey.split(".")[0] ?? "liqzar"}.daily.co/${roomName}`;

    // Issue per-participant meeting token
    const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dailyKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: isCustomer ? "Customer" : "Driver",
          user_id: uid,
          exp: Math.floor(expMs / 1000),
          is_owner: isCustomer, // customer initiates so grant owner to allow kicking
        },
      }),
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.warn("[issue-call-token] daily token failed", text);
      return json({ ok: false, error: "Could not issue call token" }, 502);
    }
    const tokenData = await tokenRes.json();

    return json({
      ok: true,
      roomUrl,
      token: tokenData.token,
      expiresAt: new Date(expMs).toISOString(),
    });
  } catch (e) {
    console.error("[issue-call-token] error", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
