import { supabase } from "../lib/supabase";

export type GiftCardRedemption = {
  appliedCents: number;
  remainingBalanceCents: number;
  cardId: string;
};

export type GiftCardIssueInput = {
  amountCents: number;
  recipientEmail?: string;
  recipientName?: string;
  recipientPhone?: string;
  message?: string;
  orderId?: string;
};

export const GiftCardService = {
  async redeem(
    code: string,
    amountCents: number,
    orderId: string | null,
  ): Promise<{ success: true; data: GiftCardRedemption } | { success: false; error: string }> {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return { success: false, error: "Enter a gift card code" };

    const { data, error } = await supabase.rpc("redeem_gift_card", {
      p_code: cleaned,
      p_amount_cents: amountCents,
      p_order_id: orderId,
    });
    if (error) return { success: false, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { success: false, error: "Could not apply gift card" };
    return {
      success: true,
      data: {
        appliedCents: row.applied_cents,
        remainingBalanceCents: row.remaining_balance_cents,
        cardId: row.card_id,
      },
    };
  },

  async checkBalance(code: string): Promise<
    | { success: true; balanceCents: number; status: string; expiresAt: string | null }
    | { success: false; error: string }
  > {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return { success: false, error: "Enter a gift card code" };
    const { data, error } = await supabase.rpc("check_gift_card_balance", {
      p_code: cleaned,
    });
    if (error) return { success: false, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { success: false, error: "Gift card not found" };
    return {
      success: true,
      balanceCents: row.balance_cents,
      status: row.status,
      expiresAt: row.expires_at,
    };
  },

  async issue(
    input: GiftCardIssueInput,
    purchaserId: string,
  ): Promise<{ success: true; code: string } | { success: false; error: string }> {
    const { data, error } = await supabase.rpc("issue_gift_card", {
      p_amount_cents: input.amountCents,
      p_purchaser_id: purchaserId,
      p_recipient_email: input.recipientEmail ?? null,
      p_recipient_name: input.recipientName ?? null,
      p_recipient_phone: input.recipientPhone ?? null,
      p_message: input.message ?? null,
      p_order_id: input.orderId ?? null,
    });
    if (error) return { success: false, error: error.message };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.code) return { success: false, error: "Could not issue gift card" };
    return { success: true, code: row.code };
  },
};
