// @ts-nocheck
/**
 * capture-payment — Supabase Edge Function (Ozow webhook + status probe)
 *
 * Invocation modes:
 *
 *   1. Ozow webhook (POST from Ozow platform to notifyUrl):
 *      application/x-www-form-urlencoded body with these fields:
 *         SiteCode, TransactionId, TransactionReference, Amount,
 *         Status, Optional, StatusMessage, CurrencyCode, IsTest, Hash
 *
 *      Hash is SHA512 of:
 *        SiteCode + TransactionId + TransactionReference + Amount + Status
 *        + Optional + StatusMessage + IsTest + PrivateKey   (all lower-cased)
 *
 *      We verify the hash, map Status → payment/order status, and ack with 200.
 *      MUST return 200 even on warnings, otherwise Ozow will retry.
 *
 *   2. Client status probe (PaymentService.verifyPaymentStatus fallback):
 *      JSON body { paymentId, orderId } with no Hash.
 *      Returns current payment/order status from DB.
 *
 * ── Required Supabase secrets ───────────────────────────────────────────────
 *   OZOW_PRIVATE_KEY - For webhook hash verification
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const contentType = req.headers.get("content-type") ?? "";
    const rawBody = await req.text();

    // Ozow posts application/x-www-form-urlencoded. Treat anything with the
    // Ozow fields as a webhook regardless of the declared content-type.
    const isFormWebhook = contentType.includes(
      "application/x-www-form-urlencoded",
    );

    if (isFormWebhook) {
      const params = new URLSearchParams(rawBody);
      // Ozow field names are PascalCase; normalise by grabbing both cases.
      const fields = extractOzowFields(params);
      if (fields.SiteCode && fields.TransactionReference && fields.Status) {
        return await handleOzowWebhook(fields, rawBody, supabase);
      }
    }

    // Fall-through: JSON body (client status probe)
    const body = JSON.parse(rawBody || "{}");
    return await handleStatusProbe(body, supabase);
  } catch (err) {
    console.error("[capture-payment] Unhandled error:", err);
    // Always 200 so Ozow doesn't retry on parse failure
    return json({ success: false, error: "Internal server error" });
  }
});

interface OzowWebhookFields {
  SiteCode: string;
  TransactionId: string;
  TransactionReference: string;
  Amount: string;
  Status: string;
  Optional: string;
  StatusMessage: string;
  CurrencyCode: string;
  IsTest: string;
  Hash: string;
  BankName?: string;
}

function extractOzowFields(params: URLSearchParams): OzowWebhookFields {
  const read = (keys: string[]): string => {
    for (const k of keys) {
      const v = params.get(k);
      if (v !== null) return v;
    }
    return "";
  };

  return {
    SiteCode: read(["SiteCode", "siteCode"]),
    TransactionId: read(["TransactionId", "transactionId"]),
    TransactionReference: read(["TransactionReference", "transactionReference"]),
    Amount: read(["Amount", "amount"]),
    Status: read(["Status", "status"]),
    Optional: read(["Optional", "optional"]),
    StatusMessage: read(["StatusMessage", "statusMessage"]),
    CurrencyCode: read(["CurrencyCode", "currencyCode"]),
    IsTest: read(["IsTest", "isTest"]),
    Hash: read(["Hash", "hash", "HashCheck", "hashCheck"]),
    BankName: read(["BankName", "bankName"]),
  };
}

async function handleOzowWebhook(
  fields: OzowWebhookFields,
  rawBody: string,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const privateKey = Deno.env.get("OZOW_PRIVATE_KEY");
  if (!privateKey) {
    console.error("[capture-payment] OZOW_PRIVATE_KEY not set — cannot verify webhook");
    return json({ received: true, warning: "not_configured" });
  }

  // Verify hash
  const hashInput =
    fields.SiteCode +
    fields.TransactionId +
    fields.TransactionReference +
    fields.Amount +
    fields.Status +
    fields.Optional +
    fields.StatusMessage +
    fields.IsTest +
    privateKey;

  const expected = await sha512Lower(hashInput);
  if (!fields.Hash || fields.Hash.toLowerCase() !== expected) {
    console.warn(
      "[capture-payment] Ozow hash mismatch — ignoring",
      { expected, received: fields.Hash },
    );
    return json({ received: true, warning: "hash_mismatch" });
  }

  // Log the webhook. Supabase resolves with { error } on failure rather than
  // rejecting — surface the error to logs so silent drops are impossible.
  const { data: eventRow, error: eventInsertError } = await supabase
    .from("webhook_events")
    .insert({
      source: "ozow",
      event_type: fields.Status,
      payload: { raw: rawBody, fields },
      status: "pending",
    })
    .select("id")
    .single();

  if (eventInsertError) {
    console.error(
      "[capture-payment] webhook_events insert failed:",
      eventInsertError,
    );
  }
  const eventId: string | undefined = eventRow?.id;

  // Resolve payment — transactionReference is our paymentId
  const paymentId = fields.TransactionReference;
  const { data: payment } = await supabase
    .from("payments")
    .select("id, order_id, status")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) {
    console.warn(
      "[capture-payment] Ozow webhook for unknown paymentId:",
      paymentId,
    );
    if (eventId) {
      const { error: ignoreErr } = await supabase
        .from("webhook_events")
        .update({
          status: "ignored",
          processed_at: new Date().toISOString(),
          error: `Unknown paymentId: ${paymentId}`,
        })
        .eq("id", eventId);
      if (ignoreErr) {
        console.error(
          "[capture-payment] webhook_events ignore-update failed:",
          ignoreErr,
        );
      }
    }
    return json({ received: true });
  }

  const orderId = payment.order_id;
  const nowIso = new Date().toISOString();

  switch (fields.Status) {
    case "Complete": {
      await Promise.all([
        supabase
          .from("payments")
          .update({
            status: "captured",
            captured_at: nowIso,
            gateway_reference: fields.TransactionId || null,
            ozow_transaction_id: fields.TransactionId || null,
            gateway_response: fields,
            updated_at: nowIso,
          })
          .eq("id", payment.id),
        supabase
          .from("orders")
          .update({ payment_status: "captured", status: "confirmed" })
          .eq("id", orderId),
      ]);
      console.log(
        `[capture-payment] Payment ${payment.id} captured via Ozow webhook`,
      );
      break;
    }
    case "Cancelled": {
      await Promise.all([
        supabase
          .from("payments")
          .update({
            status: "cancelled",
            failure_reason: fields.StatusMessage || "Cancelled by customer",
            failed_at: nowIso,
            gateway_response: fields,
            updated_at: nowIso,
          })
          .eq("id", payment.id),
        supabase
          .from("orders")
          .update({ payment_status: "cancelled" })
          .eq("id", orderId),
      ]);
      break;
    }
    case "Error":
    case "Abandoned": {
      await Promise.all([
        supabase
          .from("payments")
          .update({
            status: "failed",
            failure_reason:
              fields.StatusMessage || `Ozow status: ${fields.Status}`,
            failed_at: nowIso,
            gateway_response: fields,
            updated_at: nowIso,
          })
          .eq("id", payment.id),
        supabase
          .from("orders")
          .update({ payment_status: "failed" })
          .eq("id", orderId),
      ]);
      break;
    }
    case "PendingInvestigation": {
      await supabase
        .from("payments")
        .update({
          status: "awaiting_payment",
          failure_reason: fields.StatusMessage || "Under investigation",
          gateway_response: fields,
          updated_at: nowIso,
        })
        .eq("id", payment.id);
      break;
    }
    default:
      console.log(
        `[capture-payment] Ozow unhandled status: ${fields.Status}`,
      );
  }

  if (eventId) {
    const { error: doneErr } = await supabase
      .from("webhook_events")
      .update({ status: "processed", processed_at: nowIso })
      .eq("id", eventId);
    if (doneErr) {
      console.error(
        "[capture-payment] webhook_events finalise-update failed:",
        doneErr,
      );
    }
  }

  return json({ received: true });
}

// Client status probe — no gateway side-effect, just reads DB.
async function handleStatusProbe(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  const paymentId = body.paymentId as string | undefined;
  const orderId = body.orderId as string | undefined;

  if (!paymentId && !orderId) {
    return json({ success: false, error: "paymentId or orderId required" });
  }

  const q = supabase
    .from("payments")
    .select("id, order_id, status, gateway_reference, amount")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: payment } = paymentId
    ? await q.eq("id", paymentId).maybeSingle()
    : await q.eq("order_id", orderId!).maybeSingle();

  if (!payment) {
    return json({ success: false, error: "Payment not found" });
  }

  return json({
    success:
      payment.status === "captured" ||
      payment.status === "authorized" ||
      payment.status === "completed",
    paymentId: payment.id,
    orderId: payment.order_id,
    status: payment.status,
    gatewayReference: payment.gateway_reference,
  });
}

async function sha512Lower(input: string): Promise<string> {
  const lower = input.toLowerCase();
  const bytes = new TextEncoder().encode(lower);
  const hash = await crypto.subtle.digest("SHA-512", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
