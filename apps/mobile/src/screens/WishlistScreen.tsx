import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { spacing, borderRadius, typography } from "../theme";
import { Icon } from "../components/Icon";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useTheme } from "../contexts/ThemeContext";
import { wishlistApi } from "../services/api";
import { useNavigation } from "@react-navigation/native";
import { Product } from "../types";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - spacing.md * 3) / 2;

interface WishlistItem {
  id: string;
  product_id: string;
  created_at: string;
  products: Product;
}

export default function WishlistScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { colors, gradients, shadows, isDark } = useTheme();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWishlist = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const data = await wishlistApi.getWishlist(user.id);
      const transformed: WishlistItem[] = (data || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        created_at: item.created_at,
        products: item.products as Product,
      }));
      setWishlistItems(transformed);
    } catch (error) {
      console.error("Error loading wishlist:", error);
      setWishlistItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const onRefresh = () => {
    setRefreshing(true);
    loadWishlist();
  };

  const removeFromWishlist = (item: WishlistItem) => {
    if (!user?.id) return;

    Alert.alert(
      "Remove from Wishlist",
      `Remove "${item.products.name}" from your wishlist?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await wishlistApi.removeFromWishlist(user.id, item.product_id);
              setWishlistItems((prev) => prev.filter((w) => w.id !== item.id));
            } catch (error) {
              console.error("Error removing from wishlist:", error);
              Alert.alert("Error", "Failed to remove item from wishlist.");
            }
          },
        },
      ],
    );
  };

  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      category: product.category,
      bottle_size: product.bottle_size,
    });
    Alert.alert(
      "Added to Cart",
      `${product.name} has been added to your cart.`,
    );
  };

  const renderWishlistItem = ({ item }: { item: WishlistItem }) => {
    const product = item.products;
    if (!product) return null;

    return (
      <View style={[styles.productCard, { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border }]}>
        <TouchableOpacity
          style={[styles.cardImageArea, { backgroundColor: colors.background.elevated }]}
          onPress={() =>
            navigation.navigate("ProductDetail", { productId: product.id })
          }
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: product.image_url }}
            style={styles.productImage}
            resizeMode="contain"
          />
          {/* Remove button overlay */}
          <TouchableOpacity
            style={styles.removeOverlay}
            onPress={() => removeFromWishlist(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name="heart-dislike-outline"
              size={18}
              color={colors.status.error}
            />
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={styles.cardInfo}>
          <Text style={[styles.productCategory, { color: colors.gold.primary }]}>{product.category}</Text>
          <Text style={[styles.productName, { color: colors.text.primary }]} numberOfLines={2}>
            {product.name}
          </Text>
          {product.bottle_size && (
            <Text style={[styles.productSize, { color: colors.text.muted }]}>{product.bottle_size}</Text>
          )}
          <Text style={[styles.productPrice, { color: colors.gold.light }]}>R{product.price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</Text>

          {product.in_stock ? (
            <TouchableOpacity
              style={styles.addToCartButton}
              onPress={() => handleAddToCart(product)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[...gradients.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addToCartGradient}
              >
                <Icon
                  name="cart-outline"
                  size={16}
                  color={colors.text.inverse}
                />
                <Text style={[styles.addToCartText, { color: colors.text.inverse }]}>Add to Cart</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={styles.outOfStockBadge}>
              <Text style={[styles.outOfStockText, { color: colors.status.error }]}>Out of Stock</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={[styles.loadingText, { color: colors.text.muted }]}>Loading wishlist...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <FlatList
        data={wishlistItems}
        renderItem={renderWishlistItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold.primary}
          />
        }
        ListHeaderComponent={
          wishlistItems.length > 0 ? (
            <Text style={[styles.itemCount, { color: colors.text.muted }]}>
              {wishlistItems.length} item{wishlistItems.length !== 1 ? "s" : ""}{" "}
              saved
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrapper, { backgroundColor: colors.gold.faint }]}>
              <Icon name="heart-outline" size={48} color={colors.gold.dark} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No items in wishlist</Text>
            <Text style={[styles.emptyText, { color: colors.text.muted }]}>
              Save products you love by tapping the heart icon while browsing
            </Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("MainTabs", { screen: "Catalog" })
              }
            >
              <LinearGradient
                colors={[...gradients.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.browseButton}
              >
                <Icon
                  name="grid-outline"
                  size={20}
                  color={colors.text.inverse}
                />
                <Text style={[styles.browseButtonText, { color: colors.text.inverse }]}>Browse Products</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.bodySmall,
    marginTop: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
    flexGrow: 1,
  },
  gridRow: {
    justifyContent: "space-between",
  },
  itemCount: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  productCard: {
    width: CARD_WIDTH,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardImageArea: {
    width: "100%",
    height: CARD_WIDTH,
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  removeOverlay: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(5,4,3,0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  cardInfo: {
    padding: spacing.sm,
  },
  productCategory: {
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  productName: {
    ...typography.bodySmall,
    fontWeight: "600",
    marginBottom: 2,
    height: 36,
  },
  productSize: {
    ...typography.caption,
    marginBottom: 4,
  },
  productPrice: {
    ...typography.body,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  addToCartButton: {
    borderRadius: borderRadius.sm,
    overflow: "hidden",
  },
  addToCartGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  addToCartText: {
    ...typography.caption,
    fontWeight: "700",
  },
  outOfStockBadge: {
    backgroundColor: "rgba(239,68,68,0.15)",
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    alignItems: "center",
  },
  outOfStockText: {
    ...typography.caption,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrapper: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    textAlign: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  browseButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  browseButtonText: {
    ...typography.button,
  },
});
