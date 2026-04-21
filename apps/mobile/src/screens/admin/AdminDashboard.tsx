import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useOrders } from "../../contexts/OrderContext";
import { spacing, borderRadius } from "../../theme";
import { formatCurrency, formatRand } from "../../utils/currency";

const { width } = Dimensions.get("window");

/** Compute a human-readable relative time string from an ISO timestamp. */
function getRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Pending", color: "#F59E0B", icon: "time-outline" },
  confirmed: {
    label: "Confirmed",
    color: "#3B82F6",
    icon: "checkmark-circle-outline",
  },
  preparing: {
    label: "Preparing",
    color: "#3B82F6",
    icon: "restaurant-outline",
  },
  ready: {
    label: "Ready",
    color: "#06B6D4",
    icon: "bag-check-outline",
  },
  driver_assigned: {
    label: "Driver Assigned",
    color: "#8B5CF6",
    icon: "person-outline",
  },
  picked_up: {
    label: "Picked Up",
    color: "#8B5CF6",
    icon: "bag-check-outline",
  },
  en_route: {
    label: "En Route",
    color: "#3B82F6",
    icon: "bicycle-outline",
  },
  delivered: {
    label: "Delivered",
    color: "#10B981",
    icon: "checkmark-done-outline",
  },
  completed: {
    label: "Completed",
    color: "#10B981",
    icon: "checkmark-done-circle-outline",
  },
  cancelled: {
    label: "Cancelled",
    color: "#EF4444",
    icon: "close-circle-outline",
  },
  refunded: {
    label: "Refunded",
    color: "#EF4444",
    icon: "return-down-back-outline",
  },
};

const QUICK_ACTIONS = [
  {
    icon: "receipt-outline",
    label: "Manage\nOrders",
    color: "#3B82F6",
    screen: "AdminOrders",
  },
  {
    icon: "cube-outline",
    label: "Products",
    color: "#10B981",
    screen: "AdminProductManagement",
  },
  {
    icon: "layers-outline",
    label: "Stock\nControl",
    color: "#F59E0B",
    screen: "AdminStock",
  },
  {
    icon: "car-outline",
    label: "Drivers",
    color: "#8B5CF6",
    screen: "AdminDrivers",
  },
  {
    icon: "bar-chart-outline",
    label: "Reports",
    color: "#EF4444",
    screen: "AdminReports",
  },
  {
    icon: "settings-outline",
    label: "Settings",
    color: "#D4AF37",
    screen: "AdminSettings",
  },
  {
    icon: "people-outline",
    label: "Customers",
    color: "#06B6D4",
    screen: "AdminCustomerManagement",
  },
  {
    icon: "pricetag-outline",
    label: "Promos",
    color: "#EC4899",
    screen: "AdminPromoManagement",
  },
  {
    icon: "map-outline",
    label: "Delivery\nZones",
    color: "#14B8A6",
    screen: "AdminZoneManagement",
  },
];


export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const { colors, isDark, shadows, gradients } = useTheme();
  const { activeOrders, getStatusDisplay, notifications, unreadCount, refreshOrders } = useOrders();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshOrders(); } finally { setRefreshing(false); }
  }, [refreshOrders]);

  // ---- Derived data from activeOrders ----
  const revenue = useMemo(
    () => activeOrders.reduce((sum, o) => sum + (o.total || 0), 0),
    [activeOrders],
  );

  const activeDriverCount = useMemo(() => {
    const ids = new Set<string>();
    activeOrders.forEach((o) => {
      // driver_name is the only driver field available at this level
      if (o.driver_name) ids.add(o.driver_name);
    });
    return ids.size;
  }, [activeOrders]);

  const pendingCount = useMemo(
    () =>
      activeOrders.filter(
        (o) => o.status === "pending" || o.status === "confirmed",
      ).length,
    [activeOrders],
  );

  const stats = [
    {
      label: "Orders Today",
      value: String(activeOrders.length),
      icon: "cart-outline",
      accent: "#3B82F6",
    },
    {
      label: "Revenue",
      value: formatRand(revenue),
      icon: "cash-outline",
      accent: "#10B981",
    },
    {
      label: "Active Drivers",
      value: String(activeDriverCount),
      icon: "car-outline",
      accent: "#8B5CF6",
    },
    {
      label: "Pending",
      value: String(pendingCount),
      icon: "time-outline",
      accent: "#F59E0B",
    },
  ];

  /** Map context orders into the shape the cards expect. */
  const displayOrders = useMemo(
    () =>
      activeOrders.map((order) => {
        const addr = order.delivery_address;
        return {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          customer_name:
            addr?.recipient_name || addr?.name || "Customer",
          total: order.total,
          items_count: 0,
          created_at: getRelativeTime(order.created_at),
          driver_name: order.driver_name || null,
        };
      }),
    [activeOrders],
  );

  const cardColumnWidth = (width - spacing.md * 2 - 10) / 2;
  const actionColumnWidth = (width - spacing.md * 2 - 24) / 3;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#1a1815", "#0f0d09"] : ["#FFFFFF", "#FAFAF8"]}
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 16,
          paddingHorizontal: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: isDark
            ? "rgba(212,175,55,0.12)"
            : "rgba(184,150,46,0.12)",
        }}
      >
        <View style={st.headerRow}>
          <View style={st.headerLeft}>
            <View
              style={[
                st.logoContainer,
                {
                  backgroundColor: colors.gold.faint,
                },
              ]}
            >
              <Image
                source={require("../../../assets/liqzar-logo.png")}
                style={st.headerLogo}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={[st.headerTitle, { color: colors.text.primary }]}>
                LIQZAR Admin
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.gold.muted,
                  marginTop: 1,
                  letterSpacing: 0.3,
                }}
              >
                {user?.full_name || "Administrator"}
              </Text>
            </View>
          </View>
          <View style={st.headerRight}>
            <TouchableOpacity
              style={[
                st.iconBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(212,175,55,0.1)"
                    : "rgba(184,150,46,0.07)",
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(212,175,55,0.15)"
                    : "rgba(184,150,46,0.1)",
                },
              ]}
              onPress={() => navigation.navigate("Notifications")}
            >
              <Icon
                name="notifications-outline"
                size={18}
                color={colors.gold.primary}
              />
              {unreadCount > 0 && (
                <View style={st.notificationBadge}>
                  <Text style={st.notificationBadgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                st.iconBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(212,175,55,0.1)"
                    : "rgba(184,150,46,0.07)",
                  borderWidth: 1,
                  borderColor: isDark
                    ? "rgba(212,175,55,0.15)"
                    : "rgba(184,150,46,0.1)",
                },
              ]}
              onPress={() => navigation.navigate("AdminSettings")}
            >
              <Icon name="menu-outline" size={18} color={colors.gold.primary} />
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
        {/* Stats Row */}
        <View style={st.statsRow}>
          {stats.map((stat, i) => (
              <LinearGradient
                key={i}
                colors={
                  isDark
                    ? [stat.accent + "0A", stat.accent + "04"]
                    : [stat.accent + "08", stat.accent + "03"]
                }
                style={[
                  st.statCard,
                  {
                    width: cardColumnWidth,
                    borderColor: stat.accent + "26",
                    ...shadows.card,
                  },
                ]}
              >
                <View style={st.statTopRow}>
                  <View
                    style={[
                      st.statIconCircle,
                      { backgroundColor: stat.accent + "1A" },
                    ]}
                  >
                    <Icon name={stat.icon} size={18} color={stat.accent} />
                  </View>
                </View>
                <Text style={[st.statValue, { color: colors.text.primary }]}>
                  {stat.value}
                </Text>
                <Text style={[st.statLabel, { color: colors.text.dim }]}>
                  {stat.label}
                </Text>
              </LinearGradient>
          ))}
        </View>

        {/* Section divider */}
        <View
          style={[
            st.sectionDivider,
            {
              backgroundColor: isDark
                ? "rgba(212,175,55,0.10)"
                : "rgba(184,150,46,0.10)",
            },
          ]}
        />

        {/* Live Orders */}
        <View style={st.sectionHeader}>
          <View style={st.sectionTitleRow}>
            <View
              style={[
                st.sectionTitleDot,
                { backgroundColor: colors.gold.primary },
              ]}
            />
            <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
              Live Orders
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("AdminOrders")}
            style={[
              st.seeAllBtn,
              {
                backgroundColor: isDark
                  ? "rgba(212,175,55,0.08)"
                  : "rgba(184,150,46,0.06)",
              },
            ]}
          >
            <Text
              style={{
                color: colors.gold.primary,
                fontWeight: "700",
                fontSize: 12,
                letterSpacing: 0.3,
              }}
            >
              See All
            </Text>
            <Icon
              name="chevron-forward"
              size={14}
              color={colors.gold.primary}
            />
          </TouchableOpacity>
        </View>

        {displayOrders.map((order) => {
          const statusConf =
            STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
          return (
            <TouchableOpacity
              key={order.id}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate("AdminOrderDetail", {
                  orderId: order.id,
                })
              }
              style={[
                st.orderCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: isDark
                    ? "rgba(212,175,55,0.10)"
                    : "rgba(184,150,46,0.10)",
                  ...shadows.card,
                },
              ]}
            >
              {/* Left status strip */}
              <View
                style={[st.statusStrip, { backgroundColor: statusConf.color }]}
              />

              <View style={st.orderContent}>
                <View style={st.orderTopRow}>
                  <View style={st.orderIdRow}>
                    <Text
                      style={[st.orderNumber, { color: colors.text.primary }]}
                    >
                      #{order.order_number}
                    </Text>
                  </View>
                  <View
                    style={[
                      st.statusPill,
                      {
                        backgroundColor: statusConf.color + "18",
                        borderWidth: 1,
                        borderColor: statusConf.color + "20",
                      },
                    ]}
                  >
                    <Icon
                      name={statusConf.icon}
                      size={12}
                      color={statusConf.color}
                    />
                    <Text
                      style={[st.statusPillText, { color: statusConf.color }]}
                    >
                      {statusConf.label}
                    </Text>
                  </View>
                </View>

                <View style={st.orderInfoRow}>
                  <View
                    style={[
                      st.customerAvatar,
                      { backgroundColor: statusConf.color + "15" },
                    ]}
                  >
                    <Icon
                      name="person-outline"
                      size={13}
                      color={statusConf.color}
                    />
                  </View>
                  <Text
                    style={[st.orderInfoText, { color: colors.text.primary }]}
                  >
                    {order.customer_name}
                  </Text>
                </View>

                <View
                  style={[
                    st.orderDivider,
                    {
                      backgroundColor: isDark
                        ? "rgba(212,175,55,0.06)"
                        : "rgba(184,150,46,0.06)",
                    },
                  ]}
                />

                <View style={st.orderMetaRow}>
                  <View style={st.metaItem}>
                    <Icon
                      name="cube-outline"
                      size={12}
                      color={colors.text.dim}
                    />
                    <Text style={[st.metaText, { color: colors.text.dim }]}>
                      {order.items_count} items
                    </Text>
                  </View>
                  <View style={st.metaItem}>
                    <Icon
                      name="time-outline"
                      size={12}
                      color={colors.text.dim}
                    />
                    <Text style={[st.metaText, { color: colors.text.dim }]}>
                      {order.created_at}
                    </Text>
                  </View>
                  {order.driver_name && (
                    <View style={st.metaItem}>
                      <Icon
                        name="bicycle-outline"
                        size={12}
                        color={colors.text.dim}
                      />
                      <Text style={[st.metaText, { color: colors.text.dim }]}>
                        {order.driver_name}
                      </Text>
                    </View>
                  )}
                  <Text style={[st.orderTotal, { color: colors.gold.primary }]}>
                    {formatRand(order.total)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Section divider */}
        <View
          style={[
            st.sectionDivider,
            {
              backgroundColor: isDark
                ? "rgba(212,175,55,0.10)"
                : "rgba(184,150,46,0.10)",
              marginTop: 8,
            },
          ]}
        />

        {/* Quick Actions */}
        <View style={st.sectionHeader}>
          <View style={st.sectionTitleRow}>
            <View
              style={[
                st.sectionTitleDot,
                { backgroundColor: colors.gold.primary },
              ]}
            />
            <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
              Quick Actions
            </Text>
          </View>
        </View>
        <View style={st.quickActions}>
          {QUICK_ACTIONS.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={[
                st.quickAction,
                {
                  width: actionColumnWidth,
                  backgroundColor: colors.background.card,
                  borderColor: isDark
                    ? "rgba(212,175,55,0.08)"
                    : "rgba(184,150,46,0.08)",
                  ...shadows.card,
                },
              ]}
              onPress={() => navigation.navigate(action.screen)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[action.color + "20", action.color + "0A"]}
                style={st.quickActionIcon}
              >
                <Icon name={action.icon} size={24} color={action.color} />
              </LinearGradient>
              <Text
                style={[st.quickActionLabel, { color: colors.text.primary }]}
                numberOfLines={2}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Section divider */}
        <View
          style={[
            st.sectionDivider,
            {
              backgroundColor: isDark
                ? "rgba(212,175,55,0.10)"
                : "rgba(184,150,46,0.10)",
              marginTop: 12,
            },
          ]}
        />

        {/* Sign Out */}
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
          <LinearGradient
            colors={[colors.status.error, "#DC2626"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 56,
              borderRadius: borderRadius.full,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Icon name="log-out-outline" size={20} color={colors.white} />
            <Text style={{ color: colors.white, fontWeight: "700", fontSize: 16 }}>
              Sign Out
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  /* ── Header ─────────────────────────────────────── */
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoContainer: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2,
  },
  headerRight: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#0f0d09",
  },
  notificationBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  /* ── Stats ──────────────────────────────────────── */
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: 10,
  },
  statCard: {
    alignItems: "flex-start",
    padding: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  statTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  changeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  changeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },

  /* ── Section chrome ─────────────────────────────── */
  sectionDivider: {
    height: 1,
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    marginTop: 4,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitleDot: {
    width: 4,
    height: 18,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.xl,
  },

  /* ── Order cards ────────────────────────────────── */
  orderCard: {
    marginHorizontal: spacing.md,
    marginBottom: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  statusStrip: {
    width: 4,
  },
  orderContent: {
    flex: 1,
    padding: 14,
  },
  orderTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  orderIdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  orderInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  customerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  orderInfoText: {
    fontSize: 14,
    fontWeight: "600",
  },
  orderDivider: {
    height: 1,
    marginBottom: 10,
  },
  orderMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: "800",
    marginLeft: "auto",
    letterSpacing: -0.2,
  },

  /* ── Quick Actions ──────────────────────────────── */
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.md,
    gap: 12,
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
  quickActionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 16,
  },

  /* ── Sign Out ───────────────────────────────────── */
  signOutBtn: {
    marginHorizontal: spacing.md,
    marginTop: 24,
    borderRadius: borderRadius.full,
    overflow: "hidden",
  },
});
