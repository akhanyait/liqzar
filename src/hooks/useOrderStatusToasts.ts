import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
}

/**
 * Subscribes to realtime INSERTs on public.notifications for the current user
 * and surfaces them as in-app toasts. Also invalidates order-related React Query
 * caches so any open order list/tracking screen refetches automatically.
 *
 * Mount once at the authenticated layout level.
 */
export const useOrderStatusToasts = (userId?: string) => {
  const queryClient = useQueryClient();
  // Guard against React Strict-mode double-mount firing duplicate toasts.
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`order-status-toasts-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as NotificationRow;
          if (!n || seenIds.current.has(n.id)) return;
          seenIds.current.add(n.id);

          toast({
            title: n.title,
            description: n.message,
            duration: n.type === "order_status" ? 6000 : 5000,
          });

          if (n.type === "order_status") {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["active-order"] });
            queryClient.invalidateQueries({ queryKey: ["order"] });
            queryClient.invalidateQueries({ queryKey: ["driver-orders"] });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
};
