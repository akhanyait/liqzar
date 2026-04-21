import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, borderRadius } from "../../theme";
import { supabase } from "../../lib/supabase";

type Period = "today" | "week" | "month" | "custom";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

interface DailyRevenue {
  day: string;
  revenue: number;
}

interface TopProduct {
  rank: number;
  name: string;
  units: number;
  revenue: number;
}

interface DriverLeaderboardEntry {
  rank: number;
  name: string;
  deliveries: number;
  rating: number;
  earnings: number;
}

function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;

  switch (period) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week": {
      const dayOfWeek = now.getDay();
      from = new Date(now);
      from.setDate(now.getDate() - dayOfWeek);
      from.setHours(0, 0, 0, 0);
      break;
    }
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "custom":
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  return { from: from.toISOString(), to };
}

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getDay()];
}

export default function AdminReports() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark, shadows } = useTheme();
  const [period, setPeriod] = useState<Period>("week");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Revenue data
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [previousRevenue, setPreviousRevenue] = useState(0);
  const [deliveryFeeRevenue, setDeliveryFeeRevenue] = useState(0);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);

  // Metrics
  const [totalOrders, setTotalOrders] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [deliverySuccessRate, setDeliverySuccessRate] = useState(0);
  const [avgDeliveryTime, setAvgDeliveryTime] = useState(0);

  // Lists
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [driverLeaderboard, setDriverLeaderboard] = useState<DriverLeaderboardEntry[]>([]);

  const maxRevenue = dailyRevenue.length > 0
    ? Math.max(...dailyRevenue.map((d) => d.revenue))
    : 1;

  const revenueChangePercent = previousRevenue > 0
    ? (((totalRevenue - previousRevenue) / previousRevenue) * 100)
    : 0;

  const fetchReportData = useCallback(async () => {
    try {
      const { from, to } = getDateRange(period);

      // Calculate previous period range for comparison
      const fromDate = new Date(from);
      const toDate = new Date(to);
      const periodMs = toDate.getTime() - fromDate.getTime();
      const prevFrom = new Date(fromDate.getTime() - periodMs).toISOString();
      const prevTo = from;

      // 1. Fetch completed orders for revenue
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, total, delivery_fee, created_at, status")
        .gte("created_at", from)
        .lte("created_at", to);

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
      }

      const allOrders = orders || [];
      const completedOrders = allOrders.filter(
        (o: any) => o.status === "completed" || o.status === "delivered"
      );

      // Total revenue from completed orders
      const revenue = completedOrders.reduce(
        (sum: number, o: any) => sum + (parseFloat(o.total) || 0),
        0
      );
      setTotalRevenue(revenue);

      // Delivery fee revenue
      const deliveryFees = completedOrders.reduce(
        (sum: number, o: any) => sum + (parseFloat(o.delivery_fee) || 0),
        0
      );
      setDeliveryFeeRevenue(deliveryFees);

      // Total orders count (all statuses)
      setTotalOrders(allOrders.length);

      // Average order value
      const avg = allOrders.length > 0
        ? allOrders.reduce((sum: number, o: any) => sum + (parseFloat(o.total) || 0), 0) / allOrders.length
        : 0;
      setAvgOrderValue(Math.round(avg));

      // 2. Fetch previous period for comparison
      const { data: prevOrders } = await supabase
        .from("orders")
        .select("total, status")
        .gte("created_at", prevFrom)
        .lte("created_at", prevTo);

      const prevCompleted = (prevOrders || []).filter(
        (o: any) => o.status === "completed" || o.status === "delivered"
      );
      const prevRev = prevCompleted.reduce(
        (sum: number, o: any) => sum + (parseFloat(o.total) || 0),
        0
      );
      setPreviousRevenue(prevRev);

      // 3. Build daily revenue chart
      const revenueByDay: Record<string, number> = {};
      completedOrders.forEach((o: any) => {
        const dayKey = getDayLabel(o.created_at);
        revenueByDay[dayKey] = (revenueByDay[dayKey] || 0) + (parseFloat(o.total) || 0);
      });

      const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const dailyData: DailyRevenue[] = dayOrder.map((day) => ({
        day,
        revenue: revenueByDay[day] || 0,
      }));
      setDailyRevenue(dailyData);

      // 4. Fetch top products
      try {
        const { data: orderItems, error: itemsError } = await supabase
          .from("order_items")
          .select("product_id, quantity, unit_price, products(name)")
          .order("quantity", { ascending: false });

        if (!itemsError && orderItems) {
          // Aggregate by product
          const productMap: Record<string, { name: string; units: number; revenue: number }> = {};
          orderItems.forEach((item: any) => {
            const pid = item.product_id;
            const name = item.products?.name || "Unknown Product";
            const qty = item.quantity || 0;
            const rev = qty * (parseFloat(item.unit_price) || 0);
            if (!productMap[pid]) {
              productMap[pid] = { name, units: 0, revenue: 0 };
            }
            productMap[pid].units += qty;
            productMap[pid].revenue += rev;
          });

          const sorted = Object.values(productMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)
            .map((p, i) => ({
              rank: i + 1,
              name: p.name,
              units: p.units,
              revenue: Math.round(p.revenue),
            }));
          setTopProducts(sorted);
        }
      } catch (e) {
        console.error("Error fetching top products:", e);
      }

      // 5. Fetch delivery assignments for metrics and leaderboard
      try {
        const { data: assignments, error: assignError } = await supabase
          .from("delivery_assignments")
          .select("driver_id, status, delivered_at, picked_up_at, created_at, driver_profiles(full_name, rating)")
          .gte("created_at", from)
          .lte("created_at", to);

        if (!assignError && assignments) {
          const totalAssignments = assignments.length;
          const delivered = assignments.filter((a: any) => a.status === "delivered");
          const successRate = totalAssignments > 0
            ? Math.round((delivered.length / totalAssignments) * 100)
            : 0;
          setDeliverySuccessRate(successRate);

          // Average delivery time (delivered_at - picked_up_at or created_at)
          let totalMinutes = 0;
          let countWithTime = 0;
          delivered.forEach((a: any) => {
            const end = a.delivered_at ? new Date(a.delivered_at).getTime() : 0;
            const start = a.picked_up_at
              ? new Date(a.picked_up_at).getTime()
              : new Date(a.created_at).getTime();
            if (end > start) {
              totalMinutes += (end - start) / (1000 * 60);
              countWithTime++;
            }
          });
          setAvgDeliveryTime(countWithTime > 0 ? Math.round(totalMinutes / countWithTime) : 0);

          // Driver leaderboard
          const driverMap: Record<string, { name: string; deliveries: number; rating: number; earnings: number }> = {};
          assignments.forEach((a: any) => {
            const did = a.driver_id;
            if (!did) return;
            const name = a.driver_profiles?.full_name || "Unknown Driver";
            const rating = a.driver_profiles?.rating || 0;
            if (!driverMap[did]) {
              driverMap[did] = { name, deliveries: 0, rating, earnings: 0 };
            }
            if (a.status === "delivered") {
              driverMap[did].deliveries += 1;
            }
          });

          const leaderboard = Object.values(driverMap)
            .filter((d) => d.deliveries > 0)
            .sort((a, b) => b.deliveries - a.deliveries)
            .slice(0, 5)
            .map((d, i) => ({
              rank: i + 1,
              name: d.name,
              deliveries: d.deliveries,
              rating: d.rating || 0,
              earnings: d.earnings,
            }));
          setDriverLeaderboard(leaderboard);
        }
      } catch (e) {
        console.error("Error fetching delivery data:", e);
      }
    } catch (error) {
      console.error("Error fetching report data:", error);
      Alert.alert("Error", "Failed to load report data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchReportData();
  }, [fetchReportData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReportData();
  }, [fetchReportData]);

  const rankColor = (rank: number) => {
    if (rank === 1) return colors.gold.primary;
    if (rank === 2) return "#C0C0C0";
    if (rank === 3) return "#CD7F32";
    return colors.text.dim;
  };

  const formatCurrency = (amount: number) => {
    return `R${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <LinearGradient
          colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 14,
            paddingHorizontal: spacing.md,
          }}
        >
          <View style={st.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={st.backBtn}
            >
              <Icon name="arrow-back" size={22} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Reports
            </Text>
            <View style={{ width: 36 }} />
          </View>
        </LinearGradient>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.gold.primary} />
          <Text style={{ color: colors.text.muted, marginTop: 12, fontSize: 14 }}>
            Loading reports...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 14,
          paddingHorizontal: spacing.md,
        }}
      >
        <View style={st.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={st.backBtn}
          >
            <Icon name="arrow-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: colors.text.primary }]}>
            Reports
          </Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Period Selector */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <View style={st.periodRow}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.key}
                onPress={() => setPeriod(p.key)}
                style={[
                  st.periodTab,
                  {
                    backgroundColor:
                      period === p.key ? colors.gold.primary : colors.background.card,
                    borderColor:
                      period === p.key ? colors.gold.primary : colors.gold.border,
                  },
                ]}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    st.periodTabText,
                    {
                      color: period === p.key ? "#000000" : colors.text.muted,
                    },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Revenue Summary Card */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <LinearGradient
            colors={isDark ? ["#1a1510", "#0f0d09"] : ["#FFFFFF", "#F9F8F5"]}
            style={[
              st.revenueCard,
              { borderColor: colors.gold.border, ...shadows.card },
            ]}
          >
            <Text
              style={{
                fontSize: 13,
                color: colors.gold.muted,
                fontWeight: "600",
                marginBottom: 4,
              }}
            >
              TOTAL REVENUE
            </Text>
            <Text style={[st.bigAmount, { color: colors.gold.primary }]}>
              {formatCurrency(totalRevenue)}
            </Text>
            <View style={st.revenueChangeRow}>
              <View style={[st.changePill, { backgroundColor: revenueChangePercent >= 0 ? colors.status.success + "18" : colors.status.error + "18" }]}>
                <Icon
                  name={revenueChangePercent >= 0 ? "trending-up-outline" : "trending-down-outline"}
                  size={14}
                  color={revenueChangePercent >= 0 ? colors.status.success : colors.status.error}
                />
                <Text
                  style={{ color: revenueChangePercent >= 0 ? colors.status.success : colors.status.error, fontSize: 13, fontWeight: "700" }}
                >
                  {revenueChangePercent >= 0 ? "+" : ""}{revenueChangePercent.toFixed(1)}%
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: colors.text.dim }}>
                vs last period
              </Text>
            </View>
            <View
              style={[
                st.deliveryFeeRow,
                { borderTopColor: colors.gold.border },
              ]}
            >
              <Text style={{ fontSize: 13, color: colors.text.muted }}>
                Delivery Fee Revenue
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: colors.text.primary,
                }}
              >
                {formatCurrency(deliveryFeeRevenue)}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Metrics Grid */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 16 }}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Key Metrics
          </Text>
          <View style={st.metricsGrid}>
            {[
              {
                label: "Orders",
                value: totalOrders.toString(),
                icon: "receipt-outline",
                accent: colors.status.info,
              },
              {
                label: "Avg Order Value",
                value: formatCurrency(avgOrderValue),
                icon: "trending-up-outline",
                accent: colors.status.success,
              },
              {
                label: "Delivery Success",
                value: `${deliverySuccessRate}%`,
                icon: "checkmark-circle-outline",
                accent: "#8B5CF6",
              },
              {
                label: "Avg Delivery Time",
                value: avgDeliveryTime > 0 ? `${avgDeliveryTime} min` : "N/A",
                icon: "time-outline",
                accent: colors.status.warning,
              },
            ].map((metric, i) => (
              <View
                key={i}
                style={[
                  st.metricCard,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                  },
                ]}
              >
                <View
                  style={[
                    st.metricIconWrap,
                    { backgroundColor: metric.accent + "15" },
                  ]}
                >
                  <Icon name={metric.icon} size={18} color={metric.accent} />
                </View>
                <Text style={[st.metricValue, { color: colors.text.primary }]}>
                  {metric.value}
                </Text>
                <Text style={{ fontSize: 11, color: colors.text.dim }}>
                  {metric.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Revenue Chart */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Daily Revenue
          </Text>
          <View style={st.chartContainer}>
            {dailyRevenue.map((day, i) => {
              const barHeight = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
              return (
                <View key={i} style={st.chartBar}>
                  <Text
                    style={{
                      fontSize: 9,
                      color: colors.gold.primary,
                      fontWeight: "700",
                      marginBottom: 4,
                    }}
                  >
                    R{(day.revenue / 1000).toFixed(1)}k
                  </Text>
                  <View
                    style={{
                      width: 20,
                      height: 100,
                      borderRadius: borderRadius.sm,
                      overflow: "hidden",
                      justifyContent: "flex-end",
                      backgroundColor: colors.background.tertiary,
                    }}
                  >
                    <LinearGradient
                      colors={[colors.gold.primary, colors.gold.dark]}
                      style={{
                        width: "100%",
                        borderRadius: borderRadius.sm,
                        height: `${barHeight}%`,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      color: colors.text.dim,
                      marginTop: 4,
                    }}
                  >
                    {day.day}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Top Products */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Top Products
          </Text>
          {topProducts.length === 0 ? (
            <View style={[st.listRow, { backgroundColor: colors.background.card, borderColor: colors.gold.border, justifyContent: "center" }]}>
              <Text style={{ color: colors.text.dim, fontSize: 14 }}>No product data for this period</Text>
            </View>
          ) : (
            topProducts.map((product) => (
              <View
                key={product.rank}
                style={[
                  st.listRow,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                  },
                ]}
              >
                <View
                  style={[
                    st.rankBadge,
                    { backgroundColor: rankColor(product.rank) + "18" },
                  ]}
                >
                  <Text style={[st.rankText, { color: rankColor(product.rank) }]}>
                    {product.rank}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.listItemName, { color: colors.text.primary }]}>
                    {product.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.text.dim }}>
                    {product.units} units sold
                  </Text>
                </View>
                <Text style={[st.listItemValue, { color: colors.gold.primary }]}>
                  {formatCurrency(product.revenue)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Driver Leaderboard */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Driver Leaderboard
          </Text>
          {driverLeaderboard.length === 0 ? (
            <View style={[st.listRow, { backgroundColor: colors.background.card, borderColor: colors.gold.border, justifyContent: "center" }]}>
              <Text style={{ color: colors.text.dim, fontSize: 14 }}>No driver data for this period</Text>
            </View>
          ) : (
            driverLeaderboard.map((driver) => (
              <View
                key={driver.rank}
                style={[
                  st.listRow,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                  },
                ]}
              >
                <View
                  style={[
                    st.rankBadge,
                    { backgroundColor: rankColor(driver.rank) + "18" },
                  ]}
                >
                  <Text style={[st.rankText, { color: rankColor(driver.rank) }]}>
                    {driver.rank}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.listItemName, { color: colors.text.primary }]}>
                    {driver.name}
                  </Text>
                  <View style={st.driverMeta}>
                    <Text style={{ fontSize: 12, color: colors.text.dim }}>
                      {driver.deliveries} deliveries
                    </Text>
                    {driver.rating > 0 && (
                      <View style={st.driverRating}>
                        <Icon name="star" size={11} color={colors.status.warning} />
                        <Text
                          style={{
                            fontSize: 12,
                            color: colors.status.warning,
                            fontWeight: "700",
                          }}
                        >
                          {driver.rating.toFixed(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[st.listItemValue, { color: colors.gold.primary }]}>
                  {formatCurrency(driver.earnings)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  periodRow: {
    flexDirection: "row",
    gap: 8,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
  },
  periodTabText: {
    fontSize: 12,
    fontWeight: "700",
  },
  revenueCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  bigAmount: { fontSize: 42, fontWeight: "900", letterSpacing: -1 },
  revenueChangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  changePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  deliveryFeeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingTop: 14,
    borderTopWidth: 1,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  metricValue: { fontSize: 22, fontWeight: "800", marginBottom: 2 },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
  },
  chartBar: { alignItems: "center", flex: 1 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: { fontSize: 14, fontWeight: "800" },
  listItemName: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  listItemValue: { fontSize: 15, fontWeight: "800" },
  driverMeta: { flexDirection: "row", gap: 10, alignItems: "center" },
  driverRating: { flexDirection: "row", alignItems: "center", gap: 3 },
});
