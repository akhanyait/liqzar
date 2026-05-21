import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "../../components/Icon";
import BrandMark from "../../components/BrandMark";
import { useTheme } from "../../contexts/ThemeContext";
import { useOrders } from "../../contexts/OrderContext";
import { spacing, borderRadius } from "../../theme";

const { width } = Dimensions.get("window");

const STEPS = [
  { key: "driver_assigned", label: "Assigned", icon: "checkmark-circle-outline" },
  { key: "picked_up", label: "Picked Up", icon: "bag-check-outline" },
  { key: "en_route", label: "En Route", icon: "navigate-outline" },
  { key: "delivered", label: "Delivered", icon: "checkmark-done-outline" },
];

export default function DriverDeliveryDetail() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark, gradients } = useTheme();
  const { markPickedUp, markEnRoute, markDelivered } = useOrders();

  const delivery = route.params?.delivery;
  const orderId = delivery?.orderId || delivery?.id;
  const [status, setStatus] = useState(delivery?.status || "driver_assigned");
  const [loading, setLoading] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.key === status);

  const handleCall = () => {
    if (delivery?.customerPhone) {
      Linking.openURL(`tel:${delivery.customerPhone.replace(/\s/g, "")}`);
    }
  };

  const handleNextStep = async () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= STEPS.length) return;
    const nextStatus = STEPS[nextIndex].key;

    if (nextStatus === "picked_up") {
      // Navigate to depot pickup → scan verify flow
      navigation.navigate("DriverDepotPickup", { delivery: { ...delivery, orderId } });
    } else if (nextStatus === "en_route") {
      // Mark en_route in backend, then navigate
      setLoading(true);
      const success = await markEnRoute(orderId);
      setLoading(false);
      if (success) {
        setStatus("en_route");
        navigation.navigate("DriverNavigation", { delivery: { ...delivery, orderId } });
      }
    } else if (nextStatus === "delivered") {
      // Navigate to PIN verification screen
      navigation.navigate("DriverDeliveryPinVerify", { delivery: { ...delivery, orderId } });
    }
  };

  const nextStep =
    currentStepIndex < STEPS.length - 1 ? STEPS[currentStepIndex + 1] : null;

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
              #{delivery?.orderNumber || "Order"}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.md }}
      >
        {/* Progress Steps */}
        <View
          style={[
            st.progressCard,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
        >
          <Text style={[st.progressTitle, { color: colors.text.primary }]}>
            Delivery Progress
          </Text>
          <View style={st.stepsRow}>
            {STEPS.map((step, i) => {
              const isCompleted = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              const stepColor = isCompleted ? colors.status.success : colors.text.dim;
              return (
                <View key={step.key} style={st.stepItem}>
                  <View
                    style={[
                      st.stepCircle,
                      {
                        backgroundColor: isCompleted
                          ? colors.status.success
                          : "transparent",
                        borderColor: isCompleted ? colors.status.success : colors.text.dim,
                      },
                      isCurrent && { borderWidth: 2.5, borderColor: colors.status.success },
                    ]}
                  >
                    <Icon
                      name={step.icon}
                      size={16}
                      color={isCompleted ? colors.white : colors.text.dim}
                    />
                  </View>
                  <Text
                    style={[
                      st.stepLabel,
                      {
                        color: stepColor,
                        fontWeight: isCurrent ? "700" : "500",
                      },
                    ]}
                  >
                    {step.label}
                  </Text>
                  {i < STEPS.length - 1 && (
                    <View
                      style={[
                        st.stepLine,
                        {
                          backgroundColor:
                            i < currentStepIndex ? colors.status.success : colors.border,
                        },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Customer Info */}
        <View
          style={[
            st.infoCard,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
        >
          <Text style={[st.cardTitle, { color: colors.text.primary }]}>
            Customer
          </Text>
          <View style={st.infoRow}>
            <Icon name="person-outline" size={18} color={colors.gold.muted} />
            <Text style={[st.infoValue, { color: colors.text.primary }]}>
              {delivery?.customerName}
            </Text>
          </View>
          <View style={st.infoRow}>
            <Icon name="call-outline" size={18} color={colors.gold.muted} />
            <Text style={[st.infoValue, { color: colors.text.primary }]}>
              {delivery?.customerPhone}
            </Text>
            <TouchableOpacity
              onPress={handleCall}
              style={[st.callBtn, { backgroundColor: colors.status.success }]}
            >
              <Icon name="call" size={16} color={colors.white} />
              <Text style={st.callBtnText}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delivery Address */}
        <View
          style={[
            st.infoCard,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
        >
          <Text style={[st.cardTitle, { color: colors.text.primary }]}>
            Delivery Address
          </Text>
          <View style={st.infoRow}>
            <Icon name="location-outline" size={18} color={colors.gold.muted} />
            <Text
              style={[st.infoValue, { color: colors.text.primary, flex: 1 }]}
            >
              {delivery?.address}
            </Text>
          </View>
          <View style={st.metaRow}>
            <View style={st.metaChip}>
              <Icon name="navigate-outline" size={14} color={colors.status.info} />
              <Text style={[st.metaText, { color: colors.status.info }]}>
                {delivery?.distance}
              </Text>
            </View>
            <View style={st.metaChip}>
              <Icon name="time-outline" size={14} color={colors.status.warning} />
              <Text style={[st.metaText, { color: colors.status.warning }]}>
                {delivery?.estimatedTime}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[st.navBtn, { borderColor: colors.status.info }]}
            onPress={() => {
              const addr = encodeURIComponent(delivery?.address || "");
              const mapsUrl = Platform.OS === "ios"
                ? `maps://?daddr=${addr}`
                : `https://maps.google.com/maps?daddr=${addr}`;
              Linking.openURL(mapsUrl);
            }}
          >
            <Icon name="navigate" size={18} color={colors.status.info} />
            <Text style={{ color: colors.status.info, fontWeight: "700", fontSize: 15 }}>
              Open in Maps
            </Text>
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
        <View
          style={[
            st.infoCard,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
        >
          <Text style={[st.cardTitle, { color: colors.text.primary }]}>
            Order Summary
          </Text>
          <View style={st.summaryRow}>
            <Text style={{ color: colors.text.muted, fontSize: 14 }}>
              {delivery?.items} items
            </Text>
            <Text
              style={{
                color: colors.gold.primary,
                fontSize: 18,
                fontWeight: "800",
              }}
            >
              R{delivery?.total?.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </Text>
          </View>
        </View>

        {/* Next Action */}
        {nextStep && status !== "delivered" && (
          <TouchableOpacity onPress={handleNextStep} activeOpacity={0.85}>
            <LinearGradient
              colors={
                nextStep.key === "delivered"
                  ? [colors.status.success, "#059669"]
                  : nextStep.key === "en_route"
                    ? [colors.status.info, "#2563EB"]
                    : ["#8B5CF6", "#7C3AED"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.nextActionBtn}
            >
              <Icon name={nextStep.icon} size={22} color={colors.white} />
              <Text style={st.nextActionText}>
                {nextStep.key === "picked_up"
                  ? "Mark as Picked Up"
                  : nextStep.key === "en_route"
                    ? "Start Delivery"
                    : "Confirm Delivered"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

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
  headerTitle: { fontSize: 18, fontWeight: "800" },
  progressCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 20,
    marginBottom: 14,
  },
  progressTitle: { fontSize: 16, fontWeight: "700", marginBottom: 16 },
  stepsRow: { flexDirection: "row", justifyContent: "space-between" },
  stepItem: { alignItems: "center", flex: 1, position: "relative" },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  stepLabel: { fontSize: 10, textAlign: "center" },
  stepLine: {
    position: "absolute",
    top: 17,
    left: "60%",
    right: "-40%",
    height: 2,
  },
  infoCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoValue: { fontSize: 15 },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.xl,
    marginLeft: "auto",
  },
  callBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  metaRow: { flexDirection: "row", gap: 12 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13, fontWeight: "600" },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nextActionBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  nextActionText: { color: "#FFF", fontSize: 17, fontWeight: "800" },
});
