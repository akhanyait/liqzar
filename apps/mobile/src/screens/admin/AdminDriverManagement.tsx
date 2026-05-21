import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
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

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  rating: number;
  total_deliveries: number;
  is_verified: boolean;
  is_active: boolean;
  is_online: boolean;
  vehicle: {
    type: string;
    make: string;
    model: string;
    license_plate: string;
    color: string;
  };
}

type FilterTab = "All" | "Active" | "Verified" | "Unverified";

const FILTER_TABS: FilterTab[] = ["All", "Active", "Verified", "Unverified"];

const getVehicleIcon = (type: string): string => {
  switch (type) {
    case "car":
      return "car-outline";
    case "motorcycle":
      return "bicycle-outline";
    case "scooter":
      return "bicycle-outline";
    default:
      return "car-outline";
  }
};

export default function AdminDriverManagement() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark, shadows } = useTheme();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [refreshing, setRefreshing] = useState(false);

  const fetchDrivers = useCallback(async () => {
    try {
      let query = supabase
        .from('driver_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching drivers:', error);
        Alert.alert('Error', 'Failed to load drivers');
        return;
      }

      const mapped: Driver[] = (data || []).map((d: any) => ({
        id: d.user_id || d.id,
        full_name: d.full_name || 'Unknown',
        phone: d.phone || '',
        rating: d.rating || 0,
        total_deliveries: d.total_deliveries || 0,
        is_verified: d.is_verified ?? false,
        is_active: d.status === 'active' || d.is_active === true,
        is_online: d.is_online ?? false,
        vehicle: d.vehicle || {
          type: d.vehicle_type || 'car',
          make: d.vehicle_make || '',
          model: d.vehicle_model || '',
          license_plate: d.license_plate || '',
          color: d.vehicle_color || '',
        },
      }));

      setDrivers(mapped);
    } catch (err) {
      console.error('Error fetching drivers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const filteredDrivers = drivers.filter((d) => {
    switch (activeTab) {
      case "Active":
        return d.is_active;
      case "Verified":
        return d.is_verified;
      case "Unverified":
        return !d.is_verified;
      default:
        return true;
    }
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDrivers();
    setRefreshing(false);
  }, [fetchDrivers]);

  const handleVerify = (id: string) => {
    Alert.alert(
      "Verify Driver",
      "Are you sure you want to verify this driver?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Verify",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('driver_profiles')
                .update({ is_verified: true })
                .eq('user_id', id);

              if (error) {
                // Try with id column
                const { error: err2 } = await supabase
                  .from('driver_profiles')
                  .update({ is_verified: true })
                  .eq('id', id);

                if (err2) {
                  console.error('Error verifying driver:', err2);
                  Alert.alert('Error', 'Failed to verify driver');
                  return;
                }
              }

              Alert.alert('Success', 'Driver verified successfully');
              fetchDrivers();
            } catch (err) {
              console.error('Error:', err);
              Alert.alert('Error', 'Something went wrong');
            }
          },
        },
      ],
    );
  };

  const handleDeactivate = (id: string) => {
    const driver = drivers.find((d) => d.id === id);
    const isActive = driver?.is_active ?? true;
    Alert.alert(
      isActive ? "Deactivate Driver" : "Activate Driver",
      `Are you sure you want to ${isActive ? "deactivate" : "activate"} this driver?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isActive ? "Deactivate" : "Activate",
          style: isActive ? "destructive" : "default",
          onPress: async () => {
            try {
              const newStatus = isActive ? 'inactive' : 'active';
              const { error } = await supabase
                .from('driver_profiles')
                .update({ status: newStatus })
                .eq('user_id', id);

              if (error) {
                const { error: err2 } = await supabase
                  .from('driver_profiles')
                  .update({ status: newStatus })
                  .eq('id', id);

                if (err2) {
                  console.error('Error updating driver:', err2);
                  Alert.alert('Error', 'Failed to update driver status');
                  return;
                }
              }

              Alert.alert('Success', `Driver ${isActive ? 'deactivated' : 'activated'} successfully`);
              fetchDrivers();
            } catch (err) {
              console.error('Error:', err);
              Alert.alert('Error', 'Something went wrong');
            }
          },
        },
      ],
    );
  };

  const handleViewDetails = (driver: Driver) => {
    Alert.alert(
      driver.full_name,
      `Phone: ${driver.phone}\nRating: ${driver.rating}\nDeliveries: ${driver.total_deliveries}\nVehicle: ${driver.vehicle.color} ${driver.vehicle.make} ${driver.vehicle.model}\nPlate: ${driver.vehicle.license_plate}\nVerified: ${driver.is_verified ? "Yes" : "No"}\nActive: ${driver.is_active ? "Yes" : "No"}`,
    );
  };

  const getTabCount = (tab: FilterTab): number => {
    switch (tab) {
      case "Active":
        return drivers.filter((d) => d.is_active).length;
      case "Verified":
        return drivers.filter((d) => d.is_verified).length;
      case "Unverified":
        return drivers.filter((d) => !d.is_verified).length;
      default:
        return drivers.length;
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={{ color: colors.text.muted, marginTop: 12 }}>Loading drivers...</Text>
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
          paddingBottom: 16,
          paddingHorizontal: spacing.md,
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
              Drivers
            </Text>
          </View>
          <View style={{ width: 38 }} />
        </View>

        {/* Filter Tabs */}
        <View style={st.tabRow}>
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab;
            const count = getTabCount(tab);
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={[
                  st.tabBtn,
                  {
                    backgroundColor: isActive
                      ? colors.gold.primary + "20"
                      : isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                    borderColor: isActive ? colors.gold.primary : "transparent",
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    st.tabBtnText,
                    {
                      color: isActive ? colors.gold.primary : colors.text.muted,
                    },
                  ]}
                >
                  {tab}
                </Text>
                <View
                  style={[
                    st.tabBadge,
                    {
                      backgroundColor: isActive
                        ? colors.gold.primary
                        : isDark
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(0,0,0,0.08)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      st.tabBadgeText,
                      {
                        color: isActive ? colors.white : colors.text.dim,
                      },
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.primary}
            colors={[colors.gold.primary]}
          />
        }
        contentContainerStyle={{ paddingTop: spacing.md }}
      >
        {/* Driver Cards */}
        {filteredDrivers.map((driver) => (
          <View
            key={driver.id}
            style={[
              st.driverCard,
              {
                backgroundColor: colors.background.card,
                borderColor: colors.gold.border,
                ...shadows.card,
              },
            ]}
          >
            {/* Top Row: Avatar + Info */}
            <View style={st.driverTopRow}>
              {/* Avatar */}
              <View style={st.avatarWrapper}>
                <LinearGradient
                  colors={[colors.gold.primary, colors.gold.dark]}
                  style={st.avatarGradient}
                >
                    <Icon name="person-outline" size={24} color={colors.white} />
                </LinearGradient>
                {/* Online Indicator */}
                <View
                  style={[
                    st.onlineDot,
                    {
                      backgroundColor: driver.is_online ? colors.status.success : "#6B7280",
                      borderColor: colors.background.card,
                    },
                  ]}
                />
              </View>

              {/* Driver Info */}
              <View style={st.driverInfo}>
                <View style={st.nameRow}>
                  <Text
                    style={[st.driverName, { color: colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {driver.full_name}
                  </Text>
                  {/* Verification Badge */}
                  {driver.is_verified ? (
                    <View
                      style={[
                        st.verifyBadge,
                        { backgroundColor: colors.status.success + "18" },
                      ]}
                    >
                      <Icon name="checkmark-circle" size={12} color={colors.status.success} />
                      <Text style={[st.verifyBadgeText, { color: colors.status.success }]}>
                        Verified
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        st.verifyBadge,
                        { backgroundColor: colors.status.warning + "18" },
                      ]}
                    >
                      <Icon name="alert-circle" size={12} color={colors.status.warning} />
                      <Text style={[st.verifyBadgeText, { color: colors.status.warning }]}>
                        Unverified
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[st.driverPhone, { color: colors.text.muted }]}>
                  {driver.phone}
                </Text>

                {/* Stats Row */}
                <View style={st.driverStatsRow}>
                  <View style={st.driverStatItem}>
                    <Icon name="star" size={14} color={colors.status.warning} />
                    <Text style={[st.driverStatText, { color: colors.status.warning }]}>
                      {driver.rating}
                    </Text>
                  </View>
                  <View
                    style={[
                      st.statSeparator,
                      { backgroundColor: colors.gold.border },
                    ]}
                  />
                  <View style={st.driverStatItem}>
                    <Icon
                      name="bicycle-outline"
                      size={14}
                      color={colors.text.dim}
                    />
                    <Text
                      style={[st.driverStatText, { color: colors.text.dim }]}
                    >
                      {driver.total_deliveries} deliveries
                    </Text>
                  </View>
                  <View
                    style={[
                      st.statSeparator,
                      { backgroundColor: colors.gold.border },
                    ]}
                  />
                  <View
                    style={[
                      st.statusPill,
                      {
                        backgroundColor:
                          (driver.is_active ? colors.status.success : colors.status.error) + "18",
                      },
                    ]}
                  >
                    <View
                      style={[
                        st.statusDotSmall,
                        {
                          backgroundColor: driver.is_active
                            ? colors.status.success
                            : colors.status.error,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        st.statusPillText,
                        {
                          color: driver.is_active ? colors.status.success : colors.status.error,
                        },
                      ]}
                    >
                      {driver.is_active ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Vehicle Info */}
            <View
              style={[
                st.vehicleRow,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.03)",
                  borderColor: colors.gold.border,
                },
              ]}
            >
              <View style={st.vehicleLeft}>
                <View
                  style={[
                    st.vehicleIconCircle,
                    { backgroundColor: "#8B5CF6" + "15" },
                  ]}
                >
                  <Icon
                    name={getVehicleIcon(driver.vehicle.type)}
                    size={16}
                    color="#8B5CF6"
                  />
                </View>
                <View>
                  <Text
                    style={[st.vehicleName, { color: colors.text.primary }]}
                  >
                    {driver.vehicle.color} {driver.vehicle.make}{" "}
                    {driver.vehicle.model}
                  </Text>
                  <Text style={[st.vehiclePlate, { color: colors.text.dim }]}>
                    {driver.vehicle.license_plate}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  st.vehicleTypeBadge,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.06)",
                  },
                ]}
              >
                <Text
                  style={[st.vehicleTypeText, { color: colors.text.muted }]}
                >
                  {driver.vehicle.type.charAt(0).toUpperCase() +
                    driver.vehicle.type.slice(1)}
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={st.actionRow}>
              {!driver.is_verified && (
                <TouchableOpacity
                  onPress={() => handleVerify(driver.id)}
                  activeOpacity={0.85}
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={[colors.status.success, "#059669"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={st.actionBtnGradient}
                  >
                    <Icon
                      name="checkmark-circle-outline"
                      size={16}
                      color={colors.white}
                    />
                    <Text style={st.actionBtnGradientText}>Verify</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => handleDeactivate(driver.id)}
                style={[st.actionBtnOutline, { borderColor: colors.status.error + "40" }]}
                activeOpacity={0.7}
              >
                <Icon
                  name={
                    driver.is_active
                      ? "close-circle-outline"
                      : "checkmark-circle-outline"
                  }
                  size={16}
                  color={colors.status.error}
                />
                <Text style={[st.actionBtnOutlineText, { color: colors.status.error }]}>
                  {driver.is_active ? "Deactivate" : "Activate"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleViewDetails(driver)}
                style={[st.actionBtnOutline, { borderColor: colors.gold.primary + "40" }]}
                activeOpacity={0.7}
              >
                <Icon name="eye-outline" size={16} color={colors.gold.primary} />
                <Text style={[st.actionBtnOutlineText, { color: colors.gold.primary }]}>
                  Details
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {filteredDrivers.length === 0 && (
          <View style={st.emptyState}>
            <Icon name="people-outline" size={48} color={colors.gold.muted} />
            <Text style={[st.emptyTitle, { color: colors.text.primary }]}>
              No drivers found
            </Text>
            <Text style={[st.emptySubtitle, { color: colors.text.muted }]}>
              No drivers match the selected filter
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", letterSpacing: 0.5 },
  tabRow: { flexDirection: "row", gap: 8 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: borderRadius.md, borderWidth: 1 },
  tabBtnText: { fontSize: 12, fontWeight: "700" },
  tabBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: borderRadius.sm },
  tabBadgeText: { fontSize: 10, fontWeight: "800" },
  driverCard: { marginHorizontal: spacing.md, marginBottom: 12, borderRadius: borderRadius.md, borderWidth: 1, padding: 16 },
  driverTopRow: { flexDirection: "row", alignItems: "flex-start" },
  avatarWrapper: { position: "relative", marginRight: 14 },
  avatarGradient: { width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center" },
  onlineDot: { position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5 },
  driverInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  driverName: { fontSize: 16, fontWeight: "800", flexShrink: 1 },
  verifyBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm },
  verifyBadgeText: { fontSize: 11, fontWeight: "700" },
  driverPhone: { fontSize: 13, marginBottom: 8 },
  driverStatsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  driverStatItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  driverStatText: { fontSize: 12, fontWeight: "600" },
  statSeparator: { width: 1, height: 14 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm },
  statusDotSmall: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  vehicleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: 12, borderRadius: borderRadius.md, borderWidth: 1 },
  vehicleLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  vehicleIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  vehicleName: { fontSize: 13, fontWeight: "600" },
  vehiclePlate: { fontSize: 11, marginTop: 1 },
  vehicleTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.sm },
  vehicleTypeText: { fontSize: 11, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  actionBtnGradient: { height: 40, borderRadius: borderRadius.xl, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  actionBtnGradientText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  actionBtnOutline: { flex: 1, height: 40, borderRadius: borderRadius.xl, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, borderWidth: 1 },
  actionBtnOutlineText: { fontSize: 13, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySubtitle: { fontSize: 14 },
});
