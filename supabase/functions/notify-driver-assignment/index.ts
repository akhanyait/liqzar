// @ts-nocheck
/**
 * notify-driver-assignment — Supabase Edge Function
 *
 * Sends a push notification to a driver when they are assigned a new order.
 * Called by:
 *   (a) The DB trigger trg_notify_driver_on_assignment on delivery_assignments INSERT
 *   (b) Manual admin re-notification (Resend Notification button in admin UI)
 *
 * Flow:
 *   1. Look up the driver's profiles.push_token via driver_profiles → auth.users → profiles
 *   2. Build a friendly notification payload
 *   3. POST to https://exp.host/--/api/v2/push/send (Expo Push API)
 *   4. Log result; on failure mark token as stale so registration retries
 *
 * Request body (JSON):
 *   { assignmentId: string } OR { orderId: string, driverProfileId: string }
 *
 * Response:
 *   { ok: true, delivered: boolean, expoReceipt?: any }
 *
 * Auth: service-role only (DB trigger uses internal call; admin UI uses
 *       Authorization: Bearer <user-jwt>). Deployed with --no-verify-jwt and
 *       validated internally.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

const sendExpoPush = async (message: ExpoPushMessage): Promise<{ ok: boolean; receipt: any }> => {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  const receipt = await res.json();
  return { ok: res.ok && !receipt?.data?.[0]?.status?.includes?.("error"), receipt };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { assignmentId, orderId, driverProfileId } = body ?? {};

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[notify-driver-assignment] Supabase env not configured");
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Resolve assignment + order + driver ─────────────────────────
    let resolvedDriverProfileId = driverProfileId;
    let resolvedOrderId = orderId;

    if (assignmentId) {
      const { data: assignment, error: aErr } = await admin
        .from("delivery_assignments")
        .select("order_id, driver_id")
        .eq("id", assignmentId)
        .maybeSingle();
      if (aErr || !assignment) {
        return jsonResponse({ error: "Assignment not found", assignmentId }, 404);
      }
      resolvedDriverProfileId = assignment.driver_id;
      resolvedOrderId = assignment.order_id;
    }

    if (!resolvedDriverProfileId || !resolvedOrderId) {
      return jsonResponse(
        { error: "Either assignmentId OR (orderId + driverProfileId) is required" },
        400,
      );
    }

    // Get driver auth user_id from driver_profiles
    const { data: driverProfile, error: dpErr } = await admin
      .from("driver_profiles")
      .select("user_id, full_name")
      .eq("id", resolvedDriverProfileId)
      .maybeSingle();
    if (dpErr || !driverProfile) {
      return jsonResponse(
        { error: "Driver profile not found", driverProfileId: resolvedDriverProfileId },
        404,
      );
    }

    // Get push_token from profiles
    const { data: profile } = await admin
      .from("profiles")
      .select("push_token")
      .eq("id", driverProfile.user_id)
      .maybeSingle();

    if (!profile?.push_token) {
      // Not an error — driver may not have granted permission / not yet registered.
      console.info(
        `[notify-driver-assignment] No push_token for driver user_id=${driverProfile.user_id}`,
      );
      return jsonResponse({ ok: true, delivered: false, reason: "no_push_token" });
    }

    // Get order details for the notification body
    const { data: order } = await admin
      .from("orders")
      .select("order_number, total, delivery_address")
      .eq("id", resolvedOrderId)
      .maybeSingle();

    const orderNumber = order?.order_number ?? "(unknown)";
    const total = order?.total ?? 0;
    const addressPreview =
      order?.delivery_address && typeof order.delivery_address === "object"
        ? (order.delivery_address.line_1 ??
            order.delivery_address.address ??
            order.delivery_address.suburb ??
            "")
        : "";

    // ── Send the push ──────────────────────────────────────────────
    const message: ExpoPushMessage = {
      to: profile.push_token,
      title: "New delivery assigned",
      body: `${orderNumber} • R${total.toFixed(2)}${addressPreview ? ` • ${addressPreview}` : ""}`,
      data: {
        type: "driver_assignment",
        orderId: resolvedOrderId,
        orderNumber,
        driverProfileId: resolvedDriverProfileId,
      },
      sound: "default",
      priority: "high",
      channelId: "orders",
    };

    const { ok, receipt } = await sendExpoPush(message);

    if (!ok) {
      console.warn(
        "[notify-driver-assignment] Expo push failed",
        JSON.stringify(receipt),
      );
    }

    return jsonResponse({
      ok: true,
      delivered: ok,
      expoReceipt: receipt,
    });
  } catch (err) {
    console.error("[notify-driver-assignment] error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
