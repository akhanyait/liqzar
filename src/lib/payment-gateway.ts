/**
 * payment-gateway.ts
 * Ozow Pay-by-Bank integration for LIQZAR web.
 *
 * Flow:
 *   1. Call `initiate-payment` Edge Function with full orderData
 *   2. Edge Function creates order + items + payment server-side (service role → bypasses RLS)
 *   3. Edge Function calls Ozow PostPaymentRequest → returns redirectUrl
 *   4. Browser redirects to Ozow hosted bank-picker
 *   5. Ozow webhook (capture-payment) confirms payment and updates order
 */

export type PaymentMethod = "instant_eft" | "cash_on_delivery";

export interface PaymentRequest {
  orderId: string;
  /** ZAR amount — server re-verifies from DB */
  displayAmount: number;
  method: PaymentMethod;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface PaymentResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  paymentReference?: string;
  redirectUrl?: string;
  error?: string;
}

/** Order data passed to the Edge Function so it can create everything server-side */
export interface OrderDataForPayment {
  user_id: string;
  items: Array<{
    product_id: string;
    product_name: string;
    product_image?: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  subtotal: number;
  vat_amount: number;
  delivery_fee: number;
  discount_amount: number;
  discount_code?: string;
  total: number;
  delivery_method: string;
  delivery_zone?: string;
  scheduled_date?: string;
  scheduled_slot?: string;
  delivery_address: Record<string, unknown>;
  payment_method: string;
  customer_notes?: string;
  delivery_instructions?: string;
}

/**
 * Initiate an online payment by passing full order data to the Edge Function.
 * The EF creates the order + items + payment record server-side (service role,
 * bypasses RLS) then triggers Ozow. Works regardless of client auth state.
 */
export async function initiatePaymentWithOrder(
  orderData: OrderDataForPayment,
  opts: {
    returnUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    customerPhone?: string;
  },
): Promise<PaymentResult> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");

    const { data, error } = await supabase.functions.invoke("initiate-payment", {
      body: {
        orderData,
        returnUrl: opts.returnUrl,
        cancelUrl: opts.cancelUrl,
        customerEmail: opts.customerEmail,
        customerPhone: opts.customerPhone,
      },
    });

    if (error) {
      console.error("[PaymentGateway] Edge function error:", error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || "Payment gateway rejected the request." };
    }

    return {
      success: true,
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      paymentReference: data.gatewayReference,
      redirectUrl: data.redirectUrl,
    };
  } catch (err) {
    console.error("[PaymentGateway] Unexpected error:", err);
    return { success: false, error: "Payment initiation failed. Please try again." };
  }
}

/**
 * Initiate a payment for a web checkout.
 * Creates a payment record then delegates to the initiate-payment Edge Function.
 */
export async function initiatePayment(
  request: PaymentRequest,
): Promise<PaymentResult> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");

    // 1. Handle COD — no gateway call needed
    if (request.method === "cash_on_delivery") {
      await supabase
        .from("payments")
        .insert({
          order_id: request.orderId,
          amount: request.displayAmount,
          currency: "ZAR",
          status: "authorized",
          payment_method: "cash_on_delivery",
          gateway: "ozow",
          metadata: {},
        });

      await supabase
        .from("orders")
        .update({ payment_status: "cash_on_delivery" })
        .eq("id", request.orderId);

      return { success: true };
    }

    // 2. Create payment record in pending state
    const { data: payment, error: insertError } = await supabase
      .from("payments")
      .insert({
        order_id: request.orderId,
        amount: request.displayAmount,
        currency: "ZAR",
        status: "pending",
        payment_method: request.method,
        gateway: "ozow",
        metadata: {},
      })
      .select()
      .single();

    if (insertError || !payment) {
      console.error("[Payment] Failed to create payment record:", insertError);
      return { success: false, error: "Could not initiate payment. Please try again." };
    }

    // 3. Update order payment status
    await supabase
      .from("orders")
      .update({ payment_status: "awaiting_payment" })
      .eq("id", request.orderId);

    // 4. Call initiate-payment Edge Function
    const { data, error } = await supabase.functions.invoke("initiate-payment", {
      body: {
        paymentId: payment.id,
        orderId: request.orderId,
        amount: request.displayAmount,
        currency: "ZAR",
        paymentMethod: request.method,
        customerEmail: request.customerEmail,
        customerPhone: request.customerPhone,
        returnUrl: request.returnUrl,
        cancelUrl: request.cancelUrl,
      },
    });

    if (error) {
      console.error("[Payment] Edge function error:", error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || "Payment gateway rejected the request." };
    }

    return {
      success: true,
      paymentReference: data?.gatewayReference,
      redirectUrl: data?.redirectUrl,
    };
  } catch (err) {
    console.error("[Payment] Unexpected error:", err);
    return {
      success: false,
      error: "Payment initiation failed. Please try again.",
    };
  }
}

/**
 * Resume payment for an order stuck in awaiting_payment.
 * Mirrors mobile's idempotency guard:
 *   - If a confirmed payment already exists → return success (already paid).
 *   - Any stuck pending/awaiting_payment payments are marked `failed` so Ozow's
 *     TransactionReference (the paymentId) is always unique and generates
 *     a new payment-request URL instead of reusing an expired one.
 */
export async function resumePayment(orderId: string): Promise<PaymentResult> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");

    // 0. Sanity: confirm we have an auth session. Test-mode loginLocal does not
    //    create a real Supabase session → RLS blocks all reads and the flow
    //    silently fails with "Order not found". Surface that clearly.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      console.error("[resumePayment] No Supabase session — user must sign in with real credentials to pay.");
      return {
        success: false,
        error: "Please sign out and sign in again to start payment. (Test-mode session is not enough for Supabase access.)",
      };
    }

    // 1. Load the order (total + payment_method + contact for gateway prefill)
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, total, payment_method, payment_status, status, user_id")
      .eq("id", orderId)
      .maybeSingle();

    console.log("[resumePayment] order fetch:", { order, orderErr });

    if (orderErr || !order) {
      return {
        success: false,
        error: orderErr?.message ?? "Order not found (it may belong to a different account).",
      };
    }

    if (order.payment_status === "captured" || order.payment_status === "paid") {
      return { success: true, orderId: order.id };
    }

    const paymentMethod = (order.payment_method as PaymentMethod) ?? "instant_eft";
    if (paymentMethod === "cash_on_delivery") {
      return { success: false, error: "COD orders do not require online payment." };
    }

    // 2. Idempotency guard — same logic as mobile PaymentService
    const { data: existingPayments } = await supabase
      .from("payments")
      .select("id, status, gateway_reference")
      .eq("order_id", orderId)
      .not("status", "in", '("failed","refunded","cancelled")')
      .order("created_at", { ascending: false });

    if (existingPayments && existingPayments.length > 0) {
      const confirmed = existingPayments.find(
        (p) =>
          p.status === "authorized" ||
          p.status === "captured" ||
          p.status === "completed",
      );
      if (confirmed) {
        return {
          success: true,
          orderId,
          paymentReference: confirmed.gateway_reference ?? undefined,
        };
      }
      const stuckIds = existingPayments.map((p) => p.id);
      await supabase
        .from("payments")
        .update({
          status: "failed",
          failure_reason: "Superseded by new payment attempt",
          failed_at: new Date().toISOString(),
        })
        .in("id", stuckIds);
    }

    // 3. Fetch customer contact for gateway prefill
    let customerEmail: string | undefined;
    let customerPhone: string | undefined;
    if (order.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, phone")
        .eq("id", order.user_id)
        .maybeSingle();
      customerEmail = profile?.email ?? undefined;
      customerPhone = profile?.phone ?? undefined;
    }

    // 4. Create a fresh pending payment record + flip order back to awaiting_payment
    const { data: payment, error: insertErr } = await supabase
      .from("payments")
      .insert({
        order_id: orderId,
        amount: order.total,
        currency: "ZAR",
        status: "pending",
        payment_method: paymentMethod,
        gateway: "ozow",
        metadata: { resumed: true },
      })
      .select()
      .single();

    if (insertErr || !payment) {
      console.error("[Payment] resume — payment insert failed:", insertErr);
      return { success: false, error: "Could not create payment record. Please try again." };
    }

    await supabase
      .from("orders")
      .update({ payment_status: "awaiting_payment" })
      .eq("id", orderId);

    // 5. Invoke initiate-payment EF (MODE A)
    const baseUrl = window.location.origin;
    const { data, error } = await supabase.functions.invoke("initiate-payment", {
      body: {
        paymentId: payment.id,
        orderId,
        amount: order.total,
        currency: "ZAR",
        paymentMethod,
        customerEmail,
        customerPhone,
        returnUrl: `${baseUrl}/payment/success?paymentId=${payment.id}&orderId=${orderId}`,
        cancelUrl: `${baseUrl}/payment/cancel?paymentId=${payment.id}&orderId=${orderId}`,
      },
    });

    if (error) {
      console.error("[Payment] resume — EF error:", error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || "Payment gateway rejected the request." };
    }

    return {
      success: true,
      orderId,
      paymentReference: data.gatewayReference,
      redirectUrl: data.redirectUrl,
    };
  } catch (err) {
    console.error("[Payment] resume — unexpected error:", err);
    return { success: false, error: "Payment resume failed. Please try again." };
  }
}

/**
 * Verify a payment outcome after the gateway redirects back.
 * Reads the order's current payment_status from Supabase (server-authoritative).
 */
export async function verifyPaymentStatus(
  orderId: string,
): Promise<{ paid: boolean; status: string }> {
  const { supabase } = await import("@/integrations/supabase/client");

  const { data, error } = await supabase
    .from("orders")
    .select("payment_status, payment_reference")
    .eq("id", orderId)
    .single();

  if (error || !data) {
    return { paid: false, status: "unknown" };
  }

  return {
    paid: data.payment_status === "paid" || data.payment_status === "captured",
    status: data.payment_status,
  };
}

/** Human-readable payment method labels */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  instant_eft: "Pay by Bank (Ozow)",
  cash_on_delivery: "Cash on Delivery",
};

/** Payment methods available at checkout */
export const AVAILABLE_PAYMENT_METHODS: PaymentMethod[] = [
  "instant_eft",
  "cash_on_delivery",
];
