import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, MapPin, Truck, Navigation, AlertTriangle } from "lucide-react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";

/**
 * ShareTripPage — public, auth-less trip-tracking page.
 *
 * Resolves `/trip/:token` via the `public-trip` Edge Function, then polls
 * every 10s for a fresh location. No user data leaves the sanitized EF
 * envelope; this page shows driver first name, vehicle, city, and the
 * moving pin only.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

interface Trip {
  orderNumber: string;
  status: string;
  etaMinutes: number | null;
  placedAt: string;
  addressCity: string;
  driver: { firstName: string; vehicle: string | null } | null;
  live: { lat: number; lng: number; updatedAt: string } | null;
}

const STATUS_COPY: Record<string, string> = {
  pending: "Order received",
  confirmed: "Confirmed",
  preparing: "Being prepared",
  ready: "Ready for pickup",
  driver_assigned: "Driver assigned",
  picked_up: "Picked up",
  en_route: "On the way",
  delivered: "Delivered",
};

const ShareTripPage = () => {
  const { token } = useParams<{ token: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid share link");
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchTrip = async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke(
          "public-trip",
          { body: { token } },
        );
        if (cancelled) return;
        if (fnErr || !data?.ok) {
          setError(data?.error || fnErr?.message || "Failed to load trip");
          setLoading(false);
          return;
        }
        setTrip(data.trip as Trip);
        setError(null);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setLoading(false);
      }
    };

    fetchTrip();
    const poll = setInterval(fetchTrip, 10_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading trip…</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">
            Can't load this trip
          </h1>
          <p className="text-sm text-muted-foreground">
            {error || "The share link may have expired or been revoked."}
          </p>
        </div>
      </div>
    );
  }

  const statusLabel = STATUS_COPY[trip.status] || trip.status;
  const updatedAgo = trip.live
    ? Math.max(
        0,
        Math.round((Date.now() - new Date(trip.live.updatedAt).getTime()) / 1000),
      )
    : null;
  const isFresh = updatedAgo !== null && updatedAgo < 30;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#1c1810] to-[#2a2520] text-white px-6 pt-12 pb-10">
        <p className="text-xs tracking-[0.2em] text-[#D4AF37] font-bold">
          LIQZAR — LIVE TRIP
        </p>
        <h1 className="text-2xl font-bold mt-2">
          {trip.driver?.firstName
            ? `${trip.driver.firstName} is delivering`
            : "Your delivery is on its way"}
        </h1>
        <p className="text-sm text-white/70 mt-1">
          Order #{trip.orderNumber}
          {trip.addressCity ? ` · ${trip.addressCity}` : ""}
        </p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 grid grid-cols-2 gap-3"
        >
          <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Truck className="w-3 h-3" />
              Status
            </div>
            <p className="text-base font-semibold mt-1">{statusLabel}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Clock className="w-3 h-3" />
              ETA
            </div>
            <p className="text-base font-semibold mt-1">
              {trip.etaMinutes !== null ? `${trip.etaMinutes} min` : "—"}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Live pin card */}
      <div className="px-6 -mt-6">
        <div className="bg-card rounded-2xl border border-border p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                isFresh ? "bg-green-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <p className="text-sm font-semibold text-foreground">
              {isFresh ? "Driver location is live" : "Reconnecting to driver…"}
            </p>
          </div>
          {trip.live ? (
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span>
                  {trip.live.lat.toFixed(5)}, {trip.live.lng.toFixed(5)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-primary" />
                <span>
                  Updated{" "}
                  {updatedAgo! < 10 ? "just now" : `${updatedAgo}s ago`}
                </span>
              </div>
              {trip.driver?.vehicle && (
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-primary" />
                  <span>{trip.driver.vehicle}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-4">
              Waiting for the driver to start the trip.
            </p>
          )}

          {/* Static map preview via OpenStreetMap — lightweight, no key needed. */}
          {trip.live && (
            <div className="mt-5 rounded-xl overflow-hidden border border-border">
              <img
                src={`https://staticmap.openstreetmap.de/staticmap.php?center=${trip.live.lat},${trip.live.lng}&zoom=15&size=600x300&markers=${trip.live.lat},${trip.live.lng},lightblue1`}
                alt="Driver location"
                className="w-full h-40 object-cover"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 mt-8 pb-12 text-center">
        <p className="text-xs text-muted-foreground">
          Shared by the recipient · LIQZAR keeps this link private and
          time-limited
        </p>
      </div>
    </div>
  );
};

export default ShareTripPage;
