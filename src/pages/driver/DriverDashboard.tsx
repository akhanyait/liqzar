import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MapPin,
  Package,
  Navigation2,
  Scan,
  Clock,
  Truck,
  Calendar,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useHaptics } from "@/hooks/useNativeFeatures";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useDriverLocationPush } from "@/hooks/useDriverLocationPush";

// Order states
type OrderState =
  | "pending_verification"
  | "verified"
  | "picked_up"
  | "in_transit"
  | "delivered";

interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  customerPhone: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  items: number;
  eta: string;
  distance: string;
  isPriority: boolean;
  status: OrderState;
}

interface DriverStats {
  name: string;
  todayDeliveries: number;
  etaFinish: string;
  rating: number | null;
  rank: number | null;
  driverPos: { lat: number; lng: number } | null;
}

// Extract lat/lng from delivery_address JSON — tolerate shape variants
// (root-level, nested under coordinates, or nested under location/geo).
const extractCoords = (
  addr: unknown,
): { lat: number | null; lng: number | null } => {
  if (!addr || typeof addr !== "object") return { lat: null, lng: null };
  const a = addr as Record<string, unknown>;
  const nested =
    (a.coordinates as Record<string, unknown> | undefined) ??
    (a.location as Record<string, unknown> | undefined) ??
    (a.geo as Record<string, unknown> | undefined) ??
    {};
  const lat = Number(a.lat ?? a.latitude ?? nested.lat ?? nested.latitude);
  const lng = Number(
    a.lng ?? a.longitude ?? a.lon ?? nested.lng ?? nested.longitude ?? nested.lon,
  );
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
};

// Haversine distance in kilometres between two lat/lng pairs.
const haversineKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// Get greeting based on time
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { impact, notification } = useHaptics();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DriverStats>({
    name: "Driver",
    todayDeliveries: 0,
    etaFinish: "—",
    rating: null,
    rank: null,
    driverPos: null,
  });

  useEffect(() => {
    fetchDriverOrders();
    fetchDriverStats();
  }, [user]);

  // Live-tracking: while the driver has an actively-delivering order
  // (picked_up / en_route / driver_assigned), push GPS every ~8s so the
  // customer tracking page renders a moving pin in real time.
  const activeOrderForTracking = useMemo(
    () =>
      orders.find((o) =>
        ["picked_up", "en_route", "in_transit", "driver_assigned"].includes(
          o.status as string,
        ),
      ),
    [orders],
  );
  useDriverLocationPush(
    activeOrderForTracking?.id,
    user?.id,
    !!activeOrderForTracking?.id && !!user?.id,
  );

  // Realtime: refetch driver's orders when any of them change
  // (new assignment, admin-triggered status flip, cancellation, etc.)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`driver-dash-orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `assigned_driver_id=eq.${user.id}`,
        },
        () => {
          fetchDriverOrders();
          fetchDriverStats();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchDriverStats = async () => {
    if (!user?.id) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [profileRes, driverRes, deliveredRes, nextEtaRes, rankRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single(),
        supabase
          .from("driver_profiles")
          .select("rating")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("assigned_driver_id", user.id)
          .eq("status", "delivered")
          .gte("delivered_at", todayStart.toISOString()),
        supabase
          .from("orders")
          .select("estimated_delivery")
          .eq("assigned_driver_id", user.id)
          .in("status", ["driver_assigned", "picked_up", "en_route"])
          .not("estimated_delivery", "is", null)
          .order("estimated_delivery", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("driver_leaderboard" as never)
          .select("rank")
          .eq("driver_user_id", user.id)
          .maybeSingle(),
      ]);

    const fullName = (profileRes.data?.full_name as string) || "Driver";
    const firstName = fullName.split(" ")[0] || "Driver";
    const etaIso = nextEtaRes.data?.estimated_delivery as string | undefined;
    const etaFinish = etaIso
      ? new Date(etaIso).toLocaleTimeString("en-ZA", {
          hour: "numeric",
          minute: "2-digit",
        })
      : "—";

    const rating =
      typeof driverRes.data?.rating === "number"
        ? driverRes.data.rating
        : null;
    const rankRow = rankRes.data as { rank?: number } | null;
    const rank = typeof rankRow?.rank === "number" ? rankRow.rank : null;

    // Best-effort: browser geolocation for distance computation
    let driverPos: { lat: number; lng: number } | null = null;
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      driverPos = await new Promise<{ lat: number; lng: number } | null>(
        (resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              }),
            () => resolve(null),
            { timeout: 5000, maximumAge: 60000 },
          );
        },
      );
    }

    setStats({
      name: firstName,
      todayDeliveries: deliveredRes.count ?? 0,
      etaFinish,
      rating,
      rank,
      driverPos,
    });
  };

  const fetchDriverOrders = async () => {
    try {
      setLoading(true);

      if (!user?.id) {
        setLoading(false);
        setOrders([]);
        return;
      }

      // Fetch orders assigned to this specific driver
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("*")
        .eq("assigned_driver_id", user.id)
        .in("status", [
          "pending",
          "preparing",
          "ready",
          "driver_assigned",
          "picked_up",
          "en_route",
        ])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching orders:", error);
        toast({
          title: "Error Loading Orders",
          description: error.message || "Failed to fetch orders from database",
          variant: "destructive",
        });
        setLoading(false);
        setOrders([]);
        return;
      }

      // Fetch order items count for each order and customer profiles
      const ordersWithItems: Order[] = await Promise.all(
        (ordersData || []).map(async (order: any) => {
          // Get order items count
          const { count: itemsCount } = await supabase
            .from("order_items")
            .select("*", { count: "exact", head: true })
            .eq("order_id", order.id);

          // Get customer profile (name + phone)
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, phone")
            .eq("id", order.user_id)
            .single();

          // Parse delivery address if it's JSON
          let addressString = "Address not provided";
          if (order.delivery_address) {
            if (typeof order.delivery_address === "string") {
              addressString = order.delivery_address;
            } else if (typeof order.delivery_address === "object") {
              const addr = order.delivery_address;
              addressString =
                `${addr.street || addr.address_line1 || ""}, ${addr.city || ""}`
                  .trim()
                  .replace(/^,\s*/, "");
            }
          }

          const { lat, lng } = extractCoords(order.delivery_address);

          // ETA from order.estimated_delivery if set; else from created_at age
          let etaLabel = "—";
          if (order.estimated_delivery) {
            const minsLeft = Math.max(
              0,
              Math.round(
                (new Date(order.estimated_delivery).getTime() - Date.now()) /
                  60000,
              ),
            );
            etaLabel =
              minsLeft === 0
                ? "Arriving"
                : minsLeft < 60
                  ? `${minsLeft} min`
                  : `${Math.round(minsLeft / 60)}h ${minsLeft % 60}m`;
          }

          return {
            id: order.id,
            orderNumber: order.order_number || "ORD-????",
            customer: (profile as any)?.full_name || "Customer",
            customerPhone: (profile as any)?.phone ?? null,
            address: addressString,
            lat,
            lng,
            items: itemsCount || 0,
            eta: etaLabel,
            distance: "—",
            isPriority: false,
            status: "pending_verification" as OrderState,
          };
        }),
      );

      setOrders(ordersWithItems);

      if (ordersWithItems.length === 0) {
        toast({
          title: "No Assigned Orders",
          description: "Waiting for admin to assign orders to you",
        });
      }
    } catch (error) {
      console.error("Error in fetchDriverOrders:", error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyStock = (orderId: string) => {
    impact("medium");
    // Navigate to item scanning page
    navigate(`/driver/scan/${orderId}`);
    toast({
      title: "Opening Scanner",
      description: "Scan all items to verify stock",
    });
  };

  const handleStartPickup = (orderId: string) => {
    impact("medium");
    setOrders(
      orders.map((order) =>
        order.id === orderId ? { ...order, status: "picked_up" } : order,
      ),
    );
    toast({
      title: "Pickup Started",
      description: "Loading items into vehicle",
    });
  };

  const handleStartDrive = (orderId: string, orderNumber: string) => {
    impact("heavy");
    notification("success");

    // Find order details
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // Navigate directly to turn-by-turn navigation (skip route overview)
    if (order.lat === null || order.lng === null) {
      toast({
        title: "Destination coordinates missing",
        description:
          "This order has no geocoded address. Contact dispatch to update.",
        variant: "destructive",
      });
      return;
    }

    const params = new URLSearchParams({
      orderId: order.orderNumber,
      customer: order.customer,
      address: order.address,
      phone: order.customerPhone ?? "",
      items: order.items.toString(),
      lat: String(order.lat),
      lng: String(order.lng),
    });

    toast({
      title: "Starting Navigation",
      description: `Turn-by-turn directions to ${order.customer}`,
    });

    navigate(`/driver/drive?${params.toString()}`);
  };

  // Derive distance (Haversine km) per order when driver GPS is known.
  const ordersWithDistance = useMemo(() => {
    const pos = stats.driverPos;
    if (!pos) return orders;
    return orders.map((o) => {
      if (o.lat == null || o.lng == null) return o;
      const km = haversineKm(pos, { lat: o.lat, lng: o.lng });
      return {
        ...o,
        distance: km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`,
      };
    });
  }, [orders, stats.driverPos]);

  const activeOrders = ordersWithDistance.filter(
    (o) => o.status !== "delivered",
  );
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header / Greeting */}
      <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-900 px-4 pt-6 pb-4 border-b border-zinc-800">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">
              {getGreeting()},{" "}
              <span className="text-primary">{stats.name}</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">{today}</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-3">
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
              <Package className="w-3 h-3" />
              <span>Today</span>
            </div>
            <p className="text-xl font-bold text-zinc-100">
              {stats.todayDeliveries}
            </p>
            <p className="text-[10px] text-zinc-400">trips</p>
          </div>

          <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-3">
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
              <Clock className="w-3 h-3" />
              <span>Last ETA</span>
            </div>
            <p className="text-xl font-bold text-zinc-100">
              {stats.etaFinish}
            </p>
            <p className="text-[10px] text-zinc-400">drop-off</p>
          </div>

          <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-3">
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
              <span>★</span>
              <span>Rating</span>
            </div>
            <p className="text-xl font-bold text-zinc-100">
              {stats.rating != null ? stats.rating.toFixed(1) : "—"}
            </p>
            <p className="text-[10px] text-zinc-400">out of 5</p>
          </div>

          <div className="bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-3">
            <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-1">
              <span>#</span>
              <span>Rank</span>
            </div>
            <p className="text-xl font-bold text-zinc-100">
              {stats.rank != null ? `#${stats.rank}` : "—"}
            </p>
            <p className="text-[10px] text-zinc-400">last 7 days</p>
          </div>
        </div>
      </div>

      {/* Today's Schedule Overview */}
      <div className="px-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-zinc-100" />
          <h2 className="text-lg font-bold text-zinc-100">Today's Schedule</h2>
        </div>

        {/* Workflow Steps */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
          <div className="space-y-3">
            {/* Step 1: Verify Stock */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Scan className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-zinc-100">
                  1. Verify Stock
                </h3>
                <p className="text-xs text-zinc-400">
                  Scan all items in each order
                </p>
              </div>
              <div className="text-sm font-bold text-blue-600">
                {
                  orders.filter((o) => o.status === "pending_verification")
                    .length
                }
              </div>
            </div>

            {/* Step 2: Pickup */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-zinc-100">
                  2. Pickup Orders
                </h3>
                <p className="text-xs text-zinc-400">Collect verified orders</p>
              </div>
              <div className="text-sm font-bold text-green-600">
                {orders.filter((o) => o.status === "verified").length}
              </div>
            </div>

            {/* Step 3: Deliver */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Truck className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-zinc-100">3. Deliver</h3>
                <p className="text-xs text-zinc-400">Complete deliveries</p>
              </div>
              <div className="text-sm font-bold text-primary">
                {
                  orders.filter(
                    (o) =>
                      o.status === "picked_up" || o.status === "in_transit",
                  ).length
                }
              </div>
            </div>
          </div>
        </div>

        {/* Orders Pending Verification */}
        {orders.filter((o) => o.status === "pending_verification").length >
          0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <h3 className="text-sm font-bold text-zinc-100">
                Pending Verification (
                {
                  orders.filter((o) => o.status === "pending_verification")
                    .length
                }
                )
              </h3>
            </div>
            <div className="space-y-3">
              {ordersWithDistance
                .filter((o) => o.status === "pending_verification")
                .map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-zinc-900 border-l-4 border-l-blue-600 border-zinc-800 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-zinc-100">
                          {order.orderNumber}
                        </h4>
                        <p className="text-xs text-zinc-400">
                          {order.customer}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-zinc-400">ETA</div>
                        <div className="text-sm font-bold text-zinc-100">
                          {order.eta}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
                      <MapPin className="w-3 h-3" />
                      <span className="line-clamp-1">{order.address}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-zinc-400">
                        {order.items} items • {order.distance}
                      </div>
                      <button
                        onClick={() => handleVerifyStock(order.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Scan className="w-3.5 h-3.5" />
                        Scan Items
                      </button>
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        )}

        {/* Orders Ready for Pickup */}
        {orders.filter((o) => o.status === "verified").length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              <h3 className="text-sm font-bold text-zinc-100">
                Ready for Pickup (
                {orders.filter((o) => o.status === "verified").length})
              </h3>
            </div>
            <div className="space-y-3">
              {ordersWithDistance
                .filter((o) => o.status === "verified")
                .map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-zinc-900 border-l-4 border-l-green-600 border-zinc-800 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-zinc-100">
                          {order.orderNumber}
                        </h4>
                        <p className="text-xs text-zinc-400">
                          {order.customer}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                        Verified ✓
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
                      <MapPin className="w-3 h-3" />
                      <span className="line-clamp-1">{order.address}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-zinc-400">
                        {order.items} items • {order.distance}
                      </div>
                      <button
                        onClick={() => handleStartPickup(order.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Package className="w-3.5 h-3.5" />
                        Start Pickup
                      </button>
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        )}

        {/* Orders In Transit */}
        {orders.filter(
          (o) => o.status === "picked_up" || o.status === "in_transit",
        ).length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-sm font-bold text-zinc-100">
                Out for Delivery (
                {
                  orders.filter(
                    (o) =>
                      o.status === "picked_up" || o.status === "in_transit",
                  ).length
                }
                )
              </h3>
            </div>
            <div className="space-y-3">
              {ordersWithDistance
                .filter(
                  (o) => o.status === "picked_up" || o.status === "in_transit",
                )
                .map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-zinc-900 border-l-4 border-l-primary border-zinc-800 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-zinc-100">
                          {order.orderNumber}
                        </h4>
                        <p className="text-xs text-zinc-400">
                          {order.customer}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-primary/20 text-primary text-[10px] font-bold rounded-full">
                        In Transit
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
                      <MapPin className="w-3 h-3" />
                      <span className="line-clamp-1">{order.address}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-zinc-400">
                        ETA: {order.eta} • {order.distance}
                      </div>
                      <button
                        onClick={() =>
                          handleStartDrive(order.id, order.orderNumber)
                        }
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Navigation2 className="w-3.5 h-3.5" />
                        Navigate
                      </button>
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {loading ? (
          <div
            className="space-y-3"
            role="status"
            aria-live="polite"
            aria-label="Loading today's schedule"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-24 rounded skeleton-shimmer bg-zinc-800" />
                    <div className="h-3 w-32 rounded skeleton-shimmer bg-zinc-800" />
                  </div>
                  <div className="h-6 w-16 rounded-full skeleton-shimmer bg-zinc-800" />
                </div>
                <div className="h-3 w-full rounded skeleton-shimmer bg-zinc-800 mb-3" />
                <div className="flex items-center justify-between">
                  <div className="h-3 w-28 rounded skeleton-shimmer bg-zinc-800" />
                  <div className="h-8 w-24 rounded-lg skeleton-shimmer bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center"
            role="status"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-primary/20">
              <Truck className="w-8 h-8 text-primary" strokeWidth={1.5} />
            </div>
            <p className="text-zinc-100 font-semibold text-base mb-1.5">
              You're all caught up
            </p>
            <p className="text-zinc-400 text-sm max-w-xs mx-auto leading-relaxed">
              No deliveries are assigned yet. We'll notify you as soon as the
              dispatcher has something for you.
            </p>
            <button
              onClick={fetchDriverOrders}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold border border-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Clock className="w-3.5 h-3.5" />
              Refresh
            </button>
          </motion.div>
        ) : null}
      </div>

      {/* Active Deliveries (Legacy - kept for backwards compatibility) */}
      <div className="px-4 mb-6 hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-100">Active Deliveries</h2>
          <span className="text-primary font-bold text-sm">
            {activeOrders.length}{" "}
            {activeOrders.length === 1 ? "order" : "orders"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;
