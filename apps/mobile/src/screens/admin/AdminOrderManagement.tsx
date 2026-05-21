import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../../components/Icon";
import BrandMark from "../../components/BrandMark";
import { useTheme } from "../../contexts/ThemeContext";
import { useOrders } from "../../contexts/OrderContext";
import { STATUS_DISPLAY } from "../../services/OrderWorkflowEngine";
import { supabase } from "../../lib/supabase";
import { spacing, borderRadius } from "../../theme";

const { width } = Dimensions.get("window");

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Pending", color: "#F59E0B", icon: "time-outline" },
  confirmed: { label: "Confirmed", color: "#0EA5E9", icon: "checkmark-circle-outline" },
  preparing: {
    label: "Preparing",
    color: "#3B82F6",
    icon: "restaurant-outline",
  },
  ready: { label: "Ready", color: "#14B8A6", icon: "bag-check-outline" },
  driver_assigned: { label: "Driver Assigned", color: "#6366F1", icon: "person-outline" },
  picked_up: { label: "Picked Up", color: "#A855F7", icon: "cube-outline" },
  en_route: {
    label: "En Route",
    color: "#8B5CF6",
    icon: "bicycle-outline",
  },
  delivered: {
    label: "Delivered",
    color: "#10B981",
    icon: "checkmark-done-outline",
  },
  completed: { label: "Completed", color: "#059669", icon: "trophy-outline" },
  cancelled: {
    label: "Cancelled",
    color: "#EF4444",
    icon: "close-circle-outline",
  },
  refunded: { label: "Refunded", color: "#F97316", icon: "return-down-back-outline" },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "driver_assigned", label: "Driver Assigned" },
  { key: "picked_up", label: "Picked Up" },
  { key: "en_route", label: "En Route" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
];

interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  total: number;
  status: string;
  items_count: number;
  created_at: string;
  driver_name: string | null;
  profiles?: { full_name: string; phone: string } | null;
  order_items?: any[];
}

export default function AdminOrderManagement() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark, shadows } = useTheme();
  const { activeOrders, getStatusDisplay } = useOrders();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [driverModalVisible, setDriverModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      // orders.user_id → auth.users, NOT profiles — PostgREST cannot resolve
      // profiles(…) as an implicit FK join. Fetch profiles in a second query.
      let query = supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });

      if (activeFilter !== 'all') {
        query = query.eq('status', activeFilter);
      }

      if (searchQuery.trim()) {
        query = query.or(`order_number.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching orders:', error);
        Alert.alert('Error', 'Failed to load orders');
        return;
      }

      // Batch-fetch profiles for all unique user_ids in one round-trip
      const userIds = [...new Set((data || []).map((o: any) => o.user_id).filter(Boolean))];
      let profileMap: Record<string, { full_name?: string; phone?: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', userIds);
        (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });
      }

      const mapped = (data || []).map((order: any) => {
        const profile = profileMap[order.user_id] || {};
        return {
          id: order.id,
          order_number: order.order_number || `ORD-${order.id?.slice(0, 6)}`,
          customer_name: profile.full_name || 'Unknown',
          customer_phone: profile.phone || '',
          address: (() => {
            const addr = order.delivery_address || order.address;
            if (!addr) return '';
            if (typeof addr === 'string') return addr;
            if (typeof addr === 'object') {
              return [addr.street, addr.suburb, addr.city, addr.postal_code]
                .filter(Boolean).join(', ');
            }
            return '';
          })(),
          total: order.total || 0,
          status: order.status || 'pending',
          items_count: order.order_items?.length || 0,
          created_at: order.created_at,
          driver_name: null,
        };
      });

      setOrders(mapped);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, [fetchOrders]);

  const formatTimeAgo = (dateStr: string): string => {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const handleAssignDriver = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setLoadingDrivers(true);
    setDriverModalVisible(true);

    try {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('is_verified', true)
        .eq('status', 'active');

      if (error) {
        console.error('Error fetching drivers:', error);
        Alert.alert('Error', 'Failed to load available drivers');
        return;
      }

      setAvailableDrivers(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const assignDriver = async (driverId: string, driverName: string) => {
    if (!selectedOrderId) return;

    try {
      const { error: assignError } = await supabase
        .from('delivery_assignments')
        .insert({
          order_id: selectedOrderId,
          driver_id: driverId,
          status: 'assigned',
        });

      if (assignError) {
        console.error('Error assigning driver:', assignError);
        Alert.alert('Error', 'Failed to assign driver');
        return;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'driver_assigned' })
        .eq('id', selectedOrderId);

      if (updateError) {
        console.error('Error updating order status:', updateError);
      }

      Alert.alert('Success', `Driver ${driverName} has been assigned.`);
      setDriverModalVisible(false);
      fetchOrders();
    } catch (err) {
      console.error('Error:', err);
      Alert.alert('Error', 'Something went wrong');
    }
  };

  const filteredOrders = orders;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={{ color: colors.text.muted, marginTop: 12 }}>Loading orders...</Text>
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
              Orders
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Search Bar */}
        <View
          style={[
            st.searchBar,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.03)",
              borderColor: colors.gold.border,
            },
          ]}
        >
          <Icon name="search-outline" size={18} color={colors.gold.muted} />
          <TextInput
            style={[st.searchInput, { color: colors.text.primary }]}
            placeholder="Search orders..."
            placeholderTextColor={colors.text.dim}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Icon name="close-circle" size={18} color={colors.gold.muted} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.filterTabsContent}
        style={st.filterTabs}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                st.filterTab,
                {
                  backgroundColor: isActive
                    ? colors.gold.primary + "18"
                    : isDark
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(0,0,0,0.03)",
                  borderColor: isActive
                    ? colors.gold.primary
                    : colors.gold.border,
                },
              ]}
              onPress={() => setActiveFilter(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  st.filterTabText,
                  {
                    color: isActive ? colors.gold.primary : colors.text.muted,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Order List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.primary}
          />
        }
        ListEmptyComponent={
          <View style={st.emptyState}>
            <Icon name="search-outline" size={48} color={colors.gold.muted} />
            <Text style={[st.emptyTitle, { color: colors.text.primary }]}>
              No orders found
            </Text>
            <Text style={[st.emptySubtitle, { color: colors.text.muted }]}>
              Try adjusting your search or filter
            </Text>
          </View>
        }
        renderItem={({ item: order }) => {
            const statusConf =
              STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const needsDriver =
              order.status === "preparing" && !order.driver_name;

            return (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("AdminOrderDetail", {
                    orderId: order.id,
                  })
                }
                style={[
                  st.orderCard,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                    ...shadows.card,
                  },
                ]}
              >
                {/* Color strip */}
                <View
                  style={[st.colorStrip, { backgroundColor: statusConf.color }]}
                />

                <View style={st.orderContent}>
                  {/* Top row: order number + status */}
                  <View style={st.orderTopRow}>
                    <Text
                      style={[st.orderNumber, { color: colors.text.primary }]}
                    >
                      #{order.order_number}
                    </Text>
                    <View
                      style={[
                        st.statusPill,
                        { backgroundColor: statusConf.color + "18" },
                      ]}
                    >
                      <Icon
                        name={statusConf.icon}
                        size={12}
                        color={statusConf.color}
                      />
                      <Text
                        style={[st.statusPillText, { color: statusConf.color }]}
                      >
                        {statusConf.label}
                      </Text>
                    </View>
                  </View>

                  {/* Customer name + phone */}
                  <View style={st.customerRow}>
                    <View style={st.customerInfo}>
                      <Icon
                        name="person-outline"
                        size={14}
                        color={colors.gold.muted}
                      />
                      <Text
                        style={[
                          st.customerName,
                          { color: colors.text.primary },
                        ]}
                      >
                        {order.customer_name}
                      </Text>
                    </View>
                    <View style={st.customerInfo}>
                      <Icon
                        name="call-outline"
                        size={12}
                        color={colors.text.dim}
                      />
                      <Text style={[st.phoneText, { color: colors.text.dim }]}>
                        {order.customer_phone}
                      </Text>
                    </View>
                  </View>

                  {/* Address */}
                  <View style={st.addressRow}>
                    <Icon
                      name="location-outline"
                      size={14}
                      color={colors.gold.muted}
                    />
                    <Text
                      style={[st.addressText, { color: colors.text.muted }]}
                      numberOfLines={1}
                    >
                      {order.address}
                    </Text>
                  </View>

                  {/* Meta row */}
                  <View style={st.metaRow}>
                    <View style={st.metaItem}>
                      <Icon
                        name="cube-outline"
                        size={12}
                        color={colors.text.dim}
                      />
                      <Text style={[st.metaText, { color: colors.text.dim }]}>
                        {order.items_count} items
                      </Text>
                    </View>
                    <View style={st.metaItem}>
                      <Icon
                        name="cash-outline"
                        size={12}
                        color={colors.text.dim}
                      />
                      <Text style={[st.metaText, { color: colors.text.dim }]}>
                        R{Math.round(order.total).toLocaleString('en-ZA')}
                      </Text>
                    </View>
                    <View style={st.metaItem}>
                      <Icon
                        name="time-outline"
                        size={12}
                        color={colors.text.dim}
                      />
                      <Text style={[st.metaText, { color: colors.text.dim }]}>
                        {formatTimeAgo(order.created_at)}
                      </Text>
                    </View>
                  </View>

                  {/* Driver / Assign Driver */}
                  {order.driver_name ? (
                    <View style={st.driverRow}>
                      <Icon
                        name="bicycle-outline"
                        size={14}
                        color={colors.gold.muted}
                      />
                      <Text
                        style={[st.driverName, { color: colors.text.primary }]}
                      >
                        {order.driver_name}
                      </Text>
                    </View>
                  ) : needsDriver ? (
                    <TouchableOpacity
                      style={{ marginTop: 10 }}
                      onPress={() => handleAssignDriver(order.id)}
                    >
                      <LinearGradient
                        colors={["#8B5CF6", "#7C3AED"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={st.assignDriverBtn}
                      >
                        <Icon
                          name="person-add-outline"
                          size={16}
                          color={colors.white}
                        />
                        <Text style={st.assignDriverText}>Assign Driver</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
        }}
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* Driver Assignment Modal */}
      <Modal
        visible={driverModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDriverModalVisible(false)}
      >
        <View style={[st.modalOverlay, { backgroundColor: colors.overlay || 'rgba(0,0,0,0.5)' }]}>
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
                Select Driver
              </Text>
              <TouchableOpacity onPress={() => setDriverModalVisible(false)}>
                <Icon name="close" size={24} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            {loadingDrivers ? (
              <ActivityIndicator size="large" color={colors.gold.primary} style={{ marginTop: 40 }} />
            ) : availableDrivers.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Icon name="people-outline" size={48} color={colors.gold.muted} />
                <Text style={{ color: colors.text.muted, marginTop: 12 }}>No available drivers</Text>
              </View>
            ) : (
              <FlatList
                data={availableDrivers}
                keyExtractor={(item) => item.user_id || item.id}
                renderItem={({ item: driver }) => (
                  <TouchableOpacity
                    style={[
                      st.driverOptionCard,
                      {
                        backgroundColor: colors.background.card,
                        borderColor: colors.gold.border,
                      },
                    ]}
                    onPress={() => assignDriver(driver.user_id || driver.id, driver.full_name || 'Driver')}
                  >
                    <Icon name="person-outline" size={20} color={colors.gold.primary} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 15 }}>
                        {driver.full_name || 'Unknown Driver'}
                      </Text>
                      <Text style={{ color: colors.text.dim, fontSize: 12 }}>
                        {driver.phone || ''}
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={18} color={colors.text.dim} />
                  </TouchableOpacity>
                )}
              />
            )}
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
    marginBottom: 12,
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    height: 44,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: 44,
  },
  filterTabs: {
    maxHeight: 50,
  },
  filterTabsContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 14,
  },
  orderCard: {
    marginHorizontal: spacing.md,
    marginBottom: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  colorStrip: {
    height: 4,
  },
  orderContent: {
    padding: 14,
  },
  orderTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: "800",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  customerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "600",
  },
  phoneText: {
    fontSize: 12,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 13,
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,175,55,0.1)",
  },
  driverName: {
    fontSize: 13,
    fontWeight: "600",
  },
  assignDriverBtn: {
    height: 38,
    borderRadius: 19,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  assignDriverText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: 20,
    maxHeight: "70%",
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
  driverOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
});
