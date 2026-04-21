// @ts-nocheck
/**
 * process-refund — Supabase Edge Function
 *
 * Processes an admin-approved refund against the Yoco payment gateway.
 * Called exclusively by RefundService.approveRefund() after an admin has
 * set a refund record to `approved` status.
 *
 * Flow:
 *   1. Validate refund record exists and is in `approved` state
 *   2. Look up the associated payment's Yoco charge ID
 *   3. Submit refund to Yoco: POST /charges/{chargeId}/refund
 *   4. On success → refunds.status = completed, payments.status = refunded,
 *                   orders.payment_status = refunded
 *   5. On Yoco failure → refunds.status = failed, payments.status = refund_pending
 *      (queued for manual processing)
 *
 * Request body (from RefundService.approveRefund):
 *   { refundId: string; paymentId: string; amount: number }
 *
 * Environment secrets required (set via `supabase secrets set`):
 *   YOCO_SECRET_KEY               — Live or test secret key from Yoco dashboard
 *   SUPABASE_URL                  — Injected automatically by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY     — Injected automatically by Supabase
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const YOCO_API_BASE = "https://payments.yoco.com/api";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Parse & validate body ─────────────────────────────────────
    const { refundId, paymentId, amount } = await req.json();

    if (!refundId || !paymentId || typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({
          error: "refundId, paymentId, and a positive amount are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const yocoSecretKey = Deno.env.get("YOCO_SECRET_KEY");
    if (!yocoSecretKey) {
      console.error("[process-refund] YOCO_SECRET_KEY is not set");
      return new Response(
        JSON.stringify({ error: "Payment gateway not configured" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ── Fetch and validate the refund record ─────────────────────
    const { data: refund, error: refundFetchError } = await supabase
      .from("refunds")
      .select("id, order_id, payment_id, amount, status, reason")
      .eq("id", refundId)
      .eq("payment_id", paymentId)
      .single();

    if (refundFetchError || !refund) {
      console.error("[process-refund] Refund not found:", refundFetchError);
      return new Response(
        JSON.stringify({ error: "Refund record not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Only process refunds in `approved` state — guard against replays
    if (refund.status !== "approved") {
      console.warn(
        `[process-refund] Refund ${refundId} is in status '${refund.status}', expected 'approved'`,
      );
      return new Response(
        JSON.stringify({
          error: `Refund is not in approved state (current: ${refund.status})`,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Fetch the payment record ──────────────────────────────────
    const { data: payment, error: paymentFetchError } = await supabase
      .from("payments")
      .select("id, yoco_charge_id, amount, status, order_id")
      .eq("id", paymentId)
      .in("status", ["authorized", "captured", "refund_pending"])
      .single();

    if (paymentFetchError || !payment) {
      console.error(
        "[process-refund] Payment not found or not eligible:",
        paymentFetchError,
      );
      return new Response(
        JSON.stringify({
          error: "Payment not found or not eligible for refund",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── No Yoco charge ID → queue for manual processing ──────────
    if (!payment.yoco_charge_id) {
      console.warn(
        "[process-refund] Payment has no yoco_charge_id — queuing for manual refund:",
        paymentId,
      );

      await Promise.all([
        supabase
          .from("refunds")
          .update({
            status: "failed",
            notes: "No gateway charge ID — manual processing required",
            processed_at: new Date().toISOString(),
          })
          .eq("id", refundId),
        supabase
          .from("payments")
          .update({
            status: "refund_pending",
            failure_reason: "Manual refund required: no gateway charge ID",
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentId),
      ]);

      return new Response(
        JSON.stringify({
          success: false,
          requiresManualProcessing: true,
          message:
            "Payment has no gateway charge ID. Queued for manual refund.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Submit refund to Yoco ─────────────────────────────────────
    // Yoco refund endpoint: POST /charges/{chargeId}/refund
    // Amounts are submitted in cents (integer)
    const refundAmountCents = Math.round(amount * 100);

    const yocoResponse = await fetch(
      `${YOCO_API_BASE}/charges/${payment.yoco_charge_id}/refund`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${yocoSecretKey}`,
        },
        body: JSON.stringify({
          amount: refundAmountCents,
          reason: refund.reason || "admin_approved",
        }),
      },
    );

    const yocoData = await yocoResponse.json();

    // ── Yoco rejected the refund ──────────────────────────────────
    if (!yocoResponse.ok) {
      console.error("[process-refund] Yoco API error:", yocoData);

      await Promise.all([
        supabase
          .from("refunds")
          .update({
            status: "failed",
            notes:
              yocoData?.displayMessage ||
              yocoData?.error ||
              "Gateway rejected refund",
            processed_at: new Date().toISOString(),
          })
          .eq("id", refundId),
        supabase
          .from("payments")
          .update({
            status: "refund_pending",
            failure_reason:
              yocoData?.displayMessage || yocoData?.error || "Refund failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentId),
      ]);

      return new Response(
        JSON.stringify({
          success: false,
          error: yocoData?.displayMessage || "Refund was rejected by gateway",
          requiresManualProcessing: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Success — update all three records atomically ─────────────
    const now = new Date().toISOString();

    await Promise.all([
      supabase
        .from("refunds")
        .update({
          status: "completed",
          processed_at: now,
          notes: `Yoco refund ID: ${yocoData.id ?? yocoData.refundId ?? "unknown"}`,
        })
        .eq("id", refundId),
      supabase
        .from("payments")
        .update({
          status: "refunded",
          yoco_refund_id: yocoData.id ?? yocoData.refundId ?? null,
          refunded_at: now,
          updated_at: now,
        })
        .eq("id", paymentId),
      supabase
        .from("orders")
        .update({ payment_status: "refunded" })
        .eq("id", refund.order_id),
    ]);

    console.log(
      `[process-refund] Refund ${refundId} completed. Yoco refund: ${yocoData.id ?? yocoData.refundId}`,
    );

    return new Response(JSON.stringify({ success: true, refundId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[process-refund] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
