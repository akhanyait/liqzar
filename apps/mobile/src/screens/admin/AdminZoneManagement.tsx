import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "../../components/Icon";
import BrandMark from "../../components/BrandMark";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, borderRadius } from "../../theme";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";

interface Zone {
  id: string;
  name: string;
  radius: number;
  deliveryFee: number;
  activeDrivers: number;
  surgeMultiplier: number;
  surgeEnabled: boolean;
  isActive: boolean;
  minOrder: number;
  estimatedDeliveryTime: string;
  driverPriority: string;
  color: string;
}

interface ZonePerformance {
  zoneName: string;
  orders: number;
  color: string;
}

const ZONE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#F97316"];
const PRIORITY_OPTIONS = ["High", "Medium", "Low"];

export default function AdminZoneManagement() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [zones, setZones] = useState<Zone[]>([]);
  const [zonePerformance, setZonePerformance] = useState<ZonePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
  const [addZoneModalVisible, setAddZoneModalVisible] = useState(false);
  const [calcDistance, setCalcDistance] = useState("");
  const [calcResult, setCalcResult] = useState<string | null>(null);

  // Add Zone form state
  const [formName, setFormName] = useState("");
  const [formRadius, setFormRadius] = useState("");
  const [formDeliveryFee, setFormDeliveryFee] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [formDeliveryTime, setFormDeliveryTime] = useState("");
  const [formPriority, setFormPriority] = useState("Medium");
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

  const fetchZones = useCallback(async () => {
    try {
      const { data: zoneData, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .order("name");

      if (error) {
        console.error("Error fetching zones:", error);
        Alert.alert("Error", "Failed to load delivery zones.");
        return;
      }

      const mappedZones: Zone[] = (zoneData || []).map((z: any, index: number) => ({
        id: z.id,
        name: z.name || "",
        radius: z.radius || z.radius_km || 0,
        deliveryFee: z.delivery_fee || z.base_fee || 0,
        activeDrivers: z.active_drivers || 0,
        surgeMultiplier: z.surge_multiplier || 1.0,
        surgeEnabled: z.surge_enabled || false,
        isActive: z.is_active !== undefined ? z.is_active : true,
        minOrder: z.min_order || z.minimum_order || 0,
        estimatedDeliveryTime: z.estimated_delivery_time || z.delivery_time || "30-45 min",
        driverPriority: z.driver_priority || "Medium",
        color: z.color || ZONE_COLORS[index % ZONE_COLORS.length],
      }));

      setZones(mappedZones);

      // Fetch zone performance from orders
      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: orders } = await supabase
          .from("orders")
          .select("delivery_zone, delivery_zone_id")
          .gte("created_at", startOfMonth.toISOString());

        if (orders) {
          const ordersByZone: Record<string, number> = {};
          orders.forEach((o: any) => {
            const zoneRef = o.delivery_zone_id || o.delivery_zone || "";
            if (zoneRef) {
              ordersByZone[zoneRef] = (ordersByZone[zoneRef] || 0) + 1;
            }
          });

          const perf: ZonePerformance[] = mappedZones.map((z) => ({
            zoneName: z.name,
            orders: ordersByZone[z.id] || ordersByZone[z.name] || 0,
            color: z.color,
          }));
          setZonePerformance(perf);
        } else {
          setZonePerformance(mappedZones.map((z) => ({
            zoneName: z.name,
            orders: 0,
            color: z.color,
          })));
        }
      } catch (e) {
        console.error("Error fetching zone performance:", e);
        setZonePerformance(mappedZones.map((z) => ({
          zoneName: z.name,
          orders: 0,
          color: z.color,
        })));
      }
    } catch (error) {
      console.error("Error fetching zones:", error);
      Alert.alert("Error", "Failed to load delivery zones.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchZones();
  }, [fetchZones]);

  const handleToggleZone = async (id: string) => {
    const zone = zones.find((z) => z.id === id);
    if (!zone) return;

    const newStatus = !zone.isActive;

    // Optimistic update
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, isActive: newStatus } : z)),
    );

    try {
      const { error } = await supabase
        .from("delivery_zones")
        .update({ is_active: newStatus })
        .eq("id", id);

      if (error) {
        console.error("Error toggling zone:", error);
        // Revert
        setZones((prev) =>
          prev.map((z) => (z.id === id ? { ...z, isActive: !newStatus } : z)),
        );
        Alert.alert("Error", "Failed to update zone status.");
      }
    } catch (e) {
      console.error("Error toggling zone:", e);
    }
  };

  const handleToggleSurge = async (id: string) => {
    const zone = zones.find((z) => z.id === id);
    if (!zone) return;

    const newSurge = !zone.surgeEnabled;

    // Optimistic update
    setZones((prev) =>
      prev.map((z) =>
        z.id === id ? { ...z, surgeEnabled: newSurge } : z,
      ),
    );

    try {
      const { error } = await supabase
        .from("delivery_zones")
        .update({ surge_enabled: newSurge })
        .eq("id", id);

      if (error) {
        console.error("Error toggling surge:", error);
        // Revert
        setZones((prev) =>
          prev.map((z) =>
            z.id === id ? { ...z, surgeEnabled: !newSurge } : z,
          ),
        );
      }
    } catch (e) {
      console.error("Error toggling surge:", e);
    }
  };

  const toggleZoneExpanded = (id: string) => {
    setExpandedZoneId((prev) => (prev === id ? null : id));
  };

  const handleCalculateFee = () => {
    const dist = parseFloat(calcDistance);
    if (isNaN(dist) || dist <= 0) {
      setCalcResult(null);
      return;
    }

    // Calculate based on actual zones
    let fee = 0;
    const sortedZones = [...zones].sort((a, b) => a.radius - b.radius);
    for (const zone of sortedZones) {
      if (dist <= zone.radius) {
        fee = zone.deliveryFee;
        break;
      }
      fee = zone.deliveryFee;
    }

    // If beyond all zones, extrapolate
    if (sortedZones.length > 0 && dist > sortedZones[sortedZones.length - 1].radius) {
      const lastZone = sortedZones[sortedZones.length - 1];
      const extraKm = dist - lastZone.radius;
      fee = lastZone.deliveryFee + Math.ceil(extraKm / 5) * 20;
    }

    setCalcResult(`R${fee.toLocaleString('en-ZA')}`);
  };

  const handleAddZone = async () => {
    if (!formName.trim() || !formRadius.trim() || !formDeliveryFee.trim()) {
      Alert.alert(
        "Error",
        "Please fill in the zone name, radius, and delivery fee.",
      );
      return;
    }

    setSaving(true);

    try {
      const zoneData: any = {
        name: formName,
        radius: parseFloat(formRadius) || 0,
        delivery_fee: parseFloat(formDeliveryFee) || 0,
        min_order: parseFloat(formMinOrder) || 100,
        estimated_delivery_time: formDeliveryTime || "30-45 min",
        driver_priority: formPriority,
        surge_multiplier: 1.0,
        surge_enabled: false,
        is_active: true,
        color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
      };

      const { data, error } = await supabase
        .from("delivery_zones")
        .insert(zoneData)
        .select()
        .single();

      if (error) {
        console.error("Error adding zone:", error);
        Alert.alert("Error", "Failed to add zone. " + error.message);
        return;
      }

      resetForm();
      setAddZoneModalVisible(false);
      Alert.alert("Success", `Zone "${formName}" has been added.`);
      fetchZones();
    } catch (e) {
      console.error("Error adding zone:", e);
      Alert.alert("Error", "Failed to add zone.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormRadius("");
    setFormDeliveryFee("");
    setFormMinOrder("");
    setFormDeliveryTime("");
    setFormPriority("Medium");
    setShowPriorityPicker(false);
  };

  const maxOrders = zonePerformance.length > 0
    ? Math.max(...zonePerformance.map((z) => z.orders), 1)
    : 1;

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case "High":
        return colors.status.success;
      case "Medium":
        return colors.status.warning;
      case "Low":
        return colors.status.error;
      default:
        return "#6B7280";
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <LinearGradient
          colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 14,
            paddingHorizontal: 16,
          }}
        >
          <View style={st.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[
                st.headerBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <Icon name="chevron-back" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <BrandMark size="xs" />
              <Text style={[st.headerTitle, { color: colors.text.primary }]}>
                Delivery Zones
              </Text>
            </View>
            <View style={{ width: 38 }} />
          </View>
        </LinearGradient>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.gold.primary} />
          <Text style={{ color: colors.text.muted, marginTop: 12, fontSize: 14 }}>
            Loading zones...
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
          paddingHorizontal: 16,
        }}
      >
        <View style={st.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[
              st.headerBtn,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Icon name="chevron-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <BrandMark size="xs" />
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Delivery Zones
            </Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Mock Map Area */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View
            style={[
              st.mockMap,
              {
                borderColor: colors.gold.faint,
              },
            ]}
          >
            <LinearGradient
              colors={
                isDark
                  ? ["#1a1510", "#0f1628", "#1a1510"]
                  : ["#E8E4DD", "#D6D0C4", "#E8E4DD"]
              }
              style={st.mockMapGradient}
            >
              {/* Zone Circles - Overlapping */}
              <View style={st.mapZonesContainer}>
                {zones.map((zone, index) => {
                  const size = 50 + zone.radius * 5;
                  return (
                    <View
                      key={zone.id}
                      style={[
                        st.mapZoneCircle,
                        {
                          width: size,
                          height: size,
                          borderRadius: size / 2,
                          backgroundColor: zone.color + "20",
                          borderColor: zone.color + "50",
                          left: 30 + index * 35,
                          top: 60 - index * 10,
                          zIndex: zones.length - index,
                        },
                      ]}
                    />
                  );
                })}
                {/* Center Pin */}
                <View style={st.mapCenterPin}>
                  <Icon name="location" size={24} color={colors.gold.primary} />
                </View>
              </View>

              {/* Zone Legend */}
              <View style={st.mapLegend}>
                {zones.map((zone) => (
                  <View key={zone.id} style={st.legendItem}>
                    <View
                      style={[st.legendDot, { backgroundColor: zone.color }]}
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        color: colors.text.muted,
                        fontWeight: "600",
                      }}
                    >
                      {zone.name}
                    </Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Zone List */}
        <View style={st.sectionHeader}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Zones
          </Text>
          <View style={[st.countBadge, { backgroundColor: colors.status.info + "18" }]}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.status.info }}>
              {zones.length}
            </Text>
          </View>
        </View>

        {zones.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Icon name="map-outline" size={48} color={colors.gold.muted} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary, marginTop: 10 }}>
              No delivery zones
            </Text>
            <Text style={{ fontSize: 13, color: colors.text.muted, marginTop: 4 }}>
              Add your first delivery zone below
            </Text>
          </View>
        ) : (
          zones.map((zone) => {
            const isExpanded = expandedZoneId === zone.id;
            const priorityColor = getPriorityColor(zone.driverPriority);
            return (
              <View
                key={zone.id}
                style={[
                  st.zoneCard,
                  {
                    backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                    borderColor: colors.gold.faint,
                  },
                ]}
              >
                {/* Zone Header */}
                <TouchableOpacity
                  onPress={() => toggleZoneExpanded(zone.id)}
                  activeOpacity={0.8}
                >
                  <View style={st.zoneTopRow}>
                    {/* Color Indicator */}
                    <View
                      style={[st.zoneColorBar, { backgroundColor: zone.color }]}
                    />

                    <View style={st.zoneInfo}>
                      <View style={st.zoneNameRow}>
                        <Text
                          style={[st.zoneName, { color: colors.text.primary }]}
                        >
                          {zone.name}
                        </Text>
                        {!zone.isActive && (
                          <View
                            style={[
                              st.inactiveBadge,
                              { backgroundColor: colors.status.error + "18" },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "700",
                                color: colors.status.error,
                              }}
                            >
                              Inactive
                            </Text>
                          </View>
                        )}
                        {zone.surgeEnabled && (
                          <View
                            style={[
                              st.surgeBadge,
                              { backgroundColor: colors.status.warning + "18" },
                            ]}
                          >
                            <Icon name="flash" size={10} color={colors.status.warning} />
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "700",
                                color: colors.status.warning,
                              }}
                            >
                              {zone.surgeMultiplier}x
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={st.zoneDetailsRow}>
                        <View style={st.zoneDetailItem}>
                          <Icon
                            name="locate-outline"
                            size={12}
                            color={colors.text.dim}
                          />
                          <Text style={{ fontSize: 12, color: colors.text.dim }}>
                            {zone.radius}km
                          </Text>
                        </View>
                        <View style={st.zoneDetailItem}>
                          <Icon
                            name="cash-outline"
                            size={12}
                            color={colors.text.dim}
                          />
                          <Text style={{ fontSize: 12, color: colors.text.dim }}>
                            {zone.deliveryFee === 0
                              ? "Free"
                              : `R${zone.deliveryFee.toLocaleString('en-ZA')}`}
                          </Text>
                        </View>
                        <View style={st.zoneDetailItem}>
                          <Icon
                            name="car-outline"
                            size={12}
                            color={colors.text.dim}
                          />
                          <Text style={{ fontSize: 12, color: colors.text.dim }}>
                            {zone.activeDrivers} drivers
                          </Text>
                        </View>
                        <View style={st.zoneDetailItem}>
                          <Icon
                            name="time-outline"
                            size={12}
                            color={colors.text.dim}
                          />
                          <Text style={{ fontSize: 12, color: colors.text.dim }}>
                            {zone.estimatedDeliveryTime}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={{ alignItems: "center", gap: 8 }}>
                      <Switch
                        value={zone.isActive}
                        onValueChange={() => handleToggleZone(zone.id)}
                        trackColor={{
                          false: isDark ? "#333" : "#DDD",
                          true: colors.gold.primary + "60",
                        }}
                        thumbColor={
                          zone.isActive ? colors.gold.primary : isDark ? "#888" : "#CCC"
                        }
                        style={{ transform: [{ scale: 0.8 }] }}
                      />
                      <Icon
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={colors.text.muted}
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded Zone Settings */}
                {isExpanded && (
                  <View style={st.expandedSection}>
                    {/* Zone Settings */}
                    <View
                      style={[
                        st.settingsBox,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.04)"
                            : "rgba(0,0,0,0.03)",
                          borderColor: colors.gold.faint,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: colors.text.primary,
                          marginBottom: 12,
                        }}
                      >
                        Zone Settings
                      </Text>

                      <View style={st.settingsGrid}>
                        <View style={st.settingItem}>
                          <Text
                            style={{
                              fontSize: 11,
                              color: colors.text.dim,
                              textTransform: "uppercase",
                              fontWeight: "600",
                            }}
                          >
                            Min Order
                          </Text>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "800",
                              color: colors.gold.primary,
                              marginTop: 4,
                            }}
                          >
                            R{zone.minOrder}
                          </Text>
                        </View>
                        <View style={st.settingItem}>
                          <Text
                            style={{
                              fontSize: 11,
                              color: colors.text.dim,
                              textTransform: "uppercase",
                              fontWeight: "600",
                            }}
                          >
                            Est. Delivery
                          </Text>
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "800",
                              color: colors.text.primary,
                              marginTop: 4,
                            }}
                          >
                            {zone.estimatedDeliveryTime}
                          </Text>
                        </View>
                        <View style={st.settingItem}>
                          <Text
                            style={{
                              fontSize: 11,
                              color: colors.text.dim,
                              textTransform: "uppercase",
                              fontWeight: "600",
                            }}
                          >
                            Driver Priority
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 4,
                            }}
                          >
                            <View
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: priorityColor,
                              }}
                            />
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "700",
                                color: priorityColor,
                              }}
                            >
                              {zone.driverPriority}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Surge Toggle */}
                      <View style={st.surgeRow}>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color: colors.text.primary,
                            }}
                          >
                            Surge Multiplier
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: colors.text.dim,
                              marginTop: 2,
                            }}
                          >
                            {zone.surgeMultiplier}x pricing during peak hours
                          </Text>
                        </View>
                        <Switch
                          value={zone.surgeEnabled}
                          onValueChange={() => handleToggleSurge(zone.id)}
                          trackColor={{
                            false: isDark ? "#333" : "#DDD",
                            true: colors.status.warning + "60",
                          }}
                          thumbColor={
                            zone.surgeEnabled
                              ? colors.status.warning
                              : isDark
                                ? "#888"
                                : "#CCC"
                          }
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Add New Zone Button */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => {
              resetForm();
              setAddZoneModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[colors.gold.primary, colors.gold.dark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.addZoneBtn}
            >
              <Icon name="add-circle-outline" size={20} color={colors.white} />
              <Text style={st.addZoneBtnText}>Add New Zone</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Delivery Fee Calculator */}
        <View style={st.sectionHeader}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Fee Calculator
          </Text>
        </View>

        <View
          style={[
            st.calcCard,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: colors.gold.faint,
            },
          ]}
        >
          <Text
            style={{ fontSize: 13, color: colors.text.muted, marginBottom: 10 }}
          >
            Enter distance to calculate delivery fee
          </Text>
          <View style={st.calcInputRow}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[
                  st.calcInput,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.04)",
                    borderColor: colors.gold.faint,
                    color: colors.text.primary,
                  },
                ]}
                placeholder="Distance in km"
                placeholderTextColor={colors.text.dim}
                value={calcDistance}
                onChangeText={(text) => {
                  setCalcDistance(text);
                  setCalcResult(null);
                }}
                keyboardType="decimal-pad"
              />
            </View>
            <TouchableOpacity
              onPress={handleCalculateFee}
              style={[st.calcBtn, { backgroundColor: colors.gold.primary }]}
              activeOpacity={0.85}
            >
              <Icon name="calculator-outline" size={18} color={colors.white} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.white }}>
                Calculate
              </Text>
            </TouchableOpacity>
          </View>
          {calcResult !== null && (
            <View
              style={[
                st.calcResultBox,
                {
                  backgroundColor: colors.gold.primary + "10",
                  borderColor: colors.gold.primary + "30",
                },
              ]}
            >
              <Icon name="cash-outline" size={20} color={colors.gold.primary} />
              <Text
                style={{ fontSize: 18, fontWeight: "800", color: colors.gold.primary }}
              >
                {calcResult}
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.muted }}>
                delivery fee for {calcDistance}km
              </Text>
            </View>
          )}
        </View>

        {/* Zone Performance */}
        <View style={st.sectionHeader}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Zone Performance
          </Text>
        </View>

        <View
          style={[
            st.performanceCard,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: colors.gold.faint,
            },
          ]}
        >
          <Text
            style={{ fontSize: 12, color: colors.text.muted, marginBottom: 14 }}
          >
            Orders per zone (this month)
          </Text>
          {zonePerformance.length === 0 ? (
            <Text style={{ fontSize: 13, color: colors.text.dim, textAlign: "center", paddingVertical: 20 }}>
              No performance data available
            </Text>
          ) : (
            zonePerformance.map((perf) => {
              const barWidth =
                maxOrders > 0 ? (perf.orders / maxOrders) * 100 : 0;
              return (
                <View key={perf.zoneName} style={st.perfRow}>
                  <Text
                    style={[st.perfLabel, { color: colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {perf.zoneName}
                  </Text>
                  <View style={st.perfBarContainer}>
                    <View
                      style={[
                        st.perfBarBg,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(0,0,0,0.06)",
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={[perf.color, perf.color + "80"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[st.perfBarFill, { width: `${barWidth}%` }]}
                      />
                    </View>
                  </View>
                  <Text style={[st.perfValue, { color: perf.color }]}>
                    {perf.orders}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Zone Modal */}
      <Modal
        visible={addZoneModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddZoneModalVisible(false)}
      >
        <View
          style={[
            st.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)" },
          ]}
        >
          <View
            style={[
              st.modalContent,
              {
                backgroundColor: colors.background.primary,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: colors.text.primary }]}>
                Add New Zone
              </Text>
              <TouchableOpacity onPress={() => setAddZoneModalVisible(false)}>
                <Icon name="close" size={24} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Zone Name */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Zone Name
              </Text>
              <TextInput
                style={[
                  st.fieldInput,
                  {
                    backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                    borderColor: colors.gold.faint,
                    color: colors.text.primary,
                  },
                ]}
                placeholder="e.g. West Rand"
                placeholderTextColor={colors.text.dim}
                value={formName}
                onChangeText={setFormName}
              />

              {/* Radius */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Radius (km)
              </Text>
              <TextInput
                style={[
                  st.fieldInput,
                  {
                    backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                    borderColor: colors.gold.faint,
                    color: colors.text.primary,
                  },
                ]}
                placeholder="e.g. 15"
                placeholderTextColor={colors.text.dim}
                value={formRadius}
                onChangeText={setFormRadius}
                keyboardType="decimal-pad"
              />

              {/* Delivery Fee */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Base Delivery Fee (R)
              </Text>
              <TextInput
                style={[
                  st.fieldInput,
                  {
                    backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                    borderColor: colors.gold.faint,
                    color: colors.text.primary,
                  },
                ]}
                placeholder="e.g. 35"
                placeholderTextColor={colors.text.dim}
                value={formDeliveryFee}
                onChangeText={setFormDeliveryFee}
                keyboardType="decimal-pad"
              />

              {/* Min Order */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Minimum Order (R)
              </Text>
              <TextInput
                style={[
                  st.fieldInput,
                  {
                    backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                    borderColor: colors.gold.faint,
                    color: colors.text.primary,
                  },
                ]}
                placeholder="e.g. 150"
                placeholderTextColor={colors.text.dim}
                value={formMinOrder}
                onChangeText={setFormMinOrder}
                keyboardType="decimal-pad"
              />

              {/* Estimated Delivery Time */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Estimated Delivery Time
              </Text>
              <TextInput
                style={[
                  st.fieldInput,
                  {
                    backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                    borderColor: colors.gold.faint,
                    color: colors.text.primary,
                  },
                ]}
                placeholder="e.g. 30-45 min"
                placeholderTextColor={colors.text.dim}
                value={formDeliveryTime}
                onChangeText={setFormDeliveryTime}
              />

              {/* Driver Priority Picker */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Driver Allocation Priority
              </Text>
              <TouchableOpacity
                style={[
                  st.fieldInput,
                  st.pickerBtn,
                  {
                    backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                    borderColor: colors.gold.faint,
                  },
                ]}
                onPress={() => setShowPriorityPicker(!showPriorityPicker)}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: getPriorityColor(formPriority),
                    }}
                  />
                  <Text style={{ color: colors.text.primary, fontSize: 15 }}>
                    {formPriority}
                  </Text>
                </View>
                <Icon
                  name={showPriorityPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.text.muted}
                />
              </TouchableOpacity>
              {showPriorityPicker && (
                <View
                  style={[
                    st.pickerList,
                    {
                      backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                      borderColor: isDark
                        ? "rgba(212,175,55,0.15)"
                        : "rgba(212,175,55,0.25)",
                    },
                  ]}
                >
                  {PRIORITY_OPTIONS.map((priority) => {
                    const pColor = getPriorityColor(priority);
                    return (
                      <TouchableOpacity
                        key={priority}
                        style={[
                          st.pickerItem,
                          formPriority === priority && {
                            backgroundColor: pColor + "10",
                          },
                        ]}
                        onPress={() => {
                          setFormPriority(priority);
                          setShowPriorityPicker(false);
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: pColor,
                            }}
                          />
                          <Text
                            style={{
                              color:
                                formPriority === priority
                                  ? pColor
                                  : colors.text.primary,
                              fontSize: 15,
                              fontWeight:
                                formPriority === priority ? "600" : "400",
                            }}
                          >
                            {priority}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleAddZone}
                activeOpacity={0.85}
                style={{ marginTop: 24 }}
                disabled={saving}
              >
                <LinearGradient
                  colors={[colors.gold.primary, colors.gold.dark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[st.saveBtn, saving && { opacity: 0.7 }]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Icon name="checkmark" size={20} color={colors.white} />
                  )}
                  <Text style={st.saveBtnText}>
                    {saving ? "Adding..." : "Add Zone"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                onPress={() => setAddZoneModalVisible(false)}
                style={[
                  st.cancelBtn,
                  {
                    borderColor: colors.gold.faint,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    color: colors.text.muted,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  mockMap: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  mockMapGradient: {
    height: 250,
    justifyContent: "center",
    alignItems: "center",
  },
  mapZonesContainer: {
    flex: 1,
    width: "100%",
    position: "relative",
  },
  mapZoneCircle: {
    position: "absolute",
    borderWidth: 2,
    borderStyle: "dashed",
  },
  mapCenterPin: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -12,
    marginTop: -12,
    zIndex: 10,
  },
  mapLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  zoneCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
  },
  zoneTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  zoneColorBar: {
    width: 4,
    height: 50,
    borderRadius: 2,
    marginRight: 12,
    marginTop: 2,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: "800",
  },
  inactiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  surgeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  zoneDetailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  zoneDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  expandedSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,175,55,0.1)",
    paddingTop: 14,
  },
  settingsBox: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
  },
  settingsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  settingItem: {
    flex: 1,
    alignItems: "center",
  },
  surgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,175,55,0.1)",
  },
  addZoneBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  addZoneBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
  calcCard: {
    marginHorizontal: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
  },
  calcInputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  calcInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 15,
  },
  calcBtn: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  calcResultBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  performanceCard: {
    marginHorizontal: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
  },
  perfRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  perfLabel: {
    width: 100,
    fontSize: 12,
    fontWeight: "600",
  },
  perfBarContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  perfBarBg: {
    height: 20,
    borderRadius: 10,
    overflow: "hidden",
  },
  perfBarFill: {
    height: 20,
    borderRadius: 10,
  },
  perfValue: {
    width: 40,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 15,
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerList: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginTop: 6,
    overflow: "hidden",
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  saveBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
  cancelBtn: {
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginTop: 12,
  },
});
