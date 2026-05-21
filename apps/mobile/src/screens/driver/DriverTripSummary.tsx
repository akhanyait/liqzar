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
import BrandMark from "../../components/BrandMark";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../../contexts/AuthContext";
import { spacing, borderRadius } from "../../theme";
import { supabase } from "../../lib/supabase";

/* ───────── COMPONENT ───────── */

export default function DriverTripSummary() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const orderId = route.params?.orderId || route.params?.delivery?.orderId;

  const [loading, setLoading] = useState(true);
  const [tripData, setTripData] = useState<any>(null);
  const [customerRating, setCustomerRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchTripData();
    } else {
      setLoading(false);
    }
  }, [orderId]);

  const fetchTripData = async () => {
    setLoading(true);
    try {
      const { data: order } = await supabase
        .from("orders")
        .select(
          "*, order_items(*, products(name, price)), delivery_assignments(*), delivery_ratings(*)",
        )
        .eq("id", orderId)
        .single();
      setTripData(order);

      // Check if already rated
      if (order?.delivery_ratings && order.delivery_ratings.length > 0) {
        const existingRating = order.delivery_ratings.find(
          (r: any) => r.driver_id === user?.id,
        );
        if (existingRating) {
          setCustomerRating(existingRating.delivery_rating || 0);
          setRatingSubmitted(true);
        }
      }
    } catch (error) {
      console.error("Error fetching trip data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRateCustomer = async (star: number) => {
    setCustomerRating(star);
    if (!ratingSubmitted) {
      try {
        await supabase.from("delivery_ratings").upsert({
          order_id: orderId,
          customer_id: tripData?.user_id,
          driver_id: user?.id,
          driver_rating: star,
          delivery_rating: star,
        });
        setRatingSubmitted(true);
      } catch (error) {
        console.error("Error submitting rating:", error);
      }
    }
  };

  const handleReportIssue = () => {
    Alert.alert(
      "Report Issue",
      "If you experienced any problems with this delivery, please describe the issue.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          onPress: () => navigation.navigate("DriverSupport"),
        },
      ],
    );
  };

  const handleBackToDashboard = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text
          style={{ color: colors.text.muted, marginTop: 12, fontSize: 14 }}
        >
          Loading trip summary...
        </Text>
      </View>
    );
  }

  // Derive display values from real data
  const orderNumber = tripData?.order_number || orderId || "N/A";
  const items = tripData?.order_items || [];
  const assignment = tripData?.delivery_assignments?.[0];
  const deliveryFee = 25;
  const tip =
    tripData?.delivery_ratings?.[0]?.tip_amount || 0;
  const total = deliveryFee + tip;
  const depotAddress = "LIQZAR Depot";
  const customerAddress = tripData?.delivery_address || "N/A";

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
            <Icon name="close" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <BrandMark size="xs" />
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Trip Summary
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* Delivery Complete Checkmark */}
        <View style={st.completeSection}>
          <View style={st.checkCircleLarge}>
            <Icon name="checkmark" size={40} color={colors.white} />
          </View>
          <Text style={[st.completeTitle, { color: colors.text.primary }]}>
            Delivery Complete!
          </Text>
        </View>

        {/* Order Card */}
        <View
          style={[
            st.card,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <View style={st.orderIdRow}>
            <Icon
              name="receipt-outline"
              size={18}
              color={colors.gold.primary}
            />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: colors.text.primary,
                marginLeft: 8,
              }}
            >
              #{orderNumber}
            </Text>
          </View>
        </View>

        {/* Trip Stats Row */}
        <View style={st.statsRow}>
          {[
            {
              label: "Items",
              value: `${items.length}`,
              icon: "cube-outline" as const,
              accent: colors.status.info,
            },
            {
              label: "Status",
              value: tripData?.status || "Delivered",
              icon: "checkmark-circle-outline" as const,
              accent: colors.status.success,
            },
            {
              label: "Rating",
              value: customerRating > 0 ? `${customerRating}/5` : "Pending",
              icon: "star-outline" as const,
              accent: colors.status.warning,
            },
          ].map((stat, i) => (
            <View
              key={i}
              style={[
                st.statCard,
                {
                  backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                  borderColor: isDark
                    ? "rgba(212,175,55,0.15)"
                    : "rgba(212,175,55,0.25)",
                },
              ]}
            >
              <View
                style={[st.statIcon, { backgroundColor: stat.accent + "15" }]}
              >
                <Icon name={stat.icon} size={18} color={stat.accent} />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: colors.text.primary,
                  marginTop: 6,
                }}
              >
                {stat.value}
              </Text>
              <Text style={{ fontSize: 11, color: colors.text.muted }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Route Summary */}
        <View
          style={[
            st.card,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.text.primary,
              marginBottom: 12,
            }}
          >
            Route
          </Text>
          <View style={st.routeRow}>
            <View style={st.routeTimeline}>
              <View
                style={[st.routeDotStart, { backgroundColor: colors.status.info }]}
              />
              <View
                style={[
                  st.routeLine,
                  { backgroundColor: isDark ? "#2a2520" : "#D6D3CD" },
                ]}
              />
              <View style={[st.routeDotEnd, { backgroundColor: colors.status.success }]} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: colors.status.info,
                    marginBottom: 2,
                  }}
                >
                  DEPOT
                </Text>
                <Text
                  style={{ fontSize: 13, color: colors.text.muted }}
                  numberOfLines={2}
                >
                  {depotAddress}
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: colors.status.success,
                    marginBottom: 2,
                  }}
                >
                  CUSTOMER
                </Text>
                <Text
                  style={{ fontSize: 13, color: colors.text.muted }}
                  numberOfLines={2}
                >
                  {customerAddress}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Earnings Breakdown */}
        <View
          style={[
            st.card,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.text.primary,
              marginBottom: 12,
            }}
          >
            Earnings Breakdown
          </Text>
          {[
            { label: "Base fare", amount: deliveryFee },
            { label: "Tips", amount: tip },
          ].map((item, i) => (
            <View key={i} style={st.earningsLine}>
              <Text style={{ fontSize: 14, color: colors.text.muted }}>
                {item.label}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color:
                    item.amount === 0 ? colors.text.dim : colors.text.primary,
                }}
              >
                R
                {item.amount.toLocaleString("en-ZA", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
          ))}
          <View
            style={[
              st.totalLine,
              {
                borderTopColor: isDark
                  ? "rgba(212,175,55,0.15)"
                  : "rgba(212,175,55,0.25)",
              },
            ]}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: colors.text.primary,
              }}
            >
              Total
            </Text>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "900",
                color: colors.gold.primary,
              }}
            >
              R
              {total.toLocaleString("en-ZA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>

        {/* Items Delivered */}
        <View
          style={[
            st.card,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.text.primary,
              marginBottom: 10,
            }}
          >
            Items Delivered
          </Text>
          {items.length > 0 ? (
            items.map((item: any) => (
              <View key={item.id} style={st.deliveredItem}>
                <Icon name="checkmark-circle" size={16} color={colors.status.success} />
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.text.muted,
                    marginLeft: 8,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {item.products?.name || "Item"}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: colors.text.dim,
                  }}
                >
                  x{item.quantity || 1}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 13, color: colors.text.dim }}>
              No item details available
            </Text>
          )}
        </View>

        {/* Rate Customer */}
        <View
          style={[
            st.card,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.text.primary,
              marginBottom: 10,
            }}
          >
            Rate Customer
          </Text>
          <View style={st.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleRateCustomer(star)}
                activeOpacity={0.7}
                disabled={ratingSubmitted}
              >
                <Icon
                  name={star <= customerRating ? "star" : "star-outline"}
                  size={36}
                  color={
                    star <= customerRating
                      ? colors.gold.primary
                      : colors.text.dim
                  }
                />
              </TouchableOpacity>
            ))}
          </View>
          {customerRating > 0 && (
            <Text
              style={{
                fontSize: 13,
                color: colors.text.muted,
                textAlign: "center",
                marginTop: 6,
              }}
            >
              {ratingSubmitted
                ? `Rating submitted: ${customerRating}/5`
                : `You rated this customer ${customerRating}/5`}
            </Text>
          )}
        </View>

        {/* Report Issue Link */}
        <TouchableOpacity onPress={handleReportIssue} style={st.reportIssueBtn}>
          <Icon name="flag-outline" size={16} color={colors.status.error} />
          <Text style={st.reportIssueText}>Report Issue</Text>
        </TouchableOpacity>

        {/* Back to Dashboard Button */}
        <TouchableOpacity
          onPress={handleBackToDashboard}
          activeOpacity={0.85}
          style={{ marginTop: 8 }}
        >
          <LinearGradient
            colors={[colors.gold.primary, colors.gold.dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={st.dashboardBtn}
          >
            <Icon name="grid-outline" size={20} color={colors.white} />
            <Text style={st.dashboardBtnText}>Back to Dashboard</Text>
          </LinearGradient>
        </TouchableOpacity>
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

  completeSection: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 8,
  },
  checkCircleLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  completeTitle: {
    fontSize: 22,
    fontWeight: "900",
  },

  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  orderIdRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  routeRow: {
    flexDirection: "row",
  },
  routeTimeline: {
    alignItems: "center",
    width: 16,
  },
  routeDotStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  routeLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  routeDotEnd: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  earningsLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
  },

  deliveredItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },

  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },

  reportIssueBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
  },
  reportIssueText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
  },

  dashboardBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  dashboardBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "800",
  },
});
