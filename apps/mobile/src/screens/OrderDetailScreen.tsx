import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { spacing, borderRadius, typography } from "../theme";
import { Icon } from "../components/Icon";
import { useTheme } from "../contexts/ThemeContext";
import { useOrders } from "../contexts/OrderContext";
import { STATUS_DISPLAY, OrderStatus } from "../services/OrderWorkflowEngine";
import { ordersApi } from "../services/api";
import { useNavigation, useRoute } from "@react-navigation/native";
import PayNowButton from "../components/PayNowButton";
import { haptics } from "../utils/haptics";

const STATUS_CONFIG = STATUS_DISPLAY;

// The happy-path order flow used for the timeline
const TIMELINE_STEPS: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "driver_assigned",
  "picked_up",
  "en_route",
  "delivered",
];

// ─── Pulsing dot for the active timeline step ────────────────────────────
function PulsingDot({ color, size }: { color: string; size: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.8,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

export default function OrderDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId } = route.params;
  const { colors, gradients, shadows, isDark } = useTheme();
  const { cancelOrder, getStatusDisplay } = useOrders();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const celebratedRef = useRef(false);

  useEffect(() => {
    loadOrderDetail();
  }, [orderId]);

  // Premium arrival feedback: fire once when we first see a delivered status.
  useEffect(() => {
    if (order?.status === "delivered" && !celebratedRef.current) {
      celebratedRef.current = true;
      haptics.success();
    }
  }, [order?.status]);

  const loadOrderDetail = async () => {
    try {
      const data = await ordersApi.getOrderById(orderId);
      setOrder(data);
    } catch (error) {
      console.error("Error loading order detail:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    return (
      STATUS_CONFIG[status as OrderStatus] || {
        color: colors.text.muted,
        icon: "ellipse-outline",
        label: status,
      }
    );
  };

  // ─── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={[styles.loadingText, { color: colors.text.muted }]}>Loading order...</Text>
      </View>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────
  if (!order) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background.primary }]}>
        <View style={styles.errorIconWrapper}>
          <Icon
            name="alert-circle-outline"
            size={48}
            color={colors.status.error}
          />
        </View>
        <Text style={[styles.errorTitle, { color: colors.text.primary }]}>Order not found</Text>
        <Text style={[styles.errorText, { color: colors.text.muted }]}>
          This order may have been removed or does not exist.
        </Text>
      </View>
    );
  }

  const statusConfig = getStatusConfig(order.status);
  const orderItems = order.order_items || [];
  const address = order.delivery_address || {};

  // ─── Timeline helpers ──────────────────────────────────────────────
  const isCancelledOrRefunded = order.status === "cancelled" || order.status === "refunded";
  const currentStepIndex = TIMELINE_STEPS.indexOf(order.status as OrderStatus);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background.primary }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ════════ HEADER ════════ */}
      <LinearGradient
        colors={[...gradients.header]}
        style={[styles.headerGradient, shadows.goldSubtle]}
      >
        <View style={styles.headerContent}>
          <Text style={[styles.headerLabel, { color: colors.text.muted }]}>ORDER</Text>
          <Text style={[styles.orderNumber, { color: colors.gold.primary }]}>
            #{order.order_number}
          </Text>
          <Text style={[styles.orderDate, { color: colors.text.muted }]}>
            {new Date(order.created_at).toLocaleDateString("en-ZA", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusConfig.color + "20" },
            ]}
          >
            <Icon name={statusConfig.icon} size={16} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
        {/* Gold bottom border accent */}
        <LinearGradient
          colors={[...gradients.goldShimmer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerBottomBorder}
        />
      </LinearGradient>

      {/* ════════ DELIVERED MOMENT ════════
          A premium, editorial receipt card that surfaces only after delivery.
          Gold hairlines + small-caps eyebrow + signature-like ink tone. */}
      {order.status === "delivered" && (
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
            padding: spacing.xl,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.background.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.gold.border,
            alignItems: "center",
          }}
          accessibilityRole="summary"
        >
          <View
            style={{
              width: 40,
              height: 1,
              backgroundColor: colors.gold.primary,
              marginBottom: spacing.md,
            }}
          />
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 2,
              textTransform: "uppercase",
              color: colors.gold.muted,
              marginBottom: spacing.sm,
            }}
          >
            Delivered With Care
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              letterSpacing: -0.5,
              color: colors.text.primary,
              textAlign: "center",
              marginBottom: spacing.xs,
            }}
          >
            Thank you for choosing LIQZAR.
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 20,
              color: colors.text.muted,
              textAlign: "center",
              fontStyle: "italic",
              paddingHorizontal: spacing.md,
              marginBottom: spacing.md,
            }}
          >
            Your order has been handed over with the discretion and care
            befitting a premium cellar selection.
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: colors.gold.faint,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.gold.border,
            }}
          >
            <Icon name="shield-checkmark" size={14} color={colors.gold.primary} />
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.4,
                color: colors.gold.primary,
              }}
            >
              Age & ID verified on delivery
            </Text>
          </View>
          <View
            style={{
              width: 40,
              height: 1,
              backgroundColor: colors.gold.primary,
              marginTop: spacing.md,
            }}
          />
        </View>
      )}

      {/* ════════ AWAITING PAYMENT BANNER ════════ */}
      {(order.payment_status === "awaiting_payment" ||
        order.payment_status === "pending" ||
        order.payment_status === "failed") &&
        order.payment_method !== "cash_on_delivery" && (
          <View
            style={[
              styles.section,
              {
                backgroundColor: colors.status.warning + "12",
                borderColor: colors.status.warning + "40",
                borderWidth: 1,
                borderRadius: borderRadius.lg,
                padding: spacing.lg,
                marginHorizontal: spacing.lg,
                marginTop: spacing.md,
              },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <Icon name="card-outline" size={20} color={colors.status.warning} />
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
                Payment required
              </Text>
            </View>
            <Text
              style={{
                ...typography.body,
                color: colors.text.muted,
                marginTop: spacing.xs,
                marginBottom: spacing.md,
              }}
            >
              Your order is awaiting payment. Complete it now to proceed.
            </Text>
            <PayNowButton
              orderId={order.id}
              amount={Number(order.total)}
              paymentMethod={order.payment_method}
              onPaid={() => {
                if (typeof (route as any).params?.refetch === "function") {
                  (route as any).params.refetch();
                }
              }}
            />
          </View>
        )}

      {/* ════════ STATUS TIMELINE ════════ */}
      {!isCancelledOrRefunded && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Icon name="analytics-outline" size={20} color={colors.gold.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Order Progress
            </Text>
          </View>
          <View
            style={[
              styles.timelineCard,
              { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border },
              shadows.card,
            ]}
          >
            {TIMELINE_STEPS.map((step, index) => {
              const stepConfig = getStatusConfig(step);
              const isCompleted = currentStepIndex >= 0 && index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isUpcoming = !isCompleted && !isCurrent;
              const isLast = index === TIMELINE_STEPS.length - 1;

              const dotColor = isCompleted || isCurrent
                ? colors.gold.primary
                : colors.text.dim;
              const lineColor = isCompleted
                ? colors.gold.primary
                : colors.gold.border;
              const labelColor = isCurrent
                ? colors.gold.primary
                : isCompleted
                  ? colors.text.secondary
                  : colors.text.dim;

              return (
                <View key={step} style={styles.timelineRow}>
                  {/* Dot column */}
                  <View style={styles.timelineDotColumn}>
                    {/* Connecting line above */}
                    {index > 0 && (
                      <View
                        style={[
                          styles.timelineLineAbove,
                          { backgroundColor: isCompleted || isCurrent ? colors.gold.primary : colors.gold.border },
                        ]}
                      />
                    )}
                    {/* Dot */}
                    <View style={styles.timelineDotWrapper}>
                      {isCurrent && (
                        <PulsingDot
                          color={colors.gold.glow}
                          size={28}
                        />
                      )}
                      <View
                        style={[
                          styles.timelineDot,
                          {
                            backgroundColor: isUpcoming ? "transparent" : dotColor,
                            borderColor: dotColor,
                            borderWidth: isUpcoming ? 2 : 0,
                          },
                        ]}
                      >
                        {isCompleted && (
                          <Icon name="checkmark" size={10} color={colors.text.inverse} />
                        )}
                        {isCurrent && (
                          <View
                            style={[
                              styles.timelineDotInner,
                              { backgroundColor: colors.text.inverse },
                            ]}
                          />
                        )}
                      </View>
                    </View>
                    {/* Connecting line below */}
                    {!isLast && (
                      <View
                        style={[
                          styles.timelineLineBelow,
                          { backgroundColor: lineColor },
                        ]}
                      />
                    )}
                  </View>
                  {/* Label */}
                  <View style={styles.timelineLabelContainer}>
                    <Text
                      style={[
                        styles.timelineLabel,
                        {
                          color: labelColor,
                          fontWeight: isCurrent ? "700" : isCompleted ? "600" : "400",
                        },
                      ]}
                    >
                      {stepConfig.label}
                    </Text>
                    {isCurrent && (
                      <Text style={[styles.timelineCurrentHint, { color: colors.gold.muted }]}>
                        Current
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Cancelled / Refunded banner */}
      {isCancelledOrRefunded && (
        <View style={styles.section}>
          <View
            style={[
              styles.cancelledBanner,
              {
                backgroundColor: colors.status.error + "10",
                borderColor: colors.status.error + "30",
              },
            ]}
          >
            <Icon name={statusConfig.icon} size={24} color={colors.status.error} />
            <Text style={[styles.cancelledText, { color: colors.status.error }]}>
              This order has been {order.status}.
            </Text>
          </View>
        </View>
      )}

      {/* ═══ Gold accent divider ═══ */}
      <View style={styles.sectionDividerContainer}>
        <View style={[styles.sectionDividerLine, { backgroundColor: colors.gold.border }]} />
        <Icon name="diamond-outline" size={12} color={colors.gold.muted} />
        <View style={[styles.sectionDividerLine, { backgroundColor: colors.gold.border }]} />
      </View>

      {/* ════════ ORDER ITEMS ════════ */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Icon name="cube-outline" size={20} color={colors.gold.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Items ({orderItems.length})
          </Text>
        </View>
        {orderItems.map((item: any, index: number) => {
          const product = item.products || {};
          const imageUri = product.image_url || item.image_url;
          return (
            <View
              key={item.id || index}
              style={[
                styles.itemCard,
                { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border },
                shadows.card,
              ]}
            >
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={[styles.itemImage, { backgroundColor: colors.background.elevated }]}
                  resizeMode="contain"
                />
              ) : (
                <View
                  style={[
                    styles.itemImagePlaceholder,
                    { backgroundColor: colors.gold.faint },
                  ]}
                >
                  <Icon name="wine-outline" size={24} color={colors.gold.muted} />
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: colors.text.primary }]} numberOfLines={2}>
                  {product.name || item.product_name || "Product"}
                </Text>
                <Text style={[styles.itemMeta, { color: colors.text.muted }]}>
                  Qty: {item.quantity} x R{item.unit_price?.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </Text>
              </View>
              <Text style={[styles.itemSubtotal, { color: colors.gold.light }]}>
                R{item.subtotal?.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ═══ Gold accent divider ═══ */}
      <View style={styles.sectionDividerContainer}>
        <View style={[styles.sectionDividerLine, { backgroundColor: colors.gold.border }]} />
        <Icon name="diamond-outline" size={12} color={colors.gold.muted} />
        <View style={[styles.sectionDividerLine, { backgroundColor: colors.gold.border }]} />
      </View>

      {/* ════════ DELIVERY ADDRESS ════════ */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Icon name="location-outline" size={20} color={colors.gold.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Delivery Address
          </Text>
        </View>
        <View
          style={[
            styles.addressCard,
            { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border },
            shadows.card,
          ]}
        >
          <View style={styles.addressRow}>
            <View style={[styles.addressIconWrapper, { backgroundColor: colors.gold.faint }]}>
              <Icon name="navigate-outline" size={20} color={colors.gold.primary} />
            </View>
            <View style={styles.addressInfo}>
              <Text style={[styles.addressText, { color: colors.text.primary }]}>
                {address.street || "N/A"}
              </Text>
              <Text style={[styles.addressText, { color: colors.text.primary }]}>
                {address.city || ""}
                {address.province ? `, ${address.province}` : ""}
              </Text>
              <Text style={[styles.addressTextMuted, { color: colors.text.muted }]}>
                {address.postal_code || address.postalCode || ""}
                {address.country ? `, ${address.country}` : ""}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ═══ Gold accent divider ═══ */}
      <View style={styles.sectionDividerContainer}>
        <View style={[styles.sectionDividerLine, { backgroundColor: colors.gold.border }]} />
        <Icon name="diamond-outline" size={12} color={colors.gold.muted} />
        <View style={[styles.sectionDividerLine, { backgroundColor: colors.gold.border }]} />
      </View>

      {/* ════════ PRICE BREAKDOWN ════════ */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Icon name="wallet-outline" size={20} color={colors.gold.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Payment Summary
          </Text>
        </View>
        <View
          style={[
            styles.priceCard,
            { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border },
            shadows.card,
          ]}
        >
          {/* Gold gradient top border */}
          <LinearGradient
            colors={[...gradients.goldShimmer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.priceCardTopBorder}
          />
          <View style={styles.priceCardInner}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>Subtotal</Text>
              <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                R{order.subtotal?.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>Delivery Fee</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color: order.delivery_fee === 0
                      ? colors.status.success
                      : colors.text.primary,
                  },
                ]}
              >
                {order.delivery_fee === 0 ? "FREE" : `R${order.delivery_fee?.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>VAT (15%)</Text>
              <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                R{order.vat_amount?.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            </View>
            {order.discount_amount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.text.muted }]}>Discount</Text>
                <Text style={[styles.summaryValue, { color: colors.status.success }]}>
                  -R{order.discount_amount?.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </Text>
              </View>
            )}
            {/* Divider */}
            <View style={styles.priceDividerContainer}>
              <LinearGradient
                colors={["transparent", colors.gold.border, "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.priceDivider}
              />
            </View>
            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.text.primary }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.gold.primary }]}>
                R{order.total?.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ════════ ACTION BUTTONS ════════ */}
      <View style={styles.actionsSection}>
        {/* Track Order Button */}
        {["driver_assigned", "picked_up", "en_route"].includes(order.status) && (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("OrderTracking", { orderId: order.id })
            }
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[...gradients.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.trackButton, shadows.gold]}
            >
              <Icon name="navigate-outline" size={22} color={colors.text.inverse} />
              <Text style={[styles.trackButtonText, { color: colors.text.inverse }]}>
                Track Order
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Rate Order Button */}
        {order.status === "delivered" && (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("CustomerRating", { orderId: order.id })
            }
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.status.warning, "#D97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.trackButton, shadows.gold]}
            >
              <Icon name="star-outline" size={22} color={colors.white} />
              <Text style={[styles.trackButtonText, { color: colors.white }]}>Rate This Order</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Cancel Order Button */}
        {["pending", "confirmed", "preparing"].includes(order.status) && (
          <TouchableOpacity
            style={styles.cancelButtonWrapper}
            onPress={() => {
              Alert.alert(
                "Cancel Order",
                "Are you sure you want to cancel this order?",
                [
                  { text: "No", style: "cancel" },
                  {
                    text: "Yes, Cancel",
                    style: "destructive",
                    onPress: () => cancelOrder(order.id, "Cancelled by customer"),
                  },
                ],
              );
            }}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.cancelButton,
                {
                  backgroundColor: colors.status.error + "10",
                  borderColor: colors.status.error + "35",
                },
              ]}
            >
              <Icon name="close-circle-outline" size={20} color={colors.status.error} />
              <Text style={[styles.cancelButtonText, { color: colors.status.error }]}>
                Cancel Order
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: spacing.xxl + spacing.md }} />
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ─── Loading / Error ─────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.bodySmall,
    marginTop: spacing.sm,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  errorIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(239,68,68,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  errorTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.bodySmall,
    textAlign: "center",
  },

  // ─── Header ──────────────────────────────────────
  headerGradient: {
    paddingTop: spacing.xl,
    paddingBottom: 0,
    overflow: "hidden",
  },
  headerContent: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerLabel: {
    ...typography.label,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  orderNumber: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  orderDate: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    gap: spacing.xs + 2,
  },
  statusText: {
    ...typography.bodySmall,
    fontWeight: "700",
  },
  headerBottomBorder: {
    height: 2,
    width: "100%",
  },

  // ─── Sections ────────────────────────────────────
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
  },

  // ─── Gold accent dividers between sections ──────
  sectionDividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl + spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
  },

  // ─── Status Timeline ─────────────────────────────
  timelineCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  timelineDotColumn: {
    width: 36,
    alignItems: "center",
    position: "relative",
    height: "100%",
    minHeight: 44,
    justifyContent: "center",
  },
  timelineLineAbove: {
    position: "absolute",
    top: 0,
    width: 2,
    height: "40%",
  },
  timelineLineBelow: {
    position: "absolute",
    bottom: 0,
    width: 2,
    height: "40%",
  },
  timelineDotWrapper: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineLabelContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.sm,
    gap: spacing.sm,
  },
  timelineLabel: {
    ...typography.bodySmall,
  },
  timelineCurrentHint: {
    ...typography.caption,
    fontStyle: "italic",
  },

  // ─── Cancelled / Refunded banner ─────────────────
  cancelledBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  cancelledText: {
    ...typography.body,
    fontWeight: "600",
    flex: 1,
  },

  // ─── Order Items ─────────────────────────────────
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
  },
  itemImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  itemName: {
    ...typography.body,
    fontWeight: "600",
    marginBottom: 4,
  },
  itemMeta: {
    ...typography.caption,
  },
  itemSubtotal: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: spacing.sm,
  },

  // ─── Delivery Address ────────────────────────────
  addressCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md + 4,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  addressIconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  addressInfo: {
    flex: 1,
  },
  addressText: {
    ...typography.body,
    marginBottom: 3,
  },
  addressTextMuted: {
    ...typography.bodySmall,
    marginTop: 2,
  },

  // ─── Price Breakdown ─────────────────────────────
  priceCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  priceCardTopBorder: {
    height: 3,
    width: "100%",
  },
  priceCardInner: {
    padding: spacing.lg,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  summaryLabel: {
    ...typography.body,
  },
  summaryValue: {
    ...typography.body,
    fontWeight: "600",
  },
  priceDividerContainer: {
    paddingVertical: spacing.md,
  },
  priceDivider: {
    height: 1,
    width: "100%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.xs,
  },
  totalLabel: {
    ...typography.h3,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  // ─── Action Buttons ──────────────────────────────
  actionsSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  trackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  trackButtonText: {
    ...typography.button,
  },
  cancelButtonWrapper: {
    // no extra spacing needed, gap on parent handles it
  },
  cancelButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  cancelButtonText: {
    fontWeight: "700",
    fontSize: 15,
  },
});
