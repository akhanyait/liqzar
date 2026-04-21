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
import { Icon } from "../../components/Icon";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useOrders } from "../../contexts/OrderContext";
import { spacing, borderRadius, typography } from "../../theme";
import { formatCurrency, formatRand } from "../../utils/currency";
import { useDriverLocationPush } from "../../hooks/useDriverLocationPush";

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
  const { user, signOut } = useAuth();
  const { colors, gradients, shadows, isDark, toggleTheme } = useTheme();
  const {
    activeOrders,
    acceptDelivery,
    markPickedUp,
    markEnRoute,
    markDelivered,
    refreshOrders,
  } = useOrders();

  const [isOnline, setIsOnline] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  /** Tracks which driver_assigned orders this driver has explicitly accepted this session */
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  /** Seconds remaining per assignment id — updated every second */
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  const ACCEPTANCE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const [expiredAssignmentIds, setExpiredAssignmentIds] = useState<Set<string>>(new Set());

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
    return activeOrders
      .filter((o) => !dismissedIds.has(o.id))
      .map((o) => {
        const addr = o.delivery_address;
        const addressStr =
          typeof addr === "string"
            ? addr
            : addr?.formatted_address || addr?.address || "No address";
        const customerName =
          addr?.recipient_name || addr?.name || "Customer";
        const customerPhone = addr?.phone || addr?.recipient_phone || "";

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
          distance: "--",
          estimatedTime: o.eta_minutes ? `${o.eta_minutes} min` : "--",
          items: 0,
          total: o.total || 0,
          status: o.status as Delivery["status"],
          createdAt,
          // [DEF-015] Use driver_assigned_at (set only at assignment time) instead of
          // updated_at (resets on every column mutation e.g. payment EF write),
          // so the countdown timer reflects the real acceptance window.
          assignedAtISO: (o as any).driver_assigned_at ?? (o as any).updated_at ?? o.created_at,
        };
      });
  }, [activeOrders, dismissedIds]);

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

  const todayStats = useMemo(() => {
    const delivered = activeOrders.filter((o) => o.status === "delivered");
    const earnings = delivered.reduce((sum, o) => sum + (o.total || 0), 0);
    return {
      completed: delivered.length,
      earnings,
      rating: 4.9,
      distance: 0,
    };
  }, [activeOrders]);

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

  const activeDelivery = deliveries.find(
    (d) => d.status === "driver_assigned" || d.status === "picked_up" || d.status === "en_route",
  );

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
                <Text style={[st.headerTitle, { color: colors.text.primary }]}>
                  LIQZAR Driver
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
              <Text style={{ fontSize: 11, color: colors.gold.muted }}>
                {user?.full_name || "Driver"}
              </Text>
            </View>
          </View>
          <View style={st.headerRight}>
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
        <View style={st.statsRow}>
          {[
            {
              label: "Deliveries",
              value: `${todayStats.completed}`,
              icon: "bicycle-outline",
              accent: colors.status.info,
              gradDark: ["rgba(59,130,246,0.12)", "rgba(59,130,246,0.04)"] as string[],
              gradLight: ["rgba(59,130,246,0.08)", "rgba(59,130,246,0.02)"] as string[],
            },
            {
              label: "Earned",
              value: formatRand(todayStats.earnings),
              icon: "cash-outline",
              accent: colors.status.success,
              gradDark: ["rgba(16,185,129,0.12)", "rgba(16,185,129,0.04)"] as string[],
              gradLight: ["rgba(16,185,129,0.08)", "rgba(16,185,129,0.02)"] as string[],
            },
            {
              label: "Rating",
              value: `${todayStats.rating}`,
              icon: "star-outline",
              accent: colors.status.warning,
              gradDark: ["rgba(245,158,11,0.12)", "rgba(245,158,11,0.04)"] as string[],
              gradLight: ["rgba(245,158,11,0.08)", "rgba(245,158,11,0.02)"] as string[],
            },
            {
              label: "Distance",
              value: `${todayStats.distance}km`,
              icon: "speedometer-outline",
              accent: "#8B5CF6",
              gradDark: ["rgba(139,92,246,0.12)", "rgba(139,92,246,0.04)"] as string[],
              gradLight: ["rgba(139,92,246,0.08)", "rgba(139,92,246,0.02)"] as string[],
            },
          ].map((stat, i) => (
            <View
              key={i}
              style={[
                st.statCardOuter,
                {
                  shadowColor: stat.accent,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.15 : 0.08,
                  shadowRadius: 8,
                  elevation: 3,
                },
              ]}
            >
              <LinearGradient
                colors={isDark ? stat.gradDark : stat.gradLight}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[
                  st.statCard,
                  {
                    borderColor: stat.accent + (isDark ? "20" : "18"),
                  },
                ]}
              >
                <View
                  style={[st.statIcon, { backgroundColor: stat.accent + "20" }]}
                >
                  <Icon name={stat.icon} size={18} color={stat.accent} />
                </View>
                <Text style={[st.statValue, { color: colors.text.primary }]}>
                  {stat.value}
                </Text>
                <Text style={[st.statLabel, { color: colors.text.dim }]}>
                  {stat.label}
                </Text>
              </LinearGradient>
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
              gradDark: ["rgba(245,158,11,0.14)", "rgba(245,158,11,0.04)"] as string[],
              gradLight: ["rgba(245,158,11,0.10)", "rgba(245,158,11,0.02)"] as string[],
              onPress: () => navigation.navigate("DriverAIAssistant"),
            },
            {
              icon: "chatbubbles-outline",
              label: "Messages",
              color: colors.status.success,
              gradDark: ["rgba(16,185,129,0.14)", "rgba(16,185,129,0.04)"] as string[],
              gradLight: ["rgba(16,185,129,0.10)", "rgba(16,185,129,0.02)"] as string[],
              onPress: () => navigation.navigate("DriverChat"),
            },
            {
              icon: "map-outline",
              label: "Navigation",
              color: colors.status.info,
              gradDark: ["rgba(59,130,246,0.14)", "rgba(59,130,246,0.04)"] as string[],
              gradLight: ["rgba(59,130,246,0.10)", "rgba(59,130,246,0.02)"] as string[],
              onPress: () => navigation.navigate("DriverNavigation", { delivery: activeDelivery }),
            },
            {
              icon: "business-outline",
              label: "Depot Pickup",
              color: "#8B5CF6",
              gradDark: ["rgba(139,92,246,0.14)", "rgba(139,92,246,0.04)"] as string[],
              gradLight: ["rgba(139,92,246,0.10)", "rgba(139,92,246,0.02)"] as string[],
              onPress: () => navigation.navigate("DriverDepotPickup", { delivery: activeDelivery }),
            },
            {
              icon: "scan-outline",
              label: "Scan & Verify",
              color: colors.status.success,
              gradDark: ["rgba(16,185,129,0.14)", "rgba(16,185,129,0.04)"] as string[],
              gradLight: ["rgba(16,185,129,0.10)", "rgba(16,185,129,0.02)"] as string[],
              onPress: () => navigation.navigate("DriverScanVerify", { delivery: activeDelivery }),
            },
            {
              icon: "wallet-outline",
              label: "Earnings",
              color: colors.gold.primary,
              gradDark: ["rgba(212,175,55,0.14)", "rgba(212,175,55,0.04)"] as string[],
              gradLight: ["rgba(212,175,55,0.10)", "rgba(212,175,55,0.02)"] as string[],
              onPress: () => navigation.navigate("DriverEarnings"),
            },
            {
              icon: "shield-checkmark-outline",
              label: "AI Verify",
              color: "#06B6D4",
              gradDark: ["rgba(6,182,212,0.14)", "rgba(6,182,212,0.04)"] as string[],
              gradLight: ["rgba(6,182,212,0.10)", "rgba(6,182,212,0.02)"] as string[],
              onPress: () => navigation.navigate("DriverAIItemVerify"),
            },
            {
              icon: "camera-outline",
              label: "Photo Proof",
              color: "#EC4899",
              gradDark: ["rgba(236,72,153,0.14)", "rgba(236,72,153,0.04)"] as string[],
              gradLight: ["rgba(236,72,153,0.10)", "rgba(236,72,153,0.02)"] as string[],
              onPress: () => navigation.navigate("DriverPhotoProof"),
            },
            {
              icon: "flame-outline",
              label: "Heat Map",
              color: colors.status.error,
              gradDark: ["rgba(239,68,68,0.14)", "rgba(239,68,68,0.04)"] as string[],
              gradLight: ["rgba(239,68,68,0.10)", "rgba(239,68,68,0.02)"] as string[],
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
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  statCardOuter: {
    flex: 1,
    borderRadius: borderRadius.lg,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  statLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },

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
    width: (width - spacing.md * 2 - 20) / 3,
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
