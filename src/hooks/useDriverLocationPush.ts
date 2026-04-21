import { useEffect, useRef } from "react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";

/**
 * useDriverLocationPush — driver-side upsert loop.
 *
 * While `enabled` is true, watches the browser's geolocation and upserts
 * `driver_live_locations` roughly every `intervalMs` (default 8s) or sooner
 * on significant movement (>25m). Stops cleanly on unmount / enabled=false.
 *
 * On mobile (React Native) we use expo-location instead; see the mobile
 * equivalent at apps/mobile/src/hooks/useDriverLocationPush.ts.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

const INTERVAL_MS = 8_000;
const SIGNIFICANT_MOVEMENT_M = 25;

// Equirectangular approximation — good enough for 25m checks.
const distM = (a: GeolocationCoordinates, b: GeolocationCoordinates) => {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const aLat = (a.latitude * Math.PI) / 180;
  const bLat = (b.latitude * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

export const useDriverLocationPush = (
  orderId: string | undefined,
  driverId: string | undefined,
  enabled: boolean,
) => {
  const watchIdRef = useRef<number | null>(null);
  const lastPushRef = useRef<number>(0);
  const lastCoordsRef = useRef<GeolocationCoordinates | null>(null);
  const latestCoordsRef = useRef<GeolocationCoordinates | null>(null);

  useEffect(() => {
    if (!enabled || !orderId || !driverId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      console.warn(
        "[useDriverLocationPush] Geolocation unavailable in this browser",
      );
      return;
    }

    const push = async () => {
      const c = latestCoordsRef.current;
      if (!c) return;
      const now = Date.now();
      const enoughTime = now - lastPushRef.current >= INTERVAL_MS;
      const enoughMovement =
        !lastCoordsRef.current ||
        distM(lastCoordsRef.current, c) >= SIGNIFICANT_MOVEMENT_M;
      if (!enoughTime && !enoughMovement) return;

      lastPushRef.current = now;
      lastCoordsRef.current = c;

      const { error } = await supabase.from("driver_live_locations").upsert(
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
      if (error) console.warn("[useDriverLocationPush] upsert error", error);
    };

    const onPos = (p: GeolocationPosition) => {
      latestCoordsRef.current = p.coords;
      push();
    };
    const onErr = (e: GeolocationPositionError) => {
      console.warn("[useDriverLocationPush] geolocation error", e.message);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 15_000,
    });

    // Fallback tick — catches the stationary-driver case.
    const tick = setInterval(push, INTERVAL_MS);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      clearInterval(tick);
    };
  }, [enabled, orderId, driverId]);
};
