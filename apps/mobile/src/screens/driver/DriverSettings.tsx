import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { spacing, borderRadius } from "../../theme";

interface ToggleRow {
  icon: string;
  iconColor: string;
  label: string;
  key: string;
}

const NOTIFICATION_TOGGLES: ToggleRow[] = [
  {
    icon: "notifications-outline",
    iconColor: "#F59E0B",
    label: "New Order Alerts",
    key: "newOrders",
  },
  {
    icon: "cash-outline",
    iconColor: "#10B981",
    label: "Earnings Updates",
    key: "earnings",
  },
  {
    icon: "chatbubble-outline",
    iconColor: "#3B82F6",
    label: "Dispatch Messages",
    key: "dispatch",
  },
  {
    icon: "megaphone-outline",
    iconColor: "#8B5CF6",
    label: "Promotional Offers",
    key: "promos",
  },
];

interface VehicleInfo {
  type: string;
  make: string;
  model: string;
  plate: string;
  color: string;
}

export default function DriverSettings() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    newOrders: true,
    earnings: true,
    dispatch: true,
    promos: false,
    navVoice: true,
  });

  useEffect(() => {
    loadSettings();
    fetchDriverProfile();
  }, []);

  const loadSettings = async () => {
    try {
      const keys = ["newOrders", "earnings", "dispatch", "promos", "navVoice"];
      const stored: Record<string, boolean> = {};
      for (const key of keys) {
        const val = await AsyncStorage.getItem(`driver_setting_${key}`);
        if (val !== null) {
          stored[key] = JSON.parse(val);
        }
      }
      setToggles((prev) => ({ ...prev, ...stored }));
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const fetchDriverProfile = async () => {
    setLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { data } = await supabase
        .from("driver_profiles")
        .select("*, driver_vehicles(*)")
        .eq("user_id", userId)
        .single();
      if (data) {
        const v = data.driver_vehicles?.[0];
        if (v) {
          setVehicle({
            type: v.vehicle_type || v.type || "Car",
            make: v.make || "",
            model: v.model || "",
            plate: v.license_plate || v.plate || "",
            color: v.color || "",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching driver profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: string) => {
    const newValue = !toggles[key];
    setToggles((prev) => ({ ...prev, [key]: newValue }));
    try {
      await AsyncStorage.setItem(
        `driver_setting_${key}`,
        JSON.stringify(newValue),
      );
    } catch (error) {
      console.error("Error saving setting:", error);
    }
  };

  const renderSectionTitle = (title: string) => (
    <Text
      style={[
        st.sectionTitle,
        { color: colors.text.dim, paddingHorizontal: spacing.md },
      ]}
    >
      {title.toUpperCase()}
    </Text>
  );

  const renderToggleRow = (
    icon: string,
    iconColor: string,
    label: string,
    value: boolean,
    onToggle: () => void,
  ) => (
    <View
      style={[
        st.menuItem,
        {
          backgroundColor: colors.background.card,
          borderColor: colors.gold.border,
        },
      ]}
    >
      <View style={[st.menuIcon, { backgroundColor: iconColor + "15" }]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[st.menuLabel, { color: colors.text.primary, flex: 1 }]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.gold.primary }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.border}
      />
    </View>
  );

  const renderChevronRow = (
    icon: string,
    iconColor: string,
    label: string,
    value: string,
    onPress?: () => void,
  ) => (
    <TouchableOpacity
      style={[
        st.menuItem,
        {
          backgroundColor: colors.background.card,
          borderColor: colors.gold.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[st.menuIcon, { backgroundColor: iconColor + "15" }]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[st.menuLabel, { color: colors.text.primary, flex: 1 }]}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, color: colors.text.muted, marginRight: 6 }}>
        {value}
      </Text>
      <Icon name="chevron-forward" size={18} color={colors.text.dim} />
    </TouchableOpacity>
  );

  const renderInfoRow = (
    icon: string,
    iconColor: string,
    label: string,
    value: string,
  ) => (
    <View
      style={[
        st.menuItem,
        {
          backgroundColor: colors.background.card,
          borderColor: colors.gold.border,
        },
      ]}
    >
      <View style={[st.menuIcon, { backgroundColor: iconColor + "15" }]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <Text style={[st.menuLabel, { color: colors.text.primary, flex: 1 }]}>
        {label}
      </Text>
      <Text style={{ fontSize: 13, color: colors.text.muted }}>{value}</Text>
    </View>
  );

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
          <Text style={[st.headerTitle, { color: colors.text.primary }]}>
            Settings
          </Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Notifications Section */}
        <View style={{ marginTop: 20 }}>
          {renderSectionTitle("Notifications")}
          <View style={{ paddingHorizontal: spacing.md, gap: 4 }}>
            {NOTIFICATION_TOGGLES.map((item) => (
              <React.Fragment key={item.key}>
                {renderToggleRow(
                  item.icon,
                  item.iconColor,
                  item.label,
                  toggles[item.key] ?? false,
                  () => handleToggle(item.key),
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Vehicle Information Section */}
        <View style={{ marginTop: 20 }}>
          {renderSectionTitle("Vehicle Information")}
          <View style={{ paddingHorizontal: spacing.md, gap: 4 }}>
            {loading ? (
              <View
                style={[
                  st.menuItem,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                    justifyContent: "center",
                  },
                ]}
              >
                <ActivityIndicator
                  size="small"
                  color={colors.gold.primary}
                />
                <Text
                  style={{
                    color: colors.text.muted,
                    fontSize: 14,
                    marginLeft: 10,
                  }}
                >
                  Loading vehicle info...
                </Text>
              </View>
            ) : vehicle ? (
              <>
                {renderInfoRow(
                  "car-outline",
                  "#3B82F6",
                  "Vehicle Type",
                  vehicle.type,
                )}
                {renderInfoRow(
                  "construct-outline",
                  "#8B5CF6",
                  "Make / Model",
                  `${vehicle.make} ${vehicle.model}`.trim() || "N/A",
                )}
                {renderInfoRow(
                  "document-text-outline",
                  "#EC4899",
                  "License Plate",
                  vehicle.plate || "N/A",
                )}
                {renderInfoRow(
                  "color-palette-outline",
                  "#10B981",
                  "Color",
                  vehicle.color || "N/A",
                )}
              </>
            ) : (
              <View
                style={[
                  st.menuItem,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                  },
                ]}
              >
                <Icon
                  name="car-outline"
                  size={20}
                  color={colors.text.dim}
                />
                <Text
                  style={{
                    color: colors.text.muted,
                    fontSize: 14,
                    marginLeft: 10,
                  }}
                >
                  No vehicle info available
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Preferences Section */}
        <View style={{ marginTop: 20 }}>
          {renderSectionTitle("Preferences")}
          <View style={{ paddingHorizontal: spacing.md, gap: 4 }}>
            {renderChevronRow(
              "time-outline",
              "#3B82F6",
              "Online Hours",
              "Auto",
            )}
            {renderToggleRow(
              "volume-high-outline",
              "#10B981",
              "Navigation Voice",
              toggles.navVoice ?? true,
              () => handleToggle("navVoice"),
            )}
            {renderToggleRow(
              isDark ? "moon-outline" : "sunny-outline",
              colors.gold.primary,
              "Dark Mode",
              isDark,
              toggleTheme,
            )}
            {renderChevronRow(
              "language-outline",
              "#8B5CF6",
              "Language",
              "English",
            )}
          </View>
        </View>

        {/* About Section */}
        <View style={{ marginTop: 20 }}>
          {renderSectionTitle("About")}
          <View style={{ paddingHorizontal: spacing.md, gap: 4 }}>
            {renderInfoRow(
              "information-circle-outline",
              "#6B7280",
              "App Version",
              "v1.0.0",
            )}
            {renderChevronRow(
              "document-outline",
              "#3B82F6",
              "Terms of Service",
              "",
            )}
            {renderChevronRow(
              "shield-checkmark-outline",
              "#10B981",
              "Privacy Policy",
              "",
            )}
          </View>
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: { fontSize: 15, fontWeight: "600", marginBottom: 1 },
});
