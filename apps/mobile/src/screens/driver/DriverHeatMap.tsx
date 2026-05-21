import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "../../components/Icon";
import BrandMark from "../../components/BrandMark";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";
import { spacing, borderRadius } from "../../theme";

/* ───────── TYPES ───────── */

interface SurgeZone {
  id: string;
  area: string;
  orderCount: number;
  level: "high" | "medium" | "low";
}

interface TimeBlock {
  id: string;
  label: string;
  isPeak: boolean;
}

const LEGEND = [
  { label: "High Demand", color: "#EF4444" },
  { label: "Medium", color: "#F59E0B" },
  { label: "Low", color: "#10B981" },
];

const TIME_BLOCKS: TimeBlock[] = [
  { id: "t-1", label: "8am", isPeak: false },
  { id: "t-2", label: "9am", isPeak: false },
  { id: "t-3", label: "10am", isPeak: false },
  { id: "t-4", label: "11am", isPeak: true },
  { id: "t-5", label: "12pm", isPeak: true },
  { id: "t-6", label: "1pm", isPeak: true },
  { id: "t-7", label: "2pm", isPeak: false },
  { id: "t-8", label: "3pm", isPeak: false },
  { id: "t-9", label: "4pm", isPeak: false },
  { id: "t-10", label: "5pm", isPeak: true },
  { id: "t-11", label: "6pm", isPeak: true },
  { id: "t-12", label: "7pm", isPeak: true },
  { id: "t-13", label: "8pm", isPeak: true },
  { id: "t-14", label: "9pm", isPeak: false },
];

/* ───────── COMPONENT ───────── */

export default function DriverHeatMap() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [surgeZones, setSurgeZones] = useState<SurgeZone[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);

  useEffect(() => {
    fetchHeatData();
  }, []);

  const fetchHeatData = async () => {
    setLoading(true);
    try {
      // Get recent orders with delivery locations
      const { data: orders } = await supabase
        .from("orders")
        .select("delivery_address")
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        )
        .not("delivery_address", "is", null);

      setTotalOrders(orders?.length || 0);

      // Group by area (extract area from address strings)
      const areaCounts: Record<string, number> = {};
      (orders || []).forEach((order: any) => {
        const addr = order.delivery_address || "";
        // Extract area from address - take the suburb/area portion
        const parts = addr.split(",").map((s: string) => s.trim());
        const area = parts.length > 1 ? parts[parts.length - 2] : parts[0] || "Unknown Area";
        areaCounts[area] = (areaCounts[area] || 0) + 1;
      });

      // Sort by count and determine levels
      const sorted = Object.entries(areaCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

      const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

      const zones: SurgeZone[] = sorted.map(([area, count], i) => ({
        id: `zone-${i}`,
        area,
        orderCount: count,
        level:
          count >= maxCount * 0.7
            ? "high"
            : count >= maxCount * 0.4
              ? "medium"
              : "low",
      }));

      setSurgeZones(zones);
    } catch (error) {
      console.error("Error fetching heat data:", error);
    } finally {
      setLoading(false);
    }
  };

  const surgeColor = (level: string) => {
    if (level === "high") return colors.status.error;
    if (level === "medium") return colors.status.warning;
    return colors.status.success;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
          paddingHorizontal: 16,
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
              Delivery Heat Map
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Map Area */}
        <View style={st.mapContainer}>
          <LinearGradient
            colors={
              isDark
                ? ["#1a2332", "#0f1a28", "#152030"]
                : ["#d4e4f7", "#c5ddf0", "#b8d4eb"]
            }
            style={st.mapGradient}
          >
            {/* Overlay colored zones */}
            {surgeZones.length > 0 && (
              <>
                {surgeZones[0] && (
                  <View style={[st.heatZone, st.zoneHigh]}>
                    <Text style={st.zoneLabel}>High</Text>
                  </View>
                )}
                {surgeZones[1] && (
                  <View style={[st.heatZone, st.zoneMedium]}>
                    <Text style={st.zoneLabel}>Med</Text>
                  </View>
                )}
                {surgeZones[2] && (
                  <View style={[st.heatZone, st.zoneLow]}>
                    <Text style={st.zoneLabel}>Low</Text>
                  </View>
                )}
              </>
            )}

            {/* Map placeholder text */}
            <View style={st.mapCenter}>
              <Icon
                name="map-outline"
                size={32}
                color="rgba(255,255,255,0.3)"
              />
              <Text style={st.mapCenterText}>
                {totalOrders > 0
                  ? `${totalOrders} orders this week`
                  : "No recent orders"}
              </Text>
            </View>

            {/* Current position pin */}
            <View style={st.currentPin}>
              <Icon name="navigate" size={20} color={colors.status.info} />
            </View>
          </LinearGradient>
        </View>

        {/* Legend Row */}
        <View style={[st.legendRow, { paddingHorizontal: 16 }]}>
          {LEGEND.map((item) => (
            <View key={item.label} style={st.legendItem}>
              <View style={[st.legendDot, { backgroundColor: item.color }]} />
              <Text style={{ fontSize: 12, color: colors.text.muted }}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
          <Text
            style={{
              fontSize: 11,
              color: colors.text.dim,
              textAlign: "center",
            }}
          >
            Based on recent order data
          </Text>
        </View>

        {/* Surge Zones */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Demand by Area
          </Text>

          {loading ? (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <ActivityIndicator size="small" color={colors.gold.primary} />
              <Text
                style={{
                  color: colors.text.muted,
                  marginTop: 8,
                  fontSize: 13,
                }}
              >
                Loading demand data...
              </Text>
            </View>
          ) : surgeZones.length > 0 ? (
            surgeZones.map((zone) => (
              <View
                key={zone.id}
                style={[
                  st.surgeCard,
                  {
                    backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                    borderColor: isDark
                      ? "rgba(212,175,55,0.15)"
                      : "rgba(212,175,55,0.25)",
                  },
                ]}
              >
                <View style={st.surgeRow}>
                  <View
                    style={[
                      st.surgeIndicator,
                      { backgroundColor: surgeColor(zone.level) + "20" },
                    ]}
                  >
                    <Icon
                      name="flame"
                      size={20}
                      color={surgeColor(zone.level)}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: colors.text.primary,
                      }}
                    >
                      {zone.area}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.text.muted }}>
                      {zone.orderCount} orders this week
                    </Text>
                  </View>
                  <View
                    style={[
                      st.multiplierBadge,
                      { backgroundColor: surgeColor(zone.level) + "18" },
                    ]}
                  >
                    <Text
                      style={[
                        st.multiplierText,
                        { color: surgeColor(zone.level) },
                      ]}
                    >
                      {zone.orderCount}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Icon
                name="map-outline"
                size={36}
                color={colors.text.dim}
              />
              <Text
                style={{
                  fontSize: 14,
                  color: colors.text.muted,
                  marginTop: 8,
                }}
              >
                No demand data available yet
              </Text>
            </View>
          )}
        </View>

        {/* Peak Hours Today */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Peak Hours Today
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6 }}
          >
            {TIME_BLOCKS.map((block) => (
              <View
                key={block.id}
                style={[
                  st.timeBlock,
                  {
                    backgroundColor: block.isPeak
                      ? "rgba(212,175,55,0.15)"
                      : isDark
                        ? "#1a1510"
                        : "#F5F3EF",
                    borderColor: block.isPeak
                      ? colors.gold.primary
                      : isDark
                        ? "rgba(212,175,55,0.1)"
                        : "rgba(212,175,55,0.2)",
                  },
                ]}
              >
                {block.isPeak && (
                  <Icon
                    name="flame"
                    size={12}
                    color={colors.gold.primary}
                    style={{ marginBottom: 2 }}
                  />
                )}
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: block.isPeak ? "700" : "500",
                    color: block.isPeak
                      ? colors.gold.primary
                      : colors.text.muted,
                  }}
                >
                  {block.label}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Suggestion Card */}
        {surgeZones.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <View
              style={[
                st.suggestionCard,
                {
                  backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                  borderColor: isDark
                    ? "rgba(212,175,55,0.15)"
                    : "rgba(212,175,55,0.25)",
                },
              ]}
            >
              <View style={st.suggestionRow}>
                <View
                  style={[
                    st.suggestionIcon,
                    { backgroundColor: "rgba(59,130,246,0.12)" },
                  ]}
                >
                  <Icon name="compass-outline" size={24} color={colors.status.info} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: colors.text.primary,
                      marginBottom: 4,
                    }}
                  >
                    Suggested Position
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.text.muted }}>
                    Move to {surgeZones[0]?.area || "high demand areas"} for
                    more orders
                  </Text>
                </View>
              </View>

              {/* Orders info */}
              <View
                style={[
                  st.earningsEstimate,
                  {
                    backgroundColor: isDark
                      ? "rgba(212,175,55,0.08)"
                      : "rgba(212,175,55,0.1)",
                  },
                ]}
              >
                <Icon
                  name="trending-up"
                  size={18}
                  color={colors.gold.primary}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.gold.primary,
                    marginLeft: 8,
                  }}
                >
                  {totalOrders} orders in the past 7 days
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ───────── STYLES ───────── */

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
  headerTitle: { fontSize: 18, fontWeight: "800" },

  mapContainer: {
    height: 350,
    marginHorizontal: 16,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    marginTop: 8,
  },
  mapGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  heatZone: {
    position: "absolute",
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  zoneHigh: {
    width: 120,
    height: 120,
    backgroundColor: "rgba(239,68,68,0.25)",
    top: 60,
    right: 40,
  },
  zoneMedium: {
    width: 100,
    height: 100,
    backgroundColor: "rgba(245,158,11,0.25)",
    top: 130,
    left: 30,
  },
  zoneLow: {
    width: 80,
    height: 80,
    backgroundColor: "rgba(16,185,129,0.2)",
    bottom: 50,
    right: 80,
  },
  zoneLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
  },
  mapCenter: {
    alignItems: "center",
    zIndex: 1,
  },
  mapCenterText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  currentPin: {
    position: "absolute",
    bottom: 100,
    left: "45%",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(59,130,246,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 12,
  },
  surgeCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  surgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  surgeIndicator: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  multiplierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  multiplierText: {
    fontSize: 16,
    fontWeight: "900",
  },

  timeBlock: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 50,
  },

  suggestionCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 16,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  suggestionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  earningsEstimate: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: borderRadius.sm,
    marginTop: 14,
  },
});
