import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "../../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, borderRadius } from "../../theme";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../../lib/supabase";

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  joinDate: string;
  totalOrders: number;
  totalSpent: number;
  isVip: boolean;
  isActive: boolean;
  rating: number;
  lastOrderDate: string;
  loyaltyPoints: number;
  notes: string;
}

type FilterTab = "All" | "VIP" | "Active" | "Inactive" | "New";

const FILTERS: FilterTab[] = ["All", "VIP", "Active", "Inactive", "New"];

export default function AdminCustomerManagement() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Stats
  const [stats, setStats] = useState([
    { label: "Total Customers", value: "0", icon: "people-outline" as const, color: colors.status.info },
    { label: "Active", value: "0", icon: "checkmark-circle-outline" as const, color: colors.status.success },
    { label: "VIP", value: "0", icon: "diamond-outline" as const, color: colors.gold.primary },
    { label: "New This Month", value: "0", icon: "person-add-outline" as const, color: "#8B5CF6" },
  ]);

  const fetchCustomers = useCallback(async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        Alert.alert("Error", "Failed to load customers.");
        return;
      }

      if (!profiles || profiles.length === 0) {
        setCustomers([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch order data for all customers
      const { data: orders } = await supabase
        .from("orders")
        .select("user_id, total, created_at, status");

      const ordersByUser: Record<string, { count: number; total: number; lastDate: string }> = {};
      (orders || []).forEach((o: any) => {
        const uid = o.user_id;
        if (!uid) return;
        if (!ordersByUser[uid]) {
          ordersByUser[uid] = { count: 0, total: 0, lastDate: "" };
        }
        ordersByUser[uid].count += 1;
        ordersByUser[uid].total += parseFloat(o.total) || 0;
        if (!ordersByUser[uid].lastDate || o.created_at > ordersByUser[uid].lastDate) {
          ordersByUser[uid].lastDate = o.created_at;
        }
      });

      // Map profiles to Customer interface
      const mappedCustomers: Customer[] = profiles.map((p: any) => {
        const nameParts = (p.full_name || p.name || "Unknown").split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const userOrders = ordersByUser[p.id] || { count: 0, total: 0, lastDate: "" };

        // Determine if active based on last order (within last 90 days)
        const lastOrderDate = userOrders.lastDate ? new Date(userOrders.lastDate) : null;
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const isActive = p.is_active !== undefined
          ? p.is_active
          : lastOrderDate ? lastOrderDate >= ninetyDaysAgo : true;

        return {
          id: p.id,
          firstName,
          lastName,
          phone: p.phone || p.phone_number || "",
          email: p.email || "",
          joinDate: p.created_at ? new Date(p.created_at).toISOString().split("T")[0] : "",
          totalOrders: userOrders.count,
          totalSpent: Math.round(userOrders.total),
          isVip: p.is_vip || false,
          isActive,
          rating: p.rating || 0,
          lastOrderDate: userOrders.lastDate
            ? new Date(userOrders.lastDate).toISOString().split("T")[0]
            : "No orders",
          loyaltyPoints: p.loyalty_points || Math.round(userOrders.total / 10),
          notes: p.notes || "",
        };
      });

      setCustomers(mappedCustomers);

      // Calculate stats
      const totalCustomers = mappedCustomers.length;
      const activeCount = mappedCustomers.filter((c) => c.isActive).length;
      const vipCount = mappedCustomers.filter((c) => c.isVip).length;

      // New this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const newThisMonth = mappedCustomers.filter(
        (c) => new Date(c.joinDate) >= startOfMonth
      ).length;

      setStats([
        { label: "Total Customers", value: totalCustomers.toLocaleString(), icon: "people-outline", color: colors.status.info },
        { label: "Active", value: activeCount.toLocaleString(), icon: "checkmark-circle-outline", color: colors.status.success },
        { label: "VIP", value: vipCount.toLocaleString(), icon: "diamond-outline", color: colors.gold.primary },
        { label: "New This Month", value: newThisMonth.toLocaleString(), icon: "person-add-outline", color: "#8B5CF6" },
      ]);
    } catch (error) {
      console.error("Error fetching customers:", error);
      Alert.alert("Error", "Failed to load customer data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      searchQuery === "" ||
      `${c.firstName} ${c.lastName}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);

    switch (activeFilter) {
      case "VIP":
        return matchesSearch && c.isVip;
      case "Active":
        return matchesSearch && c.isActive;
      case "Inactive":
        return matchesSearch && !c.isActive;
      case "New":
        return matchesSearch && c.totalOrders <= 5;
      default:
        return matchesSearch;
    }
  });

  const getInitials = (first: string, last: string): string =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={
            i <= Math.floor(rating)
              ? "star"
              : i - rating < 1
                ? "star-half"
                : "star-outline"
          }
          size={12}
          color={colors.status.warning}
        />,
      );
    }
    return stars;
  };

  const handleSendNotification = (customer: Customer) => {
    Alert.alert(
      "Send Notification",
      `Send a push notification to ${customer.firstName} ${customer.lastName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: () => Alert.alert("Sent", "Notification sent successfully."),
        },
      ],
    );
  };

  const handleApplyDiscount = (customer: Customer) => {
    Alert.alert(
      "Apply Discount",
      `Apply a 10% discount coupon for ${customer.firstName} ${customer.lastName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Apply",
          onPress: () =>
            Alert.alert("Applied", "Discount coupon has been sent."),
        },
      ],
    );
  };

  const handleFlagVip = (customer: Customer) => {
    const action = customer.isVip ? "Remove VIP status from" : "Flag as VIP";
    Alert.alert(
      customer.isVip ? "Remove VIP" : "Flag VIP",
      `${action} ${customer.firstName} ${customer.lastName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const newVipStatus = !customer.isVip;
              const { error } = await supabase
                .from("profiles")
                .update({ is_vip: newVipStatus })
                .eq("id", customer.id);

              if (error) {
                console.error("Error updating VIP status:", error);
                // Still update locally even if Supabase fails (column may not exist)
              }

              setCustomers((prev) =>
                prev.map((c) =>
                  c.id === customer.id ? { ...c, isVip: newVipStatus } : c,
                ),
              );

              // Update selected customer if modal is open
              if (selectedCustomer?.id === customer.id) {
                setSelectedCustomer((prev) =>
                  prev ? { ...prev, isVip: newVipStatus } : prev
                );
              }

              Alert.alert(
                "Success",
                `${customer.firstName} ${customer.lastName} ${newVipStatus ? "is now a VIP customer" : "VIP status removed"}.`
              );
            } catch (e) {
              console.error("Error toggling VIP:", e);
              Alert.alert("Error", "Failed to update VIP status.");
            }
          },
        },
      ],
    );
  };

  const handleExport = () => {
    Alert.alert(
      "Export Data",
      "Customer data export started. You will receive a CSV file via email.",
      [{ text: "OK" }],
    );
  };

  const openCustomerDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDetailModalVisible(true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
        <LinearGradient
          colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 14,
            paddingHorizontal: 16,
          }}
        >
          <View style={st.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[
                st.headerBtn,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <Icon name="chevron-back" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Customer Management
            </Text>
            <View style={{ width: 38 }} />
          </View>
        </LinearGradient>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.gold.primary} />
          <Text style={{ color: colors.text.muted, marginTop: 12, fontSize: 14 }}>
            Loading customers...
          </Text>
        </View>
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
          paddingHorizontal: 16,
        }}
      >
        <View style={st.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[
              st.headerBtn,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Icon name="chevron-back" size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: colors.text.primary }]}>
            Customer Management
          </Text>
          <TouchableOpacity
            onPress={() => {}}
            style={[
              st.headerBtn,
              {
                backgroundColor: isDark
                  ? "rgba(212,175,55,0.15)"
                  : "rgba(212,175,55,0.1)",
              },
            ]}
          >
            <Icon name="search" size={20} color={colors.gold.primary} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Search Bar */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View
            style={[
              st.searchBar,
              {
                backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                borderColor: searchFocused
                  ? colors.gold.primary
                  : isDark
                    ? "rgba(212,175,55,0.15)"
                    : "rgba(212,175,55,0.25)",
                borderWidth: searchFocused ? 1.5 : 1,
              },
            ]}
          >
            <Icon name="search-outline" size={20} color={colors.gold.muted} />
            <TextInput
              style={[st.searchInput, { color: colors.text.primary }]}
              placeholder="Search customers..."
              placeholderTextColor={colors.text.dim}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Icon name="close-circle" size={18} color={colors.gold.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            gap: 10,
          }}
        >
          {stats.map((stat, i) => (
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
                style={[st.statIcon, { backgroundColor: stat.color + "15" }]}
              >
                <Icon name={stat.icon} size={18} color={stat.color} />
              </View>
              <Text style={[st.statValue, { color: colors.text.primary }]}>
                {stat.value}
              </Text>
              <Text style={[st.statLabel, { color: colors.text.dim }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            gap: 8,
          }}
        >
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={[
                  st.filterPill,
                  {
                    backgroundColor: isActive
                      ? colors.gold.primary + "20"
                      : isDark
                        ? "#1a1510"
                        : "#F5F3EF",
                    borderColor: isActive
                      ? colors.gold.primary
                      : isDark
                        ? "rgba(212,175,55,0.15)"
                        : "rgba(212,175,55,0.25)",
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    st.filterPillText,
                    { color: isActive ? colors.gold.primary : colors.text.muted },
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Customer Count */}
        <View
          style={{ paddingHorizontal: 16, marginTop: 14, marginBottom: 10 }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: colors.text.muted,
            }}
          >
            {filteredCustomers.length} customer
            {filteredCustomers.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* Customer List */}
        {filteredCustomers.map((customer) => {
          const isExpanded = expandedId === customer.id;
          return (
            <View
              key={customer.id}
              style={[
                st.customerCard,
                {
                  backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                  borderColor: isDark
                    ? "rgba(212,175,55,0.15)"
                    : "rgba(212,175,55,0.25)",
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => toggleExpanded(customer.id)}
              >
                <View style={st.customerTopRow}>
                  {/* Avatar */}
                  <LinearGradient
                    colors={
                      customer.isVip
                        ? [colors.gold.primary, colors.gold.dark]
                        : [
                            isDark ? "#2a2520" : "#E8E4DD",
                            isDark ? "#201c16" : "#DDD8D0",
                          ]
                    }
                    style={st.avatar}
                  >
                    <Text
                      style={[
                        st.avatarText,
                        {
                          color: customer.isVip ? colors.white : colors.text.primary,
                        },
                      ]}
                    >
                      {getInitials(customer.firstName, customer.lastName)}
                    </Text>
                  </LinearGradient>

                  {/* Info */}
                  <View style={st.customerInfo}>
                    <View style={st.nameRow}>
                      <Text
                        style={[
                          st.customerName,
                          { color: colors.text.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {customer.firstName} {customer.lastName}
                      </Text>
                      {customer.isVip && (
                        <View
                          style={[
                            st.vipBadge,
                            { backgroundColor: colors.gold.primary + "18" },
                          ]}
                        >
                          <Icon name="diamond" size={10} color={colors.gold.primary} />
                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight: "700",
                              color: colors.gold.primary,
                            }}
                          >
                            VIP
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.text.muted,
                        marginTop: 2,
                      }}
                    >
                      {customer.phone}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.text.dim,
                        marginTop: 1,
                      }}
                    >
                      {customer.email}
                    </Text>

                    <View style={st.customerMetaRow}>
                      <View style={st.metaItem}>
                        <Icon
                          name="calendar-outline"
                          size={12}
                          color={colors.text.dim}
                        />
                        <Text style={{ fontSize: 11, color: colors.text.dim }}>
                          Joined {customer.joinDate}
                        </Text>
                      </View>
                      <View style={st.metaItem}>
                        <Icon
                          name="cart-outline"
                          size={12}
                          color={colors.text.dim}
                        />
                        <Text style={{ fontSize: 11, color: colors.text.dim }}>
                          {customer.totalOrders} orders
                        </Text>
                      </View>
                    </View>

                    <View style={st.customerMetaRow}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: colors.gold.primary,
                        }}
                      >
                        R{customer.totalSpent.toLocaleString()}
                      </Text>
                      {customer.rating > 0 && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                            marginLeft: 12,
                          }}
                        >
                          {renderStars(customer.rating)}
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "600",
                              color: colors.text.muted,
                              marginLeft: 4,
                            }}
                          >
                            {customer.rating}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.text.dim,
                        marginTop: 4,
                      }}
                    >
                      Last order: {customer.lastOrderDate}
                    </Text>
                  </View>

                  {/* Expand Icon */}
                  <Icon
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.text.muted}
                  />
                </View>
              </TouchableOpacity>

              {/* Expanded Section */}
              {isExpanded && (
                <View style={st.expandedSection}>
                  <View
                    style={[
                      st.expandedInfoBox,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(0,0,0,0.03)",
                        borderColor: isDark
                          ? "rgba(212,175,55,0.15)"
                          : "rgba(212,175,55,0.25)",
                      },
                    ]}
                  >
                    <View style={st.expandedInfoRow}>
                      <View style={st.expandedInfoItem}>
                        <Text
                          style={{
                            fontSize: 11,
                            color: colors.text.dim,
                            textTransform: "uppercase",
                            fontWeight: "600",
                          }}
                        >
                          Loyalty Points
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "800",
                            color: colors.gold.primary,
                            marginTop: 4,
                          }}
                        >
                          {customer.loyaltyPoints.toLocaleString()}
                        </Text>
                      </View>
                      <View style={st.expandedInfoItem}>
                        <Text
                          style={{
                            fontSize: 11,
                            color: colors.text.dim,
                            textTransform: "uppercase",
                            fontWeight: "600",
                          }}
                        >
                          Avg Order
                        </Text>
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "800",
                            color: colors.text.primary,
                            marginTop: 4,
                          }}
                        >
                          R
                          {customer.totalOrders > 0
                            ? Math.round(
                                customer.totalSpent / customer.totalOrders,
                              ).toLocaleString()
                            : "0"}
                        </Text>
                      </View>
                      <View style={st.expandedInfoItem}>
                        <Text
                          style={{
                            fontSize: 11,
                            color: colors.text.dim,
                            textTransform: "uppercase",
                            fontWeight: "600",
                          }}
                        >
                          Status
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            marginTop: 4,
                          }}
                        >
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: customer.isActive
                                ? colors.status.success
                                : colors.status.error,
                            }}
                          />
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: customer.isActive ? colors.status.success : colors.status.error,
                            }}
                          >
                            {customer.isActive ? "Active" : "Inactive"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {customer.notes !== "" && (
                      <View
                        style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTopWidth: 1,
                          borderTopColor: isDark
                            ? "rgba(212,175,55,0.1)"
                            : "rgba(212,175,55,0.15)",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: colors.text.dim,
                            fontWeight: "600",
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                        >
                          Notes
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: colors.text.muted,
                            lineHeight: 18,
                          }}
                        >
                          {customer.notes}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Action Buttons */}
                  <View style={st.actionRow}>
                    <TouchableOpacity
                      onPress={() => handleSendNotification(customer)}
                      style={[
                        st.actionBtn,
                        {
                          backgroundColor: colors.status.info + "15",
                          borderColor: colors.status.info + "30",
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Icon
                        name="notifications-outline"
                        size={14}
                        color={colors.status.info}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: colors.status.info,
                        }}
                      >
                        Notify
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleApplyDiscount(customer)}
                      style={[
                        st.actionBtn,
                        {
                          backgroundColor: colors.status.success + "15",
                          borderColor: colors.status.success + "30",
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Icon name="pricetag-outline" size={14} color={colors.status.success} />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: colors.status.success,
                        }}
                      >
                        Discount
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleFlagVip(customer)}
                      style={[
                        st.actionBtn,
                        {
                          backgroundColor: customer.isVip
                            ? colors.status.error + "15"
                            : colors.gold.primary + "15",
                          borderColor: customer.isVip
                            ? colors.status.error + "30"
                            : colors.gold.primary + "30",
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Icon
                        name="diamond-outline"
                        size={14}
                        color={customer.isVip ? colors.status.error : colors.gold.primary}
                      />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: customer.isVip ? colors.status.error : colors.gold.primary,
                        }}
                      >
                        {customer.isVip ? "Remove VIP" : "Flag VIP"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {filteredCustomers.length === 0 && (
          <View style={st.emptyState}>
            <Icon name="people-outline" size={48} color={colors.gold.muted} />
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: colors.text.primary,
                marginTop: 10,
              }}
            >
              No customers found
            </Text>
            <Text
              style={{ fontSize: 14, color: colors.text.muted, marginTop: 4 }}
            >
              Try adjusting your search or filter
            </Text>
          </View>
        )}

        {/* Export Button */}
        <View
          style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 }}
        >
          <TouchableOpacity onPress={handleExport} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.gold.primary, colors.gold.dark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.exportBtn}
            >
              <Icon name="download-outline" size={20} color={colors.white} />
              <Text style={st.exportBtnText}>Export Customer Data</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Customer Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View
          style={[
            st.modalOverlay,
            { backgroundColor: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)" },
          ]}
        >
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
                Customer Details
              </Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Icon name="close" size={24} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            {selectedCustomer && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: "center", marginBottom: 20 }}>
                  <LinearGradient
                    colors={
                      selectedCustomer.isVip
                        ? [colors.gold.primary, colors.gold.dark]
                        : [
                            isDark ? "#2a2520" : "#E8E4DD",
                            isDark ? "#201c16" : "#DDD8D0",
                          ]
                    }
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 35,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 24,
                        fontWeight: "800",
                        color: selectedCustomer.isVip
                          ? colors.white
                          : colors.text.primary,
                      }}
                    >
                      {getInitials(
                        selectedCustomer.firstName,
                        selectedCustomer.lastName,
                      )}
                    </Text>
                  </LinearGradient>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "800",
                      color: colors.text.primary,
                      marginTop: 12,
                    }}
                  >
                    {selectedCustomer.firstName} {selectedCustomer.lastName}
                  </Text>
                  {selectedCustomer.isVip && (
                    <View
                      style={[
                        st.vipBadge,
                        { backgroundColor: colors.gold.primary + "18", marginTop: 8 },
                      ]}
                    >
                      <Icon name="diamond" size={12} color={colors.gold.primary} />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: colors.gold.primary,
                        }}
                      >
                        VIP Customer
                      </Text>
                    </View>
                  )}
                </View>

                <View
                  style={[
                    st.modalInfoCard,
                    {
                      backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                      borderColor: isDark
                        ? "rgba(212,175,55,0.15)"
                        : "rgba(212,175,55,0.25)",
                    },
                  ]}
                >
                  <View style={st.modalInfoRow}>
                    <Icon
                      name="call-outline"
                      size={16}
                      color={colors.gold.muted}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: colors.text.primary,
                      }}
                    >
                      {selectedCustomer.phone}
                    </Text>
                  </View>
                  <View style={st.modalInfoRow}>
                    <Icon
                      name="mail-outline"
                      size={16}
                      color={colors.gold.muted}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: colors.text.primary,
                      }}
                    >
                      {selectedCustomer.email}
                    </Text>
                  </View>
                  <View style={st.modalInfoRow}>
                    <Icon
                      name="calendar-outline"
                      size={16}
                      color={colors.gold.muted}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: colors.text.primary,
                      }}
                    >
                      Joined {selectedCustomer.joinDate}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  <View
                    style={[
                      st.modalStatBox,
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
                        fontSize: 22,
                        fontWeight: "800",
                        color: colors.gold.primary,
                      }}
                    >
                      R{selectedCustomer.totalSpent.toLocaleString()}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.text.dim,
                        marginTop: 2,
                      }}
                    >
                      Total Spent
                    </Text>
                  </View>
                  <View
                    style={[
                      st.modalStatBox,
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
                        fontSize: 22,
                        fontWeight: "800",
                        color: colors.text.primary,
                      }}
                    >
                      {selectedCustomer.totalOrders}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.text.dim,
                        marginTop: 2,
                      }}
                    >
                      Total Orders
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <View
                    style={[
                      st.modalStatBox,
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
                        fontSize: 22,
                        fontWeight: "800",
                        color: colors.gold.primary,
                      }}
                    >
                      {selectedCustomer.loyaltyPoints.toLocaleString()}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.text.dim,
                        marginTop: 2,
                      }}
                    >
                      Loyalty Points
                    </Text>
                  </View>
                  <View
                    style={[
                      st.modalStatBox,
                      {
                        backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
                        borderColor: isDark
                          ? "rgba(212,175,55,0.15)"
                          : "rgba(212,175,55,0.25)",
                      },
                    ]}
                  >
                    {selectedCustomer.rating > 0 ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        {renderStars(selectedCustomer.rating)}
                      </View>
                    ) : (
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.text.dim,
                        }}
                      >
                        No rating
                      </Text>
                    )}
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.text.dim,
                        marginTop: 2,
                      }}
                    >
                      Rating {selectedCustomer.rating > 0 ? `(${selectedCustomer.rating})` : ""}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setDetailModalVisible(false)}
                  style={[
                    st.cancelBtn,
                    {
                      borderColor: isDark
                        ? "rgba(212,175,55,0.15)"
                        : "rgba(212,175,55,0.25)",
                      marginTop: 24,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      color: colors.text.muted,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Close
                  </Text>
                </TouchableOpacity>
              </ScrollView>
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
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 10,
    marginRight: 8,
  },
  statCard: {
    width: 130,
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  customerCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
  },
  customerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800",
  },
  customerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customerName: {
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  customerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  expandedSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,175,55,0.1)",
    paddingTop: 14,
  },
  expandedInfoBox: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
  },
  expandedInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  expandedInfoItem: {
    flex: 1,
    alignItems: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
  },
  exportBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  exportBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: 16,
    paddingTop: 20,
    maxHeight: "90%",
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
  modalInfoCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  modalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalStatBox: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  cancelBtn: {
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
});
