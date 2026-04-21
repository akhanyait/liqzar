// @ts-nocheck
/**
 * notify-restock — Supabase Edge Function
 *
 * Complements the DB trigger added in migration 013. The trigger already
 * inserts in-app notifications when a product transitions back to available,
 * and marks each stock_notifications row as `notified`. This EF:
 *
 *   (a) Can be invoked by admins to push an immediate restock ping even when
 *       stock_quantity hasn't changed (e.g. reorder confirmed, ETA announced).
 *   (b) Dispatches transactional email/SMS to subscribers — the DB trigger
 *       only handles in-app. Email/SMS provider hooks are stubbed and
 *       marked TODO until SendGrid / Twilio credentials are configured.
 *
 * Request body (JSON):
 *   { productId: string; message?: string; dispatchEmail?: boolean; dispatchSms?: boolean }
 *
 * Response:
 *   { ok: true, notified: number, emailsQueued: number, smsQueued: number }
 *
 * Auth: admin-only. The caller's JWT must resolve to a user_roles row with role='admin'.
 * Deploy with `--no-verify-jwt` and validate internally (matches existing pattern).
 *
 * Environment (optional — stubs no-op if unset):
 *   SENDGRID_API_KEY   — transactional email
 *   SENDGRID_FROM      — from address
 *   TWILIO_ACCOUNT_SID — SMS
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productId, message, dispatchEmail, dispatchSms } = await req.json();

    if (!productId || typeof productId !== "string") {
      return jsonResponse({ error: "productId is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[notify-restock] Supabase env not configured");
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // ── Caller must be an admin ───────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Invalid auth token" }, 401);
    }
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (roleRow?.role !== "admin") {
      return jsonResponse({ error: "Admin role required" }, 403);
    }

    // ── Load product ─────────────────────────────────────────────
    const { data: product, error: prodErr } = await admin
      .from("products")
      .select("id, name")
      .eq("id", productId)
      .maybeSingle();
    if (prodErr || !product) {
      return jsonResponse({ error: "Product not found" }, 404);
    }

    // ── Load all pending subscribers with their profile contact info ──
    const { data: subs, error: subErr } = await admin
      .from("stock_notifications")
      .select("id, user_id")
      .eq("product_id", productId)
      .eq("status", "pending");
    if (subErr) {
      console.error("[notify-restock]", subErr);
      return jsonResponse({ error: "Failed to load subscribers" }, 500);
    }

    if (!subs || subs.length === 0) {
      return jsonResponse({
        ok: true,
        notified: 0,
        emailsQueued: 0,
        smsQueued: 0,
      });
    }

    const userIds = subs.map((s) => s.user_id);

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, phone, email")
      .in("id", userIds);
    const profileMap = new Map<
      string,
      { full_name?: string; phone?: string; email?: string }
    >();
    (profiles || []).forEach((p) => profileMap.set(p.id, p));

    const body =
      message ||
      `${product.name} is back in stock. Tap to buy before it sells out again.`;

    // ── Insert in-app notifications ──────────────────────────────
    const notifRows = subs.map((s) => ({
      user_id: s.user_id,
      title: "Back in stock",
      message: body,
      type: "stock_back",
    }));
    await admin.from("notifications").insert(notifRows);

    // ── Mark subs as notified ────────────────────────────────────
    await admin
      .from("stock_notifications")
      .update({ status: "notified", notified_at: new Date().toISOString() })
      .in(
        "id",
        subs.map((s) => s.id),
      );

    // ── Optional: queue transactional email (SendGrid) ───────────
    let emailsQueued = 0;
    if (dispatchEmail) {
      const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
      const sendgridFrom = Deno.env.get("SENDGRID_FROM");
      if (!sendgridKey || !sendgridFrom) {
        console.warn(
          "[notify-restock] SENDGRID_* env not set — email dispatch skipped (stub)",
        );
      } else {
        for (const s of subs) {
          const profile = profileMap.get(s.user_id);
          if (!profile?.email) continue;
          try {
            await fetch("https://api.sendgrid.com/v3/mail/send", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${sendgridKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                personalizations: [{ to: [{ email: profile.email }] }],
                from: { email: sendgridFrom, name: "LIQZAR" },
                subject: `${product.name} is back in stock`,
                content: [{ type: "text/plain", value: body }],
              }),
            });
            emailsQueued++;
          } catch (e) {
            console.error("[notify-restock] sendgrid error", e);
          }
        }
      }
    }

    // ── Optional: queue SMS (Twilio) ─────────────────────────────
    let smsQueued = 0;
    if (dispatchSms) {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioFrom = Deno.env.get("TWILIO_FROM");
      if (!twilioSid || !twilioToken || !twilioFrom) {
        console.warn(
          "[notify-restock] TWILIO_* env not set — SMS dispatch skipped (stub)",
        );
      } else {
        const creds = btoa(`${twilioSid}:${twilioToken}`);
        for (const s of subs) {
          const profile = profileMap.get(s.user_id);
          if (!profile?.phone) continue;
          try {
            const form = new URLSearchParams({
              To: profile.phone,
              From: twilioFrom,
              Body: body,
            });
            await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  Authorization: `Basic ${creds}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: form.toString(),
              },
            );
            smsQueued++;
          } catch (e) {
            console.error("[notify-restock] twilio error", e);
          }
        }
      }
    }

    return jsonResponse({
      ok: true,
      notified: subs.length,
      emailsQueued,
      smsQueued,
    });
  } catch (e) {
    console.error("[notify-restock] unhandled", e);
    return jsonResponse({ error: String(e) }, 500);
  }
});
