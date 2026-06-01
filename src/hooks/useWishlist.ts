import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

// Tables `wishlists` / `stock_notifications` were added in migration 013 but
// the generated Database types haven't been regenerated yet. Cast locally so
// we don't have to touch the auto-generated file and lose future regens.
 
const supabase = typedSupabase as any;

/**
 * useWishlist — cross-device wishlist backed by `public.wishlists`.
 *
 * Guest behaviour: falls back to localStorage so unauthenticated users can
 * still save items. When they sign in, any locally-stored ids are merged
 * into Supabase once (per session) and localStorage is cleared.
 *
 * Exposed:
 *   - items: string[] of product_ids in the wishlist
 *   - isInWishlist(id): boolean
 *   - toggle(id): add or remove
 *   - add(id) / remove(id)
 *   - isLoading / isReady
 */

const LEGACY_KEY = "liqzar-wishlist";
const GUEST_KEY = "liqzar-wishlist-guest";
const MERGE_DONE_KEY = "liqzar-wishlist-merged";
const UPDATE_EVENT = "wishlist-updated";

const readLocal = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const writeLocal = (key: string, ids: string[]) => {
  localStorage.setItem(key, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
};

// Guest helpers (used when no authenticated user).
const readGuest = (): string[] => {
  const modern = readLocal(GUEST_KEY);
  if (modern.length) return modern;
  // Backfill from the old localStorage key used before Supabase wire-up.
  const legacy = readLocal(LEGACY_KEY);
  return legacy;
};

export const useWishlist = () => {
  const { user } = useAuth();
  const userId = user?.id || null;
  const queryClient = useQueryClient();
  const [guestIds, setGuestIds] = useState<string[]>(readGuest);

  // Guest list hydration across tabs / components.
  useEffect(() => {
    const refresh = () => setGuestIds(readGuest());
    window.addEventListener(UPDATE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(UPDATE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const wishlistQuery = useQuery({
    queryKey: ["wishlist", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [] as string[];
      const { data, error } = await supabase
        .from("wishlists")
        .select("product_id")
        .eq("user_id", userId);
      if (error) throw error;
      return (data || []).map((r) => r.product_id as string);
    },
  });

  const remoteIds = wishlistQuery.data || [];

  // One-shot merge: when a guest signs in, push their local ids to Supabase.
  useEffect(() => {
    if (!userId) return;
    const alreadyMerged = sessionStorage.getItem(MERGE_DONE_KEY);
    if (alreadyMerged === userId) return;

    const pending = readGuest().filter((id) => !remoteIds.includes(id));
    if (pending.length === 0) {
      sessionStorage.setItem(MERGE_DONE_KEY, userId);
      return;
    }

    (async () => {
      const rows = pending.map((product_id) => ({ user_id: userId, product_id }));
      const { error } = await supabase
        .from("wishlists")
        .upsert(rows, { onConflict: "user_id,product_id", ignoreDuplicates: true });
      if (!error) {
        localStorage.removeItem(GUEST_KEY);
        localStorage.removeItem(LEGACY_KEY);
        setGuestIds([]);
        queryClient.invalidateQueries({ queryKey: ["wishlist", userId] });
      }
      sessionStorage.setItem(MERGE_DONE_KEY, userId);
    })();
  }, [userId, remoteIds, queryClient]);

  const addMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!userId) {
        const next = Array.from(new Set([...readGuest(), productId]));
        writeLocal(GUEST_KEY, next);
        return;
      }
      const { error } = await supabase
        .from("wishlists")
        .upsert(
          { user_id: userId, product_id: productId },
          { onConflict: "user_id,product_id", ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["wishlist", userId] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!userId) {
        const next = readGuest().filter((id) => id !== productId);
        writeLocal(GUEST_KEY, next);
        return;
      }
      const { error } = await supabase
        .from("wishlists")
        .delete()
        .eq("user_id", userId)
        .eq("product_id", productId);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["wishlist", userId] }),
  });

  const items = userId ? remoteIds : guestIds;

  const isInWishlist = useCallback(
    (productId: string) => items.includes(productId),
    [items],
  );

  const add = useCallback(
    (productId: string) => addMutation.mutate(productId),
    [addMutation],
  );

  const remove = useCallback(
    (productId: string) => removeMutation.mutate(productId),
    [removeMutation],
  );

  const toggle = useCallback(
    (productId: string) => {
      if (items.includes(productId)) {
        removeMutation.mutate(productId);
      } else {
        addMutation.mutate(productId);
      }
    },
    [items, addMutation, removeMutation],
  );

  return {
    items,
    isInWishlist,
    add,
    remove,
    toggle,
    isLoading: userId ? wishlistQuery.isLoading : false,
    isAuthed: !!userId,
  };
};
