import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Dimensions,
  StatusBar,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../components/Icon";
import BrandMark from "../components/BrandMark";
import { useCart } from "../contexts/CartContext";
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";
import { productsApi } from "../services/api";
import { spacing, borderRadius, typography } from "../theme";
import { Product } from "../types";

const { width } = Dimensions.get("window");
const COLUMN_GAP = 12;
const HORIZONTAL_PADDING = 16;
const CARD_WIDTH = (width - HORIZONTAL_PADDING * 2 - COLUMN_GAP) / 2;

const CATEGORIES = [
  "All",
  "Whisky",
  "Vodka",
  "Gin",
  "Wine",
  "Beer",
  "Champagne",
  "Cognac",
  "Rum",
  "Tequila",
  "Liqueurs",
];

const CATEGORY_ICONS: Record<string, string> = {
  All: "grid-outline",
  Whisky: "wine-outline",
  Vodka: "water-outline",
  Gin: "flask-outline",
  Wine: "wine-outline",
  Beer: "beer-outline",
  Champagne: "sparkles-outline",
  Cognac: "cafe-outline",
  Rum: "boat-outline",
  Tequila: "flame-outline",
  Liqueurs: "color-palette-outline",
};

const SORT_OPTIONS: { label: string; value: 'name' | 'price_asc' | 'price_desc' | 'newest' }[] = [
  { label: 'Name A-Z', value: 'name' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Newest First', value: 'newest' },
];

export default function CatalogScreen() {
  const navigation = useNavigation<any>();
  const { addItem } = useCart();
  const { colors, gradients, shadows, isDark } = useTheme();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price_asc' | 'price_desc' | 'newest'>('name');

  useEffect(() => {
    loadProducts();
  }, [selectedCategory, searchQuery, sortBy]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params: { category?: string; search?: string } = {};
      if (selectedCategory !== "All") {
        params.category = selectedCategory;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      // Use Supabase query with sorting
      let query = supabase.from('products').select('*');
      if (params.category) query = query.eq('category', params.category);
      if (params.search) query = query.ilike('name', `%${params.search}%`);
      if (sortBy === 'price_asc') query = query.order('price', { ascending: true });
      else if (sortBy === 'price_desc') query = query.order('price', { ascending: false });
      else if (sortBy === 'newest') query = query.order('created_at', { ascending: false });
      else query = query.order('name', { ascending: true });

      const { data, error } = await query;
      if (error) {
        // Fallback to API if direct query fails
        const apiData = await productsApi.getProducts(params);
        setProducts(apiData || []);
      } else {
        setProducts(data || []);
      }
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProducts();
  }, [selectedCategory, searchQuery, sortBy]);

  const handleFilter = () => {
    setShowFilters(!showFilters);
  };

  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      category: product.category,
    });
  };

  const renderCategoryChip = ({ item }: { item: string }) => {
    const isActive = selectedCategory === item;
    const iconName = CATEGORY_ICONS[item] || "ellipse-outline";
    return (
      <TouchableOpacity
        style={[
          styles.categoryChip,
          { borderColor: colors.gold.border, backgroundColor: colors.background.tertiary },
          isActive && [styles.categoryChipActive, { borderColor: colors.gold.primary }],
        ]}
        onPress={() => setSelectedCategory(item)}
        activeOpacity={0.7}
      >
        {isActive ? (
          <LinearGradient
            colors={gradients.gold as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.categoryChipGradient}
          >
            <Icon name={iconName} size={14} color={colors.text.inverse} style={{ marginRight: 5 }} />
            <Text style={[styles.categoryChipTextActive, { color: colors.text.inverse }]}>{item}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.categoryChipInner}>
            <Icon name={iconName} size={14} color={colors.text.muted} style={{ marginRight: 5 }} />
            <Text style={[styles.categoryChipText, { color: colors.text.muted }]}>{item}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={[styles.productCard, { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border }, shadows.card]}
      activeOpacity={0.85}
      onPress={() =>
        navigation.navigate("ProductDetail", { productId: item.id })
      }
    >
      <View style={[styles.productImageContainer, { backgroundColor: colors.background.elevated }]}>
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.productImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Icon name="wine-outline" size={44} color={colors.gold.muted} />
          </View>
        )}
        {/* Subtle gradient overlay at bottom of image */}
        <LinearGradient
          colors={["transparent", isDark ? "rgba(26,21,16,0.6)" : "rgba(237,234,228,0.6)"]}
          style={styles.imageGradientOverlay}
        />
      </View>
      <View style={styles.productInfo}>
        <Text style={[styles.productName, { color: colors.text.primary }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.productCategoryText, { color: colors.text.muted }]} numberOfLines={1}>
          {item.category}
        </Text>
        <View style={styles.productBottom}>
          <Text style={[styles.productPrice, { color: colors.gold.primary }]}>R{item.price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>
          <TouchableOpacity
            style={[styles.addToCartButton, { backgroundColor: colors.gold.primary }, shadows.goldSubtle]}
            onPress={() => handleAddToCart(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="add" size={18} color={colors.text.inverse} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      {/* Premium gold ring decoration */}
      <View style={[styles.emptyIconRingOuter, { borderColor: colors.gold.faint }]}>
        <View style={[styles.emptyIconWrapper, { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border }]}>
          <Icon name="wine-outline" size={48} color={colors.gold.primary} />
        </View>
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Nothing here yet</Text>
      <Text style={[styles.emptySubtext, { color: colors.text.dim }]}>
        We couldn't find products matching your criteria.{"\n"}Try a different search or category.
      </Text>
      <TouchableOpacity
        style={styles.emptyCTAButton}
        activeOpacity={0.8}
        onPress={() => {
          setSearchQuery("");
          setSelectedCategory("All");
        }}
      >
        <LinearGradient
          colors={gradients.gold as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyCTAGradient}
        >
          <Icon name="refresh-outline" size={16} color={colors.text.inverse} />
          <Text style={[styles.emptyCTAText, { color: colors.text.inverse }]}>Browse All Products</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderListHeader = () => (
    <View>
      {/* Header with LinearGradient background */}
      <LinearGradient
        colors={isDark ? ["#1a1815", "#0f0d09"] : ["#FFFFFF", "#FAFAF8"]}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View>
            <BrandMark size="xs" />
            <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Catalogue</Text>
          </View>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handleFilter}
          >
            <Icon name="options-outline" size={22} color={colors.gold.primary} />
          </TouchableOpacity>
        </View>
        {/* Subtle gold bottom border */}
        <View style={[styles.headerBorderBottom, { backgroundColor: colors.gold.border }]} />
      </LinearGradient>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border },
            searchFocused && { borderColor: colors.gold.primary, borderWidth: 1.5 },
          ]}
        >
          <Icon name="search-outline" size={20} color={searchFocused ? colors.gold.primary : colors.gold.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder="Search products..."
            placeholderTextColor={colors.text.dim}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ marginRight: 6 }}>
              <Icon name="close-circle" size={18} color={colors.gold.muted} />
            </TouchableOpacity>
          )}
          {/* Barcode scan button */}
          <TouchableOpacity
            style={[styles.barcodeScanButton, { backgroundColor: colors.gold.faint, borderColor: colors.gold.border }]}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Icon name="barcode-outline" size={18} color={colors.gold.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Sort Indicator */}
      {sortBy !== 'name' && (
        <View style={{ paddingHorizontal: HORIZONTAL_PADDING, marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="funnel-outline" size={14} color={colors.gold.primary} />
            <Text style={{ fontSize: 12, color: colors.gold.primary, fontWeight: '600' }}>
              Sorted: {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
            </Text>
            <TouchableOpacity onPress={() => setSortBy('name')}>
              <Icon name="close-circle" size={16} color={colors.text.dim} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Category Chips */}
      <FlatList
        data={CATEGORIES}
        renderItem={renderCategoryChip}
        keyExtractor={(item) => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContent}
        style={styles.categoriesContainer}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background.primary}
      />

      {loading && !refreshing ? (
        <View style={styles.fullContainer}>
          {renderListHeader()}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.gold.primary} />
            <Text style={[styles.loadingText, { color: colors.text.muted }]}>Loading catalogue...</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.productListContent}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold.primary}
              colors={[colors.gold.primary]}
              progressBackgroundColor={colors.background.tertiary}
            />
          }
        />
      )}

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showFilters}
        onRequestClose={() => setShowFilters(false)}
      >
        <TouchableOpacity
          style={[styles.filterOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setShowFilters(false)}
        >
          <View
            style={[styles.filterContent, { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border }]}
            onStartShouldSetResponder={() => true}
          >
            {/* Filter Header */}
            <View style={[styles.filterHeader, { borderBottomColor: colors.gold.border }]}>
              <Text style={[styles.filterTitle, { color: colors.text.primary }]}>Sort & Filter</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Icon name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Sort Options */}
            <View style={{ padding: spacing.lg }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Sort By
              </Text>
              {SORT_OPTIONS.map((option) => {
                const isActive = sortBy === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.sortOption,
                      {
                        backgroundColor: isActive ? colors.gold.faint : 'transparent',
                        borderColor: isActive ? colors.gold.primary : colors.gold.border,
                      },
                    ]}
                    onPress={() => setSortBy(option.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 15, fontWeight: isActive ? '700' : '500', color: isActive ? colors.gold.primary : colors.text.primary }}>
                      {option.label}
                    </Text>
                    {isActive && <Icon name="checkmark" size={20} color={colors.gold.primary} />}
                  </TouchableOpacity>
                );
              })}

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <TouchableOpacity
                  style={[styles.filterActionBtn, { borderColor: colors.gold.border, borderWidth: 1, flex: 1 }]}
                  onPress={() => {
                    setSortBy('name');
                    setShowFilters(false);
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => setShowFilters(false)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={gradients.gold as unknown as string[]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.filterActionBtn}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.inverse }}>Apply</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullContainer: {
    flex: 1,
  },

  // Header
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    letterSpacing: -0.5,
  },
  headerBorderBottom: {
    height: 1,
    width: "100%",
    opacity: 0.5,
  },
  filterButton: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },

  // Search
  searchWrapper: {
    paddingHorizontal: HORIZONTAL_PADDING,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 52,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
  },
  barcodeScanButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },

  // Categories
  categoriesContainer: {
    marginBottom: spacing.md,
  },
  categoriesContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: 10,
  },
  categoryChip: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  categoryChipActive: {
    borderWidth: 0,
  },
  categoryChipGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  categoryChipInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Product List
  productListContent: {
    paddingBottom: spacing.xxl,
  },
  columnWrapper: {
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: COLUMN_GAP,
    marginBottom: COLUMN_GAP,
  },

  // Product Card
  productCard: {
    width: CARD_WIDTH,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  productImageContainer: {
    width: "100%",
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  productImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
  imageGradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  productInfo: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
    height: 36,
    lineHeight: 18,
  },
  productCategoryText: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  productBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "800",
  },
  addToCartButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.bodySmall,
    marginTop: spacing.md,
  },

  // Empty
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingBottom: spacing.xxl,
  },
  emptyIconRingOuter: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    marginBottom: spacing.md,
  },
  emptyIconWrapper: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.bodySmall,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  emptyCTAButton: {
    borderRadius: borderRadius.md,
    overflow: "hidden",
  },
  emptyCTAGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    gap: 8,
  },
  emptyCTAText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Filter Modal
  filterOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  filterContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
  },
  filterActionBtn: {
    height: 48,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
});
