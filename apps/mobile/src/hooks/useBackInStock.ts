import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

/**
 * useBackInStock (mobile) — Supabase-backed subscription for a single product,
 * with AsyncStorage fallback for guest users. Mirrors /src/hooks/useBackInStock.ts.
 *
 * Sign-in merge: when a guest authenticates, any locally-cached product ids
 * are upserted into `stock_notifications` once per session.
 */

const GUEST_KEY = "liqzar-back-in-stock-guest";

const readGuest = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const writeGuest = async (ids: string[]) => {
  await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(ids));
};

// Table added in migration 013; Database types not regenerated — use `as any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export const useBackInStock = (productId: string | undefined) => {
  const { user } = useAuth();
  const userId = user?.id || null;

  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const refresh = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      if (!userId) {
        const ids = await readGuest();
        setSubscribed(ids.includes(productId));
        return;
      }
      const { data } = await sb
        .from("stock_notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("product_id", productId)
        .eq("status", "pending")
        .maybeSingle();
      setSubscribed(!!data);
    } finally {
      setLoading(false);
    }
  }, [productId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!productId) return;
    if (!userId) {
      const ids = await readGuest();
      if (!ids.includes(productId)) {
        await writeGuest([...ids, productId]);
      }
      setSubscribed(true);
      return;
    }
    await sb
      .from("stock_notifications")
      .upsert(
        { user_id: userId, product_id: productId, status: "pending" },
        { onConflict: "user_id,product_id", ignoreDuplicates: false },
      );
    setSubscribed(true);
  }, [productId, userId]);

  const unsubscribe = useCallback(async () => {
    if (!productId) return;
    if (!userId) {
      const ids = await readGuest();
      await writeGuest(ids.filter((id) => id !== productId));
      setSubscribed(false);
      return;
    }
    await sb
      .from("stock_notifications")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
      .eq("product_id", productId);
    setSubscribed(false);
  }, [productId, userId]);

  return { subscribed, loading, subscribe, unsubscribe };
};
