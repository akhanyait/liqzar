/**
 * PaymentService - Handles payment processing via Ozow Pay-by-Bank.
 *
 * Payment lifecycle: pending -> awaiting_payment -> authorized -> captured -> completed
 * Failure path: awaiting_payment -> failed -> retry or cancel
 * Refund path: captured -> refunded | partially_refunded (Ozow refunds are portal-only today)
 */
import { supabase } from "../lib/supabase";

export type PaymentMethod = "instant_eft" | "cash_on_delivery";

export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency?: string;
  paymentMethod: PaymentMethod;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  gatewayReference?: string;
  status: string;
  error?: string;
  redirectUrl?: string;
}

class PaymentServiceClass {
  private static instance: PaymentServiceClass;

  // Ozow configuration - loaded server-side via the initiate-payment Edge Function.
  // API/site/private keys live only in Supabase secrets; the client never sees them.
  private gatewayConfig = {
    gateway: "ozow" as const,
  };

  static getInstance(): PaymentServiceClass {
    if (!PaymentServiceClass.instance) {
      PaymentServiceClass.instance = new PaymentServiceClass();
    }
    return PaymentServiceClass.instance;
  }

  /**
   * Initiate a payment for an order
   * This creates a payment record and calls the Supabase Edge Function
   * which handles the actual gateway communication server-side
   */
  async initiatePayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      // 0. Idempotency guard — only block on genuinely completed payments
      //    Stuck "pending" or "awaiting_payment" payments (from prior failed attempts)
      //    are reset to "failed" so a fresh attempt can proceed.
      const { data: existingPayments } = await supabase
        .from("payments")
        .select("id, status, gateway_reference")
        .eq("order_id", request.orderId)
        .not("status", "in", '("failed","refunded","cancelled")')
        .order("created_at", { ascending: false });

      if (existingPayments && existingPayments.length > 0) {
        const confirmed = existingPayments.find(
          (p: any) => p.status === "authorized" || p.status === "captured" || p.status === "completed",
        );
        if (confirmed) {
          // Already paid — return the confirmed payment
          console.log(`[PaymentService] Order ${request.orderId} already has confirmed payment ${confirmed.id}`);
          return {
            success: true,
            paymentId: confirmed.id,
            status: confirmed.status,
            gatewayReference: confirmed.gateway_reference,
          };
        }
        // Stuck pending/awaiting_payment — mark all as failed so we can create fresh
        const stuckIds = existingPayments.map((p: any) => p.id);
        await supabase
          .from("payments")
          .update({ status: "failed", failure_reason: "Superseded by new payment attempt", failed_at: new Date().toISOString() })
          .in("id", stuckIds);
        console.log(`[PaymentService] Reset ${stuckIds.length} stuck payment(s) for order ${request.orderId}`);
      }

      // 1. Create payment record in pending state
      const { data: payment, error: insertError } = await supabase
        .from("payments")
        .insert({
          order_id: request.orderId,
          amount: request.amount,
          currency: request.currency || "ZAR",
          status: "pending",
          payment_method: request.paymentMethod,
          gateway: this.gatewayConfig.gateway,
          metadata: request.metadata || {},
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 2. Update order payment status
      await supabase
        .from("orders")
        .update({ payment_status: "awaiting_payment" })
        .eq("id", request.orderId);

      // 3. Handle cash on delivery differently
      if (request.paymentMethod === "cash_on_delivery") {
        await supabase
          .from("payments")
          .update({ status: "authorized" })
          .eq("id", payment.id);

        await supabase
          .from("orders")
          .update({ payment_status: "cash_on_delivery" })
          .eq("id", request.orderId);

        return {
          success: true,
          paymentId: payment.id,
          status: "cash_on_delivery",
        };
      }

      // 4. Call server-side payment initiation via Supabase SDK (handles auth automatically)
      // NOTE: The Edge Function always returns HTTP 200, so fnError is only set on true
      // network failures. Business-level success/failure is in gatewayResult.success.
      let gatewayResult: Record<string, any> | null = null;
      try {
        // Refresh the user session to ensure a valid JWT before invoking
        await supabase.auth.getUser();

        const { data, error: fnError } = await supabase.functions.invoke(
          "initiate-payment",
          {
            body: {
              paymentId: payment.id,
              orderId: request.orderId,
              amount: request.amount,
              currency: request.currency || "ZAR",
              paymentMethod: request.paymentMethod,
              customerEmail: request.customerEmail,
              customerPhone: request.customerPhone,
            },
          },
        );

        if (fnError) {
          console.warn("[PaymentService] functions.invoke error:", fnError);
          await this.handlePaymentFailure(payment.id, request.orderId, fnError.message || "Gateway unreachable");
          return { success: false, paymentId: payment.id, status: "failed", error: "Could not reach payment gateway. Please retry." };
        }

        gatewayResult = data;
      } catch (invokeErr: any) {
        console.warn("[PaymentService] Network error invoking Edge Function:", invokeErr?.message);
        await this.handlePaymentFailure(payment.id, request.orderId, "Network error");
        return { success: false, paymentId: payment.id, status: "failed", error: "Network error. Please check your connection and retry." };
      }

      // Check business-level success flag
      console.log("[PaymentService] Gateway result:", JSON.stringify(gatewayResult));
      if (!gatewayResult?.success) {
        const reason = gatewayResult?.error || "Payment gateway rejected the request";
        await this.handlePaymentFailure(payment.id, request.orderId, reason);
        return { success: false, paymentId: payment.id, status: "failed", error: reason };
      }

      // 5. Store the Ozow payment request reference. We do NOT mark the payment
      // authorized here — with Ozow, funds aren't authorized until the shopper
      // completes bank auth. The capture-payment webhook is the source of truth.
      if (gatewayResult?.gatewayReference) {
        await supabase
          .from("payments")
          .update({
            gateway_reference: gatewayResult.gatewayReference,
            status: "awaiting_payment",
          })
          .eq("id", payment.id);
      }

      // 6. Ozow always redirects the shopper to its hosted bank-auth page.
      if (gatewayResult?.redirectUrl) {
        return {
          success: true,
          paymentId: payment.id,
          status: "awaiting_payment",
          redirectUrl: gatewayResult.redirectUrl,
          gatewayReference: gatewayResult.gatewayReference,
        };
      }

      return {
        success: true,
        paymentId: payment.id,
        status: gatewayResult?.status || "awaiting_payment",
        gatewayReference: gatewayResult?.gatewayReference,
      };
    } catch (error: any) {
      console.warn("[PaymentService] initiatePayment error:", error);
      return {
        success: false,
        status: "failed",
        error: error.message || "Payment initiation failed",
      };
    }
  }

  /**
   * Verify payment status (polling for redirect-based flows)
   */
  async verifyPaymentStatus(paymentId: string): Promise<PaymentResult> {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (error) {
      console.error(`[PaymentService] verifyPaymentStatus error for payment ${paymentId}:`, error);
      return { success: false, status: "unknown", error: error.message };
    }

    return {
      success: data.status === "captured" || data.status === "authorized",
      paymentId: data.id,
      status: data.status,
      gatewayReference: data.gateway_reference,
      error: data.failure_reason,
    };
  }

  /**
   * Request a refund for a refused/failed delivery.
   * Called by the driver handoff screen when ComplianceService returns
   * paymentAction === "refund_required".
   */
  async requestRefund(orderId: string, reason: string): Promise<boolean> {
    try {
      // Fetch the active payment for this order
      const { data: payment, error: fetchError } = await supabase
        .from("payments")
        .select("id, status")
        .eq("order_id", orderId)
        .in("status", ["authorized", "captured"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !payment) {
        console.error(
          `[PaymentService] requestRefund: no active payment found for order ${orderId}`,
          fetchError,
        );
        return false;
      }

      const { error: fnError } = await supabase.functions.invoke(
        "refund-payment",
        { body: { paymentId: payment.id, orderId, reason } },
      );

      if (fnError) {
        console.error(
          `[PaymentService] requestRefund: edge function error for order ${orderId}:`,
          fnError,
        );
        return false;
      }

      // Optimistic local state update — webhook will confirm final status
      await supabase
        .from("payments")
        .update({ status: "refund_pending", failure_reason: reason })
        .eq("id", payment.id);

      return true;
    } catch (error) {
      console.error("[PaymentService] requestRefund error:", error);
      return false;
    }
  }

  /**
   */
  async capturePayment(paymentId: string, orderId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke("capture-payment", {
        body: { paymentId, orderId },
      });

      if (error) {
        console.error("[PaymentService] capturePayment error:", error);
        return false;
      }

      await supabase
        .from("payments")
        .update({
          status: "captured",
          captured_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      await supabase
        .from("orders")
        .update({ payment_status: "captured" })
        .eq("id", orderId);

      return true;
    } catch (error) {
      console.error("[PaymentService] capturePayment error:", error);
      return false;
    }
  }

  private async handlePaymentFailure(
    paymentId: string,
    orderId: string,
    reason: string,
  ) {
    console.warn(
      `[PaymentService] handlePaymentFailure: order=${orderId}, payment=${paymentId}, reason=${reason}`,
    );

    const { error: paymentError } = await supabase
      .from("payments")
      .update({
        status: "failed",
        failure_reason: reason,
        failed_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (paymentError) {
      console.warn(
        `[PaymentService] Failed to update payment ${paymentId} to failed:`,
        paymentError,
      );
    }

    const { error: orderError } = await supabase
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", orderId);

    if (orderError) {
      console.warn(
        `[PaymentService] Failed to update order ${orderId} payment_status to failed:`,
        orderError,
      );
    }
  }

  /**
   * Get available payment methods.
   * Ozow handles Pay-by-Bank (instant EFT across all SA banks).
   */
  getAvailablePaymentMethods(): {
    id: PaymentMethod;
    label: string;
    icon: string;
    enabled: boolean;
  }[] {
    return [
      {
        id: "instant_eft",
        label: "Pay by Bank (Ozow)",
        icon: "swap-horizontal-outline",
        enabled: true,
      },
      {
        id: "cash_on_delivery",
        label: "Cash on Delivery",
        icon: "cash-outline",
        enabled: true,
      },
    ];
  }
}

export const PaymentService = PaymentServiceClass.getInstance();
