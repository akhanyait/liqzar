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
  FlatList,
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

interface Product {
  id: string;
  name: string;
  category: string;
  bottle_size: string;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  image_url: string | null;
  in_stock: boolean;
}

const CATEGORIES = [
  "All",
  "Whisky",
  "Wine",
  "Vodka",
  "Gin",
  "Brandy",
  "Beer",
  "Champagne",
];

const CATEGORY_OPTIONS = [
  "Whisky",
  "Wine",
  "Vodka",
  "Gin",
  "Brandy",
  "Beer",
  "Champagne",
];

export default function AdminProductManagement() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark, shadows } = useTheme();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Whisky");
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formBottleSize, setFormBottleSize] = useState("750ml");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      let query = supabase
        .from('products')
        .select('*')
        .order('name');

      if (selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }

      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching products:', error);
        Alert.alert('Error', 'Failed to load products');
        return;
      }

      const mapped: Product[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name || '',
        category: p.category || '',
        bottle_size: p.bottle_size || p.size || '',
        price: p.price || 0,
        stock_quantity: p.stock_quantity ?? 0,
        low_stock_threshold: p.low_stock_threshold ?? 10,
        image_url: p.image_url || null,
        in_stock: (p.stock_quantity ?? 0) > 0,
      }));

      setProducts(mapped);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [fetchProducts]);

  const getStockColor = (qty: number, threshold: number): string => {
    if (qty === 0) return colors.status.error;
    if (qty <= threshold) return colors.status.warning;
    return colors.status.success;
  };

  const getStockLabel = (qty: number, threshold: number): string => {
    if (qty === 0) return "Out of stock";
    if (qty <= threshold) return `Low stock: ${qty}`;
    return `${qty} in stock`;
  };

  const getStockBarWidth = (qty: number): number => {
    if (qty === 0) return 0;
    if (qty > 60) return 100;
    return Math.max(8, (qty / 60) * 100);
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName("");
    setFormCategory("Whisky");
    setFormPrice("");
    setFormStock("");
    setFormBottleSize("750ml");
    setModalVisible(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormCategory(product.category);
    setFormPrice(product.price.toString());
    setFormStock(product.stock_quantity.toString());
    setFormBottleSize(product.bottle_size);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPrice.trim() || !formStock.trim()) return;

    setSaving(true);
    try {
      const productData = {
        name: formName,
        category: formCategory,
        price: parseFloat(formPrice) || 0,
        stock_quantity: parseInt(formStock, 10) || 0,
        bottle_size: formBottleSize,
        in_stock: (parseInt(formStock, 10) || 0) > 0,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) {
          console.error('Error updating product:', error);
          Alert.alert('Error', 'Failed to update product');
          return;
        }
        Alert.alert('Success', 'Product updated successfully');
      } else {
        const { error } = await supabase
          .from('products')
          .insert(productData);

        if (error) {
          console.error('Error adding product:', error);
          Alert.alert('Error', 'Failed to add product');
          return;
        }
        Alert.alert('Success', 'Product added successfully');
      }

      setModalVisible(false);
      fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (product: Product) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', product.id);

              if (error) {
                console.error('Error deleting product:', error);
                Alert.alert('Error', 'Failed to delete product');
                return;
              }

              Alert.alert('Success', 'Product deleted');
              fetchProducts();
            } catch (err) {
              console.error('Error:', err);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={{ color: colors.text.muted, marginTop: 12 }}>Loading products...</Text>
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
              Products
            </Text>
          </View>
          <TouchableOpacity
            onPress={openAddModal}
            style={[
              st.headerBtn,
              {
                backgroundColor: colors.gold.faint,
              },
            ]}
          >
            <Icon name="add" size={20} color={colors.gold.primary} />
          </TouchableOpacity>
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
        {/* Search Bar */}
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

        {/* Category Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.categoryRow}
          style={{ marginTop: spacing.md }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  st.categoryPill,
                  {
                    backgroundColor: isActive
                      ? colors.gold.primary + "20"
                      : colors.background.card,
                    borderColor: isActive ? colors.gold.primary : colors.gold.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    st.categoryPillText,
                    { color: isActive ? colors.gold.primary : colors.text.muted },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Product Count */}
        <View style={st.countRow}>
          <Text style={[st.countText, { color: colors.text.muted }]}>
            {filteredProducts.length} product
            {filteredProducts.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* Product List */}
        {filteredProducts.map((product) => {
          const stockColor = getStockColor(
            product.stock_quantity,
            product.low_stock_threshold,
          );
          const stockLabel = getStockLabel(
            product.stock_quantity,
            product.low_stock_threshold,
          );
          const barWidth = getStockBarWidth(product.stock_quantity);

          return (
            <View
              key={product.id}
              style={[
                st.productCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                  ...shadows.card,
                },
              ]}
            >
              <View style={st.productRow}>
                {/* Product Image Placeholder */}
                <View
                  style={[
                    st.productImage,
                    {
                      backgroundColor: isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                    },
                  ]}
                >
                  <Icon
                    name="wine-outline"
                    size={28}
                    color={colors.gold.muted}
                  />
                </View>

                {/* Product Info */}
                <View style={st.productInfo}>
                  <Text
                    style={[st.productName, { color: colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {product.name}
                  </Text>
                  <View style={st.productMeta}>
                    <Text
                      style={[st.productCategory, { color: colors.text.muted }]}
                    >
                      {product.category}
                    </Text>
                    <View
                      style={[st.metaDot, { backgroundColor: colors.text.dim }]}
                    />
                    <Text style={[st.productSize, { color: colors.text.dim }]}>
                      {product.bottle_size}
                    </Text>
                  </View>
                  <Text style={[st.productPrice, { color: colors.gold.primary }]}>
                    R{product.price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </Text>

                  {/* Stock Bar */}
                  <View style={st.stockRow}>
                    <View
                      style={[
                        st.stockBarBg,
                        {
                          backgroundColor: isDark
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(0,0,0,0.06)",
                        },
                      ]}
                    >
                      <View
                        style={[
                          st.stockBarFill,
                          {
                            backgroundColor: stockColor,
                            width: `${barWidth}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[st.stockLabel, { color: stockColor }]}>
                      {stockLabel}
                    </Text>
                  </View>
                </View>

                {/* Edit Button */}
                <TouchableOpacity
                  onPress={() => openEditModal(product)}
                  style={[st.editBtn, { borderColor: colors.gold.border }]}
                  activeOpacity={0.7}
                >
                  <Icon
                    name="create-outline"
                    size={16}
                    color={colors.gold.primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {filteredProducts.length === 0 && (
          <View style={st.emptyState}>
            <Icon name="search-outline" size={48} color={colors.gold.muted} />
            <Text style={[st.emptyTitle, { color: colors.text.primary }]}>
              No products found
            </Text>
            <Text style={[st.emptySubtitle, { color: colors.text.muted }]}>
              Try adjusting your search or category filter
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add/Edit Product Modal */}
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
                {editingProduct ? "Edit Product" : "Add Product"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Name Input */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Product Name
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
                placeholder="e.g. Johnnie Walker Black Label"
                placeholderTextColor={colors.text.dim}
                value={formName}
                onChangeText={setFormName}
              />

              {/* Category Picker */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Category
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
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text style={{ color: colors.text.primary, fontSize: 15 }}>
                  {formCategory}
                </Text>
                <Icon
                  name={showCategoryPicker ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.text.muted}
                />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View
                  style={[
                    st.pickerList,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.gold.border,
                    },
                  ]}
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        st.pickerItem,
                        formCategory === cat && {
                          backgroundColor: colors.gold.primary + "15",
                        },
                      ]}
                      onPress={() => {
                        setFormCategory(cat);
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Text
                        style={{
                          color:
                            formCategory === cat
                              ? colors.gold.primary
                              : colors.text.primary,
                          fontSize: 15,
                          fontWeight: formCategory === cat ? "600" : "400",
                        }}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Bottle Size */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Bottle Size
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
                placeholder="e.g. 750ml"
                placeholderTextColor={colors.text.dim}
                value={formBottleSize}
                onChangeText={setFormBottleSize}
              />

              {/* Price Input */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Price (R)
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
                placeholder="0.00"
                placeholderTextColor={colors.text.dim}
                value={formPrice}
                onChangeText={setFormPrice}
                keyboardType="decimal-pad"
              />

              {/* Stock Quantity Input */}
              <Text style={[st.fieldLabel, { color: colors.text.muted }]}>
                Stock Quantity
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
                placeholder="0"
                placeholderTextColor={colors.text.dim}
                value={formStock}
                onChangeText={setFormStock}
                keyboardType="number-pad"
              />

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
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
                      <Text style={st.saveBtnText}>
                        {editingProduct ? "Update Product" : "Add Product"}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Delete Button (only when editing) */}
              {editingProduct && (
                <TouchableOpacity
                  onPress={() => {
                    setModalVisible(false);
                    handleDelete(editingProduct);
                  }}
                  style={[st.cancelBtn, { borderColor: colors.status.error + '40' }]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      color: colors.status.error,
                      fontSize: 16,
                      fontWeight: "600",
                    }}
                  >
                    Delete Product
                  </Text>
                </TouchableOpacity>
              )}

              {/* Cancel Button */}
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
    fontSize: 20,
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
  categoryRow: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  countRow: {
    paddingHorizontal: spacing.md,
    marginTop: 14,
    marginBottom: 10,
  },
  countText: {
    fontSize: 13,
    fontWeight: "600",
  },
  productCard: {
    marginHorizontal: spacing.md,
    marginBottom: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  productMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 12,
    fontWeight: "600",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  productSize: {
    fontSize: 12,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stockBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  stockBarFill: {
    height: 6,
    borderRadius: 3,
  },
  stockLabel: {
    fontSize: 11,
    fontWeight: "700",
    minWidth: 80,
    textAlign: "right",
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 14,
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
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 15,
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerList: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginTop: 6,
    overflow: "hidden",
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  saveBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  saveBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "700",
  },
  cancelBtn: {
    height: 50,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginTop: 12,
  },
});
