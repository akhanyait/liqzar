import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../../components/Icon";
import BrandMark from "../../components/BrandMark";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, borderRadius } from "../../theme";

const { width } = Dimensions.get("window");

interface MenuItem {
  icon: string;
  label: string;
  subtitle: string;
  color: string;
  screen?: string;
  badge?: string;
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: "Deliveries",
    items: [
      {
        icon: "home-outline",
        label: "Dashboard",
        subtitle: "Active orders & overview",
        color: "#3B82F6",
        screen: "DriverDashboard",
      },
      {
        icon: "list-outline",
        label: "All Deliveries",
        subtitle: "View delivery history",
        color: "#8B5CF6",
        screen: "DriverEarnings",
      },
      {
        icon: "business-outline",
        label: "Depot Pickup",
        subtitle: "Navigate to depot",
        color: "#EC4899",
        screen: "DriverDepotPickup",
      },
      {
        icon: "scan-outline",
        label: "Scan & Verify",
        subtitle: "Verify order items",
        color: "#10B981",
        screen: "DriverScanVerify",
      },
    ],
  },
  {
    title: "AI & Tools",
    items: [
      {
        icon: "sparkles-outline",
        label: "AI Assistant",
        subtitle: "Smart routing & insights",
        color: "#F59E0B",
        screen: "DriverAIAssistant",
        badge: "NEW",
      },
      {
        icon: "map-outline",
        label: "Navigation",
        subtitle: "In-app map navigation",
        color: "#3B82F6",
        screen: "DriverNavigation",
      },
      {
        icon: "barcode-outline",
        label: "Barcode Scanner",
        subtitle: "Scan product barcodes",
        color: "#06B6D4",
        screen: "BarcodeScanner",
      },
      {
        icon: "shield-checkmark-outline",
        label: "AI Item Verify",
        subtitle: "AI-powered item confirmation",
        color: "#14B8A6",
        screen: "DriverAIItemVerify",
        badge: "NEW",
      },
      {
        icon: "camera-outline",
        label: "Photo Proof",
        subtitle: "Proof of delivery photos",
        color: "#EC4899",
        screen: "DriverPhotoProof",
      },
      {
        icon: "flame-outline",
        label: "Heat Map",
        subtitle: "Delivery demand zones",
        color: "#EF4444",
        screen: "DriverHeatMap",
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        icon: "chatbubbles-outline",
        label: "Messages",
        subtitle: "Chat with customers & office",
        color: "#10B981",
        screen: "DriverChat",
        badge: "3",
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        icon: "wallet-outline",
        label: "Earnings",
        subtitle: "Your earnings & payouts",
        color: "#D4AF37",
        screen: "DriverEarnings",
      },
      {
        icon: "star-outline",
        label: "Ratings & Reviews",
        subtitle: "Your performance stats",
        color: "#F59E0B",
        screen: "DriverRatings",
      },
      {
        icon: "settings-outline",
        label: "Settings",
        subtitle: "App preferences & account",
        color: "#6B7280",
        screen: "DriverSettings",
      },
      {
        icon: "help-circle-outline",
        label: "Help & Support",
        subtitle: "FAQs and contact support",
        color: "#8B5CF6",
        screen: "DriverSupport",
      },
    ],
  },
];

export default function DriverMenu() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  const handleNavigate = (screen?: string) => {
    if (screen) {
      navigation.navigate(screen);
    }
  };

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
              Menu
            </Text>
          </View>
          <TouchableOpacity onPress={toggleTheme} style={st.backBtn}>
            <Icon
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={20}
              color={colors.gold.primary}
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Driver Profile Card */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <View
            style={[
              st.profileCard,
              {
                backgroundColor: colors.background.card,
                borderColor: colors.gold.border,
              },
            ]}
          >
            <View style={st.profileRow}>
              <LinearGradient colors={[colors.gold.primary, colors.gold.dark]} style={st.avatar}>
                <Icon name="person" size={28} color={colors.white} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[st.profileName, { color: colors.text.primary }]}>
                  {user?.full_name || "Driver"}
                </Text>
                <Text style={{ fontSize: 12, color: colors.text.muted }}>
                  {user?.phone || "LIQZAR Driver"}
                </Text>
              </View>
              <View style={[st.ratingPill, { backgroundColor: colors.status.warning + "18" }]}>
                <Icon name="star" size={14} color={colors.status.warning} />
                <Text
                  style={{ color: colors.status.warning, fontSize: 13, fontWeight: "800" }}
                >
                  4.9
                </Text>
              </View>
            </View>

            {/* Quick stats row */}
            <View style={st.quickStatsRow}>
              {[
                {
                  label: "Today",
                  value: "8 trips",
                  icon: "bicycle-outline",
                  color: "#3B82F6",
                },
                {
                  label: "Online",
                  value: "6h 30m",
                  icon: "time-outline",
                  color: "#10B981",
                },
                {
                  label: "Earned",
                  value: "R1,245",
                  icon: "cash-outline",
                  color: "#D4AF37",
                },
              ].map((stat, i) => (
                <View key={i} style={st.quickStat}>
                  <Icon name={stat.icon} size={16} color={stat.color} />
                  <Text
                    style={[st.quickStatValue, { color: colors.text.primary }]}
                  >
                    {stat.value}
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.text.dim }}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Menu Sections */}
        {MENU_SECTIONS.map((section, sIdx) => (
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
              {section.items.map((item, iIdx) => (
                <TouchableOpacity
                  key={iIdx}
                  style={[
                    st.menuItem,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.gold.border,
                    },
                  ]}
                  onPress={() => handleNavigate(item.screen)}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      st.menuIcon,
                      { backgroundColor: item.color + "15" },
                    ]}
                  >
                    <Icon name={item.icon} size={20} color={item.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[st.menuLabel, { color: colors.text.primary }]}
                    >
                      {item.label}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.text.muted }}>
                      {item.subtitle}
                    </Text>
                  </View>
                  {item.badge && (
                    <View
                      style={[
                        st.menuBadge,
                        {
                          backgroundColor:
                            item.badge === "NEW" ? colors.status.warning : colors.status.error,
                        },
                      ]}
                    >
                      <Text style={st.menuBadgeText}>{item.badge}</Text>
                    </View>
                  )}
                  <Icon
                    name="chevron-forward"
                    size={18}
                    color={colors.text.dim}
                  />
                </TouchableOpacity>
              ))}
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

        {/* App version */}
        <View style={{ alignItems: "center", marginTop: 16, marginBottom: 40 }}>
          <Text style={{ fontSize: 11, color: colors.text.dim }}>
            LIQZAR Driver v1.0.0
          </Text>
        </View>
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
  profileCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 16,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: { fontSize: 17, fontWeight: "800", marginBottom: 1 },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.md,
  },
  quickStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,175,55,0.1)",
  },
  quickStat: { alignItems: "center", gap: 2 },
  quickStatValue: { fontSize: 13, fontWeight: "700" },
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
  menuBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  menuBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
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
