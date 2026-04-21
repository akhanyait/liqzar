import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * useDriverLiveLocation (mobile) — customer-side live pin subscription.
 * Mirror of /src/hooks/useDriverLiveLocation.ts.
 */

// Table added in migration 014; Database types not regenerated — cast to any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

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

    (async () => {
      const { data } = await sb
        .from("driver_live_locations")
        .select("lat, lng, heading, speed_mps, accuracy_m, eta_minutes, updated_at")
        .eq("order_id", orderId)
        .maybeSingle();
      if (!cancelled && data) setLocation(data as LiveLocation);
    })();

    const channel = sb
      .channel(`driver-live-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_live_locations",
          filter: `order_id=eq.${orderId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (payload.new) setLocation(payload.new as LiveLocation);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(channel);
    };
  }, [orderId]);

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
