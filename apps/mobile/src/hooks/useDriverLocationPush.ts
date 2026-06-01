import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import { supabase } from "../lib/supabase";

/**
 * useDriverLocationPush (mobile) — expo-location watcher that upserts
 * `driver_live_locations` every ~8s while an active order is assigned.
 * Mirror of the web hook at /src/hooks/useDriverLocationPush.ts.
 *
 * Requests foreground permission on mount; if denied, logs a warning and
 * no-ops (background location requires config + user prompt we don't
 * want to demand for Phase 2A).
 */

// Table added in migration 014; Database types not regenerated — cast to any.
 
const sb = supabase as any;

const INTERVAL_MS = 8_000;

export const useDriverLocationPush = (
  orderId: string | undefined,
  driverId: string | undefined,
  enabled: boolean,
) => {
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const lastPushRef = useRef<number>(0);
  const latestRef = useRef<Location.LocationObjectCoords | null>(null);

  useEffect(() => {
    if (!enabled || !orderId || !driverId) return;

    let cancelled = false;

    const push = async () => {
      const c = latestRef.current;
      if (!c) return;
      if (Date.now() - lastPushRef.current < INTERVAL_MS) return;
      lastPushRef.current = Date.now();

      const { error } = await sb.from("driver_live_locations").upsert(
        {
          order_id: orderId,
          driver_id: driverId,
          lat: c.latitude,
          lng: c.longitude,
          heading: c.heading ?? null,
          speed_mps: c.speed ?? null,
          accuracy_m: c.accuracy ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id" },
      );
      if (error) console.warn("[useDriverLocationPush] upsert", error);
    };

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.warn(
          "[useDriverLocationPush] Location permission denied — live tracking disabled",
        );
        return;
      }
      if (cancelled) return;

      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: INTERVAL_MS,
          distanceInterval: 25,
        },
        (loc) => {
          latestRef.current = loc.coords;
          push();
        },
      );
    };

    start();
    const tick = setInterval(push, INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(tick);
      if (subRef.current) {
        subRef.current.remove();
        subRef.current = null;
      }
    };
  }, [enabled, orderId, driverId]);
};
