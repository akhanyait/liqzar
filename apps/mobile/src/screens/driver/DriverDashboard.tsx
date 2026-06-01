import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
  Image,
  Dimensions,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { supabase } from "../../lib/supabase";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useOrders } from "../../contexts/OrderContext";
import { spacing, borderRadius, typography } from "../../theme";
import { formatCurrency, formatRand } from "../../utils/currency";
import { useDriverLocationPush } from "../../hooks/useDriverLocationPush";
import DriverRoutePlanModal from "./DriverRoutePlanModal";

const { width } = Dimensions.get("window");

interface Delivery {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  distance: string;
  estimatedTime: string;
  items: number;
  total: number;
  status: "pending" | "driver_assigned" | "picked_up" | "en_route" | "delivered";
  createdAt: string;
  /** ISO timestamp used to detect acceptance timeout (best-effort: status updated_at or created_at) */
  assignedAtISO?: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "New Order", color: "#F59E0B", icon: "time-outline" },
  driver_assigned: {
    label: "Assigned",
    color: "#3B82F6",
    icon: "checkmark-circle-outline",
  },
  accepted_by_driver: {
    label: "Accepted",
    color: "#3B82F6",
    icon: "checkmark-circle-outline",
  },
  picked_up: {
    label: "Picked Up",
    color: "#8B5CF6",
    icon: "bag-check-outline",
  },
  en_route: { label: "En Route", color: "#3B82F6", icon: "navigate-outline" },
  delivered: {
    label: "Delivered",
    color: "#10B981",
    icon: "checkmark-done-outline",
  },
};

const STATUS_CONFIG_FALLBACK: { label: string; color: string; icon: string } = {
  label: "In Progress",
  color: "#6B7280",
  icon: "ellipsis-horizontal-outline",
};

const PROGRESS_MAP: Record<string, number> = {
  pending: 0,
  driver_assigned: 0.25,
  accepted_by_driver: 0.25,
  picked_up: 0.5,
  en_route: 0.75,
  delivered: 1,
};

export default function DriverDashboard() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, role, signOut } = useAuth();
  const { colors, gradients, shadows, isDark, toggleTheme } = useTheme();
  const {
    activeOrders,
    acceptDelivery,
    markPickedUp,
    markEnRoute,
    markDelivered,
    refreshOrders,
    unreadCount,
  } = useOrders();

  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [routePlanOpen, setRoutePlanOpen] = useState(false);
  /** Tracks which driver_assigned orders this driver has explicitly accepted this session */
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  /** Seconds remaining per assignment id — updated every second */
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  const ACCEPTANCE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const [expiredAssignmentIds, setExpiredAssignmentIds] = useState<Set<string>>(new Set());

  // One-shot driver GPS for delivery-card distance/ETA. The active live-tracking
  // hook is write-only (pushes to server), so we acquire location locally here.
  // No watch — cards re-render on activeOrders refresh, not on every GPS tick,
  // and a planning view doesn't need sub-second freshness.
  const [driverGps, setDriverGps] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled || status !== "granted") return;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setDriverGps({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (e) {
        // Silent — distance/ETA cells will show "—"
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live-tracking: while this driver has a picked-up / en-route order,
  // push GPS every ~8s so the customer tracking screen sees a moving pin.
  const activeOrderForTracking = useMemo(
    () =>
      activeOrders.find((o) =>
        ["picked_up", "en_route", "in_transit"].includes(o.status as string),
      ),
    [activeOrders],
  );
  useDriverLocationPush(
    activeOrderForTracking?.id,
    user?.id,
    isOnline && !!activeOrderForTracking?.id && !!user?.id,
  );

  // Map activeOrders from OrderContext to the Delivery format used by this screen
  const deliveries: Delivery[] = useMemo(() => {
    // Haversine kilometres — straight-line distance is fine for the card hint;
    // Mapbox Directions API gives the real route distance inside DepotPickup /
    // Navigation. Calling Directions API per card would burn the free tier.
    const haversineKm = (
      a: { latitude: number; longitude: number },
      b: { latitude: number; longitude: number },
    ): number => {
      const R = 6371;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const dLat = toRad(b.latitude - a.latitude);
      const dLng = toRad(b.longitude - a.longitude);
      const lat1 = toRad(a.latitude);
      const lat2 = toRad(b.latitude);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };
    const AVG_CITY_SPEED_KMH = 30;

    return activeOrders
      .filter((o) => !dismissedIds.has(o.id))
      .map((o) => {
        const addr = o.delivery_address;
        const addressStr =
          typeof addr === "string"
            ? addr
            : addr?.formatted_address || addr?.address || "No address";
        // customer_name is now hydrated by OrderContext from delivery_address
        // or the profile linked to user_id. Falls through to "Customer" only
        // as a final display-time guard.
        const customerName = (o as any).customer_name || "Customer";
        const customerPhone = addr?.phone || addr?.recipient_phone || "";
        const itemCount = (o as any).order_items?.length ?? 0;

        // Distance / ETA from driver GPS to delivery coords. delivery_address
        // shape: { coordinates: { lat, lng } } OR { coordinates: { latitude,
        // longitude } }. Both forms appear in the codebase — handle both.
        const coords = addr?.coordinates || addr?.location || addr?.geo;
        const destLat = Number(coords?.latitude ?? coords?.lat);
        const destLng = Number(coords?.longitude ?? coords?.lng);
        let distanceStr = "—";
        let etaStr = o.eta_minutes ? `${o.eta_minutes} min` : "—";
        if (
          driverGps &&
          Number.isFinite(destLat) &&
          Number.isFinite(destLng)
        ) {
          const km = haversineKm(driverGps, { latitude: destLat, longitude: destLng });
          distanceStr =
            km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
          // Only overwrite ETA when the server didn't already provide one
          // (an en-route order has a real Mapbox-computed ETA from when the
          // driver started navigation; haversine would be less accurate).
          if (!o.eta_minutes) {
            const mins = Math.max(1, Math.round((km / AVG_CITY_SPEED_KMH) * 60));
            etaStr = `~${mins} min`;
          }
        }

        const now = new Date();
        const created = new Date(o.created_at);
        const diffMin = Math.round(
          (now.getTime() - created.getTime()) / 60000,
        );
        const createdAt =
          diffMin < 1
            ? "Just now"
            : diffMin < 60
              ? `${diffMin} mins ago`
              : `${Math.round(diffMin / 60)}h ago`;

        return {
          id: o.id,
          orderNumber: o.order_number,
          customerName,
          customerPhone,
          address: addressStr,
          distance: distanceStr,
          estimatedTime: etaStr,
          items: itemCount,
          total: o.total || 0,
          status: o.status as Delivery["status"],
          createdAt,
          // [DEF-015] Use driver_assigned_at (set only at assignment time) instead of
          // updated_at (resets on every column mutation e.g. payment EF write),
          // so the countdown timer reflects the real acceptance window.
          assignedAtISO: (o as any).driver_assigned_at ?? (o as any).updated_at ?? o.created_at,
        };
      });
  }, [activeOrders, dismissedIds, driverGps]);

  // Live countdown + expiry checker — ticks every second for unaccepted driver_assigned orders
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const expired = new Set<string>();
      const next: Record<string, number> = {};

      for (const d of deliveries) {
        if (d.status === "driver_assigned" && d.assignedAtISO && !acceptedIds.has(d.id)) {
          const assignedMs = new Date(d.assignedAtISO).getTime();
          const elapsedMs = now - assignedMs;
          const remainingMs = ACCEPTANCE_TIMEOUT_MS - elapsedMs;

          if (remainingMs <= 0) {
            expired.add(d.id);
            next[d.id] = 0;
          } else {
            next[d.id] = Math.ceil(remainingMs / 1000);
          }
        }
      }

      setExpiredAssignmentIds(expired);
      setCountdowns(next);
    };

    tick();
    const interval = setInterval(tick, 1_000);
    return () => clearInterval(interval);
  }, [deliveries, acceptedIds]);

  // Real driver rating from driver_profiles (per migration 011). One-shot
  // fetch on mount — rating doesn't change often enough to need a watch.
  // total_deliveries here is lifetime; the "Deliveries" tile shows TODAY only.
  const [driverRating, setDriverRating] = useState<number | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("driver_profiles")
        .select("rating")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && data?.rating != null) {
        setDriverRating(Number(data.rating));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const todayStats = useMemo(() => {
    // Today in local time — start at midnight.
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();

    // Deliveries completed TODAY only — use delivered_at (set by the
    // status-transition function when status flips to 'delivered'), falling
    // back to updated_at if a legacy row lacks it.
    const deliveredToday = activeOrders.filter((o) => {
      if (o.status !== "delivered") return false;
      const t = (o as any).delivered_at ?? (o as any).updated_at;
      if (!t) return false;
      return new Date(t).getTime() >= startMs;
    });

    // Earnings = sum of delivery_fee (the per-order driver-attributable fee).
    // delivery_fee column exists on orders per the original schema migration.
    // Fall back to a 10% slice of order total when delivery_fee is 0/missing
    // so legacy seeded data still gives a non-zero hint.
    const earnings = deliveredToday.reduce((sum, o) => {
      const fee = Number((o as any).delivery_fee ?? 0);
      return sum + (fee > 0 ? fee : (o.total || 0) * 0.1);
    }, 0);

    // Distance proxy: haversine from depot to each delivery address.
    // Real route distance would require a Mapbox call per order; the proxy
    // is cheap and "good enough" for an at-a-glance tile. Depot constant
    // mirrors DriverDepotPickup.tsx — when multi-depot lands this should
    // come from order.fulfillment_depot_id.
    const DEPOT = { latitude: -33.9215, longitude: 18.4184 };
    const toRad = (d: number) => (d * Math.PI) / 180;
    const haversineKm = (
      a: { latitude: number; longitude: number },
      b: { latitude: number; longitude: number },
    ) => {
      const R = 6371;
      const dLat = toRad(b.latitude - a.latitude);
      const dLng = toRad(b.longitude - a.longitude);
      const lat1 = toRad(a.latitude);
      const lat2 = toRad(b.latitude);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };
    const distanceKm = deliveredToday.reduce((sum, o) => {
      const coords =
        o.delivery_address?.coordinates ||
        o.delivery_address?.location ||
        o.delivery_address?.geo;
      const lat = Number(coords?.latitude ?? coords?.lat);
      const lng = Number(coords?.longitude ?? coords?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return sum;
      return sum + haversineKm(DEPOT, { latitude: lat, longitude: lng });
    }, 0);

    return {
      completed: deliveredToday.length,
      earnings,
      rating: driverRating ?? 5.0,
      // One decimal under 10km, integer above. Avoid "0.0" — show "0" cleanly.
      distance: distanceKm === 0 ? 0 : Number(distanceKm.toFixed(distanceKm < 10 ? 1 : 0)),
    };
  }, [activeOrders, driverRating]);

  const activeDeliveries = deliveries.filter((d) => d.status !== "delivered");
  const pendingCount = deliveries.filter((d) => d.status === "pending").length;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshOrders();
    } finally {
      setRefreshing(false);
    }
  }, [refreshOrders]);

  const handleAcceptDelivery = useCallback(
    async (id: string) => {
      const success = await acceptDelivery(id);
      if (success) {
        setAcceptedIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }
    },
    [acceptDelivery],
  );

  const handleUpdateStatus = useCallback(
    async (id: string, newStatus: Delivery["status"]) => {
      switch (newStatus) {
        case "picked_up":
          await markPickedUp(id);
          break;
        case "en_route":
          await markEnRoute(id);
          break;
        case "delivered":
          await markDelivered(id);
          break;
      }
    },
    [markPickedUp, markEnRoute, markDelivered],
  );

  // Latest active delivery — sort by assignedAt/createdAt DESC so a brand-new
  // assignment surfaces immediately as the hero card.
  const activeDelivery = useMemo(() => {
    const candidates = deliveries.filter(
      (d) =>
        d.status === "driver_assigned" ||
        d.status === "picked_up" ||
        d.status === "en_route",
    );
    if (candidates.length === 0) return undefined;
    return [...candidates].sort((a, b) => {
      const aT = new Date(a.assignedAtISO || a.createdAt).getTime();
      const bT = new Date(b.assignedAtISO || b.createdAt).getTime();
      return bT - aT;
    })[0];
  }, [deliveries]);

  /** Format seconds remaining into "4:32" style label */
  const formatCountdown = (secs: number): string => {
    if (secs <= 0) return "Expired";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#1a1815", "#0f0d09"] : ["#FFFFFF", "#FAFAF8"]}
        style={[
          {
            paddingTop: insets.top + 8,
            paddingBottom: 14,
            paddingHorizontal: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(212,175,55,0.12)",
          },
        ]}
      >
        <View style={st.headerRow}>
          <View style={st.headerLeft}>
            <Image
              source={require("../../../assets/liqzar-logo.png")}
              style={st.headerLogo}
              resizeMode="contain"
            />
            <View>
              <View style={st.headerTitleRow}>
                <Text style={[st.headerTitle, { color: colors.text.primary }]} numberOfLines={1}>
                  {user?.full_name || "Driver"}
                </Text>
                <View
                  style={[
                    st.headerStatusDot,
                    {
                      backgroundColor: isOnline ? colors.status.success : colors.status.error,
                      shadowColor: isOnline ? colors.status.success : colors.status.error,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.6,
                      shadowRadius: 4,
                      elevation: 4,
                    },
                  ]}
                />
              </View>
              {/* Identity strip — phone · role pill. Tight horizontal use,
                  premium feel, role generalises if header is reused. */}
              <View style={st.identityStrip}>
                {user?.phone && (
                  <>
                    <Icon
                      name="call-outline"
                      size={10}
                      color={colors.gold.muted}
                    />
                    <Text style={st.identityPhone}>
                      {(() => {
                        const digits = user.phone.replace(/\D/g, "");
                        const local = digits.startsWith("27")
                          ? "0" + digits.slice(2)
                          : digits;
                        return local.length === 10
                          ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
                          : user.phone;
                      })()}
                    </Text>
                    <View
                      style={[
                        st.identitySeparator,
                        { backgroundColor: colors.gold.border },
                      ]}
                    />
                  </>
                )}
                <View
                  style={[
                    st.rolePill,
                    {
                      backgroundColor: colors.gold.primary + (isDark ? "1A" : "14"),
                      borderColor: colors.gold.primary + (isDark ? "33" : "26"),
                    },
                  ]}
                >
                  <Icon
                    name={
                      role === "admin"
                        ? "key-outline"
                        : role === "driver"
                          ? "shield-checkmark-outline"
                          : "person-outline"
                    }
                    size={9}
                    color={colors.gold.primary}
                  />
                  <Text style={[st.rolePillText, { color: colors.gold.primary }]}>
                    {(role ?? "driver").toUpperCase()}
                  </Text>
                </View>

                {/* Theme toggle — small chip on the identity strip so it's
                    discoverable without competing with the action icons.
                    Icon morphs between sun (currently in dark) and moon
                    (currently in light) so the affordance reads as
                    "tap to switch to THAT mode". */}
                <TouchableOpacity
                  onPress={toggleTheme}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={
                    isDark ? "Switch to light mode" : "Switch to dark mode"
                  }
                  accessibilityRole="button"
                  style={[
                    st.themeToggle,
                    {
                      backgroundColor: colors.gold.primary + (isDark ? "12" : "0E"),
                      borderColor: colors.gold.primary + (isDark ? "26" : "1F"),
                    },
                  ]}
                >
                  <Icon
                    name={isDark ? "sunny-outline" : "moon-outline"}
                    size={11}
                    color={colors.gold.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={st.headerRight}>
            {/* Notification bell with unread badge */}
            <TouchableOpacity
              style={[
                st.iconBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
              onPress={() => navigation.navigate("Notifications")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              accessibilityRole="button"
            >
              <Icon
                name="notifications-outline"
                size={18}
                color={colors.gold.primary}
              />
              {unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: 8,
                    backgroundColor: colors.status.error,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      color: "#fff",
                      fontWeight: "700",
                    }}
                  >
                    {unreadCount > 9 ? "9+" : String(unreadCount)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                st.iconBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
              onPress={() => navigation.navigate("DriverChat")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Messages"
              accessibilityRole="button"
            >
              <Icon
                name="chatbubbles-outline"
                size={18}
                color={colors.status.success}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                st.iconBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
              onPress={() => navigation.navigate("DriverAIAssistant")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="AI Assistant"
              accessibilityRole="button"
            >
              <Icon
                name="sparkles-outline"
                size={18}
                color={colors.status.warning}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                st.iconBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
              onPress={() => navigation.navigate("DriverMenu")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Menu"
              accessibilityRole="button"
            >
              <Icon
                name="menu-outline"
                size={18}
                color={colors.gold.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.primary}
          />
        }
      >
        {/* Online Toggle Bar */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setIsOnline((prev) => !prev)}
          style={{ marginHorizontal: spacing.md, marginTop: spacing.md }}
          accessibilityLabel={isOnline ? 'Go offline' : 'Go online'}
          accessibilityRole="switch"
        >
          <LinearGradient
            colors={
              isOnline
                ? isDark
                  ? ["rgba(16,185,129,0.15)", "rgba(16,185,129,0.06)"]
                  : ["rgba(16,185,129,0.10)", "rgba(16,185,129,0.03)"]
                : isDark
                  ? ["rgba(239,68,68,0.15)", "rgba(239,68,68,0.06)"]
                  : ["rgba(239,68,68,0.10)", "rgba(239,68,68,0.03)"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              st.onlineBar,
              {
                borderColor: isOnline
                  ? "rgba(16,185,129,0.3)"
                  : "rgba(239,68,68,0.3)",
              },
            ]}
          >
            <View style={st.onlineBarLeft}>
              <View
                style={[
                  st.onlineIndicator,
                  {
                    backgroundColor: isOnline ? colors.status.success : colors.status.error,
                    shadowColor: isOnline ? colors.status.success : colors.status.error,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 8,
                    elevation: 6,
                  },
                ]}
              >
                <Icon
                  name={isOnline ? "radio-outline" : "radio-outline"}
                  size={16}
                  color={colors.white}
                />
              </View>
              <View>
                <Text style={[st.onlineBarTitle, { color: colors.text.primary }]}>
                  {isOnline ? "You're Online" : "You're Offline"}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: isOnline ? colors.status.success : colors.status.error,
                    fontWeight: "500",
                  }}
                >
                  {isOnline
                    ? "Receiving delivery requests"
                    : "Tap to go online"}
                </Text>
              </View>
            </View>
            <Switch
              value={isOnline}
              onValueChange={setIsOnline}
              trackColor={{
                false: "rgba(239,68,68,0.3)",
                true: "rgba(16,185,129,0.3)",
              }}
              thumbColor={isOnline ? colors.status.success : colors.status.error}
              ios_backgroundColor="rgba(239,68,68,0.3)"
            />
          </LinearGradient>
        </TouchableOpacity>

        {/* Stats Row */}
        <View style={st.statsGrid}>
          {[
            // Gradient stop opacities mirror the onlineBar above: 15%/6% in dark,
            // 10%/3% in light. Keeps the whole header (status card + 4 tiles)
            // as one matched set.
            {
              label: "Deliveries",
              value: `${todayStats.completed}`,
              hint: "completed today",
              icon: "bicycle-outline",
              accent: colors.status.info,
              gradDark: ["rgba(59,130,246,0.15)", "rgba(59,130,246,0.06)"] as [string, string, ...string[]],
              gradLight: ["rgba(59,130,246,0.10)", "rgba(59,130,246,0.03)"] as [string, string, ...string[]],
            },
            {
              label: "Earned",
              value: formatRand(todayStats.earnings),
              hint: "in delivery fees",
              icon: "cash-outline",
              accent: colors.status.success,
              gradDark: ["rgba(16,185,129,0.15)", "rgba(16,185,129,0.06)"] as [string, string, ...string[]],
              gradLight: ["rgba(16,185,129,0.10)", "rgba(16,185,129,0.03)"] as [string, string, ...string[]],
            },
            {
              label: "Rating",
              // Always one decimal so "5" never appears (looks like a count, not a rating)
              value: todayStats.rating.toFixed(1),
              hint: "out of 5.0",
              icon: "star",
              accent: colors.status.warning,
              gradDark: ["rgba(245,158,11,0.15)", "rgba(245,158,11,0.06)"] as [string, string, ...string[]],
              gradLight: ["rgba(245,158,11,0.10)", "rgba(245,158,11,0.03)"] as [string, string, ...string[]],
            },
            {
              label: "Distance",
              // Show "—" instead of "0 km" when there's no data yet
              value:
                todayStats.distance === 0 ? "—" : `${todayStats.distance} km`,
              hint: "depot → drops",
              icon: "speedometer-outline",
              accent: "#8B5CF6",
              gradDark: ["rgba(139,92,246,0.15)", "rgba(139,92,246,0.06)"] as [string, string, ...string[]],
              gradLight: ["rgba(139,92,246,0.10)", "rgba(139,92,246,0.03)"] as [string, string, ...string[]],
            },
          ].map((stat, i) => (
            <View
              key={i}
              style={[
                st.statCardOuter,
                {
                  // Soft accent-coloured halo — mirrors activeCard's
                  // shadow recipe (offset 4y, opacity 0.25 dark / 0.12 light,
                  // radius 16). Gives every tile the same lifted feel.
                  shadowColor: stat.accent,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isDark ? 0.25 : 0.12,
                  shadowRadius: 16,
                  elevation: 6,
                },
              ]}
            >
              <View
                style={[
                  st.statCard,
                  {
                    // Neutral card bg + saturated 2px accent border — same
                    // formula as the "Current Delivery" card with gold. The
                    // border carries the colour, the inside stays calm.
                    backgroundColor: colors.background.card,
                    borderColor: stat.accent,
                  },
                ]}
              >
                {/* Top row: label + icon chip */}
                <View style={st.statCardTopRow}>
                  <Text
                    style={[
                      st.statLabel,
                      { color: stat.accent },
                    ]}
                    numberOfLines={1}
                  >
                    {stat.label}
                  </Text>
                  <View
                    style={[
                      st.statIcon,
                      {
                        backgroundColor: stat.accent + (isDark ? "26" : "1F"),
                      },
                    ]}
                  >
                    <Icon name={stat.icon} size={14} color={stat.accent} />
                  </View>
                </View>

                {/* Hero value — bottom-aligned, dominant */}
                <View style={st.statValueWrap}>
                  <Text
                    style={[st.statValue, { color: colors.text.primary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {stat.value}
                  </Text>
                  <Text
                    style={[st.statHint, { color: colors.text.muted }]}
                    numberOfLines={1}
                  >
                    {stat.hint}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Active Delivery Highlight */}
        {activeDelivery && (
          <>
            <View style={st.sectionHeader}>
              <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
                Current Delivery
              </Text>
              <View style={[st.livePill]}>
                <View style={st.liveDot} />
                <Text style={st.liveText}>LIVE</Text>
              </View>
            </View>
            <View
              style={[
                st.activeCard,
                {
                  borderColor: colors.gold.primary,
                  backgroundColor: colors.background.card,
                  shadowColor: colors.gold.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isDark ? 0.25 : 0.12,
                  shadowRadius: 16,
                  elevation: 8,
                },
              ]}
            >
              <View style={st.activeCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.activeOrderNum, { color: colors.text.primary }]}>
                    #{activeDelivery.orderNumber}
                  </Text>
                  <Text style={[st.activeCustomer, { color: colors.text.muted }]}>
                    {activeDelivery.customerName}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[st.activeEarning, { color: colors.gold.primary }]}>
                    {formatRand(activeDelivery.total)}
                  </Text>
                  <View
                    style={[
                      st.statusPill,
                      { backgroundColor: (STATUS_CONFIG[activeDelivery.status] ?? STATUS_CONFIG_FALLBACK).color + "18" },
                    ]}
                  >
                    <Icon
                      name={(STATUS_CONFIG[activeDelivery.status] ?? STATUS_CONFIG_FALLBACK).icon}
                      size={12}
                      color={(STATUS_CONFIG[activeDelivery.status] ?? STATUS_CONFIG_FALLBACK).color}
                    />
                    <Text
                      style={[st.statusText, { color: (STATUS_CONFIG[activeDelivery.status] ?? STATUS_CONFIG_FALLBACK).color }]}
                    >
                      {(STATUS_CONFIG[activeDelivery.status] ?? STATUS_CONFIG_FALLBACK).label}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={st.progressContainer}>
                <View style={st.progressLabels}>
                  <Text style={[st.progressLabel, { color: colors.text.dim }]}>
                    Order Progress
                  </Text>
                  <Text style={[st.progressPercent, { color: colors.gold.primary }]}>
                    {Math.round(PROGRESS_MAP[activeDelivery.status] * 100)}%
                  </Text>
                </View>
                <View
                  style={[
                    st.progressTrack,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.06)",
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[colors.gold.primary, "#F5E6A3", colors.gold.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      st.progressFill,
                      {
                        width: `${PROGRESS_MAP[activeDelivery.status] * 100}%` as any,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={st.activeMetaRow}>
                <View style={st.activeMetaItem}>
                  <Icon name="navigate-outline" size={14} color={colors.gold.muted} />
                  <Text style={[st.activeMetaText, { color: colors.text.primary }]}>
                    {activeDelivery.distance}
                  </Text>
                </View>
                <View style={st.activeMetaItem}>
                  <Icon name="time-outline" size={14} color={colors.gold.muted} />
                  <Text style={[st.activeMetaText, { color: colors.text.primary }]}>
                    {activeDelivery.estimatedTime}
                  </Text>
                </View>
                <View style={st.activeMetaItem}>
                  <Icon name="cube-outline" size={14} color={colors.gold.muted} />
                  <Text style={[st.activeMetaText, { color: colors.text.primary }]}>
                    {activeDelivery.items} items
                  </Text>
                </View>
              </View>

              {/* Navigation Button */}
              {activeDelivery.status === "driver_assigned" && (
                <>
                  {/* Countdown banner for unaccepted assignments */}
                  {!acceptedIds.has(activeDelivery.id) && (
                    <View style={{
                      marginTop: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: expiredAssignmentIds.has(activeDelivery.id)
                        ? "rgba(146,64,14,0.12)"
                        : "rgba(212,175,55,0.1)",
                      borderRadius: 8,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: expiredAssignmentIds.has(activeDelivery.id)
                        ? "rgba(146,64,14,0.3)"
                        : "rgba(212,175,55,0.25)",
                    }}>
                      <Icon
                        name={expiredAssignmentIds.has(activeDelivery.id) ? "alert-circle-outline" : "timer-outline"}
                        size={16}
                        color={expiredAssignmentIds.has(activeDelivery.id) ? "#92400E" : colors.gold.primary}
                      />
                      {expiredAssignmentIds.has(activeDelivery.id) ? (
                        <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "600", flex: 1 }}>
                          Response window expired — accept to confirm you're still proceeding
                        </Text>
                      ) : (
                        <Text style={{ color: colors.gold.primary, fontSize: 12, fontWeight: "600", flex: 1 }}>
                          Accept within{" "}
                          <Text style={{ color: colors.text.primary, fontWeight: "800" }}>
                            {formatCountdown(countdowns[activeDelivery.id] ?? ACCEPTANCE_TIMEOUT_MS / 1000)}
                          </Text>
                        </Text>
                      )}
                    </View>
                  )}
                  <TouchableOpacity
                    style={{ marginTop: 12 }}
                    onPress={
                      acceptedIds.has(activeDelivery.id)
                        ? () => navigation.navigate("DriverDepotPickup", { delivery: activeDelivery })
                        : () => handleAcceptDelivery(activeDelivery.id)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={acceptedIds.has(activeDelivery.id) ? "Go to depot" : "Accept delivery"}
                  >
                    <LinearGradient
                      colors={acceptedIds.has(activeDelivery.id) ? ["#8B5CF6", "#7C3AED"] : [colors.status.success, "#059669"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={st.activeNavBtn}
                    >
                      <Icon
                        name={acceptedIds.has(activeDelivery.id) ? "business-outline" : "checkmark-circle-outline"}
                        size={20}
                        color={colors.white}
                      />
                      <Text style={st.activeNavBtnText}>
                        {acceptedIds.has(activeDelivery.id) ? "Go to Depot" : "Accept Delivery"}
                      </Text>
                      <Icon name="arrow-forward" size={18} color={colors.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
              {activeDelivery.status === "picked_up" && (
                <TouchableOpacity
                  style={{ marginTop: 14 }}
                  onPress={() => {
                    handleUpdateStatus(activeDelivery.id, "en_route");
                    navigation.navigate("DriverNavigation", {
                      delivery: activeDelivery,
                    });
                  }}
                >
                  <LinearGradient
                    colors={["#2563EB", "#1D4ED8"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={st.activeNavBtn}
                  >
                    <Icon name="navigate-outline" size={20} color={colors.white} />
                    <Text style={st.activeNavBtnText}>Navigate to Customer</Text>
                    <Icon name="arrow-forward" size={18} color={colors.white} />
                  </LinearGradient>
                </TouchableOpacity>
              )}
              {activeDelivery.status === "en_route" && (
                <TouchableOpacity
                  style={{ marginTop: 14 }}
                  onPress={() =>
                    navigation.navigate("DriverDeliveryPinVerify", {
                      delivery: { ...activeDelivery, orderId: activeDelivery.id },
                    })
                  }
                >
                  <LinearGradient
                    colors={["#10B981", "#059669"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={st.activeNavBtn}
                  >
                    <Icon name="checkmark-done" size={20} color={colors.white} />
                    <Text style={st.activeNavBtnText}>Confirm Delivered</Text>
                    <Icon name="arrow-forward" size={18} color={colors.white} />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Route Plan CTA — only show when driver actually has stops to plan */}
        {activeDeliveries.length > 0 && (
          <TouchableOpacity
            onPress={() => setRoutePlanOpen(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Open today's route plan"
            style={{ marginHorizontal: spacing.md, marginTop: spacing.md }}
          >
            <LinearGradient
              colors={[...gradients.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: spacing.lg,
                paddingVertical: 14,
                borderRadius: borderRadius.lg,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "rgba(0,0,0,0.18)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="map-outline" size={20} color="#050403" />
                </View>
                <View>
                  <Text
                    style={{
                      color: "#050403",
                      fontWeight: "800",
                      fontSize: 14,
                      letterSpacing: 0.3,
                    }}
                  >
                    Route Plan
                  </Text>
                  <Text style={{ color: "rgba(5,4,3,0.7)", fontSize: 11, marginTop: 2 }}>
                    {activeDeliveries.length}{" "}
                    {activeDeliveries.length === 1 ? "stop" : "stops"} · tap to view map
                  </Text>
                </View>
              </View>
              <Icon name="arrow-forward" size={18} color="#050403" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Active Deliveries */}
        <View style={st.sectionHeader}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Active Deliveries
          </Text>
          {pendingCount > 0 && (
            <View style={[st.pendingBadge, { backgroundColor: colors.status.warning }]}>
              <Text style={st.pendingBadgeText}>{pendingCount} new</Text>
            </View>
          )}
        </View>

        {activeDeliveries.length === 0 ? (
          <View
            style={[
              st.emptyState,
              {
                backgroundColor: colors.background.card,
                borderColor: colors.gold.border,
              },
            ]}
          >
            <Icon
              name="checkmark-done-circle-outline"
              size={48}
              color={colors.gold.muted}
            />
            <Text style={[st.emptyTitle, { color: colors.text.primary }]}>
              All caught up!
            </Text>
            <Text style={[st.emptySubtitle, { color: colors.text.muted }]}>
              No active deliveries right now
            </Text>
          </View>
        ) : (
          activeDeliveries.map((delivery) => {
            const statusConf = STATUS_CONFIG[delivery.status] ?? STATUS_CONFIG_FALLBACK;
            const progress = PROGRESS_MAP[delivery.status] ?? 0;
            return (
              <TouchableOpacity
                key={delivery.id}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("DriverDeliveryDetail", { delivery })
                }
                style={[
                  st.deliveryCard,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                    ...shadows.card,
                  },
                ]}
              >
                <View style={st.deliveryCardInner}>
                  {/* Left status stripe */}
                  <View
                    style={[
                      st.statusStripe,
                      { backgroundColor: statusConf.color },
                    ]}
                  />

                  <View style={st.deliveryContent}>
                    <View style={st.deliveryTop}>
                      <View style={st.deliveryTopLeft}>
                        <Text
                          style={[st.orderNum, { color: colors.text.primary }]}
                        >
                          #{delivery.orderNumber}
                        </Text>
                        <View
                          style={[
                            st.statusPill,
                            { backgroundColor: statusConf.color + "18" },
                          ]}
                        >
                          <Icon
                            name={statusConf.icon}
                            size={12}
                            color={statusConf.color}
                          />
                          <Text
                            style={[st.statusText, { color: statusConf.color }]}
                          >
                            {statusConf.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={[st.timeAgo, { color: colors.text.dim }]}>
                        {delivery.createdAt}
                      </Text>
                    </View>

                    <View style={st.deliveryInfo}>
                      <View style={st.infoRow}>
                        <Icon
                          name="person-outline"
                          size={14}
                          color={colors.gold.muted}
                        />
                        <Text
                          style={[st.infoText, { color: colors.text.primary }]}
                        >
                          {delivery.customerName}
                        </Text>
                      </View>
                      <View style={st.infoRow}>
                        <Icon
                          name="location-outline"
                          size={14}
                          color={colors.gold.muted}
                        />
                        <Text
                          style={[st.infoText, { color: colors.text.muted }]}
                          numberOfLines={1}
                        >
                          {delivery.address}
                        </Text>
                      </View>

                      {/* Prominent distance & ETA */}
                      <View style={st.distanceEtaRow}>
                        <View
                          style={[
                            st.distanceEtaChip,
                            {
                              backgroundColor: isDark
                                ? "rgba(59,130,246,0.12)"
                                : "rgba(59,130,246,0.08)",
                            },
                          ]}
                        >
                          <Icon
                            name="navigate-outline"
                            size={14}
                            color={colors.status.info}
                          />
                          <Text style={st.distanceEtaText}>
                            {delivery.distance}
                          </Text>
                        </View>
                        <View
                          style={[
                            st.distanceEtaChip,
                            {
                              backgroundColor: isDark
                                ? "rgba(139,92,246,0.12)"
                                : "rgba(139,92,246,0.08)",
                            },
                          ]}
                        >
                          <Icon
                            name="time-outline"
                            size={14}
                            color="#8B5CF6"
                          />
                          <Text
                            style={[
                              st.distanceEtaText,
                              { color: "#8B5CF6" },
                            ]}
                          >
                            {delivery.estimatedTime}
                          </Text>
                        </View>
                        <View style={st.metaItem}>
                          <Icon
                            name="cube-outline"
                            size={12}
                            color={colors.text.dim}
                          />
                          <Text style={[st.metaText, { color: colors.text.dim }]}>
                            {delivery.items} items
                          </Text>
                        </View>
                        <Text
                          style={[st.totalText, { color: colors.gold.primary }]}
                        >
                          {formatRand(delivery.total)}
                        </Text>
                      </View>

                      {/* Mini progress bar */}
                      {delivery.status !== "pending" && (
                        <View style={st.miniProgressContainer}>
                          <View
                            style={[
                              st.miniProgressTrack,
                              {
                                backgroundColor: isDark
                                  ? "rgba(255,255,255,0.06)"
                                  : "rgba(0,0,0,0.04)",
                              },
                            ]}
                          >
                            <View
                              style={[
                                st.miniProgressFill,
                                {
                                  width: `${progress * 100}%` as any,
                                  backgroundColor: statusConf.color,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Action buttons */}
                    <View style={st.actionRow}>
                      {delivery.status === "pending" && (
                        <>
                          <TouchableOpacity
                            style={[
                              st.declineBtn,
                              { borderColor: "rgba(239,68,68,0.3)" },
                            ]}
                            onPress={() =>
                              setDismissedIds((prev) => {
                                const next = new Set(prev);
                                next.add(delivery.id);
                                return next;
                              })
                            }
                            accessibilityLabel="Decline delivery"
                            accessibilityRole="button"
                          >
                            <Text
                              style={{
                                color: colors.status.error,
                                fontWeight: "600",
                                fontSize: 14,
                              }}
                            >
                              Decline
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1 }}
                            onPress={() => handleAcceptDelivery(delivery.id)}
                            accessibilityLabel="Accept delivery"
                            accessibilityRole="button"
                          >
                            <LinearGradient
                              colors={[colors.status.success, "#059669"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={st.acceptBtn}
                            >
                              <Icon name="checkmark" size={18} color={colors.white} />
                              <Text style={st.acceptBtnText}>Accept</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </>
                      )}
                      {delivery.status === "driver_assigned" && (
                        <>
                          {/* Countdown / expired banner — only for unaccepted assignments */}
                          {!acceptedIds.has(delivery.id) && (
                            <View
                              style={{
                                backgroundColor: expiredAssignmentIds.has(delivery.id)
                                  ? "#FEF3C7"
                                  : isDark ? "rgba(212,175,55,0.1)" : "rgba(212,175,55,0.08)",
                                borderRadius: 8,
                                paddingVertical: 6,
                                paddingHorizontal: 10,
                                marginBottom: 8,
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                borderWidth: 1,
                                borderColor: expiredAssignmentIds.has(delivery.id)
                                  ? "rgba(146,64,14,0.25)"
                                  : "rgba(212,175,55,0.2)",
                              }}
                            >
                              <Icon
                                name={expiredAssignmentIds.has(delivery.id) ? "alert-circle-outline" : "timer-outline"}
                                size={14}
                                color={expiredAssignmentIds.has(delivery.id) ? "#92400E" : colors.gold.primary}
                              />
                              {expiredAssignmentIds.has(delivery.id) ? (
                                <Text style={{ color: "#92400E", fontSize: 12, fontWeight: "600", flex: 1 }}>
                                  Response window expired — accept to confirm you're still proceeding
                                </Text>
                              ) : (
                                <>
                                  <Text style={{ color: colors.gold.primary, fontSize: 12, fontWeight: "600" }}>
                                    Accept within:
                                  </Text>
                                  <Text style={{ color: colors.text.primary, fontSize: 13, fontWeight: "800", marginLeft: 2 }}>
                                    {formatCountdown(countdowns[delivery.id] ?? ACCEPTANCE_TIMEOUT_MS / 1000)}
                                  </Text>
                                </>
                              )}
                            </View>
                          )}

                          {acceptedIds.has(delivery.id) ? (
                            // Accepted — show Go to Depot
                            <TouchableOpacity
                              style={{ flex: 1 }}
                              onPress={() => navigation.navigate("DriverDepotPickup", { delivery })}
                              accessibilityLabel="Go to depot for pickup"
                              accessibilityRole="button"
                            >
                              <LinearGradient
                                colors={["#8B5CF6", "#7C3AED"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={st.acceptBtn}
                              >
                                <Icon name="business-outline" size={18} color={colors.white} />
                                <Text style={st.acceptBtnText}>Go to Depot</Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          ) : (
                            // Not yet accepted — show Accept button
                            <TouchableOpacity
                              style={{ flex: 1 }}
                              onPress={() => handleAcceptDelivery(delivery.id)}
                              accessibilityLabel="Accept delivery assignment"
                              accessibilityRole="button"
                            >
                              <LinearGradient
                                colors={[colors.status.success, "#059669"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={st.acceptBtn}
                              >
                                <Icon name="checkmark-circle-outline" size={18} color={colors.white} />
                                <Text style={st.acceptBtnText}>Accept Delivery</Text>
                              </LinearGradient>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                      {delivery.status === "picked_up" && (
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => {
                            handleUpdateStatus(delivery.id, "en_route");
                            navigation.navigate("DriverNavigation", { delivery });
                          }}
                        >
                          <LinearGradient
                            colors={["#2563EB", "#1D4ED8"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={st.acceptBtn}
                          >
                            <Icon
                              name="navigate-outline"
                              size={18}
                              color={colors.white}
                            />
                            <Text style={st.acceptBtnText}>Navigate to Customer</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                      {delivery.status === "en_route" && (
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() =>
                            navigation.navigate("DriverDeliveryPinVerify", {
                              delivery: { ...delivery, orderId: delivery.id },
                            })
                          }
                        >
                          <LinearGradient
                            colors={[colors.status.success, "#059669"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={st.acceptBtn}
                          >
                            <Icon name="checkmark-done" size={18} color={colors.white} />
                            <Text style={st.acceptBtnText}>
                              Confirm Delivered
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Quick Actions */}
        <View style={st.sectionHeader}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Quick Actions
          </Text>
        </View>
        <View style={st.quickActions}>
          {[
            {
              icon: "sparkles-outline",
              label: "AI Copilot",
              color: colors.status.warning,
              gradDark: ["rgba(245,158,11,0.14)", "rgba(245,158,11,0.04)"] as [string, string, ...string[]],
              gradLight: ["rgba(245,158,11,0.10)", "rgba(245,158,11,0.02)"] as [string, string, ...string[]],
              onPress: () => navigation.navigate("DriverAIAssistant"),
            },
            {
              icon: "chatbubbles-outline",
              label: "Messages",
              color: colors.status.success,
              gradDark: ["rgba(16,185,129,0.14)", "rgba(16,185,129,0.04)"] as [string, string, ...string[]],
              gradLight: ["rgba(16,185,129,0.10)", "rgba(16,185,129,0.02)"] as [string, string, ...string[]],
              onPress: () => navigation.navigate("DriverChat"),
            },
            {
              icon: "map-outline",
              label: "Navigation",
              color: colors.status.info,
              gradDark: ["rgba(59,130,246,0.14)", "rgba(59,130,246,0.04)"] as [string, string, ...string[]],
              gradLight: ["rgba(59,130,246,0.10)", "rgba(59,130,246,0.02)"] as [string, string, ...string[]],
              onPress: () => navigation.navigate("DriverNavigation", { delivery: activeDelivery }),
            },
            {
              icon: "business-outline",
              label: "Depot Pickup",
              color: "#8B5CF6",
              gradDark: ["rgba(139,92,246,0.14)", "rgba(139,92,246,0.04)"] as [string, string, ...string[]],
              gradLight: ["rgba(139,92,246,0.10)", "rgba(139,92,246,0.02)"] as [string, string, ...string[]],
              onPress: () => navigation.navigate("DriverDepotPickup", { delivery: activeDelivery }),
            },
            {
              icon: "scan-outline",
              label: "Scan & Verify",
              color: colors.status.success,
              gradDark: ["rgba(16,185,129,0.14)", "rgba(16,185,129,0.04)"] as [string, string, ...string[]],
              gradLight: ["rgba(16,185,129,0.10)", "rgba(16,185,129,0.02)"] as [string, string, ...string[]],
              onPress: () => navigation.navigate("DriverScanVerify", { delivery: activeDelivery }),
            },
            {
              icon: "wallet-outline",
              label: "Earnings",
              color: colors.gold.primary,
              gradDark: ["rgba(212,175,55,0.14)", "rgba(212,175,55,0.04)"] as [string, string, ...string[]],
              gradLight: ["rgba(212,175,55,0.10)", "rgba(212,175,55,0.02)"] as [string, string, ...string[]],
              onPress: () => navigation.navigate("DriverEarnings"),
            },
            {
              icon: "shield-checkmark-outline",
              label: "AI Verify",
              color: "#06B6D4",
              gradDark: ["rgba(6,182,212,0.14)", "rgba(6,182,212,0.04)"] as [string, string, ...string[]],
              gradLight: ["rgba(6,182,212,0.10)", "rgba(6,182,212,0.02)"] as [string, string, ...string[]],
              onPress: () => navigation.navigate("DriverAIItemVerify"),
            },
            {
              icon: "camera-outline",
              label: "Photo Proof",
              color: "#EC4899",
              gradDark: ["rgba(236,72,153,0.14)", "rgba(236,72,153,0.04)"] as [string, string, ...string[]],
              gradLight: ["rgba(236,72,153,0.10)", "rgba(236,72,153,0.02)"] as [string, string, ...string[]],
              onPress: () => navigation.navigate("DriverPhotoProof"),
            },
            {
              icon: "flame-outline",
              label: "Heat Map",
              color: colors.status.error,
              gradDark: ["rgba(239,68,68,0.14)", "rgba(239,68,68,0.04)"] as [string, string, ...string[]],
              gradLight: ["rgba(239,68,68,0.10)", "rgba(239,68,68,0.02)"] as [string, string, ...string[]],
              onPress: () => navigation.navigate("DriverHeatMap"),
            },
          ].map((action, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.75}
              onPress={action.onPress}
              style={st.quickActionOuter}
            >
              <LinearGradient
                colors={isDark ? action.gradDark : action.gradLight}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[
                  st.quickAction,
                  {
                    borderColor: action.color + (isDark ? "1A" : "14"),
                  },
                ]}
              >
                <View
                  style={[
                    st.quickActionIcon,
                    { backgroundColor: action.color + "1A" },
                  ]}
                >
                  <Icon name={action.icon} size={24} color={action.color} />
                </View>
                <Text
                  style={[st.quickActionLabel, { color: colors.text.primary }]}
                  numberOfLines={1}
                >
                  {action.label}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[st.signOutBtn, { borderColor: "rgba(239,68,68,0.2)" }]}
          onPress={() => Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Sign Out", style: "destructive", onPress: () => signOut() },
            ]
          )}
          activeOpacity={0.7}
        >
          <Icon name="log-out-outline" size={18} color={colors.status.error} />
          <Text style={{ color: colors.status.error, fontWeight: "600" }}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <DriverRoutePlanModal
        visible={routePlanOpen}
        onClose={() => setRoutePlanOpen(false)}
        orders={activeOrders.filter((o) => o.status !== "delivered")}
      />
    </View>
  );
}

const st = StyleSheet.create({
  /* ── Header ─────────────────────────────── */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerLogo: { width: 36, height: 36 },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", letterSpacing: 2 },
  headerStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },

  /* ── Identity strip: phone · role pill ─── */
  identityStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  identityPhone: {
    fontSize: 11,
    color: "rgba(212,175,55,0.65)",
    letterSpacing: 0.4,
    fontVariant: ["tabular-nums"],
  },
  identitySeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 2,
    opacity: 0.7,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rolePillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  themeToggle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },

  headerRight: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── Online Toggle Bar ──────────────────── */
  onlineBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
  },
  onlineBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  onlineIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  onlineBarTitle: {
    fontSize: 16,
    fontWeight: "700",
  },

  /* ── Stats ──────────────────────────────── */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  statCardOuter: {
    // 2×2 grid: subtract horizontal padding (2 × spacing.md = 32) + one 12 gap,
    // then ÷ 2. Math.floor guards against sub-pixel rounding wrapping to 1-col.
    width: Math.floor((width - spacing.md * 2 - 14) / 2),
    borderRadius: borderRadius.xl,
  },
  statCard: {
    minHeight: 104,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    // Mirrors `activeCard` (Current Delivery) — xl radius + 2px saturated
    // accent border. The border is the only colour signal; the inside is
    // a neutral card surface like the Current Delivery card.
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    justifyContent: "space-between",
  },
  statCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  statValueWrap: {
    marginTop: 12,
  },
  statValue: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 34,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  statHint: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.2,
    marginTop: 3,
    opacity: 0.7,
  },

  /* ── Active Delivery Card ───────────────── */
  activeCard: {
    marginHorizontal: spacing.md,
    marginBottom: 16,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    padding: 18,
  },
  activeCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  activeOrderNum: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  activeCustomer: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 2,
  },
  activeEarning: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  activeMetaRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  activeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  activeMetaText: {
    fontSize: 14,
    fontWeight: "600",
  },
  activeNavBtn: {
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  activeNavBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(239,68,68,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EF4444",
  },
  liveText: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },

  /* ── Progress Bar ───────────────────────── */
  progressContainer: {
    marginTop: 2,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: "800",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },

  /* ── Section Headers ────────────────────── */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    marginTop: 12,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  pendingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.md },
  pendingBadgeText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  /* ── Empty State ────────────────────────── */
  emptyState: {
    marginHorizontal: spacing.md,
    padding: 32,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubtitle: { fontSize: 14 },

  /* ── Delivery Cards ─────────────────────── */
  deliveryCard: {
    marginHorizontal: spacing.md,
    marginBottom: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  deliveryCardInner: {
    flexDirection: "row",
  },
  statusStripe: {
    width: 4,
  },
  deliveryContent: { flex: 1, padding: 16 },
  deliveryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  deliveryTopLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  orderNum: { fontSize: 16, fontWeight: "800" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  timeAgo: { fontSize: 12 },
  deliveryInfo: { gap: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 14, flex: 1 },
  distanceEtaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  distanceEtaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  distanceEtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3B82F6",
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  totalText: {
    fontSize: 20,
    fontWeight: "800",
    marginLeft: "auto",
    letterSpacing: -0.3,
  },

  /* ── Mini Progress ──────────────────────── */
  miniProgressContainer: {
    marginTop: 6,
  },
  miniProgressTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: "hidden",
  },
  miniProgressFill: {
    height: 3,
    borderRadius: 1.5,
  },

  /* ── Action Buttons ─────────────────────── */
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  declineBtn: {
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptBtn: {
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  acceptBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },

  /* ── Quick Actions ──────────────────────── */
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    gap: 10,
  },
  quickActionOuter: {
    // Math.floor + 4px slack: RN rounds sub-pixel widths UP, which can push
    // 3 items + 2 gaps over the parent's inner width by ~1px and wrap to 2 cols.
    width: Math.floor((width - spacing.md * 2 - 24) / 3),
  },
  quickAction: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    gap: 10,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  quickActionLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },

  /* ── Sign Out ───────────────────────────── */
  signOutBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginHorizontal: spacing.md,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
});
