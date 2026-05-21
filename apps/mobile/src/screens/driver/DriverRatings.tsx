import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

interface RatingBreakdownItem {
  stars: number;
  count: number;
}

interface ReviewItem {
  id: string;
  name: string;
  initial: string;
  rating: number;
  date: string;
  comment: string;
}

interface PerformanceMetrics {
  totalDeliveries: number;
  successRate: string;
  avgRating: string;
}

export default function DriverRatings() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark, shadows } = useTheme();

  const [loading, setLoading] = useState(true);
  const [overallRating, setOverallRating] = useState(0);
  const [ratingBreakdown, setRatingBreakdown] = useState<RatingBreakdownItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    totalDeliveries: 0,
    successRate: "0",
    avgRating: "0",
  });

  useEffect(() => {
    fetchRatings();
  }, []);

  const fetchRatings = async () => {
    setLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;

      const { data: ratings } = await supabase
        .from("delivery_ratings")
        .select("*, profiles!delivery_ratings_customer_id_fkey(full_name)")
        .eq("driver_id", userId)
        .order("created_at", { ascending: false });

      // Calculate overall rating
      const avgRating = ratings?.length
        ? ratings.reduce((s: number, r: any) => s + (r.driver_rating || 0), 0) /
          ratings.length
        : 0;

      // Calculate star breakdown
      const breakdown = [5, 4, 3, 2, 1].map((star) => ({
        stars: star,
        count:
          ratings?.filter((r: any) => Math.round(r.driver_rating) === star)
            .length || 0,
      }));

      // Map reviews
      const mappedReviews: ReviewItem[] = (ratings || [])
        .filter((r: any) => r.comment || r.review_text)
        .slice(0, 10)
        .map((r: any) => {
          const fullName = r.profiles?.full_name || "Customer";
          return {
            id: r.id,
            name: fullName,
            initial: fullName.charAt(0).toUpperCase(),
            rating: Math.round(r.driver_rating || 0),
            date: new Date(r.created_at).toLocaleDateString("en-ZA", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            comment: r.comment || r.review_text || "",
          };
        });

      // Calculate performance metrics from delivery_assignments
      const { data: assignments } = await supabase
        .from("delivery_assignments")
        .select("status, created_at, completed_at")
        .eq("driver_id", userId);

      const totalDeliveries = assignments?.length || 0;
      const completed =
        assignments?.filter((a: any) => a.status === "delivered").length || 0;
      const successRate =
        totalDeliveries > 0
          ? ((completed / totalDeliveries) * 100).toFixed(1)
          : "0";

      setOverallRating(avgRating);
      setRatingBreakdown(breakdown);
      setReviews(mappedReviews);
      setPerformanceMetrics({
        totalDeliveries,
        successRate,
        avgRating: avgRating.toFixed(1),
      });
    } catch (error) {
      console.error("Error fetching ratings:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalRatings = ratingBreakdown.reduce((s, r) => s + r.count, 0);
  const maxCount = Math.max(...ratingBreakdown.map((r) => r.count), 1);

  const renderStars = (count: number, size: number = 14) => (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name={i <= count ? "star" : "star-outline"}
          size={size}
          color={i <= count ? colors.gold.primary : colors.text.dim}
        />
      ))}
    </View>
  );

  const metricsDisplay = [
    {
      label: "Completion Rate",
      value: `${performanceMetrics.successRate}%`,
      color: "#8B5CF6",
      icon: "flag-outline",
    },
    {
      label: "Total Deliveries",
      value: `${performanceMetrics.totalDeliveries}`,
      color: colors.status.info,
      icon: "checkmark-circle-outline",
    },
    {
      label: "Avg Rating",
      value: `${performanceMetrics.avgRating}/5`,
      color: colors.status.warning,
      icon: "heart-outline",
    },
  ];

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
              Ratings
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={colors.gold.primary} />
          <Text
            style={{ color: colors.text.muted, marginTop: 12, fontSize: 14 }}
          >
            Loading ratings...
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Overall Rating Card */}
          <View
            style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}
          >
            <View
              style={[
                st.overallCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                },
              ]}
            >
              <Text style={st.bigRating}>
                {overallRating > 0 ? overallRating.toFixed(1) : "--"}
              </Text>
              {renderStars(Math.round(overallRating), 24)}
              <Text
                style={{
                  fontSize: 13,
                  color: colors.text.muted,
                  marginTop: 8,
                }}
              >
                Based on {totalRatings} deliveries
              </Text>
            </View>
          </View>

          {/* Rating Breakdown */}
          <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
            <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
              Rating Breakdown
            </Text>
            <View
              style={[
                st.breakdownCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                },
              ]}
            >
              {ratingBreakdown.map((item) => {
                const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                return (
                  <View key={item.stars} style={st.breakdownRow}>
                    <Text
                      style={[
                        st.breakdownLabel,
                        { color: colors.text.muted },
                      ]}
                    >
                      {item.stars} star
                    </Text>
                    <View
                      style={[
                        st.barBg,
                        { backgroundColor: colors.background.tertiary },
                      ]}
                    >
                      <LinearGradient
                        colors={[colors.gold.primary, colors.gold.dark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[st.barFill, { width: `${pct}%` }]}
                      />
                    </View>
                    <Text
                      style={[
                        st.breakdownCount,
                        { color: colors.text.primary },
                      ]}
                    >
                      {item.count}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Performance Metrics */}
          <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
            <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
              Performance Metrics
            </Text>
            <View style={st.metricsGrid}>
              {metricsDisplay.map((metric, i) => (
                <View
                  key={i}
                  style={[
                    st.metricCard,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.gold.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      st.metricIconCircle,
                      { backgroundColor: metric.color + "15" },
                    ]}
                  >
                    <Icon name={metric.icon} size={20} color={metric.color} />
                  </View>
                  <Text style={[st.metricValue, { color: metric.color }]}>
                    {metric.value}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.text.muted,
                      textAlign: "center",
                    }}
                  >
                    {metric.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Recent Reviews */}
          <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
            <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
              Recent Reviews
            </Text>
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <View
                  key={review.id}
                  style={[
                    st.reviewCard,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.gold.border,
                    },
                  ]}
                >
                  <View style={st.reviewHeader}>
                    <LinearGradient
                      colors={[colors.gold.primary, colors.gold.dark]}
                      style={st.reviewAvatar}
                    >
                      <Text style={st.reviewInitial}>{review.initial}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          st.reviewName,
                          { color: colors.text.primary },
                        ]}
                      >
                        {review.name}
                      </Text>
                      {renderStars(review.rating, 12)}
                    </View>
                    <Text style={{ fontSize: 11, color: colors.text.dim }}>
                      {review.date}
                    </Text>
                  </View>
                  <Text
                    style={[
                      st.reviewComment,
                      { color: colors.text.muted },
                    ]}
                  >
                    {review.comment}
                  </Text>
                </View>
              ))
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 20 }}>
                <Icon
                  name="chatbubble-outline"
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
                  No reviews yet
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
  overallCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  bigRating: {
    fontSize: 56,
    fontWeight: "900",
    color: "#D4AF37",
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  breakdownCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: "600",
    width: 44,
  },
  barBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  breakdownCount: {
    fontSize: 13,
    fontWeight: "700",
    width: 32,
    textAlign: "right",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: (width - spacing.md * 2 - 10) / 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
  },
  metricIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  reviewCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewInitial: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "800",
  },
  reviewName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 18,
  },
});
