import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  Dimensions,
  ActivityIndicator,
  Alert,
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

interface StockAlert {
  id: string;
  product_name: string;
  category: string;
  stock_quantity: number;
  low_stock_threshold: number;
}

interface StockAdjustment {
  id: string;
  product_name: string;
  previous_qty: number;
  new_qty: number;
  adjustment: number;
  reason: string;
  adjusted_by: string;
  created_at: string;
}

const REASON_OPTIONS = ["Received", "Damaged", "Sold", "Correction", "Return"];

export default function AdminStockControl() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark, shadows } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<StockAlert[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [showProductList, setShowProductList] = useState(false);
  const [currentStock, setCurrentStock] = useState("0");
  const [newQuantity, setNewQuantity] = useState("");
  const [selectedReason, setSelectedReason] = useState("Received");
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchStockData = useCallback(async () => {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, category, stock_quantity, low_stock_threshold, max_stock');

      if (error) {
        console.error('Error fetching stock data:', error);
        Alert.alert('Error', 'Failed to load stock data');
        return;
      }

      const prods = products || [];
      setAllProducts(prods);
      setTotalProducts(prods.length);

      const outOfStock = prods.filter((p: any) => (p.stock_quantity ?? 0) === 0);
      setOutOfStockCount(outOfStock.length);

      const lowStock = prods.filter(
        (p: any) => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 10)
      );
      setLowStockCount(lowStock.length);

      const alerts: StockAlert[] = prods
        .filter((p: any) => (p.stock_quantity ?? 0) <= (p.low_stock_threshold ?? 10))
        .map((p: any) => ({
          id: p.id,
          product_name: p.name || '',
          category: p.category || '',
          stock_quantity: p.stock_quantity ?? 0,
          low_stock_threshold: p.low_stock_threshold ?? 10,
        }));
      setLowStockAlerts(alerts);
    } catch (err) {
      console.error('Error fetching stock data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdjustmentHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .eq('action', 'stock_adjustment')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        // Table may not exist yet, use empty array
        console.log('Audit log not available:', error.message);
        return;
      }

      const mapped: StockAdjustment[] = (data || []).map((entry: any) => {
        const details = entry.details || {};
        return {
          id: entry.id,
          product_name: details.product_name || 'Unknown',
          previous_qty: details.previous_qty || 0,
          new_qty: details.new_qty || 0,
          adjustment: (details.new_qty || 0) - (details.previous_qty || 0),
          reason: details.reason || 'Unknown',
          adjusted_by: entry.admin_name || 'Admin',
          created_at: entry.created_at ? formatTimeAgo(entry.created_at) : '',
        };
      });

      setAdjustments(mapped);
    } catch (err) {
      console.log('Error fetching adjustments:', err);
    }
  }, []);

  useEffect(() => {
    fetchStockData();
    fetchAdjustmentHistory();
  }, [fetchStockData, fetchAdjustmentHistory]);

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

  const filteredAlerts = lowStockAlerts.filter(
    (a) =>
      searchQuery === "" ||
      a.product_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredProductSearch = allProducts.filter(
    (p: any) =>
      productSearch === "" ||
      (p.name || '').toLowerCase().includes(productSearch.toLowerCase()),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchStockData(), fetchAdjustmentHistory()]);
    setRefreshing(false);
  }, [fetchStockData, fetchAdjustmentHistory]);

  const openAdjustModal = (productName?: string, productId?: string) => {
    setSelectedProduct(productName || "");
    setSelectedProductId(productId || null);
    setProductSearch(productName || "");
    setShowProductList(false);
    const alert = lowStockAlerts.find((a) => a.product_name === productName);
    setCurrentStock(alert ? alert.stock_quantity.toString() : "0");
    setNewQuantity("");
    setSelectedReason("Received");
    setShowReasonPicker(false);
    setModalVisible(true);
  };

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product.name);
    setSelectedProductId(product.id);
    setProductSearch(product.name);
    setShowProductList(false);
    setCurrentStock((product.stock_quantity ?? 0).toString());
  };

  const adjustmentAmount =
    newQuantity !== ""
      ? parseInt(newQuantity, 10) - parseInt(currentStock, 10)
      : 0;

  const handleSaveAdjustment = async () => {
    if (!selectedProduct || newQuantity === "" || !selectedProductId) return;

    setSaving(true);
    try {
      const newQty = parseInt(newQuantity, 10);
      const prevQty = parseInt(currentStock, 10);

      // Update the product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_quantity: newQty,
          in_stock: newQty > 0,
        })
        .eq('id', selectedProductId);

      if (updateError) {
        console.error('Error updating stock:', updateError);
        Alert.alert('Error', 'Failed to update stock');
        return;
      }

      // Try to log to audit log
      try {
        await supabase.from('admin_audit_log').insert({
          action: 'stock_adjustment',
          details: {
            product_name: selectedProduct,
            product_id: selectedProductId,
            previous_qty: prevQty,
            new_qty: newQty,
            reason: selectedReason,
          },
        });
      } catch (logErr) {
        // Audit log might not exist, that's ok
        console.log('Could not log adjustment:', logErr);
      }

      // Add to local adjustments list
      const newAdj: StockAdjustment = {
        id: Date.now().toString(),
        product_name: selectedProduct,
        previous_qty: prevQty,
        new_qty: newQty,
        adjustment: newQty - prevQty,
        reason: selectedReason,
        adjusted_by: "Admin",
        created_at: "Just now",
      };
      setAdjustments((prev) => [newAdj, ...prev]);

      Alert.alert('Success', 'Stock adjusted successfully');
      setModalVisible(false);
      fetchStockData();
    } catch (err) {
      console.error('Error saving adjustment:', err);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const getReasonIcon = (reason: string): string => {
    switch (reason) {
      case "Received":
        return "arrow-down-circle-outline";
      case "Damaged":
        return "alert-circle-outline";
      case "Sold":
        return "cart-outline";
      case "Correction":
        return "pencil-outline";
      case "Return":
        return "return-down-back-outline";
      default:
        return "ellipse-outline";
    }
  };

  const getReasonColor = (reason: string): string => {
    switch (reason) {
      case "Received":
        return colors.status.success;
      case "Damaged":
        return colors.status.error;
      case "Sold":
        return colors.status.info;
      case "Correction":
        return colors.status.warning;
      case "Return":
        return "#8B5CF6";
      default:
        return "#6B7280";
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={{ color: colors.text.muted, marginTop: 12 }}>Loading stock data...</Text>
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
          <View style={{ alignItems: "center" }}>
            <BrandMark size="xs" />
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Stock Control
            </Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.primary}
            colors={[colors.gold.primary]}
          />
        }
      >
        {/* Search */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <View
            style={[
              st.searchBar,
              {
                backgroundColor: colors.background.card,
                borderColor: searchFocused
                  ? colors.gold.primary
                  : colors.gold.border,
                borderWidth: searchFocused ? 1.5 : 1,
              },
            ]}
          >
            <Icon name="search-outline" size={20} color={colors.gold.muted} />
            <TextInput
              style={[st.searchInput, { color: colors.text.primary }]}
              placeholder="Search products..."
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

        {/* Summary Cards */}
        <View style={st.summaryRow}>
          {[
            {
              label: "Total Products",
              value: totalProducts.toString(),
              icon: "cube-outline",
              color: colors.status.info,
            },
            {
              label: "Low Stock",
              value: lowStockCount.toString(),
              icon: "warning-outline",
              color: colors.status.warning,
            },
            {
              label: "Out of Stock",
              value: outOfStockCount.toString(),
              icon: "close-circle-outline",
              color: colors.status.error,
            },
          ].map((card, i) => (
            <View
              key={i}
              style={[
                st.summaryCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                  ...shadows.card,
                },
              ]}
            >
              <View
                style={[st.summaryIcon, { backgroundColor: card.color + "15" }]}
              >
                <Icon name={card.icon} size={20} color={card.color} />
              </View>
              <Text style={[st.summaryValue, { color: colors.text.primary }]}>
                {card.value}
              </Text>
              <Text style={[st.summaryLabel, { color: colors.text.dim }]}>
                {card.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Stock Alerts */}
        <View style={st.sectionHeader}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Stock Alerts
          </Text>
          <View style={[st.alertBadge, { backgroundColor: colors.status.error + "18" }]}>
            <Text style={[st.alertBadgeText, { color: colors.status.error }]}>
              {lowStockAlerts.length}
            </Text>
          </View>
        </View>

        {filteredAlerts.map((alert) => {
          const isOutOfStock = alert.stock_quantity === 0;
          const alertColor = isOutOfStock ? colors.status.error : colors.status.warning;

          return (
            <View
              key={alert.id}
              style={[
                st.alertCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                },
              ]}
            >
              <View style={st.alertRow}>
                <View
                  style={[st.alertIndicator, { backgroundColor: alertColor }]}
                />
                <View style={st.alertInfo}>
                  <Text
                    style={[st.alertName, { color: colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {alert.product_name}
                  </Text>
                  <View style={st.alertMeta}>
                    <Text
                      style={[st.alertCategory, { color: colors.text.muted }]}
                    >
                      {alert.category}
                    </Text>
                    <View style={st.alertStockRow}>
                      <Text style={[st.alertStock, { color: alertColor }]}>
                        {alert.stock_quantity}
                      </Text>
                      <Text style={{ color: colors.text.dim, fontSize: 12 }}>
                        {" / "}
                      </Text>
                      <Text style={{ color: colors.text.dim, fontSize: 12 }}>
                        {alert.low_stock_threshold} threshold
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => openAdjustModal(alert.product_name, alert.id)}
                  style={[
                    st.adjustSmallBtn,
                    {
                      borderColor: alertColor + "40",
                      backgroundColor: alertColor + "10",
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[st.adjustSmallBtnText, { color: alertColor }]}>
                    Adjust
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Recent Adjustments */}
        <View style={[st.sectionHeader, { marginTop: 24 }]}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Recent Adjustments
          </Text>
        </View>

        {adjustments.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Text style={{ color: colors.text.dim, fontSize: 14 }}>No recent adjustments</Text>
          </View>
        )}

        {adjustments.map((adj) => {
          const reasonColor = getReasonColor(adj.reason);
          const isPositive = adj.adjustment > 0;

          return (
            <View
              key={adj.id}
              style={[
                st.adjustCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                },
              ]}
            >
              <View style={st.adjustCardRow}>
                <View
                  style={[
                    st.adjustIconCircle,
                    { backgroundColor: reasonColor + "15" },
                  ]}
                >
                  <Icon
                    name={getReasonIcon(adj.reason)}
                    size={18}
                    color={reasonColor}
                  />
                </View>
                <View style={st.adjustInfo}>
                  <Text
                    style={[
                      st.adjustProductName,
                      { color: colors.text.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {adj.product_name}
                  </Text>
                  <View style={st.adjustMetaRow}>
                    <View
                      style={[
                        st.reasonPill,
                        { backgroundColor: reasonColor + "18" },
                      ]}
                    >
                      <Text style={[st.reasonPillText, { color: reasonColor }]}>
                        {adj.reason}
                      </Text>
                    </View>
                    <Text style={{ color: colors.text.dim, fontSize: 11 }}>
                      {adj.adjusted_by}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: colors.text.dim,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    {adj.created_at}
                  </Text>
                </View>
                <View style={st.adjustQtyCol}>
                  <Text
                    style={[
                      st.adjustQtyChange,
                      { color: isPositive ? colors.status.success : colors.status.error },
                    ]}
                  >
                    {isPositive ? "+" : ""}
                    {adj.adjustment}
                  </Text>
                  <Text style={{ color: colors.text.dim, fontSize: 11 }}>
                    {adj.previous_qty} → {adj.new_qty}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* FAB - Adjust Stock */}
      <TouchableOpacity
        onPress={() => openAdjustModal()}
        activeOpacity={0.85}
        style={[st.fab, { bottom: insets.bottom + 20 }]}
      >
        <LinearGradient
          colors={[colors.gold.primary, colors.gold.dark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={st.fabGradient}
        >
          <Icon name="swap-vertical-outline" size={22} color={colors.white} />
          <Text style={st.fabText}>Adjust Stock</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Stock Adjustment Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[st.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View
            style={[
              st.modalContent,
              {
                backgroundColor: colors.background.primary,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: colors.text.primary }]}>
                Adjust Stock
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Product Selector */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Product
              </Text>
              <TextInput
                style={[
                  st.fieldInput,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                    color: colors.text.primary,
                  },
                ]}
                placeholder="Search for a product..."
                placeholderTextColor={colors.text.dim}
                value={productSearch}
                onChangeText={(t) => {
                  setProductSearch(t);
                  setShowProductList(true);
                  setSelectedProduct("");
                  setSelectedProductId(null);
                }}
                onFocus={() => setShowProductList(true)}
              />
              {showProductList &&
                productSearch.length > 0 &&
                !selectedProduct && (
                  <View
                    style={[
                      st.productDropdown,
                      {
                        backgroundColor: colors.background.card,
                        borderColor: colors.gold.border,
                      },
                    ]}
                  >
                    {filteredProductSearch.slice(0, 10).map((product: any) => (
                      <TouchableOpacity
                        key={product.id}
                        style={st.productDropdownItem}
                        onPress={() => handleSelectProduct(product)}
                      >
                        <Icon
                          name="cube-outline"
                          size={16}
                          color={colors.gold.muted}
                        />
                        <Text
                          style={{
                            color: colors.text.primary,
                            fontSize: 14,
                            flex: 1,
                          }}
                        >
                          {product.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

              {/* Current Stock */}
              {selectedProduct !== "" && (
                <View
                  style={[
                    st.currentStockBox,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(0,0,0,0.03)",
                      borderColor: colors.gold.border,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text.muted, fontSize: 13 }}>
                    Current Stock
                  </Text>
                  <Text
                    style={[
                      st.currentStockValue,
                      { color: colors.text.primary },
                    ]}
                  >
                    {currentStock} units
                  </Text>
                </View>
              )}

              {/* New Quantity */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                New Quantity
              </Text>
              <TextInput
                style={[
                  st.fieldInput,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                    color: colors.text.primary,
                  },
                ]}
                placeholder="Enter new stock quantity"
                placeholderTextColor={colors.text.dim}
                value={newQuantity}
                onChangeText={setNewQuantity}
                keyboardType="number-pad"
              />

              {/* Adjustment Preview */}
              {newQuantity !== "" && selectedProduct !== "" && (
                <View
                  style={[
                    st.adjustPreview,
                    {
                      backgroundColor:
                        (adjustmentAmount >= 0 ? colors.status.success : colors.status.error) + "10",
                      borderColor:
                        (adjustmentAmount >= 0 ? colors.status.success : colors.status.error) + "30",
                    },
                  ]}
                >
                  <Icon
                    name={
                      adjustmentAmount >= 0
                        ? "arrow-up-circle-outline"
                        : "arrow-down-circle-outline"
                    }
                    size={20}
                    color={adjustmentAmount >= 0 ? colors.status.success : colors.status.error}
                  />
                  <Text
                    style={{
                      color: adjustmentAmount >= 0 ? colors.status.success : colors.status.error,
                      fontSize: 15,
                      fontWeight: "700",
                    }}
                  >
                    {adjustmentAmount >= 0 ? "+" : ""}
                    {adjustmentAmount} units
                  </Text>
                </View>
              )}

              {/* Reason Picker */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Reason
              </Text>
              <TouchableOpacity
                style={[
                  st.fieldInput,
                  st.pickerBtn,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                  },
                ]}
                onPress={() => setShowReasonPicker(!showReasonPicker)}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: getReasonColor(selectedReason),
                    }}
                  />
                  <Text style={{ color: colors.text.primary, fontSize: 15 }}>
                    {selectedReason}
                  </Text>
                </View>
                <Icon
                  name={showReasonPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.text.muted}
                />
              </TouchableOpacity>
              {showReasonPicker && (
                <View
                  style={[
                    st.pickerList,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.gold.border,
                    },
                  ]}
                >
                  {REASON_OPTIONS.map((reason) => {
                    const rColor = getReasonColor(reason);
                    return (
                      <TouchableOpacity
                        key={reason}
                        style={[
                          st.pickerItem,
                          selectedReason === reason && {
                            backgroundColor: rColor + "10",
                          },
                        ]}
                        onPress={() => {
                          setSelectedReason(reason);
                          setShowReasonPicker(false);
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Icon
                            name={getReasonIcon(reason)}
                            size={16}
                            color={rColor}
                          />
                          <Text
                            style={{
                              color:
                                selectedReason === reason
                                  ? rColor
                                  : colors.text.primary,
                              fontSize: 15,
                              fontWeight:
                                selectedReason === reason ? "600" : "400",
                            }}
                          >
                            {reason}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSaveAdjustment}
                activeOpacity={0.85}
                style={{ marginTop: spacing.lg }}
                disabled={saving}
              >
                <LinearGradient
                  colors={[colors.gold.primary, colors.gold.dark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={st.saveBtn}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Icon name="checkmark" size={20} color={colors.white} />
                      <Text style={st.saveBtnText}>Save Adjustment</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[st.cancelBtn, { borderColor: colors.gold.border }]}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    color: colors.text.muted,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", letterSpacing: 0.5 },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: borderRadius.md, paddingHorizontal: 14, height: 46 },
  searchInput: { flex: 1, fontSize: 15, marginLeft: 10, marginRight: 8 },
  summaryRow: { flexDirection: "row", paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: 10 },
  summaryCard: { flex: 1, alignItems: "center", padding: 14, borderRadius: borderRadius.md, borderWidth: 1 },
  summaryIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  summaryValue: { fontSize: 24, fontWeight: "800", marginBottom: 2 },
  summaryLabel: { fontSize: 11, fontWeight: "600" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, marginTop: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  alertBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.md },
  alertBadgeText: { fontSize: 12, fontWeight: "700" },
  alertCard: { marginHorizontal: spacing.md, marginBottom: 8, borderRadius: borderRadius.md, borderWidth: 1, padding: 14 },
  alertRow: { flexDirection: "row", alignItems: "center" },
  alertIndicator: { width: 4, height: 40, borderRadius: 2, marginRight: 12 },
  alertInfo: { flex: 1 },
  alertName: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  alertMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  alertCategory: { fontSize: 12, fontWeight: "600" },
  alertStockRow: { flexDirection: "row", alignItems: "center" },
  alertStock: { fontSize: 13, fontWeight: "800" },
  adjustSmallBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: borderRadius.md, borderWidth: 1, marginLeft: 8 },
  adjustSmallBtnText: { fontSize: 12, fontWeight: "700" },
  adjustCard: { marginHorizontal: spacing.md, marginBottom: 8, borderRadius: borderRadius.md, borderWidth: 1, padding: 14 },
  adjustCardRow: { flexDirection: "row", alignItems: "center" },
  adjustIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginRight: 12 },
  adjustInfo: { flex: 1 },
  adjustProductName: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  adjustMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  reasonPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm },
  reasonPillText: { fontSize: 11, fontWeight: "700" },
  adjustQtyCol: { alignItems: "flex-end", marginLeft: 10 },
  adjustQtyChange: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  fab: { position: "absolute", right: spacing.md, zIndex: 10 },
  fabGradient: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, height: 52, borderRadius: 26 },
  fabText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingHorizontal: spacing.md, paddingTop: 20, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: "800" },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldInput: { borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: 14, height: 50, fontSize: 15 },
  pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerList: { borderWidth: 1, borderRadius: borderRadius.md, marginTop: 6, overflow: "hidden" },
  pickerItem: { paddingHorizontal: 14, paddingVertical: 12 },
  productDropdown: { borderWidth: 1, borderRadius: borderRadius.md, marginTop: 6, maxHeight: 200, overflow: "hidden" },
  productDropdownItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  currentStockBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, padding: 14, borderRadius: borderRadius.md, borderWidth: 1 },
  currentStockValue: { fontSize: 20, fontWeight: "800" },
  adjustPreview: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, padding: 12, borderRadius: borderRadius.md, borderWidth: 1 },
  saveBtn: { height: 56, borderRadius: borderRadius.full, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
  saveBtnText: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  cancelBtn: { height: 50, borderRadius: borderRadius.full, justifyContent: "center", alignItems: "center", borderWidth: 1, marginTop: 12 },
});
