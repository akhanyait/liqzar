import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, borderRadius, typography } from "../theme";
import { Icon } from "../components/Icon";
import BrandMark from "../components/BrandMark";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import type { Dispute } from "../types";

const DISPUTE_TYPES = [
  { value: "wrong_item", label: "Wrong Item", icon: "swap-horizontal-outline" },
  { value: "damaged", label: "Damaged", icon: "alert-circle-outline" },
  {
    value: "missing_item",
    label: "Missing Item",
    icon: "remove-circle-outline",
  },
  { value: "quality", label: "Quality Issue", icon: "thumbs-down-outline" },
  { value: "late_delivery", label: "Late Delivery", icon: "time-outline" },
  { value: "overcharged", label: "Overcharged", icon: "cash-outline" },
  { value: "other", label: "Other", icon: "help-circle-outline" },
] as const;

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  open: { label: "Open", color: "#F59E0B", icon: "alert-circle-outline" },
  investigating: {
    label: "Investigating",
    color: "#3B82F6",
    icon: "search-outline",
  },
  resolved: {
    label: "Resolved",
    color: "#10B981",
    icon: "checkmark-circle-outline",
  },
  rejected: {
    label: "Rejected",
    color: "#EF4444",
    icon: "close-circle-outline",
  },
};

export default function DisputeScreen() {
  const { colors, gradients, shadows } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const orderId = route.params?.orderId;

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(!!orderId);
  const [selectedType, setSelectedType] = useState<string>("wrong_item");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchDisputes = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("disputes")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDisputes(data || []);
    } catch (err) {
      console.error("Failed to fetch disputes:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDisputes();
  }, [fetchDisputes]);

  const handleSubmitDispute = async () => {
    if (!description.trim()) {
      Alert.alert("Required", "Please describe the issue.");
      return;
    }
    if (!orderId) {
      Alert.alert("Error", "No order selected for this dispute.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("disputes").insert({
        order_id: orderId,
        customer_id: user?.id,
        type: selectedType,
        description: description.trim(),
        status: "open",
      });

      if (error) throw error;

      Alert.alert(
        "Submitted",
        "Your dispute has been submitted. We'll review it shortly.",
      );
      setShowCreateModal(false);
      setDescription("");
      fetchDisputes();
    } catch (err) {
      Alert.alert("Error", "Could not submit dispute. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderDisputeItem = ({ item }: { item: Dispute }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
    const typeInfo = DISPUTE_TYPES.find((t) => t.value === item.type);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          styles.card,
          {
            backgroundColor: colors.background.card,
            borderColor: colors.gold.border,
            ...(shadows.card as any),
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View
              style={[styles.typeIcon, { backgroundColor: colors.gold.faint }]}
            >
              <Icon
                name={typeInfo?.icon || "help-circle-outline"}
                size={20}
                color={colors.gold.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
                {typeInfo?.label || item.type}
              </Text>
              <Text style={[styles.cardOrderId, { color: colors.text.muted }]}>
                Order: {item.order_id?.slice(0, 8) || "N/A"}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: status.color + "20" },
            ]}
          >
            <Icon name={status.icon} size={14} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <Text
          style={[styles.cardDescription, { color: colors.text.secondary }]}
          numberOfLines={2}
        >
          {item.description}
        </Text>

        {item.resolution && (
          <View
            style={[
              styles.resolutionBox,
              {
                backgroundColor: colors.background.primary,
                borderColor: colors.gold.border,
              },
            ]}
          >
            <Text
              style={[styles.resolutionLabel, { color: colors.gold.primary }]}
            >
              Resolution
            </Text>
            <Text
              style={[styles.resolutionText, { color: colors.text.secondary }]}
            >
              {item.resolution}
            </Text>
            {item.refund_amount != null && item.refund_amount > 0 && (
              <Text
                style={[styles.refundText, { color: colors.status.success }]}
              >
                Refund: R{item.refund_amount.toFixed(2)}
              </Text>
            )}
          </View>
        )}

        <Text style={[styles.cardDate, { color: colors.text.dim }]}>
          {new Date(item.created_at).toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIconContainer,
          { backgroundColor: colors.gold.faint },
        ]}
      >
        <Icon
          name="checkmark-circle-outline"
          size={48}
          color={colors.gold.muted}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
        No Disputes
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.text.muted }]}>
        All your orders are in good standing.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background.primary },
        ]}
      >
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={[styles.loadingText, { color: colors.text.muted }]}>
          Loading disputes...
        </Text>
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
        <View style={{ alignItems: "center" }}>
          <BrandMark size="xs" />
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            My Disputes
          </Text>
        </View>
        <View style={{ width: 32 }} />
      </LinearGradient>

      <FlatList
        data={disputes}
        renderItem={renderDisputeItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.primary}
            colors={[colors.gold.primary]}
          />
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* Create dispute modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.background.card,
                borderColor: colors.gold.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                Submit Dispute
              </Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Icon
                  name="close-outline"
                  size={24}
                  color={colors.text.muted}
                />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text.secondary }]}>
              Issue Type
            </Text>
            <View style={styles.typeGrid}>
              {DISPUTE_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  onPress={() => setSelectedType(type.value)}
                  style={[
                    styles.typeOption,
                    {
                      borderColor:
                        selectedType === type.value
                          ? colors.gold.primary
                          : colors.gold.border,
                      backgroundColor:
                        selectedType === type.value
                          ? colors.gold.faint
                          : "transparent",
                    },
                  ]}
                >
                  <Icon
                    name={type.icon}
                    size={18}
                    color={
                      selectedType === type.value
                        ? colors.gold.primary
                        : colors.text.muted
                    }
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      {
                        color:
                          selectedType === type.value
                            ? colors.gold.primary
                            : colors.text.secondary,
                      },
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.text.secondary }]}>
              Description
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  color: colors.text.primary,
                  backgroundColor: colors.background.primary,
                  borderColor: colors.gold.border,
                },
              ]}
              placeholder="Describe the issue..."
              placeholderTextColor={colors.text.dim}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              onPress={handleSubmitDispute}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[...gradients.gold]}
                style={styles.submitButton}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Dispute</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: spacing.sm, ...typography.body },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: { padding: spacing.xs },
  headerTitle: { ...typography.h3, fontWeight: "700" },
  listContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  typeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.sm,
  },
  cardTitle: { ...typography.body, fontWeight: "600" },
  cardOrderId: { ...typography.caption, marginTop: 2 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  statusText: { ...typography.caption, fontWeight: "600" },
  cardDescription: { ...typography.body, marginBottom: spacing.sm },
  resolutionBox: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.sm,
  },
  resolutionLabel: {
    ...typography.caption,
    fontWeight: "600",
    marginBottom: 4,
  },
  resolutionText: { ...typography.body },
  refundText: { ...typography.body, fontWeight: "600", marginTop: 4 },
  cardDate: { ...typography.caption },
  emptyContainer: { alignItems: "center", paddingTop: 80 },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.h3, marginBottom: spacing.xs },
  emptySubtitle: { ...typography.body, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: { ...typography.h3, fontWeight: "700" },
  label: { ...typography.body, fontWeight: "600", marginBottom: spacing.sm },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  typeLabel: { ...typography.caption, fontWeight: "500" },
  textInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    ...typography.body,
    marginBottom: spacing.lg,
  },
  submitButton: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  submitButtonText: {
    ...typography.body,
    fontWeight: "700",
    color: "#000",
  },
});
