import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

/**
 * useDeliveryChat (mobile) — Supabase-backed chat for an order.
 * Mirror of /src/hooks/useDeliveryChat.ts.
 */

 
const sb = supabase as any;

export interface DeliveryMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: "customer" | "driver" | "admin" | "system";
  body: string;
  read_at: string | null;
  created_at: string;
}

export const useDeliveryChat = (orderId: string | undefined) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DeliveryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [senderRole, setSenderRole] = useState<"customer" | "driver" | null>(
    null,
  );

  useEffect(() => {
    if (!orderId || !user?.id) return;
    (async () => {
      const { data } = await sb
        .from("orders")
        .select("user_id, assigned_driver_id")
        .eq("id", orderId)
        .maybeSingle();
      if (!data) return;
      if (data.user_id === user.id) setSenderRole("customer");
      else if (data.assigned_driver_id === user.id) setSenderRole("driver");
    })();
  }, [orderId, user?.id]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data } = await sb
        .from("delivery_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setMessages((data as DeliveryMessage[]) || []);
        setLoading(false);
      }
    })();

    const channel = sb
      .channel(`delivery-chat-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_messages",
          filter: `order_id=eq.${orderId}`,
        },
         
        (payload: any) => {
          const msg = payload.new as DeliveryMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(channel);
    };
  }, [orderId]);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!orderId || !user?.id || !senderRole) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      const { error } = await sb.from("delivery_messages").insert({
        order_id: orderId,
        sender_id: user.id,
        sender_role: senderRole,
        body: trimmed,
      });
      if (error) throw error;
    },
    [orderId, user?.id, senderRole],
  );

  const markAllRead = useCallback(async () => {
    if (!orderId || !user?.id) return;
    await sb
      .from("delivery_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .is("read_at", null)
      .neq("sender_id", user.id);
  }, [orderId, user?.id]);

  const unreadCount = messages.filter(
    (m) => !m.read_at && m.sender_id !== user?.id,
  ).length;

  return { messages, loading, sendMessage, markAllRead, unreadCount, senderRole };
};
