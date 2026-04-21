// @ts-nocheck
/**
 * initiate-payment — Supabase Edge Function (Ozow gateway)
 *
 * Two modes:
 *  A) Legacy  — client pre-created order + payment: { paymentId, orderId, amount, ... }
 *  B) New     — client passes full order data:      { orderData, ... }
 *               EF creates order + items + payment record server-side (bypasses RLS).
 *
 * Calls Ozow PostPaymentRequest API to create a Pay-by-Bank payment link.
 * Returns HTTP 200 always — errors signalled via { success: false, error }.
 *
 * ── Required Supabase secrets ───────────────────────────────────────────────
 *   OZOW_SITE_CODE       - Merchant site code (e.g. "TSTSTE0001" for sandbox)
 *   OZOW_API_KEY         - Server API key (request header)
 *   OZOW_PRIVATE_KEY     - Used for SHA512 hash generation
 *   OZOW_IS_TEST         - "true" for sandbox, "false" for live  (optional, defaults to "true")
 *   APP_PUBLIC_URL       - Public HTTPS origin for redirect pages (e.g. "https://liqzar.app")
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const OZOW_API_URL_LIVE = "https://api.ozow.com/PostPaymentRequest";
const OZOW_API_URL_TEST = "https://stagingapi.ozow.com/PostPaymentRequest";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));

    const siteCode = Deno.env.get("OZOW_SITE_CODE");
    const apiKey = Deno.env.get("OZOW_API_KEY");
    const privateKey = Deno.env.get("OZOW_PRIVATE_KEY");
    const isTest = (Deno.env.get("OZOW_IS_TEST") ?? "true") === "true";
    // OZOW_USE_STAGING controls which API endpoint we hit — independent of the
    // IsTest body field. This decoupling lets us post IsTest=false (skips the
    // /response-test harness on staging that requires a feature flag we don't
    // have) while still targeting the sandbox endpoint.
    const useStaging =
      (Deno.env.get("OZOW_USE_STAGING") ?? (isTest ? "true" : "false")) ===
      "true";
    const appOrigin = Deno.env.get("APP_PUBLIC_URL") ?? "https://liqzar.app";

    if (!siteCode || !apiKey || !privateKey) {
      console.error("[initiate-payment] Ozow env vars missing");
      return json({
        success: false,
        error: "Payment gateway not configured on server",
      });
    }

    // ── Service-role client — bypasses RLS ────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let paymentId = "";
    let orderId = "";
    let orderNumber = "";
    let amount = 0;
    let resolvedPaymentMethod = "";

    // ══ MODE B: create everything server-side ═════════════════════
    if (body.orderData) {
      const od = body.orderData as Record<string, unknown>;

      if (!od.user_id || !od.total || !od.items || !od.payment_method) {
        return json({
          success: false,
          error:
            "orderData missing required fields (user_id, total, items, payment_method)",
        });
      }

      amount = Number(od.total);
      resolvedPaymentMethod = od.payment_method as string;

      // 1. Create order (service role bypasses RLS)
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: od.user_id,
          status: "pending",
          subtotal: od.subtotal ?? amount,
          vat_amount: od.vat_amount ?? 0,
          delivery_fee: od.delivery_fee ?? 0,
          discount_amount: od.discount_amount ?? 0,
          discount_code: od.discount_code ?? null,
          total: amount,
          delivery_method: od.delivery_method ?? "standard",
          delivery_zone: od.delivery_zone ?? null,
          scheduled_date: od.scheduled_date ?? null,
          scheduled_slot: od.scheduled_slot ?? null,
          delivery_address: od.delivery_address ?? {},
          payment_method: resolvedPaymentMethod,
          payment_status: "awaiting_payment",
          customer_notes: od.customer_notes ?? null,
          delivery_instructions: od.delivery_instructions ?? null,
        })
        .select()
        .single();

      if (orderErr || !order) {
        console.error("[initiate-payment] Order insert failed:", orderErr);
        return json({
          success: false,
          error: `Order creation failed: ${orderErr?.message ?? "unknown"}`,
        });
      }

      orderId = order.id;
      orderNumber = order.order_number ?? "";

      // 2. Insert order items
      const items = (od.items as any[]).map((item: any) => ({
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        product_image: item.product_image ?? null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
      }));

      const { error: itemsErr } = await supabase
        .from("order_items")
        .insert(items);
      if (itemsErr) {
        console.error("[initiate-payment] order_items insert failed:", itemsErr);
        await supabase.from("orders").delete().eq("id", orderId);
        return json({
          success: false,
          error: `Order items failed: ${itemsErr.message}`,
        });
      }

      // 3. Create payment record
      const { data: payment, error: payErr } = await supabase
        .from("payments")
        .insert({
          order_id: orderId,
          amount,
          currency: "ZAR",
          status: "pending",
          payment_method: resolvedPaymentMethod,
          gateway: "ozow",
          metadata: {},
        })
        .select("id")
        .single();

      if (payErr || !payment) {
        console.error("[initiate-payment] Payment insert failed:", payErr);
        await supabase.from("orders").delete().eq("id", orderId);
        return json({
          success: false,
          error: `Payment record failed: ${payErr?.message ?? "unknown"}`,
        });
      }

      paymentId = payment.id;

      // ══ MODE A: legacy — client pre-created order + payment ═══════
    } else {
      const pid = body.paymentId;
      const oid = body.orderId;
      const amt = body.amount;
      resolvedPaymentMethod = body.paymentMethod ?? "";

      if (!pid || !oid || !amt || !resolvedPaymentMethod) {
        return json({
          success: false,
          error:
            "paymentId, orderId, amount and paymentMethod are required",
        });
      }

      paymentId = pid;
      orderId = oid;
      amount = Number(amt);

      const { data: payment, error: fetchErr } = await supabase
        .from("payments")
        .select("id, status, order_id, amount")
        .eq("id", paymentId)
        .eq("order_id", orderId)
        .maybeSingle();

      if (fetchErr || !payment) {
        return json({ success: false, error: "Payment record not found" });
      }

      if (
        payment.status !== "pending" &&
        payment.status !== "awaiting_payment"
      ) {
        return json({
          success: false,
          error: `Payment already in status: ${payment.status}`,
        });
      }
    }

    // ══ BUILD OZOW REQUEST ════════════════════════════════════════
    const amountStr = amount.toFixed(2);
    // BankReference appears on the customer's bank statement — max 20 chars, alphanumeric.
    const bankReference = `LIQZAR-${(orderNumber || orderId).toString().replace(/[^A-Za-z0-9]/g, "").slice(0, 13)}`.slice(0, 20);
    const transactionReference = paymentId;

    const successUrl =
      body.returnUrl ??
      `${appOrigin}/payment/success?paymentId=${paymentId}&orderId=${orderId}`;
    const cancelUrlFinal =
      body.cancelUrl ??
      `${appOrigin}/payment/cancel?paymentId=${paymentId}&orderId=${orderId}`;
    const errorUrlFinal =
      body.errorUrl ??
      `${appOrigin}/payment/error?paymentId=${paymentId}&orderId=${orderId}`;
    const notifyUrl =
      body.notifyUrl ??
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/capture-payment`;

    // Ozow hash input: all fields concatenated + privateKey, then lowercased, SHA512.
    // Order: SiteCode + CountryCode + CurrencyCode + Amount + TransactionReference
    //        + BankReference + Cancel + Error + Success + Notify + IsTest + PrivateKey
    const hashInput =
      siteCode +
      "ZA" +
      "ZAR" +
      amountStr +
      transactionReference +
      bankReference +
      cancelUrlFinal +
      errorUrlFinal +
      successUrl +
      notifyUrl +
      (isTest ? "true" : "false") +
      privateKey;

    const hashCheck = await sha512Lower(hashInput);

    const ozowBody = {
      siteCode,
      countryCode: "ZA",
      currencyCode: "ZAR",
      amount: Number(amountStr),
      transactionReference,
      bankReference,
      cancelUrl: cancelUrlFinal,
      errorUrl: errorUrlFinal,
      successUrl,
      notifyUrl,
      isTest,
      hashCheck,
    };

    // ══ CALL OZOW ════════════════════════════════════════════════
    const ozowEndpoint = useStaging ? OZOW_API_URL_TEST : OZOW_API_URL_LIVE;
    let ozowData: Record<string, unknown> = {};
    try {
      const ozowRes = await fetch(ozowEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ApiKey: apiKey,
        },
        body: JSON.stringify(ozowBody),
      });

      ozowData = await ozowRes.json().catch(() => ({}));

      if (!ozowRes.ok || ozowData.errorMessage) {
        const errMsg =
          (ozowData?.errorMessage as string) ||
          `Ozow rejected request (HTTP ${ozowRes.status})`;
        console.error("[initiate-payment] Ozow error:", errMsg, ozowData);
        await supabase
          .from("payments")
          .update({
            status: "failed",
            failure_reason: errMsg,
            failed_at: new Date().toISOString(),
            gateway_response: ozowData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentId);
        await supabase
          .from("orders")
          .update({ payment_status: "failed" })
          .eq("id", orderId);
        return json({ success: false, error: errMsg });
      }
    } catch (fetchErr) {
      console.error("[initiate-payment] Ozow network error:", fetchErr);
      return json({
        success: false,
        error: "Could not reach payment gateway. Please try again.",
      });
    }

    // ══ UPDATE PAYMENT RECORD ═════════════════════════════════════
    const gatewayRef = (ozowData.paymentRequestId ?? "") as string;
    const redirectUrl = (ozowData.url ?? null) as string | null;

    await supabase
      .from("payments")
      .update({
        status: "awaiting_payment",
        gateway_reference: gatewayRef || null,
        gateway_response: ozowData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    return json({
      success: true,
      orderId,
      orderNumber: orderNumber || null,
      paymentId,
      gatewayReference: gatewayRef || null,
      redirectUrl,
      status: "awaiting_payment",
    });
  } catch (err) {
    console.error("[initiate-payment] Unhandled error:", err);
    return json({ success: false, error: "Internal server error" });
  }
});

async function sha512Lower(input: string): Promise<string> {
  const lower = input.toLowerCase();
  const bytes = new TextEncoder().encode(lower);
  const hash = await crypto.subtle.digest("SHA-512", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
