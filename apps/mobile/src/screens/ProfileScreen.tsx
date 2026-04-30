import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  spacing,
  borderRadius,
  typography,
} from "../theme";
import { Icon } from "../components/Icon";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";

interface MenuItem {
  icon: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  showChevron?: boolean;
  iconColor: string;
  iconBg: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const { colors, gradients, shadows, isDark, toggleTheme, mode } = useTheme();

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of LIQZAR?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: signOut,
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Deleting your account will permanently remove your profile, order history, addresses, loyalty points, and all other data associated with your account. This cannot be undone.\n\nAre you sure you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "This is your final confirmation. Tap \"Delete My Account\" to permanently delete everything.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete My Account",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      const { data, error } = await supabase.functions.invoke(
                        "delete-account",
                        { method: "POST" },
                      );
                      if (error) throw error;
                      if (!data?.success) {
                        throw new Error(data?.error || "Account deletion failed");
                      }
                      await signOut();
                      Alert.alert(
                        "Account Deleted",
                        "Your LIQZAR account and all associated data have been permanently deleted.",
                      );
                    } catch (err: any) {
                      Alert.alert(
                        "Could Not Delete Account",
                        err?.message ||
                          "Something went wrong. Please try again or contact support@liqzar.co.za.",
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const menuGroups: MenuGroup[] = [
    {
      title: "Account",
      items: [
        {
          icon: "create-outline",
          label: "Edit Profile",
          subtitle: "Update your personal details",
          onPress: () => navigation.navigate("EditProfile"),
          iconColor: colors.gold.primary,
          iconBg: isDark ? "rgba(212,175,55,0.12)" : "rgba(212,175,55,0.08)",
        },
        {
          icon: "receipt-outline",
          label: "Order History",
          subtitle: "View your past orders",
          onPress: () => navigation.navigate("OrderHistory"),
          iconColor: colors.status.info,
          iconBg: isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)",
        },
        {
          icon: "heart-outline",
          label: "Wishlist",
          subtitle: "Your saved products",
          onPress: () => navigation.navigate("Wishlist"),
          iconColor: colors.status.error,
          iconBg: isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)",
        },
        {
          icon: "location-outline",
          label: "Saved Addresses",
          subtitle: "Manage delivery addresses",
          onPress: () => navigation.navigate("SavedAddresses"),
          iconColor: colors.status.success,
          iconBg: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.08)",
        },
      ],
    },
    {
      title: "Rewards & Offers",
      items: [
        {
          icon: "star-outline",
          label: "LIQZAR Rewards",
          subtitle: "2,450 points \u2014 Gold Member",
          onPress: () => navigation.navigate("Loyalty"),
          iconColor: colors.status.warning,
          iconBg: isDark ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.08)",
        },
        {
          icon: "gift-outline",
          label: "Refer & Earn",
          subtitle: "Give R50, Get R50",
          onPress: () => navigation.navigate("Referral"),
          iconColor: "#8B5CF6",
          iconBg: isDark ? "rgba(139,92,246,0.12)" : "rgba(139,92,246,0.08)",
        },
        {
          icon: "repeat-outline",
          label: "Quick Reorder",
          subtitle: "Reorder from past orders",
          onPress: () => navigation.navigate("Reorder"),
          iconColor: "#06B6D4",
          iconBg: isDark ? "rgba(6,182,212,0.12)" : "rgba(6,182,212,0.08)",
        },
        {
          icon: "pricetag-outline",
          label: "Promo Codes",
          subtitle: "Apply discount codes",
          onPress: () => navigation.navigate("PromoCode"),
          iconColor: "#EC4899",
          iconBg: isDark ? "rgba(236,72,153,0.12)" : "rgba(236,72,153,0.08)",
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: "calendar-outline",
          label: "Schedule Delivery",
          subtitle: "Plan future deliveries",
          onPress: () => navigation.navigate("ScheduleDelivery"),
          iconColor: "#14B8A6",
          iconBg: isDark ? "rgba(20,184,166,0.12)" : "rgba(20,184,166,0.08)",
        },
        {
          icon: "notifications-outline",
          label: "Notifications",
          subtitle: "Manage alerts & updates",
          onPress: () => {},
          iconColor: "#F97316",
          iconBg: isDark ? "rgba(249,115,22,0.12)" : "rgba(249,115,22,0.08)",
          comingSoon: true,
        },
        {
          icon: "finger-print-outline",
          label: "Security & Biometrics",
          subtitle: "Fingerprint, Face ID & PIN",
          onPress: () => {},
          iconColor: "#6366F1",
          iconBg: isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.08)",
          comingSoon: true,
        },
        {
          icon: "help-circle-outline",
          label: "Help & Support",
          subtitle: "FAQs, contact us",
          onPress: () =>
            Alert.alert(
              "Support",
              "Contact us at support@liqzar.co.za or call 0800-LIQZAR",
            ),
          iconColor: "#64748B",
          iconBg: isDark ? "rgba(100,116,139,0.12)" : "rgba(100,116,139,0.08)",
        },
      ],
    },
  ];

  const displayName = user?.full_name || "Guest User";
  const displayContact = user?.email || user?.phone || "";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const headerColors: [string, string] = [...gradients.header] as [string, string];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background.primary,
        },
        /* ── Header ─────────────────────────────────── */
        headerGradient: {
          paddingBottom: spacing.lg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.gold.border,
        },
        profileSection: {
          alignItems: "center",
          paddingTop: spacing.xl + spacing.sm,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.lg,
        },
        avatarGlow: {
          width: 100,
          height: 100,
          borderRadius: borderRadius.full,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: spacing.md,
          backgroundColor: colors.gold.faint,
          ...shadows.gold,
        },
        avatarRing: {
          width: 86,
          height: 86,
          borderRadius: borderRadius.full,
          justifyContent: "center",
          alignItems: "center",
          padding: 3,
        },
        avatarInner: {
          width: 80,
          height: 80,
          borderRadius: borderRadius.full,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isDark ? colors.background.tertiary : colors.background.primary,
        },
        avatarText: {
          fontSize: 28,
          fontWeight: "800",
          color: colors.gold.primary,
          letterSpacing: 1,
        },
        userName: {
          fontSize: 24,
          fontWeight: "700",
          color: colors.text.primary,
          marginBottom: 6,
          letterSpacing: -0.3,
        },
        contactRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          marginTop: 2,
        },
        userContact: {
          ...typography.bodySmall,
          color: colors.gold.muted,
          fontWeight: "500",
        },
        /* ── Theme toggle ───────────────────────────── */
        themeSection: {
          paddingHorizontal: spacing.lg,
          marginTop: spacing.lg,
        },
        themeCard: {
          borderRadius: borderRadius.lg,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.gold.border,
          backgroundColor: colors.background.card,
          ...shadows.card,
        },
        themeCardInner: {
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.md,
        },
        themeIconWrapper: {
          width: 36,
          height: 36,
          borderRadius: borderRadius.md,
          backgroundColor: colors.gold.faint,
          justifyContent: "center",
          alignItems: "center",
          marginRight: spacing.md,
        },
        themeContent: {
          flex: 1,
        },
        themeLabel: {
          ...typography.body,
          color: colors.text.primary,
          fontWeight: "600",
          marginBottom: 2,
        },
        themeSubtitle: {
          ...typography.caption,
          color: colors.text.muted,
        },
        /* ── Menu groups ────────────────────────────── */
        menuGroupContainer: {
          paddingHorizontal: spacing.lg,
          marginTop: spacing.lg,
        },
        menuGroupTitle: {
          ...typography.caption,
          color: colors.gold.muted,
          fontWeight: "700",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: spacing.sm,
          marginLeft: spacing.xs,
        },
        menuGroupCard: {
          borderRadius: borderRadius.lg,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.gold.border,
          backgroundColor: colors.background.card,
          ...shadows.card,
        },
        menuItem: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: spacing.md,
        },
        menuDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.gold.border,
          marginLeft: 36 + spacing.md + spacing.md,
        },
        menuIconWrapper: {
          width: 36,
          height: 36,
          borderRadius: borderRadius.md,
          justifyContent: "center",
          alignItems: "center",
          marginRight: spacing.md,
        },
        menuContent: {
          flex: 1,
        },
        menuLabel: {
          ...typography.body,
          color: colors.text.primary,
          fontWeight: "600",
          marginBottom: 2,
        },
        menuSubtitle: {
          ...typography.caption,
          color: colors.text.muted,
        },
        /* ── Sign out ───────────────────────────────── */
        signOutSection: {
          paddingHorizontal: spacing.lg,
          marginTop: spacing.xl,
        },
        signOutGradientBorder: {
          borderRadius: borderRadius.lg,
          padding: 1.5,
          ...shadows.goldSubtle,
        },
        signOutButton: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 16,
          borderRadius: borderRadius.lg - 1,
          backgroundColor: colors.background.card,
          gap: spacing.sm,
        },
        signOutText: {
          ...typography.body,
          color: colors.status.error,
          fontWeight: "600",
        },
        /* ── Delete account ─────────────────────────── */
        deleteAccountSection: {
          paddingHorizontal: spacing.lg,
          marginTop: spacing.md,
          alignItems: "center",
        },
        deleteAccountButton: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 12,
          paddingHorizontal: spacing.lg,
          gap: spacing.xs,
        },
        deleteAccountText: {
          ...typography.bodySmall,
          color: colors.status.error,
          fontWeight: "600",
        },
        deleteAccountHint: {
          ...typography.caption,
          color: colors.text.muted,
          textAlign: "center",
          marginTop: 2,
        },
        /* ── Footer ─────────────────────────────────── */
        versionText: {
          ...typography.caption,
          color: colors.text.dim,
          textAlign: "center",
          marginTop: spacing.lg,
          marginBottom: spacing.xxl,
        },
      }),
    [colors, shadows, isDark],
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── Header with gradient background ─────────── */}
      <LinearGradient colors={headerColors} style={styles.headerGradient}>
        <View style={styles.profileSection}>
          {/* Avatar with glow + gold gradient ring */}
          <View style={styles.avatarGlow}>
            <LinearGradient
              colors={[...gradients.goldShimmer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <View style={styles.avatarInner}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </LinearGradient>
          </View>

          <Text style={styles.userName}>{displayName}</Text>

          {displayContact ? (
            <View style={styles.contactRow}>
              <Icon
                name={user?.email ? "mail-outline" : "call-outline"}
                size={14}
                color={colors.gold.muted}
              />
              <Text style={styles.userContact}>{displayContact}</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      {/* ── Theme Toggle ────────────────────────────── */}
      <View style={styles.themeSection}>
        <View style={styles.themeCard}>
          <View style={styles.themeCardInner}>
            <View style={styles.themeIconWrapper}>
              <Icon
                name={isDark ? "moon-outline" : "sunny-outline"}
                size={20}
                color={colors.gold.primary}
              />
            </View>
            <View style={styles.themeContent}>
              <Text style={styles.themeLabel}>
                {isDark ? "Dark Mode" : "Light Mode"}
              </Text>
              <Text style={styles.themeSubtitle}>
                {isDark
                  ? "Switch to light appearance"
                  : "Switch to dark appearance"}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{
                false: colors.border,
                true: colors.gold.primary,
              }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.border}
            />
          </View>
        </View>
      </View>

      {/* ── Menu Groups ─────────────────────────────── */}
      {menuGroups.map((group, groupIndex) => (
        <View key={groupIndex} style={styles.menuGroupContainer}>
          <Text style={styles.menuGroupTitle}>{group.title}</Text>
          <View style={styles.menuGroupCard}>
            {group.items.map((item, index) => (
              <React.Fragment key={index}>
                <TouchableOpacity
                  style={[styles.menuItem, (item as any).comingSoon && { opacity: 0.55 }]}
                  onPress={(item as any).comingSoon ? undefined : item.onPress}
                  activeOpacity={(item as any).comingSoon ? 1 : 0.6}
                  disabled={(item as any).comingSoon}
                  accessibilityLabel={(item as any).comingSoon ? `${item.label} — coming soon` : item.label}
                >
                  <View
                    style={[
                      styles.menuIconWrapper,
                      { backgroundColor: item.iconBg },
                    ]}
                  >
                    <Icon name={item.icon} size={20} color={item.iconColor} />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                  {(item as any).comingSoon ? (
                    <View
                      style={{
                        backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                        borderRadius: 10,
                        paddingVertical: 3,
                        paddingHorizontal: 8,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.text.muted }}>
                        Soon
                      </Text>
                    </View>
                  ) : (
                    <Icon
                      name="chevron-forward"
                      size={18}
                      color={colors.gold.muted}
                    />
                  )}
                </TouchableOpacity>
                {index < group.items.length - 1 && (
                  <View style={styles.menuDivider} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>
      ))}

      {/* ── Sign Out ────────────────────────────────── */}
      <View style={styles.signOutSection}>
        <LinearGradient
          colors={[...gradients.gold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.signOutGradientBorder}
        >
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Icon
              name="log-out-outline"
              size={20}
              color={colors.status.error}
            />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* ── Delete Account (required for App Store) ─── */}
      <View style={styles.deleteAccountSection}>
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
        >
          <Icon name="trash-outline" size={18} color={colors.status.error} />
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </TouchableOpacity>
        <Text style={styles.deleteAccountHint}>
          Permanently remove your account and all associated data
        </Text>
      </View>

      {/* ── App Version ─────────────────────────────── */}
      <Text style={styles.versionText}>LIQZAR v1.0.0</Text>
    </ScrollView>
  );
}
