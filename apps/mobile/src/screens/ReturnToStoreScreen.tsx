import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, borderRadius, typography } from "../theme";
import { Icon } from "../components/Icon";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../lib/supabase";

const RETURN_REASONS = [
  {
    value: "customer_unavailable",
    label: "Customer Unavailable",
    icon: "person-outline",
  },
  { value: "wrong_address", label: "Wrong Address", icon: "location-outline" },
  {
    value: "customer_refused",
    label: "Customer Refused",
    icon: "hand-left-outline",
  },
  {
    value: "unsafe_location",
    label: "Unsafe Location",
    icon: "warning-outline",
  },
  {
    value: "damaged_items",
    label: "Items Damaged in Transit",
    icon: "alert-circle-outline",
  },
  { value: "other", label: "Other", icon: "help-circle-outline" },
] as const;

export default function ReturnToStoreScreen() {
  const { colors, gradients, shadows } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const { orderId, orderNumber } = route.params || {};

  const [selectedReason, setSelectedReason] = useState<string>(
    "customer_unavailable",
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"reason" | "confirm" | "done">("reason");

  const handleSubmitReturn = useCallback(async () => {
    if (!orderId) {
      Alert.alert("Error", "No order specified.");
      return;
    }

    setSubmitting(true);
    try {
      // Update order status to return_to_store with optimistic concurrency
      const { data, error } = await supabase
        .from("orders")
        .update({
          status: "return_to_store",
          return_reason: selectedReason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "en_route")
        .select()
        .single();

      if (error || !data) {
        // If status was already changed, try from picked_up as well
        const { data: retryData, error: retryError } = await supabase
          .from("orders")
          .update({
            status: "return_to_store",
            return_reason: selectedReason,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .eq("status", "picked_up")
          .select()
          .single();

        if (retryError || !retryData) {
          throw new Error(
            "Order status has already changed. Cannot initiate return.",
          );
        }
      }

      // Update delivery assignment with failure reason
      await supabase
        .from("delivery_assignments")
        .update({
          status: "returning",
          failed_reason: `${selectedReason}${notes.trim() ? `: ${notes.trim()}` : ""}`,
          failed_at: new Date().toISOString(),
        })
        .eq("order_id", orderId)
        .eq("driver_id", user?.id);

      // Increment failed delivery count on the order
      await supabase.rpc("increment_failed_delivery_count", {
        p_order_id: orderId,
      });

      setStep("done");
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.message || "Could not process return. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [orderId, selectedReason, notes, user?.id]);

  const handleConfirm = () => {
    Alert.alert(
      "Confirm Return to Store",
      `Are you sure you want to return this order?\n\nReason: ${RETURN_REASONS.find((r) => r.value === selectedReason)?.label}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Return",
          style: "destructive",
          onPress: handleSubmitReturn,
        },
      ],
    );
  };

  if (step === "done") {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background.primary },
        ]}
      >
        <View style={styles.doneContainer}>
          <View
            style={[styles.doneIcon, { backgroundColor: colors.gold.faint }]}
          >
            <Icon
              name="checkmark-circle-outline"
              size={64}
              color={colors.gold.primary}
            />
          </View>
          <Text style={[styles.doneTitle, { color: colors.text.primary }]}>
            Return Initiated
          </Text>
          <Text style={[styles.doneSubtitle, { color: colors.text.muted }]}>
            Order {orderNumber || orderId?.slice(0, 8)} has been marked for
            return to store. Please bring all items back to the warehouse.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[...gradients.gold]}
              style={styles.doneButton}
            >
              <Text style={styles.doneButtonText}>Back to Dashboard</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background.primary }]}
    >
      <LinearGradient
        colors={[...gradients.header]}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
          Return to Store
        </Text>
        <View style={{ width: 32 }} />
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Order info banner */}
        <View
          style={[
            styles.orderBanner,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
        >
          <Icon name="cube-outline" size={20} color={colors.gold.primary} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[styles.orderLabel, { color: colors.text.muted }]}>
              Returning Order
            </Text>
            <Text style={[styles.orderNumber, { color: colors.text.primary }]}>
              {orderNumber || orderId?.slice(0, 12) || "Unknown"}
            </Text>
          </View>
          <View style={[styles.warningBadge, { backgroundColor: colors.status.error + "20" }]}>
            <Icon name="warning-outline" size={14} color={colors.status.error} />
            <Text
              style={{
                color: colors.status.error,
                ...typography.caption,
                fontWeight: "600",
              }}
            >
              Return
            </Text>
          </View>
        </View>

        {/* Reason selection */}
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          Reason for Return
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.text.muted }]}>
          Select the reason why the delivery cannot be completed.
        </Text>

        {RETURN_REASONS.map((reason) => (
          <TouchableOpacity
            key={reason.value}
            activeOpacity={0.7}
            onPress={() => setSelectedReason(reason.value)}
            style={[
              styles.reasonCard,
              {
                backgroundColor: colors.background.card,
                borderColor:
                  selectedReason === reason.value
                    ? colors.gold.primary
                    : colors.gold.border,
                borderWidth:
                  selectedReason === reason.value
                    ? 1.5
                    : StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View
              style={[
                styles.reasonIcon,
                {
                  backgroundColor:
                    selectedReason === reason.value
                      ? colors.gold.faint
                      : colors.background.primary,
                },
              ]}
            >
              <Icon
                name={reason.icon}
                size={20}
                color={
                  selectedReason === reason.value
                    ? colors.gold.primary
                    : colors.text.muted
                }
              />
            </View>
            <Text
              style={[
                styles.reasonLabel,
                {
                  color:
                    selectedReason === reason.value
                      ? colors.text.primary
                      : colors.text.secondary,
                  fontWeight: selectedReason === reason.value ? "600" : "400",
                },
              ]}
            >
              {reason.label}
            </Text>
            {selectedReason === reason.value && (
              <Icon
                name="checkmark-circle"
                size={20}
                color={colors.gold.primary}
              />
            )}
          </TouchableOpacity>
        ))}

        {/* Additional notes */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text.primary, marginTop: spacing.lg },
          ]}
        >
          Additional Notes
        </Text>
        <TextInput
          style={[
            styles.textInput,
            {
              color: colors.text.primary,
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
          placeholder="Optional: Add details about the situation..."
          placeholderTextColor={colors.text.dim}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Warning */}
        <View
          style={[
            styles.warningBox,
            { backgroundColor: colors.status.error + "10", borderColor: colors.status.error + "40" },
          ]}
        >
          <Icon name="warning-outline" size={18} color={colors.status.error} />
          <Text style={[styles.warningText, { color: colors.text.secondary }]}>
            This action will flag the order for return. All items must be
            returned to the warehouse in their original condition.
          </Text>
        </View>

        {/* Submit button */}
        <TouchableOpacity
          onPress={handleConfirm}
          disabled={submitting}
          activeOpacity={0.8}
          style={{ marginTop: spacing.lg, marginBottom: spacing.xxl }}
        >
          <LinearGradient
            colors={[colors.status.error, "#DC2626"]}
            style={styles.submitButton}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Icon name="arrow-undo-outline" size={20} color={colors.white} />
                <Text style={styles.submitButtonText}>
                  Initiate Return to Store
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: { padding: spacing.xs },
  headerTitle: { ...typography.h3, fontWeight: "700" },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.md },
  orderBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
  },
  orderLabel: { ...typography.caption },
  orderNumber: { ...typography.body, fontWeight: "700" },
  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  sectionTitle: {
    ...typography.h3,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  sectionSubtitle: { ...typography.body, marginBottom: spacing.md },
  reasonCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  reasonIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  reasonLabel: { ...typography.body, flex: 1 },
  textInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 80,
    ...typography.body,
    marginBottom: spacing.md,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  warningText: { ...typography.body, flex: 1 },
  submitButton: {
    flexDirection: "row",
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  submitButtonText: {
    ...typography.body,
    fontWeight: "700",
    color: "#FFF",
  },
  doneContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  doneIcon: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  doneTitle: { ...typography.h2, fontWeight: "700", marginBottom: spacing.sm },
  doneSubtitle: {
    ...typography.body,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  doneButton: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  doneButtonText: {
    ...typography.body,
    fontWeight: "700",
    color: "#000",
  },
});
