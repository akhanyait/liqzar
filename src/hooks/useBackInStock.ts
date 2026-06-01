import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

// Table `stock_notifications` was added in migration 013; cast to avoid
// regenerating Database types here.
 
const supabase = typedSupabase as any;

/**
 * useBackInStock — subscription to `public.stock_notifications` for a given
 * product. When the product transitions to available, a DB trigger fires a
 * `notifications` row for each subscriber (handled by migration 013).
 *
 * Guest behaviour: localStorage-only. Merges into Supabase on sign-in via the
 * same pattern as useWishlist.
 */

const GUEST_KEY = "liqzar-back-in-stock";
const LEGACY_KEY = "liqzar-back-in-stock"; // was the only key pre-013
const MERGE_DONE_KEY = "liqzar-back-in-stock-merged";
const UPDATE_EVENT = "back-in-stock-updated";

const readGuest = (): string[] => {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const writeGuest = (ids: string[]) => {
  localStorage.setItem(GUEST_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
};

export const useBackInStock = (productId: string | undefined) => {
  const { user } = useAuth();
  const userId = user?.id || null;
  const queryClient = useQueryClient();
  const [guestIds, setGuestIds] = useState<string[]>(readGuest);

  useEffect(() => {
    const refresh = () => setGuestIds(readGuest());
    window.addEventListener(UPDATE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(UPDATE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const subsQuery = useQuery({
    queryKey: ["stock-notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [] as string[];
      const { data, error } = await supabase
        .from("stock_notifications")
        .select("product_id")
        .eq("user_id", userId)
        .eq("status", "pending");
      if (error) throw error;
      return ((data || []) as { product_id: string }[]).map((r) => r.product_id);
    },
  });

  const remoteIds: string[] = subsQuery.data || [];

  // Sign-in merge.
  useEffect(() => {
    if (!userId) return;
    const already = sessionStorage.getItem(MERGE_DONE_KEY);
    if (already === userId) return;

    const pending = readGuest().filter((id) => !remoteIds.includes(id));
    if (pending.length === 0) {
      sessionStorage.setItem(MERGE_DONE_KEY, userId);
      return;
    }

    (async () => {
      const rows = pending.map((product_id) => ({
        user_id: userId,
        product_id,
        status: "pending",
      }));
      const { error } = await supabase
        .from("stock_notifications")
        .upsert(rows, {
          onConflict: "user_id,product_id",
          ignoreDuplicates: true,
        });
      if (!error) {
        localStorage.removeItem(GUEST_KEY);
        if (GUEST_KEY !== LEGACY_KEY) localStorage.removeItem(LEGACY_KEY);
        setGuestIds([]);
        queryClient.invalidateQueries({
          queryKey: ["stock-notifications", userId],
        });
      }
      sessionStorage.setItem(MERGE_DONE_KEY, userId);
    })();
  }, [userId, remoteIds, queryClient]);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!productId) return;
      if (!userId) {
        const next = Array.from(new Set([...readGuest(), productId]));
        writeGuest(next);
        return;
      }
      const { error } = await supabase
        .from("stock_notifications")
        .upsert(
          { user_id: userId, product_id: productId, status: "pending" },
          { onConflict: "user_id,product_id", ignoreDuplicates: false },
        );
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["stock-notifications", userId],
      }),
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      if (!productId) return;
      if (!userId) {
        const next = readGuest().filter((id) => id !== productId);
        writeGuest(next);
        return;
      }
      const { error } = await supabase
        .from("stock_notifications")
        .update({ status: "cancelled" })
        .eq("user_id", userId)
        .eq("product_id", productId);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["stock-notifications", userId],
      }),
  });

  const active = userId ? remoteIds : guestIds;
  const subscribed = productId ? active.includes(productId) : false;

  const subscribe = useCallback(() => {
    subscribeMutation.mutate();
  }, [subscribeMutation]);

  const unsubscribe = useCallback(() => {
    unsubscribeMutation.mutate();
  }, [unsubscribeMutation]);

  return { subscribed, subscribe, unsubscribe };
};
