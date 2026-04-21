/**
 * RefundService - Handles refund processing
 */
import { supabase } from "../lib/supabase";

export interface RefundRequest {
  orderId: string;
  paymentId?: string;
  amount: number;
  reason: string;
  isPartial?: boolean;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  status: string;
  error?: string;
}

class RefundServiceClass {
  private static instance: RefundServiceClass;

  static getInstance(): RefundServiceClass {
    if (!RefundServiceClass.instance) {
      RefundServiceClass.instance = new RefundServiceClass();
    }
    return RefundServiceClass.instance;
  }

  /**
   * Request a refund (creates pending refund, requires admin approval)
   */
  async requestRefund(request: RefundRequest): Promise<RefundResult> {
    try {
      // Find the payment if not provided
      let paymentId = request.paymentId;
      if (!paymentId) {
        const { data: payment } = await supabase
          .from("payments")
          .select("id")
          .eq("order_id", request.orderId)
          .eq("status", "captured")
          .single();
        paymentId = payment?.id;
      }

      const { data: refund, error } = await supabase
        .from("refunds")
        .insert({
          order_id: request.orderId,
          payment_id: paymentId,
          amount: request.amount,
          reason: request.reason,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Log audit event
      await supabase.from("admin_audit_log").insert({
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        action: "refund_requested",
        target_type: "order",
        target_id: request.orderId,
        metadata: {
          refund_id: refund.id,
          amount: request.amount,
          reason: request.reason,
        },
      });

      return { success: true, refundId: refund.id, status: "pending" };
    } catch (error: any) {
      return { success: false, status: "failed", error: error.message };
    }
  }

  /**
   * Approve a refund (admin only)
   */
  async approveRefund(refundId: string): Promise<RefundResult> {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;

      const { error: updateError } = await supabase
        .from("refunds")
        .update({
          status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", refundId)
        .eq("status", "pending");

      if (updateError) throw updateError;

      // Process the refund via Edge Function
      const { data: refund } = await supabase
        .from("refunds")
        .select("*, payments(*)")
        .eq("id", refundId)
        .single();

      if (refund) {
        const { error: processError } = await supabase.functions.invoke(
          "process-refund",
          {
            body: {
              refundId,
              paymentId: refund.payment_id,
              amount: refund.amount,
            },
          },
        );

        if (processError) {
          console.error("[RefundService] Process error:", processError);
          return {
            success: false,
            refundId,
            status: "approved",
            error: "Processing failed",
          };
        }

        await supabase
          .from("refunds")
          .update({
            status: "completed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", refundId);

        // Update order payment status
        await supabase
          .from("orders")
          .update({ payment_status: "refunded" })
          .eq("id", refund.order_id);
      }

      return { success: true, refundId, status: "completed" };
    } catch (error: any) {
      return {
        success: false,
        refundId,
        status: "failed",
        error: error.message,
      };
    }
  }

  /**
   * Reject a refund (admin only)
   */
  async rejectRefund(refundId: string, reason: string): Promise<RefundResult> {
    try {
      const { error } = await supabase
        .from("refunds")
        .update({ status: "rejected", notes: reason })
        .eq("id", refundId)
        .eq("status", "pending");

      if (error) throw error;
      return { success: true, refundId, status: "rejected" };
    } catch (error: any) {
      return {
        success: false,
        refundId,
        status: "failed",
        error: error.message,
      };
    }
  }

  /**
   * Get refunds for an order
   */
  async getOrderRefunds(orderId: string) {
    const { data, error } = await supabase
      .from("refunds")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    return { data, error };
  }
}

export const RefundService = RefundServiceClass.getInstance();
