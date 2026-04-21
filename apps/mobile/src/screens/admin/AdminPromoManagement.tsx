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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, borderRadius } from "../../theme";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";

interface Promo {
  id: string;
  code: string;
  description: string;
  discountType: "percentage" | "fixed" | "free_delivery";
  value: number;
  minOrder: number;
  usageCount: number;
  usageLimit: number;
  expiryDate: string;
  isActive: boolean;
  startDate: string;
  targetAudience: string;
}

interface ExpiredPromo {
  id: string;
  code: string;
  description: string;
  discountType: "percentage" | "fixed" | "free_delivery";
  value: number;
  totalUsed: number;
  totalRevenueLost: number;
  expiredDate: string;
}

const DISCOUNT_TYPES = [
  { key: "percentage" as const, label: "Percentage (%)" },
  { key: "fixed" as const, label: "Fixed Amount (R)" },
  { key: "free_delivery" as const, label: "Free Delivery" },
];

const TARGET_OPTIONS = ["All", "New Users", "VIP", "Specific Customers"];

export default function AdminPromoManagement() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [promos, setPromos] = useState<Promo[]>([]);
  const [expiredPromos, setExpiredPromos] = useState<ExpiredPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [showExpired, setShowExpired] = useState(false);

  // Stats
  const [stats, setStats] = useState([
    { label: "Active Promos", value: "0", icon: "pricetag-outline" as const, color: colors.status.success },
    { label: "Used Today", value: "0", icon: "trending-up-outline" as const, color: colors.status.info },
    { label: "Revenue Impact", value: "R0", icon: "cash-outline" as const, color: colors.gold.primary },
  ]);

  // Create Promo form state
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<
    "percentage" | "fixed" | "free_delivery"
  >("percentage");
  const [formValue, setFormValue] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [formUsageLimit, setFormUsageLimit] = useState("");
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [formEndDate, setFormEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });
  const [formTarget, setFormTarget] = useState("All");
  const [showDiscountTypePicker, setShowDiscountTypePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  const fetchPromos = useCallback(async () => {
    try {
      const { data: promoData, error } = await supabase
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching promos:", error);
        Alert.alert("Error", "Failed to load promotions.");
        return;
      }

      const now = new Date();
      const activePromos: Promo[] = [];
      const expired: ExpiredPromo[] = [];

      (promoData || []).forEach((p: any) => {
        const expiryDate = p.expiry_date || p.end_date || p.expires_at || "";
        const startDate = p.start_date || p.starts_at || p.created_at || "";
        const isExpired = expiryDate ? new Date(expiryDate) < now : false;
        const isActive = p.is_active !== undefined ? p.is_active : !isExpired;

        if (isExpired) {
          expired.push({
            id: p.id,
            code: p.code || "",
            description: p.description || "",
            discountType: p.discount_type || "percentage",
            value: p.discount_value || p.value || 0,
            totalUsed: p.usage_count || p.times_used || 0,
            totalRevenueLost: (p.usage_count || p.times_used || 0) * (p.discount_value || p.value || 0),
            expiredDate: expiryDate ? new Date(expiryDate).toISOString().split("T")[0] : "",
          });
        } else {
          activePromos.push({
            id: p.id,
            code: p.code || "",
            description: p.description || "",
            discountType: p.discount_type || "percentage",
            value: p.discount_value || p.value || 0,
            minOrder: p.min_order || p.minimum_order || 0,
            usageCount: p.usage_count || p.times_used || 0,
            usageLimit: p.usage_limit || p.max_uses || 100,
            expiryDate: expiryDate ? new Date(expiryDate).toISOString().split("T")[0] : "",
            isActive,
            startDate: startDate ? new Date(startDate).toISOString().split("T")[0] : "",
            targetAudience: p.target_audience || "All",
          });
        }
      });

      setPromos(activePromos);
      setExpiredPromos(expired);

      // Calculate stats
      const activeCount = activePromos.filter((p) => p.isActive).length;
      const totalUsedToday = activePromos.reduce((sum, p) => sum + p.usageCount, 0);
      const revenueImpact = [...activePromos, ...expired.map((e) => ({
        ...e,
        usageCount: e.totalUsed,
      }))].reduce((sum, p) => {
        const val = 'usageCount' in p ? p.usageCount : 0;
        return sum + val * (p.value || 0);
      }, 0);

      setStats([
        { label: "Active Promos", value: activeCount.toString(), icon: "pricetag-outline", color: colors.status.success },
        { label: "Total Used", value: totalUsedToday.toString(), icon: "trending-up-outline", color: colors.status.info },
        { label: "Revenue Impact", value: `R${revenueImpact.toLocaleString()}`, icon: "cash-outline", color: colors.gold.primary },
      ]);
    } catch (error) {
      console.error("Error fetching promos:", error);
      Alert.alert("Error", "Failed to load promotions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPromos();
  }, [fetchPromos]);

  const getDiscountLabel = (type: string, value: number): string => {
    switch (type) {
      case "percentage":
        return `${value}% OFF`;
      case "fixed":
        return `R${Number(value).toLocaleString('en-ZA')} OFF`;
      case "free_delivery":
        return "FREE DELIVERY";
      default:
        return "";
    }
  };

  const getDiscountColor = (type: string): string => {
    switch (type) {
      case "percentage":
        return "#8B5CF6";
      case "fixed":
        return colors.status.info;
      case "free_delivery":
        return colors.status.success;
      default:
        return "#6B7280";
    }
  };

  const handleTogglePromo = async (id: string) => {
    const promo = promos.find((p) => p.id === id);
    if (!promo) return;

    const newStatus = !promo.isActive;

    // Optimistic update
    setPromos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: newStatus } : p)),
    );

    try {
      const { error } = await supabase
        .from("promo_codes")
        .update({ is_active: newStatus })
        .eq("id", id);

      if (error) {
        console.error("Error toggling promo:", error);
        // Revert on error
        setPromos((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: !newStatus } : p)),
        );
        Alert.alert("Error", "Failed to update promotion status.");
      }
    } catch (e) {
      console.error("Error toggling promo:", e);
    }
  };

  const handleCreatePromo = async () => {
    if (!formCode.trim() || !formDescription.trim()) {
      Alert.alert("Error", "Please fill in the promo code and description.");
      return;
    }

    setSaving(true);

    try {
      const promoData: any = {
        code: formCode.toUpperCase(),
        description: formDescription,
        discount_type: formDiscountType,
        discount_value: parseFloat(formValue) || 0,
        min_order: parseFloat(formMinOrder) || 0,
        usage_count: 0,
        usage_limit: parseInt(formUsageLimit, 10) || 100,
        expiry_date: formEndDate,
        start_date: formStartDate,
        is_active: true,
        target_audience: formTarget,
      };

      const { data, error } = await supabase
        .from("promo_codes")
        .insert(promoData)
        .select()
        .single();

      if (error) {
        console.error("Error creating promo:", error);
        Alert.alert("Error", "Failed to create promotion. " + error.message);
        return;
      }

      resetForm();
      setCreateModalVisible(false);
      Alert.alert("Success", `Promo "${formCode.toUpperCase()}" has been created.`);
      fetchPromos();
    } catch (e) {
      console.error("Error creating promo:", e);
      Alert.alert("Error", "Failed to create promotion.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormCode("");
    setFormDescription("");
    setFormDiscountType("percentage");
    setFormValue("");
    setFormMinOrder("");
    setFormUsageLimit("");
    setFormStartDate(new Date().toISOString().split("T")[0]);
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    setFormEndDate(d.toISOString().split("T")[0]);
    setFormTarget("All");
    setShowDiscountTypePicker(false);
    setShowTargetPicker(false);
  };

  const handleBulkDeactivate = () => {
    Alert.alert("Bulk Deactivate", "Deactivate all active promotions?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate All",
        style: "destructive",
        onPress: async () => {
          try {
            const activeIds = promos.filter((p) => p.isActive).map((p) => p.id);
            if (activeIds.length === 0) {
              Alert.alert("Info", "No active promotions to deactivate.");
              return;
            }

            const { error } = await supabase
              .from("promo_codes")
              .update({ is_active: false })
              .in("id", activeIds);

            if (error) {
              console.error("Error bulk deactivating:", error);
              Alert.alert("Error", "Failed to deactivate promotions.");
              return;
            }

            setPromos((prev) => prev.map((p) => ({ ...p, isActive: false })));
            Alert.alert("Done", "All promotions have been deactivated.");
          } catch (e) {
            console.error("Error bulk deactivating:", e);
            Alert.alert("Error", "Failed to deactivate promotions.");
          }
        },
      },
    ]);
  };

  const activeCount = promos.filter((p) => p.isActive).length;

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
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Promotions & Coupons
            </Text>
            <View style={{ width: 38 }} />
          </View>
        </LinearGradient>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.gold.primary} />
          <Text style={{ color: colors.text.muted, marginTop: 12, fontSize: 14 }}>
            Loading promotions...
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
          <Text style={[st.headerTitle, { color: colors.text.primary }]}>
            Promotions & Coupons
          </Text>
          <TouchableOpacity
            onPress={() => {
              resetForm();
              setCreateModalVisible(true);
            }}
            style={[
              st.headerBtn,
              {
                backgroundColor: colors.gold.faint,
              },
            ]}
          >
            <Icon name="add" size={20} color={colors.gold.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Row */}
        <View style={st.statsRow}>
          {stats.map((stat, i) => (
            <View
              key={i}
              style={[
                st.statCard,
                {
                  backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                  borderColor: colors.gold.faint,
                },
              ]}
            >
              <View
                style={[st.statIcon, { backgroundColor: stat.color + "15" }]}
              >
                <Icon name={stat.icon} size={18} color={stat.color} />
              </View>
              <Text style={[st.statValue, { color: colors.text.primary }]}>
                {stat.value}
              </Text>
              <Text style={[st.statLabel, { color: colors.text.dim }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Active Promotions Section */}
        <View style={st.sectionHeader}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Active Promotions
          </Text>
          <View style={[st.countBadge, { backgroundColor: colors.status.success + "18" }]}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.status.success }}>
              {activeCount}
            </Text>
          </View>
        </View>

        {/* Promo Cards */}
        {promos.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Icon name="pricetag-outline" size={48} color={colors.gold.muted} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text.primary, marginTop: 10 }}>
              No promotions yet
            </Text>
            <Text style={{ fontSize: 13, color: colors.text.muted, marginTop: 4 }}>
              Tap + to create your first promotion
            </Text>
          </View>
        ) : (
          promos.map((promo) => {
            const discountColor = getDiscountColor(promo.discountType);
            const usagePercent =
              promo.usageLimit > 0
                ? (promo.usageCount / promo.usageLimit) * 100
                : 0;
            return (
              <View
                key={promo.id}
                style={[
                  st.promoCard,
                  {
                    backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                    borderColor: colors.gold.faint,
                  },
                ]}
              >
                {/* Top Row: Code + Toggle */}
                <View style={st.promoTopRow}>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <View
                        style={[
                          st.codeBadge,
                          {
                            backgroundColor: discountColor + "15",
                            borderColor: discountColor + "30",
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "800",
                            color: discountColor,
                            letterSpacing: 1,
                          }}
                        >
                          {promo.code}
                        </Text>
                      </View>
                      <View
                        style={[
                          st.discountBadge,
                          { backgroundColor: discountColor + "15" },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: discountColor,
                          }}
                        >
                          {getDiscountLabel(promo.discountType, promo.value)}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.text.muted,
                        marginTop: 8,
                        lineHeight: 18,
                      }}
                    >
                      {promo.description}
                    </Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Switch
                      value={promo.isActive}
                      onValueChange={() => handleTogglePromo(promo.id)}
                      trackColor={{
                        false: isDark ? "#333" : "#DDD",
                        true: colors.gold.primary + "60",
                      }}
                      thumbColor={
                        promo.isActive ? colors.gold.primary : isDark ? "#888" : "#CCC"
                      }
                    />
                    <Text
                      style={{
                        fontSize: 10,
                        color: promo.isActive ? colors.status.success : colors.status.error,
                        fontWeight: "700",
                        marginTop: 2,
                      }}
                    >
                      {promo.isActive ? "Active" : "Paused"}
                    </Text>
                  </View>
                </View>

                {/* Details */}
                <View style={st.promoDetailsRow}>
                  <View style={st.promoDetailItem}>
                    <Icon name="cart-outline" size={12} color={colors.text.dim} />
                    <Text style={{ fontSize: 11, color: colors.text.dim }}>
                      Min R{promo.minOrder}
                    </Text>
                  </View>
                  <View style={st.promoDetailItem}>
                    <Icon
                      name="people-outline"
                      size={12}
                      color={colors.text.dim}
                    />
                    <Text style={{ fontSize: 11, color: colors.text.dim }}>
                      {promo.targetAudience}
                    </Text>
                  </View>
                  <View style={st.promoDetailItem}>
                    <Icon
                      name="calendar-outline"
                      size={12}
                      color={colors.text.dim}
                    />
                    <Text style={{ fontSize: 11, color: colors.text.dim }}>
                      Exp: {promo.expiryDate}
                    </Text>
                  </View>
                </View>

                {/* Usage Progress Bar */}
                <View style={st.usageRow}>
                  <View style={st.usageLabelRow}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: colors.text.muted,
                      }}
                    >
                      Usage
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: colors.text.primary,
                      }}
                    >
                      {promo.usageCount}/{promo.usageLimit} uses
                    </Text>
                  </View>
                  <View
                    style={[
                      st.progressBarBg,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.06)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        st.progressBarFill,
                        {
                          backgroundColor:
                            usagePercent > 80
                              ? colors.status.error
                              : usagePercent > 50
                                ? colors.status.warning
                                : colors.status.success,
                          width: `${Math.min(usagePercent, 100)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* Bulk Deactivate */}
        {promos.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <TouchableOpacity
              onPress={handleBulkDeactivate}
              style={[
                st.bulkBtn,
                {
                  borderColor: colors.status.error + "40",
                  backgroundColor: colors.status.error + "08",
                },
              ]}
              activeOpacity={0.7}
            >
              <Icon name="close-circle-outline" size={18} color={colors.status.error} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.status.error }}>
                Bulk Deactivate All
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Expired Promos Section */}
        <TouchableOpacity
          onPress={() => setShowExpired(!showExpired)}
          style={[st.sectionHeader, { marginTop: 24 }]}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
              Expired Promotions
            </Text>
            <View
              style={[st.countBadge, { backgroundColor: "#6B7280" + "18" }]}
            >
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: "#6B7280" }}
              >
                {expiredPromos.length}
              </Text>
            </View>
          </View>
          <Icon
            name={showExpired ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.text.muted}
          />
        </TouchableOpacity>

        {showExpired &&
          expiredPromos.map((ep) => {
            const discountColor = getDiscountColor(ep.discountType);
            return (
              <View
                key={ep.id}
                style={[
                  st.expiredCard,
                  {
                    backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                    borderColor: colors.gold.faint,
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: colors.text.muted,
                          letterSpacing: 1,
                          textDecorationLine: "line-through",
                        }}
                      >
                        {ep.code}
                      </Text>
                      <View
                        style={[
                          st.discountBadge,
                          {
                            backgroundColor: discountColor + "10",
                            opacity: 0.6,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: discountColor,
                          }}
                        >
                          {getDiscountLabel(ep.discountType, ep.value)}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.text.dim,
                        marginTop: 4,
                      }}
                    >
                      {ep.description}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontSize: 10,
                        color: colors.status.error,
                        fontWeight: "600",
                      }}
                    >
                      Expired
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: colors.text.dim,
                        marginTop: 2,
                      }}
                    >
                      {ep.expiredDate}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", marginTop: 10, gap: 16 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Icon
                      name="people-outline"
                      size={12}
                      color={colors.text.dim}
                    />
                    <Text style={{ fontSize: 11, color: colors.text.dim }}>
                      {ep.totalUsed} uses
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Icon
                      name="cash-outline"
                      size={12}
                      color={colors.text.dim}
                    />
                    <Text style={{ fontSize: 11, color: colors.text.dim }}>
                      R{ep.totalRevenueLost.toLocaleString()} impact
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

        {showExpired && expiredPromos.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <Text style={{ fontSize: 13, color: colors.text.dim }}>
              No expired promotions
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create Promo Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
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
                Create Promo
              </Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Icon name="close" size={24} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Code */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Promo Code
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
                placeholder="e.g. SUMMER25"
                placeholderTextColor={colors.text.dim}
                value={formCode}
                onChangeText={setFormCode}
                autoCapitalize="characters"
              />

              {/* Description */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Description
              </Text>
              <TextInput
                style={[
                  st.fieldInput,
                  {
                    backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                    borderColor: colors.gold.faint,
                    color: colors.text.primary,
                    height: 70,
                    textAlignVertical: "top",
                    paddingTop: 14,
                  },
                ]}
                placeholder="Describe the promotion..."
                placeholderTextColor={colors.text.dim}
                value={formDescription}
                onChangeText={setFormDescription}
                multiline
              />

              {/* Discount Type Picker */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Discount Type
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
                onPress={() =>
                  setShowDiscountTypePicker(!showDiscountTypePicker)
                }
              >
                <Text style={{ color: colors.text.primary, fontSize: 15 }}>
                  {
                    DISCOUNT_TYPES.find((d) => d.key === formDiscountType)
                      ?.label
                  }
                </Text>
                <Icon
                  name={showDiscountTypePicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.text.muted}
                />
              </TouchableOpacity>
              {showDiscountTypePicker && (
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
                  {DISCOUNT_TYPES.map((dt) => (
                    <TouchableOpacity
                      key={dt.key}
                      style={[
                        st.pickerItem,
                        formDiscountType === dt.key && {
                          backgroundColor: colors.gold.primary + "15",
                        },
                      ]}
                      onPress={() => {
                        setFormDiscountType(dt.key);
                        setShowDiscountTypePicker(false);
                      }}
                    >
                      <Text
                        style={{
                          color:
                            formDiscountType === dt.key
                              ? colors.gold.primary
                              : colors.text.primary,
                          fontSize: 15,
                          fontWeight:
                            formDiscountType === dt.key ? "600" : "400",
                        }}
                      >
                        {dt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Value */}
              {formDiscountType !== "free_delivery" && (
                <>
                  <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                    {formDiscountType === "percentage"
                      ? "Discount (%)"
                      : "Discount Amount (R)"}
                  </Text>
                  <TextInput
                    style={[
                      st.fieldInput,
                      {
                        backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                        borderColor: isDark
                          ? "rgba(212,175,55,0.15)"
                          : "rgba(212,175,55,0.25)",
                        color: colors.text.primary,
                      },
                    ]}
                    placeholder={
                      formDiscountType === "percentage" ? "e.g. 20" : "e.g. 50"
                    }
                    placeholderTextColor={colors.text.dim}
                    value={formValue}
                    onChangeText={setFormValue}
                    keyboardType="decimal-pad"
                  />
                </>
              )}

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

              {/* Usage Limit */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Usage Limit
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
                placeholder="e.g. 100"
                placeholderTextColor={colors.text.dim}
                value={formUsageLimit}
                onChangeText={setFormUsageLimit}
                keyboardType="number-pad"
              />

              {/* Start / End Date */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                    Start Date
                  </Text>
                  <TextInput
                    style={[
                      st.fieldInput,
                      {
                        backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                        borderColor: isDark
                          ? "rgba(212,175,55,0.15)"
                          : "rgba(212,175,55,0.25)",
                        color: colors.text.primary,
                      },
                    ]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.text.dim}
                    value={formStartDate}
                    onChangeText={setFormStartDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                    End Date
                  </Text>
                  <TextInput
                    style={[
                      st.fieldInput,
                      {
                        backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                        borderColor: isDark
                          ? "rgba(212,175,55,0.15)"
                          : "rgba(212,175,55,0.25)",
                        color: colors.text.primary,
                      },
                    ]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.text.dim}
                    value={formEndDate}
                    onChangeText={setFormEndDate}
                  />
                </View>
              </View>

              {/* Target Audience Picker */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Target Audience
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
                onPress={() => setShowTargetPicker(!showTargetPicker)}
              >
                <Text style={{ color: colors.text.primary, fontSize: 15 }}>
                  {formTarget}
                </Text>
                <Icon
                  name={showTargetPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.text.muted}
                />
              </TouchableOpacity>
              {showTargetPicker && (
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
                  {TARGET_OPTIONS.map((target) => (
                    <TouchableOpacity
                      key={target}
                      style={[
                        st.pickerItem,
                        formTarget === target && {
                          backgroundColor: colors.gold.primary + "15",
                        },
                      ]}
                      onPress={() => {
                        setFormTarget(target);
                        setShowTargetPicker(false);
                      }}
                    >
                      <Text
                        style={{
                          color:
                            formTarget === target
                              ? colors.gold.primary
                              : colors.text.primary,
                          fontSize: 15,
                          fontWeight: formTarget === target ? "600" : "400",
                        }}
                      >
                        {target}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleCreatePromo}
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
                    {saving ? "Creating..." : "Create Promotion"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                onPress={() => setCreateModalVisible(false)}
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
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
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
  promoCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
  },
  promoTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  codeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  discountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  promoDetailsRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 14,
    flexWrap: "wrap",
  },
  promoDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  usageRow: {
    marginTop: 12,
  },
  usageLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  bulkBtn: {
    height: 48,
    borderRadius: borderRadius.xl,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
  },
  expiredCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: 16,
    paddingTop: 20,
    maxHeight: "92%",
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
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginTop: 12,
  },
});
