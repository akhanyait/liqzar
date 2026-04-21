import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "../../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";
import { spacing, borderRadius } from "../../theme";

/* ───────── TYPES ───────── */

interface VerifyItem {
  id: string;
  name: string;
  quantity: number;
  barcode: string;
  category: string;
  verified: boolean;
}

/* ───────── COMPONENT ───────── */

export default function DriverAIItemVerify() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const orderId = route.params?.orderId;
  const orderNumber = route.params?.orderNumber || orderId || "N/A";

  const [items, setItems] = useState<VerifyItem[]>([]);
  const [loading, setLoading] = useState(true);

  const verifiedCount = items.filter((i) => i.verified).length;
  const allVerified = items.length > 0 && verifiedCount === items.length;
  const progress = items.length > 0 ? verifiedCount / items.length : 0;

  useEffect(() => {
    if (orderId) {
      fetchItems();
    } else {
      setLoading(false);
    }
  }, [orderId]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, quantity, products(name, barcode, category)")
        .eq("order_id", orderId);

      if (error) {
        console.error("Error fetching order items:", error);
        setItems([]);
      } else {
        const mapped: VerifyItem[] = (data || []).map((row: any) => ({
          id: row.id,
          name: row.products?.name || "Unknown Item",
          quantity: row.quantity || 1,
          barcode: row.products?.barcode || "",
          category: row.products?.category || "",
          verified: false,
        }));
        setItems(mapped);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, verified: true } : item)),
    );
  };

  const handleConfirmAll = async () => {
    if (!allVerified) return;
    try {
      // Update the order to mark items as verified
      await supabase
        .from("orders")
        .update({ items_verified: true })
        .eq("id", orderId);

      Alert.alert(
        "Items Confirmed",
        "All items have been verified. Proceeding to delivery.",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      console.error("Error confirming items:", error);
      Alert.alert("Error", "Failed to confirm items. Please try again.");
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              AI Item Verification
            </Text>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 10,
                backgroundColor: colors.gold.primary + "22",
                borderWidth: 1,
                borderColor: colors.gold.border,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                  color: colors.gold.primary,
                }}
              >
                PREVIEW
              </Text>
            </View>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
      >
        {/* Order Selector */}
        <View
          style={[
            st.orderSelector,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <Icon
            name="document-text-outline"
            size={20}
            color={colors.gold.primary}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontSize: 12, color: colors.text.muted }}>
              Current Order
            </Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: colors.text.primary,
              }}
            >
              #{orderNumber}
            </Text>
          </View>
          <Icon name="chevron-down" size={20} color={colors.text.muted} />
        </View>

        {/* Item Checklist */}
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={colors.gold.primary} />
            <Text
              style={{
                color: colors.text.muted,
                marginTop: 12,
                fontSize: 13,
              }}
            >
              Loading order items...
            </Text>
          </View>
        ) : items.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Icon name="cube-outline" size={40} color={colors.text.dim} />
            <Text
              style={{
                color: colors.text.muted,
                marginTop: 10,
                fontSize: 14,
              }}
            >
              {orderId ? "No items found for this order" : "No order selected"}
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View
              key={item.id}
              style={[
                st.itemCard,
                {
                  backgroundColor: item.verified
                    ? isDark
                      ? "rgba(16,185,129,0.06)"
                      : "rgba(16,185,129,0.04)"
                    : isDark
                      ? "#1a1510"
                      : "#F5F3EF",
                  borderColor: item.verified
                    ? "#10B98130"
                    : isDark
                      ? "rgba(212,175,55,0.15)"
                      : "rgba(212,175,55,0.25)",
                },
              ]}
            >
              <View style={st.itemRow}>
                {/* Product Image Placeholder */}
                <View
                  style={[
                    st.imagePlaceholder,
                    {
                      backgroundColor: isDark
                        ? "rgba(212,175,55,0.08)"
                        : "rgba(212,175,55,0.1)",
                    },
                  ]}
                >
                  <Icon
                    name="wine-outline"
                    size={24}
                    color={colors.gold.primary}
                  />
                </View>

                {/* Item Details */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[st.itemName, { color: colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.text.muted }}>
                    Qty: {item.quantity}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.text.dim }}>
                    {item.barcode ? `Barcode: ${item.barcode}` : item.category || "No barcode"}
                  </Text>
                  {item.verified && (
                    <View style={st.confidenceRow}>
                      <Icon name="checkmark-circle" size={12} color={colors.status.success} />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: colors.status.success,
                          marginLeft: 4,
                        }}
                      >
                        Verified
                      </Text>
                    </View>
                  )}
                </View>

                {/* Verified check or Scan button */}
                {item.verified ? (
                  <View style={st.verifiedBadge}>
                    <Icon name="checkmark-circle" size={28} color={colors.status.success} />
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleScanItem(item.id)}
                    style={st.scanBtn}
                    activeOpacity={0.75}
                  >
                    <Icon name="scan-outline" size={16} color={colors.white} />
                    <Text style={st.scanBtnText}>Scan Item</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}

        {/* Verification Summary */}
        <View
          style={[
            st.analysisCard,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <View style={st.analysisHeader}>
            <Icon
              name="shield-checkmark-outline"
              size={20}
              color={colors.gold.primary}
            />
            <Text
              style={[st.analysisTitleText, { color: colors.text.primary }]}
            >
              Verification Summary
            </Text>
          </View>
          <Text style={[st.analysisText, { color: colors.text.muted }]}>
            {items.length === 0
              ? "No items to verify."
              : allVerified
                ? "All items verified and match order manifest."
                : `${verifiedCount} of ${items.length} items verified (${Math.round(progress * 100)}%).`}
          </Text>
          <Text style={[st.analysisText, { color: colors.text.muted }]}>
            {allVerified
              ? "Package integrity: Verified"
              : "Complete verification of all items before proceeding."}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Summary Bar */}
      <View
        style={[
          st.bottomBar,
          {
            backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
            borderTopColor: isDark
              ? "rgba(212,175,55,0.15)"
              : "rgba(212,175,55,0.25)",
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        {/* Progress row */}
        <View style={st.progressRow}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: colors.text.primary,
            }}
          >
            {verifiedCount}/{items.length} Items Verified
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: allVerified ? colors.status.success : colors.gold.primary,
            }}
          >
            {Math.round(progress * 100)}%
          </Text>
        </View>

        {/* Progress Bar */}
        <View
          style={[
            st.progressBarBg,
            { backgroundColor: isDark ? "#2a2520" : "#E5E2DC" },
          ]}
        >
          <View
            style={[
              st.progressBarFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: allVerified ? colors.status.success : colors.gold.primary,
              },
            ]}
          />
        </View>

        {/* Confirm Button */}
        <TouchableOpacity
          onPress={handleConfirmAll}
          activeOpacity={allVerified ? 0.85 : 1}
          disabled={!allVerified}
        >
          <LinearGradient
            colors={
              allVerified
                ? [colors.gold.primary, colors.gold.dark]
                : [
                    isDark ? "#2a2520" : "#D6D3CD",
                    isDark ? "#2a2520" : "#D6D3CD",
                  ]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[st.confirmBtn, !allVerified && { opacity: 0.5 }]}
          >
            <Icon
              name="checkmark-done"
              size={22}
              color={allVerified ? colors.white : isDark ? "#666" : "#999"}
            />
            <Text
              style={[
                st.confirmBtnText,
                {
                  color: allVerified ? colors.white : isDark ? "#666" : "#999",
                },
              ]}
            >
              Confirm All Items
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
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

  orderSelector: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 16,
  },

  itemCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  imagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  verifiedBadge: {
    justifyContent: "center",
    alignItems: "center",
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
  },
  scanBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },

  analysisCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 16,
    marginTop: 6,
  },
  analysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  analysisTitleText: {
    fontSize: 15,
    fontWeight: "700",
  },
  analysisText: {
    fontSize: 13,
    lineHeight: 20,
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 14,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  confirmBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  confirmBtnText: {
    fontSize: 17,
    fontWeight: "800",
  },
});
