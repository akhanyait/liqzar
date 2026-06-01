import { useEffect, useState } from "react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";

/**
 * useDriverLiveLocation — customer-side live pin for an active order.
 *
 * Subscribes to `driver_live_locations` via Supabase Realtime (INSERT + UPDATE)
 * keyed on order_id. Returns the latest known location + last-update timestamp.
 *
 * This replaces the localStorage/BroadcastChannel hack in `useDeliverySync.ts`
 * for cross-device tracking (customer on phone, driver on mobile = different
 * machines, so localStorage won't cut it).
 */

// Table added in migration 014; Database types not regenerated — cast to any.
 
const supabase = typedSupabase as any;

export interface LiveLocation {
  lat: number;
  lng: number;
  heading: number | null;
  speed_mps: number | null;
  accuracy_m: number | null;
  eta_minutes: number | null;
  updated_at: string;
}

export const useDriverLiveLocation = (orderId: string | undefined) => {
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    // Initial fetch.
    (async () => {
      const { data } = await supabase
        .from("driver_live_locations")
        .select("lat, lng, heading, speed_mps, accuracy_m, eta_minutes, updated_at")
        .eq("order_id", orderId)
        .maybeSingle();
      if (!cancelled && data) setLocation(data as LiveLocation);
    })();

    // Realtime subscription.
    const channel = supabase
      .channel(`driver-live-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_live_locations",
          filter: `order_id=eq.${orderId}`,
        },
         
        (payload: any) => {
          if (payload.new) setLocation(payload.new as LiveLocation);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // Mark stale if no update in 30s.
  useEffect(() => {
    if (!location) return;
    const check = () => {
      const age = Date.now() - new Date(location.updated_at).getTime();
      setStale(age > 30_000);
    };
    check();
    const t = setInterval(check, 5_000);
    return () => clearInterval(t);
  }, [location]);

  return { location, stale };
};
