import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, borderRadius, typography } from "../theme";
import { Icon } from "../components/Icon";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { ordersApi } from "../services/api";
import { useNavigation } from "@react-navigation/native";

interface OrderData {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  estimated_delivery?: string;
  order_items?: any[];
}

type FilterTab = "all" | "active" | "completed" | "cancelled";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const ACTIVE_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "en_route",
];

const STATUS_CONFIG: Record<
  string,
  { color: string; icon: string; label: string }
> = {
  pending: { color: "#D4AF37", icon: "time-outline", label: "Pending" },
  confirmed: {
    color: "#D4AF37",
    icon: "checkmark-outline",
    label: "Confirmed",
  },
  preparing: {
    color: "#F59E0B",
    icon: "restaurant-outline",
    label: "Preparing",
  },
  ready: { color: "#3B82F6", icon: "cube-outline", label: "Ready" },
  en_route: { color: "#3B82F6", icon: "car-outline", label: "En Route" },
  delivered: {
    color: "#10B981",
    icon: "checkmark-circle-outline",
    label: "Delivered",
  },
  cancelled: {
    color: "#EF4444",
    icon: "close-circle-outline",
    label: "Cancelled",
  },
};

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function OrderHistoryScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, gradients, shadows, isDark } = useTheme();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const loadOrders = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await ordersApi.getOrders(user.id);
      setOrders(data || []);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const getStatusConfig = (status: string) => {
    return (
      STATUS_CONFIG[status] || {
        color: colors.text.muted,
        icon: "ellipse-outline",
        label: status,
      }
    );
  };

  const getItemCount = (order: OrderData): number => {
    return order.order_items?.length || 0;
  };

  const filteredOrders = useMemo(() => {
    switch (activeFilter) {
      case "active":
        return orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
      case "completed":
        return orders.filter((o) => o.status === "delivered");
      case "cancelled":
        return orders.filter((o) => o.status === "cancelled");
      default:
        return orders;
    }
  }, [orders, activeFilter]);

  const headerGradientColors: [string, string] = [...gradients.header] as [string, string];

  // ── Filter Tab Bar ────────────────────────────────────────
  const renderFilterTabs = () => (
    <View style={styles.filterContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          const count =
            tab.key === "all"
              ? orders.length
              : tab.key === "active"
                ? orders.filter((o) => ACTIVE_STATUSES.includes(o.status))
                    .length
                : tab.key === "completed"
                  ? orders.filter((o) => o.status === "delivered").length
                  : orders.filter((o) => o.status === "cancelled").length;

          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.7}
              onPress={() => setActiveFilter(tab.key)}
              style={styles.filterTabTouchable}
            >
              {isActive ? (
                <LinearGradient
                  colors={[...gradients.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.filterTab}
                >
                  <Text style={[styles.filterTabText, styles.filterTabTextActive]}>
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View
                      style={[
                        styles.filterTabCount,
                        { backgroundColor: "rgba(255,255,255,0.25)" },
                      ]}
                    >
                      <Text style={[styles.filterTabCountText, { color: colors.white }]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.filterTab,
                    {
                      backgroundColor: isDark
                        ? "rgba(212,175,55,0.06)"
                        : "rgba(184,150,46,0.06)",
                      borderWidth: 1,
                      borderColor: isDark
                        ? "rgba(212,175,55,0.12)"
                        : "rgba(184,150,46,0.12)",
                    },
                  ]}
                >
                  <Text
                    style={[styles.filterTabText, { color: colors.text.muted }]}
                  >
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View
                      style={[
                        styles.filterTabCount,
                        {
                          backgroundColor: isDark
                            ? "rgba(212,175,55,0.10)"
                            : "rgba(184,150,46,0.10)",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterTabCountText,
                          { color: colors.text.dim },
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ── Order Card ────────────────────────────────────────────
  const renderOrder = ({ item }: { item: OrderData }) => {
    const statusConfig = getStatusConfig(item.status);
    const itemCount = getItemCount(item);
    const items = item.order_items || [];

    return (
      <TouchableOpacity
        style={[
          styles.orderCard,
          {
            backgroundColor: colors.background.card,
            borderColor: colors.gold.border,
          },
          shadows.card as any,
        ]}
        onPress={() =>
          navigation.navigate("OrderDetail", { orderId: item.id })
        }
        activeOpacity={0.7}
      >
        {/* Left status color stripe */}
        <View
          style={[
            styles.cardStripe,
            { backgroundColor: statusConfig.color },
          ]}
        />

        <View style={styles.cardContent}>
          {/* Card top row: order number + status pill */}
          <View style={styles.cardTopRow}>
            <View style={styles.orderNumberRow}>
              <View
                style={[
                  styles.orderIconCircle,
                  { backgroundColor: colors.gold.faint },
                ]}
              >
                <Icon
                  name="receipt-outline"
                  size={16}
                  color={colors.gold.primary}
                />
              </View>
              <View>
                <Text
                  style={[styles.orderNumber, { color: colors.text.primary }]}
                >
                  #{item.order_number}
                </Text>
                <Text style={[styles.orderDate, { color: colors.text.dim }]}>
                  {getRelativeTime(item.created_at)}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: statusConfig.color + "18",
                  borderColor: statusConfig.color + "30",
                },
              ]}
            >
              <Icon
                name={statusConfig.icon}
                size={13}
                color={statusConfig.color}
              />
              <Text
                style={[styles.statusPillText, { color: statusConfig.color }]}
              >
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View
            style={[
              styles.cardDivider,
              { backgroundColor: colors.gold.border },
            ]}
          />

          {/* Items preview + total */}
          <View style={styles.cardBottomRow}>
            <View style={styles.itemsPreviewSection}>
              {/* Item thumbnails */}
              {items.length > 0 && (
                <View style={styles.thumbnailRow}>
                  {items.slice(0, 3).map((orderItem: any, index: number) => (
                    <View
                      key={index}
                      style={[
                        styles.thumbnail,
                        {
                          backgroundColor: isDark
                            ? "rgba(212,175,55,0.08)"
                            : "rgba(184,150,46,0.06)",
                          borderColor: colors.gold.border,
                          marginLeft: index > 0 ? -6 : 0,
                          zIndex: 3 - index,
                        },
                      ]}
                    >
                      {orderItem.product?.image_url ||
                      orderItem.image_url ? (
                        <Image
                          source={{
                            uri:
                              orderItem.product?.image_url ||
                              orderItem.image_url,
                          }}
                          style={styles.thumbnailImage}
                        />
                      ) : (
                        <Icon
                          name="wine-outline"
                          size={14}
                          color={colors.gold.muted}
                        />
                      )}
                    </View>
                  ))}
                  {items.length > 3 && (
                    <View
                      style={[
                        styles.thumbnail,
                        styles.thumbnailMore,
                        {
                          backgroundColor: colors.gold.faint,
                          borderColor: colors.gold.border,
                          marginLeft: -6,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.thumbnailMoreText,
                          { color: colors.gold.muted },
                        ]}
                      >
                        +{items.length - 3}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              <Text
                style={[styles.itemCountText, { color: colors.text.muted }]}
              >
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </Text>
            </View>

            <View style={styles.totalSection}>
              <Text style={[styles.totalLabel, { color: colors.text.dim }]}>
                Total
              </Text>
              <Text
                style={[styles.orderTotal, { color: colors.gold.primary }]}
              >
                R{item.total.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            </View>
          </View>

          {/* Footer arrow */}
          <View style={styles.cardFooter}>
            <View style={styles.footerLeft}>
              {item.estimated_delivery && (
                <View style={styles.deliveryRow}>
                  <Icon
                    name="time-outline"
                    size={12}
                    color={colors.text.dim}
                  />
                  <Text
                    style={[styles.deliveryText, { color: colors.text.dim }]}
                  >
                    Est. {item.estimated_delivery}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.viewDetailsRow}>
              <Text
                style={[styles.viewDetails, { color: colors.gold.primary }]}
              >
                View Details
              </Text>
              <Icon
                name="chevron-forward"
                size={16}
                color={colors.gold.primary}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Empty State ───────────────────────────────────────────
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      {/* Decorative rings */}
      <View style={styles.emptyIllustration}>
        <View
          style={[
            styles.emptyRingOuter,
            { borderColor: colors.gold.faint },
          ]}
        >
          <View
            style={[
              styles.emptyRingMiddle,
              {
                borderColor: isDark
                  ? "rgba(212,175,55,0.10)"
                  : "rgba(184,150,46,0.08)",
              },
            ]}
          >
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(212,175,55,0.12)", "rgba(212,175,55,0.04)"]
                  : ["rgba(184,150,46,0.10)", "rgba(184,150,46,0.03)"]
              }
              style={styles.emptyIconCircle}
            >
              <Icon
                name="receipt-outline"
                size={52}
                color={colors.gold.primary}
              />
            </LinearGradient>
          </View>
        </View>
      </View>

      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
        No orders yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.text.muted }]}>
        Your order history will appear here after{"\n"}your first purchase
      </Text>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() =>
          navigation.navigate("MainTabs", { screen: "Catalog" })
        }
      >
        <LinearGradient
          colors={[...gradients.gold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shopButton}
        >
          <Icon name="cart-outline" size={20} color={colors.text.inverse} />
          <Text
            style={[styles.shopButtonText, { color: colors.text.inverse }]}
          >
            Start Shopping
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={[styles.emptyHint, { color: colors.text.dim }]}>
        Browse our curated collection of premium spirits
      </Text>
    </View>
  );

  // ── Loading State ─────────────────────────────────────────
  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background.primary },
        ]}
      >
        <View
          style={[
            styles.loadingIconWrap,
            { backgroundColor: colors.gold.faint },
          ]}
        >
          <ActivityIndicator size="large" color={colors.gold.primary} />
        </View>
        <Text style={[styles.loadingText, { color: colors.text.muted }]}>
          Loading orders...
        </Text>
      </View>
    );
  }

  // ── Main Render ───────────────────────────────────────────
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background.primary },
      ]}
    >
      {/* Premium Header */}
      <LinearGradient
        colors={headerGradientColors}
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
              My Orders
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: colors.text.muted }]}
            >
              Track and manage your orders
            </Text>
          </View>
          {orders.length > 0 && (
            <LinearGradient
              colors={[...gradients.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.orderCountBadge}
            >
              <Text style={styles.orderCountText}>{orders.length}</Text>
            </LinearGradient>
          )}
        </View>
        {/* Gold bottom border */}
        <View
          style={[styles.headerBorder, { backgroundColor: colors.gold.border }]}
        />
      </LinearGradient>

      {/* Filter Tabs */}
      {orders.length > 0 && renderFilterTabs()}

      {/* Order List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredOrders.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: 0,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  orderCountBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  orderCountText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  headerBorder: {
    height: 1,
    width: "100%",
    opacity: 0.6,
  },

  // ── Filter Tabs ─────────────────────────────────────────
  filterContainer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterTabTouchable: {
    // wrapper for touch target
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  filterTabCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  filterTabCountText: {
    fontSize: 11,
    fontWeight: "800",
  },

  // ── Order Card ──────────────────────────────────────────
  orderCard: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
  },
  cardStripe: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: spacing.md,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  orderIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  orderDate: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    gap: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.5,
  },

  // ── Items Preview + Total ────────────────────────────────
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemsPreviewSection: {
    flex: 1,
    gap: 6,
  },
  thumbnailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnail: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  thumbnailImage: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.sm,
  },
  thumbnailMore: {
    // extra styles for the "+N" pill
  },
  thumbnailMoreText: {
    fontSize: 10,
    fontWeight: "800",
  },
  itemCountText: {
    fontSize: 12,
    fontWeight: "500",
  },
  totalSection: {
    alignItems: "flex-end",
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  // ── Card Footer ─────────────────────────────────────────
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  footerLeft: {
    flex: 1,
  },
  deliveryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deliveryText: {
    fontSize: 11,
    fontWeight: "500",
  },
  viewDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewDetails: {
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Empty State ─────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyIllustration: {
    marginBottom: spacing.xl,
  },
  emptyRingOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyRingMiddle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.bodySmall,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  shopButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 15,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  shopButtonText: {
    ...typography.button,
  },
  emptyHint: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: spacing.md,
  },

  // ── Loading State ───────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  loadingText: {
    ...typography.bodySmall,
  },

  // ── List ────────────────────────────────────────────────
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
});
