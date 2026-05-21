import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../../components/Icon";
import BrandMark from "../../components/BrandMark";
import { useTheme } from "../../contexts/ThemeContext";
import { useOrders } from "../../contexts/OrderContext";
import { STATUS_DISPLAY, OrderStatus, orderWorkflow } from "../../services/OrderWorkflowEngine";
import { spacing, borderRadius } from "../../theme";
import { supabase } from "../../lib/supabase";

const { width } = Dimensions.get("window");

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Pending", color: "#F59E0B", icon: "time-outline" },
  confirmed: {
    label: "Confirmed",
    color: "#3B82F6",
    icon: "checkmark-circle-outline",
  },
  preparing: {
    label: "Preparing",
    color: "#3B82F6",
    icon: "restaurant-outline",
  },
  ready: {
    label: "Ready",
    color: "#06B6D4",
    icon: "bag-check-outline",
  },
  driver_assigned: {
    label: "Driver Assigned",
    color: "#8B5CF6",
    icon: "person-outline",
  },
  picked_up: {
    label: "Picked Up",
    color: "#8B5CF6",
    icon: "bag-check-outline",
  },
  en_route: {
    label: "En Route",
    color: "#3B82F6",
    icon: "bicycle-outline",
  },
  delivered: {
    label: "Delivered",
    color: "#10B981",
    icon: "checkmark-done-outline",
  },
  completed: {
    label: "Completed",
    color: "#10B981",
    icon: "checkmark-done-circle-outline",
  },
  cancelled: {
    label: "Cancelled",
    color: "#EF4444",
    icon: "close-circle-outline",
  },
  refunded: {
    label: "Refunded",
    color: "#EF4444",
    icon: "return-down-back-outline",
  },
};

const STATUS_FLOW = [
  { key: "pending", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready for Pickup" },
  { key: "driver_assigned", label: "Driver Assigned" },
  { key: "picked_up", label: "Picked Up" },
  { key: "en_route", label: "En Route" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Completed" },
];

const MOCK_ORDER = {
  id: "1",
  order_number: "LZR001A",
  customer_name: "Sarah M.",
  customer_phone: "+27 79 123 4567",
  customer_address: "42 Nelson Mandela Blvd, Cape Town, 8001",
  status: "preparing",
  created_at: "2024-12-15 14:32",
  items: [
    {
      id: "i1",
      name: "Hennessy VS Cognac 750ml",
      quantity: 1,
      unit_price: 499,
      subtotal: 499,
    },
    {
      id: "i2",
      name: "Johnnie Walker Black Label 750ml",
      quantity: 1,
      unit_price: 350,
      subtotal: 350,
    },
    {
      id: "i3",
      name: "Tanqueray London Dry Gin 750ml",
      quantity: 1,
      unit_price: 280,
      subtotal: 280,
    },
  ],
  subtotal: 1129,
  delivery_fee: 49,
  vat: 176.7,
  total: 1354.7,
  driver: {
    name: "John D.",
    rating: 4.8,
    phone: "+27 62 987 6543",
  },
};

// Drivers are loaded from driver_profiles at runtime — no mock data

export default function AdminOrderDetail() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark, shadows, gradients } = useTheme();
  const { updateOrderStatus, assignDriver, cancelOrder, getStatusDisplay } = useOrders();

  const orderId = route.params?.orderId;

  const [order, setOrder] = useState(MOCK_ORDER);
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const [loading, setLoading] = useState(!!orderId);
  const [drivers, setDrivers] = useState<Array<{ id: string; name: string; available: boolean }>>([]);
  const [driversLoading, setDriversLoading] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    const fetchOrder = async () => {
      // orders.user_id → auth.users, NOT profiles, so PostgREST cannot resolve
      // profiles(…) as an implicit FK join. Fetch the profile in a second query.
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .single();

      if (cancelled) return;
      if (error || !data) {
        console.error("[AdminOrderDetail] fetch error:", error);
        setLoading(false);
        return;
      }

      // Fetch customer profile separately using user_id
      let customerName = "Customer";
      let customerPhone = "";
      if (data.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", data.user_id)
          .maybeSingle();
        if (profile) {
          customerName = profile.full_name || customerName;
          customerPhone = profile.phone || customerPhone;
        }
      }

      if (cancelled) return;

      const addr = data.delivery_address;
      const addrStr =
        addr && typeof addr === "object"
          ? [addr.street, addr.suburb, addr.city, addr.postal_code]
              .filter(Boolean)
              .join(", ")
          : typeof addr === "string"
            ? addr
            : "";
      setOrder({
        id: data.id,
        order_number: data.order_number,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: addrStr,
        status: data.status,
        created_at: data.created_at,
        items: (data.order_items || []).map((item: any) => ({
          id: item.id,
          name: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          subtotal: Number(item.subtotal),
        })),
        subtotal: Number(data.subtotal),
        delivery_fee: Number(data.delivery_fee),
        vat: Number(data.vat_amount),
        total: Number(data.total),
        driver: data.assigned_driver_id
          ? { name: "Assigned Driver", rating: 0, phone: "" }
          : null,
      });
      setLoading(false);
    };
    fetchOrder();
    return () => { cancelled = true; };
  }, [orderId]);

  const currentStatusIndex = STATUS_FLOW.findIndex(
    (s) => s.key === order.status,
  );
  const isCancelled = order.status === "cancelled";

  const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;

  // Use the real workflow engine to determine valid next statuses
  const validNextStatuses = orderWorkflow.getNextStatuses(order.status as OrderStatus);
  const nextStatus = validNextStatuses.find((s) => s !== "cancelled") || null;

  const getNextStatus = () => nextStatus;

  const handleUpdateStatus = async () => {
    if (nextStatus && orderId) {
      const success = await updateOrderStatus(orderId, nextStatus as any);
      if (success) {
        setOrder((prev) => ({ ...prev, status: nextStatus }));
        Alert.alert("Status Updated", `Order moved to: ${STATUS_DISPLAY[nextStatus]?.label || nextStatus}`);
      }
    }
  };

  const handleOpenDriverPicker = async () => {
    setShowDriverPicker(true);
    if (drivers.length > 0) return;
    setDriversLoading(true);
    try {
      const { data } = await supabase
        .from("driver_profiles")
        .select("id, full_name, is_verified")
        .order("full_name");
      setDrivers(
        (data || []).map((d: any) => ({
          id: d.id,
          name: d.full_name,
          available: d.is_verified,
        }))
      );
    } catch (err) {
      console.error("[AdminOrderDetail] failed to load drivers:", err);
    } finally {
      setDriversLoading(false);
    }
  };

  const handleAssignDriver = async (driver: { id: string; name: string; available: boolean }) => {
    if (orderId) {
      const success = await assignDriver(orderId, driver.id, driver.name);
      if (success) {
        setOrder((prev) => ({
          ...prev,
          driver: {
            name: driver.name,
            rating: 0,
            phone: "",
          },
        }));
        Alert.alert("Driver Assigned", `${driver.name} has been assigned to this order.`);
      }
    }
    setShowDriverPicker(false);
  };

  const handleContactCustomer = () => {
    Linking.openURL(`tel:${order.customer_phone}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {loading && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 10, backgroundColor: colors.background.primary }}>
          <ActivityIndicator size="large" color={colors.gold.primary} />
        </View>
      )}
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
            style={[
              st.backBtn,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
            onPress={() => navigation.goBack()}
          >
            <Icon name="chevron-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <BrandMark size="xs" />
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Order #{order.order_number}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View
          style={[
            st.statusCard,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
        >
          <View style={st.statusCardTop}>
            <View
              style={[
                st.statusPillLarge,
                { backgroundColor: statusConf.color + "18" },
              ]}
            >
              <Icon name={statusConf.icon} size={18} color={statusConf.color} />
              <Text
                style={[st.statusPillLargeText, { color: statusConf.color }]}
              >
                {statusConf.label}
              </Text>
            </View>
            {!isCancelled && getNextStatus() && (
              <TouchableOpacity onPress={handleUpdateStatus}>
                <LinearGradient
                  colors={[...gradients.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={st.updateStatusBtnSmall}
                >
                  <Icon name="arrow-forward" size={14} color="#050403" />
                  <Text style={st.updateStatusBtnSmallText}>
                    {nextStatus ? (STATUS_DISPLAY[nextStatus]?.label || "Next") : "Update Status"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* Status Timeline */}
          <View style={st.timeline}>
            {STATUS_FLOW.map((step, index) => {
              const isCompleted = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const isFuture = index > currentStatusIndex;

              return (
                <View key={step.key} style={st.timelineStep}>
                  <View style={st.timelineDotCol}>
                    <View
                      style={[
                        st.timelineDot,
                        isCompleted && {
                          backgroundColor: colors.status.success,
                          borderColor: colors.status.success,
                        },
                        isCurrent && {
                          backgroundColor: colors.gold.primary,
                          borderColor: colors.gold.primary,
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                        },
                        isFuture && {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.1)"
                            : "rgba(0,0,0,0.1)",
                          borderColor: isDark
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(0,0,0,0.15)",
                        },
                      ]}
                    >
                      {isCompleted && (
                        <Icon name="checkmark" size={8} color={colors.white} />
                      )}
                    </View>
                    {index < STATUS_FLOW.length - 1 && (
                      <View
                        style={[
                          st.timelineLine,
                          {
                            backgroundColor: isCompleted
                              ? colors.status.success
                              : isDark
                                ? "rgba(255,255,255,0.1)"
                                : "rgba(0,0,0,0.1)",
                          },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      st.timelineLabel,
                      {
                        color: isCurrent
                          ? colors.gold.primary
                          : isCompleted
                            ? colors.status.success
                            : colors.text.dim,
                        fontWeight: isCurrent ? "700" : "500",
                      },
                    ]}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Customer Info */}
        <View style={st.sectionHeader}>
          <Icon name="person-outline" size={18} color={colors.gold.primary} />
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Customer Info
          </Text>
        </View>
        <View
          style={[
            st.infoCard,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
        >
          <View style={st.infoRow}>
            <Icon name="person-outline" size={16} color={colors.gold.muted} />
            <Text style={[st.infoText, { color: colors.text.primary }]}>
              {order.customer_name}
            </Text>
          </View>
          <View style={st.infoRow}>
            <Icon name="call-outline" size={16} color={colors.gold.muted} />
            <Text style={[st.infoText, { color: colors.text.primary }]}>
              {order.customer_phone}
            </Text>
          </View>
          <View style={st.infoRow}>
            <Icon name="location-outline" size={16} color={colors.gold.muted} />
            <Text style={[st.infoText, { color: colors.text.muted, flex: 1 }]}>
              {order.customer_address}
            </Text>
          </View>
        </View>

        {/* Items List */}
        <View style={st.sectionHeader}>
          <Icon name="cube-outline" size={18} color={colors.gold.primary} />
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Items ({order.items.length})
          </Text>
        </View>
        <View
          style={[
            st.infoCard,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
        >
          {order.items.map((item, index) => (
            <View
              key={item.id}
              style={[
                st.itemRow,
                index < order.items.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.gold.border,
                  paddingBottom: 12,
                  marginBottom: 12,
                },
              ]}
            >
              <View style={st.itemInfo}>
                <Text
                  style={[st.itemName, { color: colors.text.primary }]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <Text style={[st.itemMeta, { color: colors.text.muted }]}>
                  {item.quantity} x R{item.unit_price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </Text>
              </View>
              <Text style={[st.itemSubtotal, { color: colors.gold.primary }]}>
                R{item.subtotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            </View>
          ))}
        </View>

        {/* Order Summary */}
        <View style={st.sectionHeader}>
          <Icon name="wallet-outline" size={18} color={colors.gold.primary} />
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Order Summary
          </Text>
        </View>
        <View
          style={[
            st.infoCard,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
        >
          <View style={st.summaryRow}>
            <Text style={[st.summaryLabel, { color: colors.text.muted }]}>
              Subtotal
            </Text>
            <Text style={[st.summaryValue, { color: colors.text.primary }]}>
              R{order.subtotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </Text>
          </View>
          <View style={st.summaryRow}>
            <Text style={[st.summaryLabel, { color: colors.text.muted }]}>
              Delivery Fee
            </Text>
            <Text style={[st.summaryValue, { color: colors.text.primary }]}>
              R{order.delivery_fee.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </Text>
          </View>
          <View style={st.summaryRow}>
            <Text style={[st.summaryLabel, { color: colors.text.muted }]}>
              VAT (15%)
            </Text>
            <Text style={[st.summaryValue, { color: colors.text.primary }]}>
              R{order.vat.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </Text>
          </View>
          <View style={[st.divider, { backgroundColor: colors.gold.border }]} />
          <View style={st.summaryRow}>
            <Text style={[st.totalLabel, { color: colors.text.primary }]}>
              Total
            </Text>
            <Text style={[st.totalValue, { color: colors.gold.primary }]}>
              R{order.total.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </Text>
          </View>
        </View>

        {/* Driver Assignment */}
        <View style={st.sectionHeader}>
          <Icon name="bicycle-outline" size={18} color={colors.gold.primary} />
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Driver Assignment
          </Text>
        </View>
        <View
          style={[
            st.infoCard,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
        >
          {order.driver ? (
            <>
              <View style={st.driverInfo}>
                <View
                  style={[
                    st.driverAvatar,
                    { backgroundColor: "#8B5CF6" + "20" },
                  ]}
                >
                  <Icon name="person" size={22} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.driverName, { color: colors.text.primary }]}>
                    {order.driver.name}
                  </Text>
                  <View style={st.driverRatingRow}>
                    <Icon name="star" size={14} color={colors.status.warning} />
                    <Text
                      style={[st.driverRating, { color: colors.text.muted }]}
                    >
                      {order.driver.rating}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleOpenDriverPicker}
                  style={[
                    st.changeDriverBtn,
                    { borderColor: colors.gold.border },
                  ]}
                >
                  <Text
                    style={[
                      st.changeDriverText,
                      { color: colors.gold.primary },
                    ]}
                  >
                    Change Driver
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity
              onPress={handleOpenDriverPicker}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[...gradients.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: 56,
                  borderRadius: borderRadius.full,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Icon name="person-add-outline" size={20} color="#050403" />
                <Text
                  style={{
                    color: "#050403",
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  Assign Driver
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Action Buttons */}
        <View style={st.actionButtons}>
          {!isCancelled && getNextStatus() && (
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={handleUpdateStatus}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[...gradients.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  height: 56,
                  borderRadius: borderRadius.full,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Icon name="arrow-forward" size={20} color="#050403" />
                <Text
                  style={{
                    color: "#050403",
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  {nextStatus ? `Mark ${STATUS_DISPLAY[nextStatus]?.label || "Next"}` : "Update Status"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              st.outlineBtn,
              {
                borderColor: colors.gold.border,
                flex: isCancelled || !getNextStatus() ? 1 : undefined,
              },
            ]}
            onPress={handleContactCustomer}
            activeOpacity={0.7}
          >
            <Icon name="call-outline" size={18} color={colors.gold.primary} />
            <Text style={[st.outlineBtnText, { color: colors.gold.primary }]}>
              Contact Customer
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Driver Picker Modal */}
      <Modal
        visible={showDriverPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDriverPicker(false)}
      >
        <View style={st.modalOverlay}>
          <View
            style={[
              st.modalContent,
              {
                backgroundColor: colors.background.card,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={st.modalHandle}>
              <View
                style={[
                  st.handleBar,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(0,0,0,0.15)",
                  },
                ]}
              />
            </View>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: colors.text.primary }]}>
                Select Driver
              </Text>
              <TouchableOpacity onPress={() => setShowDriverPicker(false)}>
                <Icon name="close" size={24} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            {driversLoading && (
              <ActivityIndicator size="small" color={colors.gold.primary} style={{ marginVertical: 20 }} />
            )}
            {!driversLoading && drivers.length === 0 && (
              <Text style={{ color: colors.text.muted, textAlign: "center", paddingVertical: 20 }}>
                No verified drivers found
              </Text>
            )}
            {drivers.map((driver) => (
              <TouchableOpacity
                key={driver.id}
                style={[
                  st.driverOption,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.02)",
                    borderColor: colors.gold.border,
                    opacity: driver.available ? 1 : 0.5,
                  },
                ]}
                onPress={() => driver.available && handleAssignDriver(driver)}
                activeOpacity={driver.available ? 0.7 : 1}
              >
                <View
                  style={[
                    st.driverOptionAvatar,
                    {
                      backgroundColor: driver.available
                        ? "#8B5CF6" + "20"
                        : "rgba(128,128,128,0.15)",
                    },
                  ]}
                >
                  <Icon
                    name="person"
                    size={20}
                    color={driver.available ? "#8B5CF6" : colors.text.dim}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      st.driverOptionName,
                      { color: colors.text.primary },
                    ]}
                  >
                    {driver.name}
                  </Text>
                  <View style={st.driverOptionMeta}>
                    <Icon
                      name={driver.available ? "checkmark-circle" : "time-outline"}
                      size={12}
                      color={driver.available ? colors.status.success : colors.text.dim}
                    />
                    <Text
                      style={[st.driverOptionRating, { color: colors.text.muted }]}
                    >
                      {driver.available ? "Verified" : "Unverified"}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    st.availabilityBadge,
                    {
                      backgroundColor: driver.available
                        ? colors.status.success + "18"
                        : colors.status.error + "18",
                    },
                  ]}
                >
                  <View
                    style={[
                      st.availabilityDot,
                      {
                        backgroundColor: driver.available
                          ? colors.status.success
                          : colors.status.error,
                      },
                    ]}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: driver.available ? colors.status.success : colors.status.error,
                    }}
                  >
                    {driver.available ? "Verified" : "Unverified"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
  },
  statusCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: 8,
    padding: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  statusCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusPillLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  statusPillLargeText: {
    fontSize: 14,
    fontWeight: "700",
  },
  updateStatusBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.lg,
  },
  updateStatusBtnSmallText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#050403",
  },
  timeline: {
    gap: 0,
  },
  timelineStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 36,
  },
  timelineDotCol: {
    width: 24,
    alignItems: "center",
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
  },
  timelineLabel: {
    fontSize: 13,
    marginLeft: 10,
    marginTop: -2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  infoCard: {
    marginHorizontal: spacing.md,
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    fontWeight: "500",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 12,
  },
  itemSubtotal: {
    fontSize: 15,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: "800",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  driverName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  driverRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  driverRating: {
    fontSize: 13,
    fontWeight: "600",
  },
  changeDriverBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  changeDriverText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    marginTop: 20,
    gap: 10,
  },
  outlineBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
  },
  modalHandle: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  driverOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  driverOptionAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  driverOptionName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  driverOptionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  driverOptionRating: {
    fontSize: 12,
    fontWeight: "600",
    marginRight: 8,
  },
  driverOptionDeliveries: {
    fontSize: 12,
  },
  availabilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  availabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
