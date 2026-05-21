import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Icon } from "../../components/Icon";
import BrandMark from "../../components/BrandMark";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, borderRadius } from "../../theme";
import { supabase } from "../../lib/supabase";

const TOGGLE_STORAGE_KEY = "@admin_settings_toggles";

interface SettingToggle {
  key: string;
  icon: string;
  label: string;
  color: string;
  type: "toggle";
  defaultValue: boolean;
}

interface SettingNav {
  key: string;
  icon: string;
  label: string;
  color: string;
  type: "nav";
  value: string;
}

interface SettingAction {
  key: string;
  icon: string;
  label: string;
  color: string;
  type: "action";
  value?: string;
}

type SettingItem = SettingToggle | SettingNav | SettingAction;

interface SettingSection {
  title: string;
  items: SettingItem[];
}

const DEFAULT_SETTINGS_SECTIONS: SettingSection[] = [
  {
    title: "Business",
    items: [
      {
        key: "delivery_zones",
        icon: "map-outline",
        label: "Delivery Zones",
        color: "#3B82F6",
        type: "nav",
        value: "Loading...",
      },
      {
        key: "delivery_fees",
        icon: "cash-outline",
        label: "Delivery Fees",
        color: "#10B981",
        type: "nav",
        value: "Loading...",
      },
      {
        key: "min_order",
        icon: "pricetag-outline",
        label: "Min Order Value",
        color: "#F59E0B",
        type: "nav",
        value: "Loading...",
      },
      {
        key: "business_hours",
        icon: "time-outline",
        label: "Business Hours",
        color: "#8B5CF6",
        type: "nav",
        value: "Mon-Sun 10am-10pm",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        key: "order_notifications",
        icon: "notifications-outline",
        label: "Order Notifications",
        color: "#3B82F6",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "driver_auto_assign",
        icon: "car-outline",
        label: "Driver Auto-Assignment",
        color: "#10B981",
        type: "toggle",
        defaultValue: true,
      },
      {
        key: "low_stock_alerts",
        icon: "alert-outline",
        label: "Low Stock Alerts",
        color: "#F59E0B",
        type: "toggle",
        defaultValue: false,
      },
      {
        key: "express_delivery",
        icon: "flash-outline",
        label: "Express Delivery",
        color: "#8B5CF6",
        type: "toggle",
        defaultValue: true,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        key: "app_version",
        icon: "information-circle-outline",
        label: "App Version",
        color: "#6B7280",
        type: "nav",
        value: "v1.0.0",
      },
      {
        key: "clear_cache",
        icon: "trash-outline",
        label: "Clear Cache",
        color: "#EF4444",
        type: "action",
      },
      {
        key: "export_data",
        icon: "download-outline",
        label: "Export Data",
        color: "#3B82F6",
        type: "action",
      },
    ],
  },
];

export default function AdminSettings() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark, shadows } = useTheme();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settingsSections, setSettingsSections] = useState<SettingSection[]>(DEFAULT_SETTINGS_SECTIONS);

  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    DEFAULT_SETTINGS_SECTIONS.forEach((section) => {
      section.items.forEach((item) => {
        if (item.type === "toggle") {
          initial[item.key] = item.defaultValue;
        }
      });
    });
    return initial;
  });

  // Load saved toggle states from AsyncStorage
  const loadToggles = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(TOGGLE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setToggles((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error("Error loading toggle settings:", e);
    }
  }, []);

  // Save toggle states to AsyncStorage
  const saveToggles = useCallback(async (newToggles: Record<string, boolean>) => {
    try {
      await AsyncStorage.setItem(TOGGLE_STORAGE_KEY, JSON.stringify(newToggles));
    } catch (e) {
      console.error("Error saving toggle settings:", e);
    }
  }, []);

  // Fetch dynamic values from Supabase
  const fetchSettingsData = useCallback(async () => {
    try {
      const updatedSections = [...DEFAULT_SETTINGS_SECTIONS.map((s) => ({
        ...s,
        items: s.items.map((item) => ({ ...item })),
      }))];

      // Fetch delivery zones count
      try {
        const { data: zones, error: zonesError } = await supabase
          .from("delivery_zones")
          .select("id, is_active")
          .eq("is_active", true);

        if (!zonesError && zones) {
          const businessSection = updatedSections.find((s) => s.title === "Business");
          if (businessSection) {
            const zonesItem = businessSection.items.find((i) => i.key === "delivery_zones");
            if (zonesItem && zonesItem.type === "nav") {
              (zonesItem as SettingNav).value = `${zones.length} zone${zones.length !== 1 ? "s" : ""} active`;
            }
          }
        }
      } catch (e) {
        // delivery_zones table may not exist
        const businessSection = updatedSections.find((s) => s.title === "Business");
        if (businessSection) {
          const zonesItem = businessSection.items.find((i) => i.key === "delivery_zones");
          if (zonesItem && zonesItem.type === "nav") {
            (zonesItem as SettingNav).value = "Not configured";
          }
        }
      }

      // Fetch product count for min order reference
      try {
        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("price")
          .order("price", { ascending: true })
          .limit(1);

        if (!productsError && products && products.length > 0) {
          const businessSection = updatedSections.find((s) => s.title === "Business");
          if (businessSection) {
            const minOrderItem = businessSection.items.find((i) => i.key === "min_order");
            if (minOrderItem && minOrderItem.type === "nav") {
              // Use AsyncStorage for min order value since there's no dedicated table
              const savedMinOrder = await AsyncStorage.getItem("@admin_min_order");
              (minOrderItem as SettingNav).value = savedMinOrder || "R150";
            }
            const deliveryFeeItem = businessSection.items.find((i) => i.key === "delivery_fees");
            if (deliveryFeeItem && deliveryFeeItem.type === "nav") {
              const savedFee = await AsyncStorage.getItem("@admin_delivery_fee");
              (deliveryFeeItem as SettingNav).value = savedFee || "R9.99 standard";
            }
          }
        }
      } catch (e) {
        console.error("Error fetching products:", e);
      }

      // Load business hours from AsyncStorage
      try {
        const savedHours = await AsyncStorage.getItem("@admin_business_hours");
        if (savedHours) {
          const businessSection = updatedSections.find((s) => s.title === "Business");
          if (businessSection) {
            const hoursItem = businessSection.items.find((i) => i.key === "business_hours");
            if (hoursItem && hoursItem.type === "nav") {
              (hoursItem as SettingNav).value = savedHours;
            }
          }
        }
      } catch (e) {
        console.error("Error loading business hours:", e);
      }

      setSettingsSections(updatedSections);
    } catch (error) {
      console.error("Error fetching settings data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToggles();
    fetchSettingsData();
  }, [loadToggles, fetchSettingsData]);

  const handleToggle = useCallback(async (key: string) => {
    const newToggles = { ...toggles, [key]: !toggles[key] };
    setToggles(newToggles);
    await saveToggles(newToggles);
  }, [toggles, saveToggles]);

  const handleClearCache = useCallback(async () => {
    Alert.alert(
      "Clear Cache",
      "This will clear all cached data. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear non-essential AsyncStorage keys
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter(
                (k) => !k.startsWith("@auth") && k !== TOGGLE_STORAGE_KEY
              );
              await AsyncStorage.multiRemove(cacheKeys);
              Alert.alert("Success", "Cache cleared successfully.");
            } catch (e) {
              Alert.alert("Error", "Failed to clear cache.");
            }
          },
        },
      ]
    );
  }, []);

  const handleExportData = useCallback(async () => {
    Alert.alert(
      "Export Data",
      "This feature will export all admin data. This may take a moment.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export",
          onPress: async () => {
            try {
              // Fetch summary data for export
              const { data: orders } = await supabase
                .from("orders")
                .select("id, total, status, created_at")
                .order("created_at", { ascending: false })
                .limit(100);

              const { data: products } = await supabase
                .from("products")
                .select("id, name, price, stock_quantity")
                .order("name");

              const exportData = {
                exportDate: new Date().toISOString(),
                ordersCount: orders?.length || 0,
                productsCount: products?.length || 0,
                settings: toggles,
              };

              // Store export data in AsyncStorage as a simple export mechanism
              await AsyncStorage.setItem(
                "@admin_last_export",
                JSON.stringify(exportData)
              );

              Alert.alert(
                "Export Complete",
                `Exported ${orders?.length || 0} orders and ${products?.length || 0} products.`
              );
            } catch (e) {
              Alert.alert("Error", "Failed to export data.");
            }
          },
        },
      ]
    );
  }, [toggles]);

  const handleAction = useCallback((key: string) => {
    switch (key) {
      case "clear_cache":
        handleClearCache();
        break;
      case "export_data":
        handleExportData();
        break;
      default:
        break;
    }
  }, [handleClearCache, handleExportData]);

  const renderSettingItem = (item: SettingItem) => {
    return (
      <TouchableOpacity
        key={item.key}
        style={[
          st.menuItem,
          {
            backgroundColor: colors.background.card,
            borderColor: colors.gold.border,
          },
        ]}
        activeOpacity={item.type === "toggle" ? 1 : 0.75}
        onPress={() => {
          if (item.type === "toggle") {
            handleToggle(item.key);
          } else if (item.type === "action") {
            handleAction(item.key);
          }
        }}
      >
        <View style={[st.menuIcon, { backgroundColor: item.color + "15" }]}>
          <Icon name={item.icon} size={20} color={item.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[st.menuLabel, { color: colors.text.primary }]}>
            {item.label}
          </Text>
        </View>
        {item.type === "nav" && (
          <View style={st.navRight}>
            <Text style={{ fontSize: 13, color: colors.text.dim }}>
              {item.value}
            </Text>
            <Icon name="chevron-forward" size={18} color={colors.text.dim} />
          </View>
        )}
        {item.type === "toggle" && (
          <Switch
            value={toggles[item.key]}
            onValueChange={() => handleToggle(item.key)}
            trackColor={{
              false: isDark ? "#333" : "#DDD",
              true: colors.gold.primary,
            }}
            thumbColor={toggles[item.key] ? "#FFFFFF" : "#F4F4F4"}
          />
        )}
        {item.type === "action" && (
          <Icon name="chevron-forward" size={18} color={colors.text.dim} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
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
                Settings
              </Text>
            </View>
            <View style={{ width: 36 }} />
          </View>
        </LinearGradient>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.gold.primary} />
          <Text style={{ color: colors.text.muted, marginTop: 12, fontSize: 14 }}>
            Loading settings...
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
              Settings
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Settings Sections */}
        {settingsSections.map((section, sIdx) => (
          <View key={sIdx} style={{ marginTop: 20 }}>
            <Text
              style={[
                st.sectionTitle,
                { color: colors.text.dim, paddingHorizontal: spacing.md },
              ]}
            >
              {section.title.toUpperCase()}
            </Text>
            <View style={{ paddingHorizontal: spacing.md, gap: 4 }}>
              {section.items.map((item) => renderSettingItem(item))}
            </View>
          </View>
        ))}

        {/* Sign Out */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 24 }}>
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
            <Text style={{ color: colors.status.error, fontWeight: "600" }}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* App footer */}
        <View style={{ alignItems: "center", marginTop: 16 }}>
          <Text style={{ fontSize: 11, color: colors.text.dim }}>
            LIQZAR Admin v1.0.0
          </Text>
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
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  menuLabel: { fontSize: 15, fontWeight: "600", marginBottom: 1 },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  signOutBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
});
