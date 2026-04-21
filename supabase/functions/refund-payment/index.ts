// @ts-nocheck
/**
 * refund-payment — Supabase Edge Function
 *
 * Submits a refund request to the Yoco API for an authorised or captured
 * payment. Called by PaymentService.requestRefund() on the mobile client.
 *
 * Request body:
 *   { paymentId: string; orderId: string; reason: string }
 *
 * Environment secrets required (set via `supabase secrets set`):
 *   YOCO_SECRET_KEY   — Live or test secret key from Yoco dashboard
 *   SUPABASE_URL      — Injected automatically by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — Injected automatically by Supabase
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
    const { paymentId, orderId, reason } = await req.json();

    if (!paymentId || !orderId) {
      return new Response(
        JSON.stringify({ error: "paymentId and orderId are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const yocoSecretKey = Deno.env.get("YOCO_SECRET_KEY");
    if (!yocoSecretKey) {
      console.error("[refund-payment] YOCO_SECRET_KEY is not set");
      return new Response(
        JSON.stringify({ error: "Payment gateway not configured" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Look up the payment record via service role ───────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("id, yoco_charge_id, amount, status, order_id")
      .eq("id", paymentId)
      .eq("order_id", orderId)
      .in("status", ["authorized", "captured"])
      .single();

    if (fetchError || !payment) {
      console.error(
        "[refund-payment] Payment not found or not refundable:",
        fetchError,
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

    if (!payment.yoco_charge_id) {
      console.error(
        "[refund-payment] Payment has no yoco_charge_id:",
        paymentId,
      );
      // Still record attempt — allows manual processing
      await supabase
        .from("payments")
        .update({
          status: "refund_pending",
          failure_reason: `Manual refund required: ${reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

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
    // https://developer.yoco.com/online/resources/api-reference
    const yocoResponse = await fetch(
      `${YOCO_API_BASE}/charges/${payment.yoco_charge_id}/refund`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${yocoSecretKey}`,
        },
        body: JSON.stringify({
          amount: Math.round(payment.amount * 100), // Yoco expects cents
          reason: reason || "customer_requested",
        }),
      },
    );

    const yocoData = await yocoResponse.json();

    if (!yocoResponse.ok) {
      console.error("[refund-payment] Yoco API error:", yocoData);
      // Record as pending for manual review
      await supabase
        .from("payments")
        .update({
          status: "refund_pending",
          failure_reason: yocoData?.displayMessage || yocoData?.error || reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      return new Response(
        JSON.stringify({
          success: false,
          error: yocoData?.displayMessage || "Refund request failed at gateway",
          requiresManualProcessing: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Update DB to reflect successful refund initiation ─────────
    await supabase
      .from("payments")
      .update({
        status: "refunded",
        yoco_refund_id: yocoData.id ?? yocoData.refundId ?? null,
        failure_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    // Update order payment_status
    await supabase
      .from("orders")
      .update({ payment_status: "refunded" })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({ success: true, refundId: yocoData.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[refund-payment] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
