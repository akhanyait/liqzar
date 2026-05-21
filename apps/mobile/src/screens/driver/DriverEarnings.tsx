import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../../components/Icon";
import BrandMark from "../../components/BrandMark";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { spacing, borderRadius } from "../../theme";

const { width } = Dimensions.get("window");

interface EarningsDay {
  date: string;
  deliveries: number;
  earnings: number;
  tips: number;
  distance: number;
}

type Period = "week" | "lastweek" | "month";

const getStartDate = (period: Period): string => {
  const now = new Date();
  if (period === "week") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  if (period === "lastweek") {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
    const start = new Date(now);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return start.toISOString();
};

const getEndDate = (period: Period): string | undefined => {
  if (period === "lastweek") {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const end = new Date(now);
    end.setDate(diff);
    end.setHours(0, 0, 0, 0);
    return end.toISOString();
  }
  return undefined;
};

export default function DriverEarnings() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark, gradients, shadows } = useTheme();
  const [period, setPeriod] = useState<Period>("week");
  const [loading, setLoading] = useState(true);
  const [earningsData, setEarningsData] = useState<EarningsDay[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalTips, setTotalTips] = useState(0);
  const [totalDeliveries, setTotalDeliveries] = useState(0);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;

      let query = supabase
        .from("delivery_assignments")
        .select("*, orders(total, created_at), delivery_ratings(tip_amount)")
        .eq("driver_id", userId)
        .eq("status", "delivered")
        .gte("created_at", getStartDate(period))
        .order("created_at", { ascending: false });

      const endDate = getEndDate(period);
      if (endDate) {
        query = query.lt("created_at", endDate);
      }

      const { data: deliveries } = await query;

      // Calculate earnings per day
      const earningsByDay: Record<
        string,
        { deliveries: number; earnings: number; tips: number; date: string }
      > = {};

      (deliveries || []).forEach((d: any) => {
        const dateStr = new Date(d.orders?.created_at || d.created_at);
        const day = dateStr.toLocaleDateString("en-ZA", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
        const deliveryFee = 25; // Base delivery fee per order
        const tip =
          d.delivery_ratings && d.delivery_ratings.length > 0
            ? d.delivery_ratings[0]?.tip_amount || 0
            : 0;
        if (!earningsByDay[day]) {
          earningsByDay[day] = {
            deliveries: 0,
            earnings: 0,
            tips: 0,
            date: day,
          };
        }
        earningsByDay[day].deliveries += 1;
        earningsByDay[day].earnings += deliveryFee;
        earningsByDay[day].tips += tip;
      });

      const earningsArray: EarningsDay[] = Object.values(earningsByDay).map(
        (d) => ({
          date: d.date,
          deliveries: d.deliveries,
          earnings: d.earnings,
          tips: d.tips,
          distance: 0,
        }),
      );

      setEarningsData(earningsArray);
      setTotalEarnings(
        earningsArray.reduce((sum, d) => sum + d.earnings + d.tips, 0),
      );
      setTotalTips(earningsArray.reduce((sum, d) => sum + d.tips, 0));
      setTotalDeliveries(deliveries?.length || 0);
    } catch (error) {
      console.error("Error fetching earnings:", error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const maxEarning = earningsData.length > 0
    ? Math.max(...earningsData.map((d) => d.earnings))
    : 1;

  const periodLabel =
    period === "week"
      ? "THIS WEEK"
      : period === "lastweek"
        ? "LAST WEEK"
        : "THIS MONTH";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
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
          <View style={{ alignItems: "center" }}>
            <BrandMark size="xs" />
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Earnings
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Period Toggle */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: 12 }}>
          <View style={st.periodRow}>
            {(
              [
                { key: "week", label: "This Week" },
                { key: "lastweek", label: "Last Week" },
                { key: "month", label: "This Month" },
              ] as const
            ).map((p) => {
              const isActive = period === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setPeriod(p.key)}
                  style={[
                    st.periodTab,
                    {
                      backgroundColor: isActive
                        ? colors.gold.primary + "18"
                        : "transparent",
                      borderColor: isActive
                        ? colors.gold.primary
                        : colors.gold.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: isActive
                        ? colors.gold.primary
                        : colors.text.muted,
                    }}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Earnings Summary Card */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <LinearGradient
            colors={isDark ? ["#1a1510", "#0f0d09"] : ["#FFFFFF", "#F9F8F5"]}
            style={[
              st.summaryCard,
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
              {periodLabel}
            </Text>
            {loading ? (
              <ActivityIndicator
                size="large"
                color={colors.gold.primary}
                style={{ marginVertical: 20 }}
              />
            ) : (
              <>
                <Text style={[st.bigAmount, { color: colors.gold.primary }]}>
                  R{totalEarnings.toLocaleString()}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.text.dim,
                    marginBottom: 16,
                  }}
                >
                  +R{totalTips} in tips
                </Text>

                <View style={st.summaryStatsRow}>
                  {[
                    {
                      label: "Deliveries",
                      value: `${totalDeliveries}`,
                      icon: "bicycle-outline",
                      accent: colors.status.info,
                    },
                    {
                      label: "Avg/delivery",
                      value:
                        totalDeliveries > 0
                          ? `R${Math.round(totalEarnings / totalDeliveries).toLocaleString("en-ZA")}`
                          : "R0",
                      icon: "trending-up-outline",
                      accent: colors.status.success,
                    },
                  ].map((stat, i) => (
                    <View key={i} style={st.summaryStat}>
                      <View
                        style={[
                          st.summaryStatIcon,
                          { backgroundColor: stat.accent + "15" },
                        ]}
                      >
                        <Icon name={stat.icon} size={16} color={stat.accent} />
                      </View>
                      <Text
                        style={[
                          st.summaryStatValue,
                          { color: colors.text.primary },
                        ]}
                      >
                        {stat.value}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.text.dim }}>
                        {stat.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </LinearGradient>
        </View>

        {!loading && earningsData.length > 0 && (
          <>
            {/* Mini bar chart */}
            <View style={{ paddingHorizontal: spacing.md, marginTop: 16 }}>
              <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
                Daily Breakdown
              </Text>
              <View style={st.chartContainer}>
                {earningsData.map((day, i) => {
                  const barHeight =
                    maxEarning > 0 ? (day.earnings / maxEarning) * 100 : 0;
                  return (
                    <View key={i} style={st.chartBar}>
                      <Text
                        style={{
                          fontSize: 10,
                          color: colors.gold.primary,
                          fontWeight: "700",
                          marginBottom: 4,
                        }}
                      >
                        R{day.earnings}
                      </Text>
                      <View
                        style={[
                          st.barBg,
                          {
                            backgroundColor: colors.background.tertiary,
                          },
                        ]}
                      >
                        <LinearGradient
                          colors={[colors.gold.primary, colors.gold.dark]}
                          style={[
                            st.barFill,
                            { height: `${barHeight}%` },
                          ]}
                        />
                      </View>
                      <Text
                        style={{
                          fontSize: 10,
                          color: colors.text.dim,
                          marginTop: 4,
                        }}
                      >
                        {day.date.split(" ")[0]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Daily list */}
            <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
              <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
                History
              </Text>
              {earningsData.map((day, i) => (
                <View
                  key={i}
                  style={[
                    st.dayRow,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.gold.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[st.dayDate, { color: colors.text.primary }]}
                    >
                      {day.date}
                    </Text>
                    <View style={st.dayMeta}>
                      <Text style={{ fontSize: 12, color: colors.text.dim }}>
                        {day.deliveries} deliveries
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[
                        st.dayEarnings,
                        { color: colors.gold.primary },
                      ]}
                    >
                      R{day.earnings.toLocaleString()}
                    </Text>
                    {day.tips > 0 && (
                      <Text style={{ fontSize: 11, color: colors.status.success }}>
                        +R{day.tips} tips
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {!loading && earningsData.length === 0 && (
          <View
            style={{
              alignItems: "center",
              paddingVertical: 40,
              paddingHorizontal: spacing.md,
            }}
          >
            <Icon
              name="cash-outline"
              size={48}
              color={colors.text.dim}
            />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: colors.text.muted,
                marginTop: 12,
              }}
            >
              No earnings for this period
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: colors.text.dim,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              Complete deliveries to start earning
            </Text>
          </View>
        )}

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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  summaryCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  bigAmount: { fontSize: 42, fontWeight: "900", letterSpacing: -1 },
  summaryStatsRow: { flexDirection: "row", gap: 20 },
  summaryStat: { alignItems: "center" },
  summaryStatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  summaryStatValue: { fontSize: 16, fontWeight: "800", marginBottom: 1 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
  },
  chartBar: { alignItems: "center", flex: 1 },
  barBg: {
    width: 20,
    height: 100,
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: { width: "100%", borderRadius: 10 },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  dayDate: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  dayMeta: { flexDirection: "row", gap: 12 },
  dayEarnings: { fontSize: 17, fontWeight: "800" },
});
