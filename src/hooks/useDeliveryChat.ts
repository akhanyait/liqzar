import { useCallback, useEffect, useRef, useState } from "react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

/**
 * useDeliveryChat — Supabase-backed customer ↔ driver chat for an order.
 *
 * Writes to `public.delivery_messages` (migration 014) and subscribes via
 * Realtime for live updates. RLS restricts to the order's customer +
 * assigned driver, so both sides see the same thread without any leaks.
 *
 * The hook infers sender_role from the order row (customer vs driver).
 * Admin/system rows are read-only from this hook.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Resolve sender role from the order row.
  useEffect(() => {
    if (!orderId || !user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("user_id, assigned_driver_id")
        .eq("id", orderId)
        .maybeSingle();
      if (!data) return;
      if (data.user_id === user.id) setSenderRole("customer");
      else if (data.assigned_driver_id === user.id) setSenderRole("driver");
    })();
  }, [orderId, user?.id]);

  // Initial load + Realtime subscription.
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("delivery_messages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setMessages((data as DeliveryMessage[]) || []);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`delivery-chat-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_messages",
          filter: `order_id=eq.${orderId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const msg = payload.new as DeliveryMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
        },
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [orderId]);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!orderId || !user?.id || !senderRole) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      const { error } = await supabase.from("delivery_messages").insert({
        order_id: orderId,
        sender_id: user.id,
        sender_role: senderRole,
        body: trimmed,
      });
      if (error) {
        console.warn("[useDeliveryChat] send error", error);
        throw error;
      }
    },
    [orderId, user?.id, senderRole],
  );

  const markAllRead = useCallback(async () => {
    if (!orderId || !user?.id) return;
    // Mark incoming (not-mine) messages as read.
    await supabase
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
