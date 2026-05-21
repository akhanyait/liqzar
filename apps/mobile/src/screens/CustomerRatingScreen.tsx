import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "../components/Icon";
import BrandMark from "../components/BrandMark";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, borderRadius } from "../theme";
import { supabase } from "../lib/supabase";

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

const TIP_OPTIONS = [
  { label: "R10", value: 10 },
  { label: "R20", value: 20 },
  { label: "R50", value: 50 },
  { label: "Custom", value: -1 },
];

interface DriverInfo {
  full_name: string;
  phone: string;
  profile_image_url: string | null;
}

export default function CustomerRatingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark, shadows } = useTheme();

  const orderId = route.params?.orderId;
  const driverId = route.params?.driverId;

  const [driverRating, setDriverRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState<number>(0);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [loadingDriver, setLoadingDriver] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDriverInfo();
  }, [driverId]);

  const fetchDriverInfo = async () => {
    if (!driverId) {
      setLoadingDriver(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('driver_profiles')
        .select('full_name, phone, profile_image_url')
        .eq('user_id', driverId)
        .single();
      setDriver(data);
    } catch (error) {
      console.error('Error fetching driver info:', error);
    } finally {
      setLoadingDriver(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const userId = (await supabase.auth.getUser()).data.user?.id;

      await supabase.from('delivery_ratings').insert({
        order_id: orderId,
        customer_id: userId,
        driver_id: driverId,
        delivery_rating: deliveryRating,
        driver_rating: driverRating,
        comment: comment,
        tip_amount: selectedTip === -1 ? customTip : selectedTip || 0,
      });

      Alert.alert('Thank You!', 'Your rating has been submitted.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStarSelector = (
    rating: number,
    onSelect: (star: number) => void,
    label: string,
  ) => (
    <View style={{ marginBottom: 6 }}>
      <View style={st.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onSelect(star)}
            activeOpacity={0.7}
            style={st.starBtn}
          >
            <Icon
              name={star <= rating ? "star" : "star-outline"}
              size={36}
              color={star <= rating ? colors.gold.primary : colors.text.dim}
            />
          </TouchableOpacity>
        ))}
      </View>
      {rating > 0 && (
        <Text
          style={{
            textAlign: "center",
            fontSize: 13,
            color: colors.gold.primary,
            fontWeight: "600",
            marginTop: 4,
          }}
        >
          {STAR_LABELS[rating]}
        </Text>
      )}
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
          <View style={{ alignItems: "center" }}>
            <BrandMark size="xs" />
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Rate Your Order
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Rate your driver */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <View
            style={[
              st.card,
              {
                backgroundColor: colors.background.card,
                borderColor: colors.gold.border,
              },
            ]}
          >
            <Text style={[st.cardTitle, { color: colors.text.primary }]}>
              Rate your driver
            </Text>

            {/* Driver Info */}
            <View style={st.driverRow}>
              {driver?.profile_image_url ? (
                <Image
                  source={{ uri: driver.profile_image_url }}
                  style={st.driverAvatarImage}
                />
              ) : (
                <LinearGradient
                  colors={[colors.gold.primary, colors.gold.dark]}
                  style={st.driverAvatar}
                >
                  <Icon name="person" size={24} color={colors.white} />
                </LinearGradient>
              )}
              <View>
                {loadingDriver ? (
                  <ActivityIndicator size="small" color={colors.gold.primary} />
                ) : (
                  <>
                    <Text style={[st.driverName, { color: colors.text.primary }]}>
                      {driver?.full_name || "Your Driver"}
                    </Text>
                    {driver?.phone && (
                      <Text style={{ fontSize: 12, color: colors.text.muted }}>
                        {driver.phone}
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>

            {renderStarSelector(driverRating, setDriverRating, "driver")}
          </View>
        </View>

        {/* Rate your delivery */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 12 }}>
          <View
            style={[
              st.card,
              {
                backgroundColor: colors.background.card,
                borderColor: colors.gold.border,
              },
            ]}
          >
            <Text style={[st.cardTitle, { color: colors.text.primary }]}>
              Rate your delivery
            </Text>
            {renderStarSelector(deliveryRating, setDeliveryRating, "delivery")}
          </View>
        </View>

        {/* Comments */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 12 }}>
          <View
            style={[
              st.card,
              {
                backgroundColor: colors.background.card,
                borderColor: colors.gold.border,
              },
            ]}
          >
            <Text style={[st.cardTitle, { color: colors.text.primary }]}>
              Comments
            </Text>
            <TextInput
              style={[
                st.commentInput,
                {
                  color: colors.text.primary,
                  backgroundColor: colors.background.tertiary,
                  borderColor: colors.gold.border,
                },
              ]}
              placeholder="Share your experience..."
              placeholderTextColor={colors.text.dim}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={comment}
              onChangeText={setComment}
            />
          </View>
        </View>

        {/* Tip your driver */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 12 }}>
          <View
            style={[
              st.card,
              {
                backgroundColor: colors.background.card,
                borderColor: colors.gold.border,
              },
            ]}
          >
            <Text style={[st.cardTitle, { color: colors.text.primary }]}>
              Tip your driver
            </Text>
            <View style={st.tipRow}>
              {TIP_OPTIONS.map((tip) => {
                const isSelected = selectedTip === tip.value;
                return (
                  <TouchableOpacity
                    key={tip.label}
                    onPress={() =>
                      setSelectedTip(isSelected ? null : tip.value)
                    }
                    activeOpacity={0.75}
                    style={{ flex: 1 }}
                  >
                    {isSelected ? (
                      <LinearGradient
                        colors={[colors.gold.primary, colors.gold.dark]}
                        style={st.tipBtn}
                      >
                        <Text style={[st.tipBtnText, { color: "#000" }]}>
                          {tip.label}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View
                        style={[
                          st.tipBtn,
                          {
                            borderWidth: 1,
                            borderColor: colors.gold.border,
                            backgroundColor: colors.background.tertiary,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            st.tipBtnText,
                            { color: colors.text.primary },
                          ]}
                        >
                          {tip.label}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedTip === -1 && (
              <TextInput
                style={[
                  st.commentInput,
                  {
                    color: colors.text.primary,
                    backgroundColor: colors.background.tertiary,
                    borderColor: colors.gold.border,
                    minHeight: 48,
                    marginTop: 12,
                    textAlign: "center",
                    fontSize: 16,
                    fontWeight: "700",
                  },
                ]}
                placeholder="Enter custom tip amount"
                placeholderTextColor={colors.text.dim}
                keyboardType="numeric"
                value={customTip ? String(customTip) : ""}
                onChangeText={(t) => setCustomTip(Number(t.replace(/[^0-9]/g, "")))}
              />
            )}
          </View>
        </View>

        {/* Submit */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
          <TouchableOpacity onPress={handleSubmit} activeOpacity={0.8} disabled={submitting}>
            <LinearGradient
              colors={[colors.gold.primary, colors.gold.dark]}
              style={st.submitBtn}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={st.submitBtnText}>Submit</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
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
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  driverAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  starBtn: {
    padding: 4,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
  },
  tipRow: {
    flexDirection: "row",
    gap: 10,
  },
  tipBtn: {
    height: 44,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  tipBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  submitBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  submitBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
