import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  colors,
  gradients,
  typography,
  spacing,
  borderRadius,
  shadows,
} from "../../theme";
import { Icon } from "../Icon";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type StockTier = "available" | "low" | "allocated" | "cellar_reserve";

export interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string;
  category: string;
  bottle_size?: string;
  is_featured?: boolean;
  in_stock?: boolean;
  stock_tier?: StockTier;
  stock_quantity?: number;
}

const SCARCITY_META: Record<Exclude<StockTier, "available">, { label: string; icon: string }> = {
  low: { label: "Low Stock", icon: "flame-outline" },
  allocated: { label: "Allocated Release", icon: "sparkles-outline" },
  cellar_reserve: { label: "Cellar Reserve", icon: "diamond-outline" },
};

const resolveScarcity = (p: Product): Exclude<StockTier, "available"> | null => {
  if (p.stock_tier && p.stock_tier !== "available") return p.stock_tier;
  if (typeof p.stock_quantity === "number" && p.stock_quantity > 0 && p.stock_quantity <= 5) {
    return "low";
  }
  return null;
};

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  cardWidth?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  onAddToCart,
  cardWidth,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const showFallback = !product.image_url || imageError;
  const isOutOfStock = product.in_stock === false;
  const scarcity = resolveScarcity(product);

  // Aspect ratio 3:4 — matches web card and bottle proportions
  const imgWidth = cardWidth ?? (SCREEN_WIDTH / 2 - spacing.lg * 1.5);
  const imgHeight = imgWidth * (4 / 3);

  return (
    <TouchableOpacity
      style={[styles.container, shadows.card]}
      onPress={() => onPress(product)}
      activeOpacity={0.88}
      accessible
      accessibilityLabel={`${product.name}, R${product.price}`}
      accessibilityRole="button"
    >
      {/* Image area */}
      <View style={[styles.imageWrapper, { height: imgHeight }]}>
        {showFallback ? (
          <LinearGradient
            colors={["#1a1a2e", "#16213e", "#0f3460"]}
            style={styles.imageFill}
          >
            <Icon name="wine-outline" size={36} color={colors.gold.muted} />
          </LinearGradient>
        ) : (
          <>
            {/* Subtle shimmer while loading */}
            {!imageLoaded && (
              <View style={[styles.imageFill, styles.shimmer]} />
            )}
            <Image
              source={{ uri: product.image_url }}
              style={[styles.imageFill, !imageLoaded && { opacity: 0 }]}
              resizeMode="contain"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        )}

        {/* Out of stock overlay */}
        {isOutOfStock && (
          <View style={styles.outOfStockOverlay}>
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Out of Stock</Text>
            </View>
          </View>
        )}

        {/* Featured badge */}
        {product.is_featured && !isOutOfStock && (
          <View style={styles.featuredBadge}>
            <Icon name="star" size={10} color={colors.text.inverse} />
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        )}

        {/* Scarcity badge — top-right; doesn't compete with Featured */}
        {scarcity && !isOutOfStock && (
          <View
            style={[
              styles.scarcityBadge,
              scarcity === "cellar_reserve" && styles.scarcityCellar,
              scarcity === "allocated" && styles.scarcityAllocated,
              scarcity === "low" && styles.scarcityLow,
            ]}
          >
            <Icon
              name={SCARCITY_META[scarcity].icon as any}
              size={10}
              color={scarcity === "low" ? "#2b1a05" : colors.gold.primary}
            />
            <Text
              style={[
                styles.scarcityText,
                { color: scarcity === "low" ? "#2b1a05" : colors.gold.primary },
              ]}
              numberOfLines={1}
            >
              {SCARCITY_META[scarcity].label}
            </Text>
          </View>
        )}
      </View>

      {/* Details */}
      <View style={styles.details}>
        <Text style={styles.category} numberOfLines={1}>
          {product.category}
          {product.bottle_size ? ` · ${product.bottle_size}` : ""}
        </Text>

        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.price}>
            R{product.price.toLocaleString("en-ZA", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Text>

          {onAddToCart && !isOutOfStock && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={(e) => {
                onAddToCart(product);
              }}
              activeOpacity={0.75}
              accessible
              accessibilityLabel={`Add ${product.name} to cart`}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={[...gradients.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addButtonGradient}
              >
                <Icon name="add" size={18} color={colors.text.inverse} />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.gold.border,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },

  // Image
  imageWrapper: {
    width: "100%",
    backgroundColor: "#0d0b08",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  imageFill: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  shimmer: {
    backgroundColor: "#1c1810",
  },

  // Badges
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,4,3,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  outOfStockBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  outOfStockText: {
    ...typography.caption,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  featuredBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.gold.primary,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  featuredText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.text.inverse,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  scarcityBadge: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(5,4,3,0.72)",
    borderColor: colors.gold.primary,
    maxWidth: "70%",
  },
  scarcityLow: {
    backgroundColor: colors.gold.primary,
    borderColor: colors.gold.primary,
  },
  scarcityAllocated: {
    backgroundColor: "rgba(5,4,3,0.82)",
  },
  scarcityCellar: {
    backgroundColor: "rgba(5,4,3,0.92)",
    borderColor: colors.gold.light,
  },
  scarcityText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  // Details
  details: {
    padding: spacing.sm + 2,
    gap: 3,
  },
  category: {
    ...typography.caption,
    color: colors.gold.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  name: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.text.primary,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  price: {
    ...typography.h4,
    color: colors.gold.primary,
  },

  // Add button — 40×40 touch target, gradient, rounded
  addButton: {
    borderRadius: borderRadius.md,
    overflow: "hidden",
  },
  addButtonGradient: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ProductCard;
