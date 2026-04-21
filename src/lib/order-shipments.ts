import { supabase } from "@/integrations/supabase/client";

export type ShipmentInput = {
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  deliveryAddress: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    country?: string;
  };
  giftNote?: string;
  scheduledForDate?: string | null;
  scheduledWindow?: string | null;
  deliveryFee?: number;
  orderItemIds: string[];
};

export async function createShipmentsForOrder(
  orderId: string,
  shipments: ShipmentInput[],
): Promise<{ success: true; shipmentIds: string[] } | { success: false; error: string }> {
  if (!shipments.length) return { success: false, error: "No shipments provided" };

  const rows = shipments.map((s) => ({
    order_id: orderId,
    recipient_name: s.recipientName,
    recipient_phone: s.recipientPhone ?? null,
    recipient_email: s.recipientEmail ?? null,
    delivery_address: s.deliveryAddress,
    gift_note: s.giftNote ?? null,
    scheduled_for_date: s.scheduledForDate ?? null,
    scheduled_window: s.scheduledWindow ?? null,
    delivery_fee: s.deliveryFee ?? 0,
  }));

  const { data, error } = await supabase
    .from("order_shipments" as any)
    .insert(rows as any)
    .select("id");
  if (error) return { success: false, error: error.message };

  const inserted = ((data ?? []) as unknown) as Array<{ id: string }>;

  // Wire each shipment's items
  for (let i = 0; i < inserted.length; i++) {
    const shipmentId = inserted[i].id;
    const ids = shipments[i].orderItemIds;
    if (!ids?.length) continue;
    const { error: linkErr } = await supabase
      .from("order_items")
      .update({ shipment_id: shipmentId } as any)
      .in("id", ids);
    if (linkErr) {
      return { success: false, error: linkErr.message };
    }
  }

  return { success: true, shipmentIds: inserted.map((r) => r.id) };
}
