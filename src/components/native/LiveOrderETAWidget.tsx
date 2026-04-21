import { useState, useEffect, memo, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck,
  MapPin,
  ChevronRight,
  X,
  Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

type ActiveStatus =
  | "pending"
  | "awaiting_payment"
  | "confirmed"
  | "preparing"
  | "ready"
  | "driver_assigned"
  | "picked_up"
  | "en_route";

const ACTIVE_STATUSES: ActiveStatus[] = [
  "pending",
  "awaiting_payment",
  "confirmed",
  "preparing",
  "ready",
  "driver_assigned",
  "picked_up",
  "en_route",
];

const STATUS_LABELS: Record<ActiveStatus, string> = {
  pending: "Order received",
  awaiting_payment: "Awaiting payment",
  confirmed: "Order confirmed",
  preparing: "Being prepared",
  ready: "Ready for dispatch",
  driver_assigned: "Driver assigned",
  picked_up: "Driver has your order",
  en_route: "On the way",
};

interface ActiveOrderRow {
  id: string;
  order_number: string | null;
  status: ActiveStatus;
  created_at: string;
  delivery_address: unknown;
  assigned_driver_id: string | null;
  estimated_delivery?: string | null;
}

const DISMISS_KEY_PREFIX = "liqzar-eta-dismissed:";

const formatAddress = (addr: unknown): string => {
  if (!addr) return "Delivery address";
  if (typeof addr === "string") return addr;
  if (typeof addr === "object") {
    const a = addr as Record<string, unknown>;
    const line = (a.addressLine1 ?? a.address_line1 ?? a.street) as string | undefined;
    const suburb = a.suburb as string | undefined;
    const city = a.city as string | undefined;
    return [line, suburb, city].filter(Boolean).join(", ") || "Delivery address";
  }
  return "Delivery address";
};

const computeEtaMinutes = (o: ActiveOrderRow): number => {
  if (o.estimated_delivery) {
    const ms = new Date(o.estimated_delivery).getTime() - Date.now();
    return Math.max(0, Math.round(ms / 60000));
  }
  const ageMin = (Date.now() - new Date(o.created_at).getTime()) / 60000;
  const FALLBACK_TOTAL = 90;
  return Math.max(1, Math.round(FALLBACK_TOTAL - ageMin));
};

const LiveOrderETAWidget = memo(() => {
  const { user } = useAuth();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const { data: order } = useQuery<ActiveOrderRow | null>({
    queryKey: ["active-order", user?.id],
    enabled: !!user?.id,
    staleTime: 15_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, created_at, delivery_address, assigned_driver_id, estimated_delivery",
        )
        .eq("user_id", user.id)
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn("LiveOrderETAWidget query failed:", error.message);
        return null;
      }
      return (data as ActiveOrderRow | null) ?? null;
    },
  });

  useEffect(() => {
    if (!order) {
      setDismissed(false);
      return;
    }
    const key = DISMISS_KEY_PREFIX + order.id;
    setDismissed(sessionStorage.getItem(key) === "1");
  }, [order?.id]);

  const etaMinutes = useMemo(
    () => (order ? computeEtaMinutes(order) : 0),
    [order],
  );

  const hideOnRoute =
    location.pathname.startsWith("/track/") ||
    location.pathname.startsWith("/checkout") ||
    location.pathname.startsWith("/payment") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/driver") ||
    location.pathname.startsWith("/warehouse") ||
    location.pathname === "/auth";

  if (!user || !order || dismissed || hideOnRoute) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    sessionStorage.setItem(DISMISS_KEY_PREFIX + order.id, "1");
    setDismissed(true);
  };

  const label = STATUS_LABELS[order.status] ?? "In progress";
  const address = formatAddress(order.delivery_address);
  const orderNumber = order.order_number ?? `LQ-${order.id.slice(0, 6)}`;
  const etaLabel =
    etaMinutes <= 0 ? "Arriving soon" : etaMinutes < 60
      ? `${etaMinutes} min`
      : `${Math.round(etaMinutes / 60)}h ${etaMinutes % 60}m`;

  return (
    <AnimatePresence>
      <motion.div
        key={order.id}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 300 }}
        className="fixed z-40 left-4 right-4 md:left-auto md:right-6 md:w-[380px] bottom-[84px] md:bottom-6"
        role="status"
        aria-live="polite"
        aria-label="Live order tracking"
      >
        <div className="relative rounded-2xl overflow-hidden shadow-[0_10px_40px_hsl(220_15%_10%/0.25)] ring-1 ring-primary/30 bg-gradient-to-br from-primary to-primary/85 text-primary-foreground">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss order tracker"
            className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-black/20 hover:bg-black/35 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <Link
            to={`/track/${order.id}`}
            className="block p-4 pr-10 focus-visible:outline-none"
            aria-label={`View tracking for order ${orderNumber}`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"
                  aria-hidden
                />
                <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
                  {label}
                </span>
              </div>
              <span className="text-[10px] font-semibold opacity-75">
                {orderNumber}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <Clock className="w-3.5 h-3.5 translate-y-0.5 opacity-80" />
                  <span className="text-2xl font-bold leading-none">
                    {etaLabel}
                  </span>
                  <span className="text-[11px] opacity-80 ml-1">
                    estimated
                  </span>
                </div>
                <p className="flex items-center gap-1.5 mt-1.5 text-[11px] opacity-85 truncate">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{address}</span>
                </p>
              </div>
              <ChevronRight className="w-4 h-4 opacity-75 flex-shrink-0" />
            </div>
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

LiveOrderETAWidget.displayName = "LiveOrderETAWidget";

export default LiveOrderETAWidget;
