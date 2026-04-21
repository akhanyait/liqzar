import { supabase } from "@/integrations/supabase/client";

/**
 * White-glove (concierge) service utilities.
 *
 * Orders are auto-elevated by a DB trigger when any of:
 *   - total >= R5000
 *   - customer on Platinum loyalty tier
 *   - order contains a cellar_reserve product
 *
 * Admins/concierges can read the queue via v_white_glove_queue and update
 * white_glove_notes / concierge_id on the orders row.
 */

export type WhiteGloveQueueRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  total: number;
  status: string;
  scheduled_for_date: string | null;
  scheduled_window: string | null;
  delivery_address: Record<string, unknown> | null;
  white_glove_notes: string | null;
  concierge_id: string | null;
  concierge_contacted_at: string | null;
  created_at: string;
};

export async function fetchWhiteGloveQueue(): Promise<WhiteGloveQueueRow[]> {
  const { data, error } = await supabase
    .from("v_white_glove_queue" as any)
    .select("*");
  if (error) throw error;
  return ((data ?? []) as unknown) as WhiteGloveQueueRow[];
}

export async function claimWhiteGloveOrder(
  orderId: string,
  conciergeId: string,
  notes?: string,
) {
  const { error } = await supabase
    .from("orders")
    .update({
      concierge_id: conciergeId,
      concierge_contacted_at: new Date().toISOString(),
      ...(notes ? { white_glove_notes: notes } : {}),
    } as any)
    .eq("id", orderId);
  if (error) throw error;
}
