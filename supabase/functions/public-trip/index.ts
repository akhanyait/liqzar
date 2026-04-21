// @ts-nocheck
/**
 * public-trip — Supabase Edge Function
 *
 * Public, unauthenticated endpoint that resolves a share-trip token
 * (from `order_share_tokens`) to a sanitized read-only view of the order:
 *
 *   {
 *     orderNumber: string,
 *     status: string,
 *     etaMinutes: number | null,
 *     placedAt: string,
 *     addressCity: string,
 *     driver: { firstName: string, vehicle: string | null } | null,
 *     live: { lat, lng, updatedAt } | null
 *   }
 *
 * Explicitly excluded: user email, full address, phone numbers, item list,
 * prices, payment state. The share URL is meant for "letting a friend watch
 * the pin move" — not a full order receipt.
 *
 * Deploy with `--no-verify-jwt` — the token IS the auth.
 *
 * Request:
 *   GET  /public-trip?token=abc123
 *   POST /public-trip  body { token: "abc123" }
 *
 * Response:
 *   200  { ok: true, trip: { ... } }
 *   404  { ok: false, error: "Unknown token" }
 *   410  { ok: false, error: "Expired" | "Revoked" }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const extractCity = (addr: unknown): string => {
  if (!addr || typeof addr !== "object") return "";
  const a = addr as Record<string, unknown>;
  return (
    (a.city as string) ||
    (a.suburb as string) ||
    (a.town as string) ||
    ""
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let token: string | null = null;
    if (req.method === "GET") {
      token = new URL(req.url).searchParams.get("token");
    } else if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = typeof body?.token === "string" ? body.token : null;
    } else {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    if (!token) return json({ ok: false, error: "token required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: tokenRow, error: tokenErr } = await admin
      .from("order_share_tokens")
      .select("order_id, expires_at, revoked_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr) {
      console.warn("[public-trip] token lookup error", tokenErr);
      return json({ ok: false, error: "Lookup failed" }, 500);
    }
    if (!tokenRow) return json({ ok: false, error: "Unknown token" }, 404);
    if (tokenRow.revoked_at) return json({ ok: false, error: "Revoked" }, 410);
    if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
      return json({ ok: false, error: "Expired" }, 410);
    }

    const { data: order } = await admin
      .from("orders")
      .select(
        "id, order_number, status, estimated_delivery, created_at, delivery_address, assigned_driver_id",
      )
      .eq("id", tokenRow.order_id)
      .maybeSingle();

    if (!order) return json({ ok: false, error: "Order not found" }, 404);

    let driver: { firstName: string; vehicle: string | null } | null = null;
    if (order.assigned_driver_id) {
      const { data: dp } = await admin
        .from("driver_profiles")
        .select("full_name")
        .eq("user_id", order.assigned_driver_id)
        .maybeSingle();
      const { data: dv } = await admin
        .from("driver_vehicles")
        .select("make_model, vehicle_type")
        .eq("driver_id", order.assigned_driver_id)
        .maybeSingle();
      if (dp) {
        const firstName = (dp.full_name || "Driver").split(" ")[0];
        driver = {
          firstName,
          vehicle: dv?.make_model || dv?.vehicle_type || null,
        };
      }
    }

    const { data: live } = await admin
      .from("driver_live_locations")
      .select("lat, lng, updated_at")
      .eq("order_id", order.id)
      .maybeSingle();

    const etaMinutes =
      order.estimated_delivery
        ? Math.max(
            0,
            Math.round(
              (new Date(order.estimated_delivery).getTime() - Date.now()) /
                60000,
            ),
          )
        : null;

    return json({
      ok: true,
      trip: {
        orderNumber: order.order_number,
        status: order.status,
        etaMinutes,
        placedAt: order.created_at,
        addressCity: extractCity(order.delivery_address),
        driver,
        live: live
          ? {
              lat: live.lat,
              lng: live.lng,
              updatedAt: live.updated_at,
            }
          : null,
      },
    });
  } catch (e) {
    console.error("[public-trip] error", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
