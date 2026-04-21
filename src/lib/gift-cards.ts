import { supabase } from "@/integrations/supabase/client";

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

export async function redeemGiftCard(
  code: string,
  amountCents: number,
  orderId: string | null,
): Promise<
  | { success: true; data: GiftCardRedemption }
  | { success: false; error: string }
> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return { success: false as const, error: "Enter a gift card code" };

  const { data, error } = await (supabase.rpc as any)("redeem_gift_card", {
    p_code: cleaned,
    p_amount_cents: amountCents,
    p_order_id: orderId,
  });
  if (error) return { success: false as const, error: error.message };
  const row: any = Array.isArray(data) ? data[0] : data;
  if (!row) return { success: false as const, error: "Could not apply gift card" };
  return {
    success: true as const,
    data: {
      appliedCents: row.applied_cents as number,
      remainingBalanceCents: row.remaining_balance_cents as number,
      cardId: row.card_id as string,
    },
  };
}

export async function checkGiftCardBalance(code: string): Promise<
  | { success: true; balanceCents: number; status: string; expiresAt: string | null }
  | { success: false; error: string }
> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return { success: false as const, error: "Enter a gift card code" };
  const { data, error } = await (supabase.rpc as any)("check_gift_card_balance", {
    p_code: cleaned,
  });
  if (error) return { success: false as const, error: error.message };
  const row: any = Array.isArray(data) ? data[0] : data;
  if (!row) return { success: false as const, error: "Gift card not found" };
  return {
    success: true as const,
    balanceCents: row.balance_cents as number,
    status: row.status as string,
    expiresAt: row.expires_at as string | null,
  };
}

export async function issueGiftCard(
  input: GiftCardIssueInput,
  purchaserId: string,
): Promise<{ success: true; code: string } | { success: false; error: string }> {
  const { data, error } = await (supabase.rpc as any)("issue_gift_card", {
    p_amount_cents: input.amountCents,
    p_purchaser_id: purchaserId,
    p_recipient_email: input.recipientEmail ?? null,
    p_recipient_name: input.recipientName ?? null,
    p_recipient_phone: input.recipientPhone ?? null,
    p_message: input.message ?? null,
    p_order_id: input.orderId ?? null,
  });
  if (error) return { success: false as const, error: error.message };
  const row: any = Array.isArray(data) ? data[0] : data;
  if (!row?.code) return { success: false as const, error: "Could not issue gift card" };
  return { success: true as const, code: row.code as string };
}
