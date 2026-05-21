import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Animated,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { spacing, borderRadius, typography } from "../theme";
import { Icon } from "../components/Icon";
import BrandMark from "../components/BrandMark";
import { useCart } from "../contexts/CartContext";
import { useTheme } from "../contexts/ThemeContext";
import { productsApi } from "../services/api";
import { Product, StockTier } from "../types";
import { useBackInStock } from "../hooks/useBackInStock";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_WIDTH * 1.15;
const CARD_OVERLAP = 28;

type ScarcityTier = Exclude<StockTier, "available">;

const SCARCITY_META: Record<
  ScarcityTier,
  { label: string; icon: string }
> = {
  low: { label: "Low Stock", icon: "flame" },
  allocated: { label: "Allocated Release", icon: "sparkles" },
  cellar_reserve: { label: "Cellar Reserve", icon: "diamond" },
};

const resolveScarcity = (p: Product): ScarcityTier | null => {
  if (p.stock_tier && p.stock_tier !== "available") return p.stock_tier;
  if (
    typeof p.stock_quantity === "number" &&
    p.stock_quantity > 0 &&
    p.stock_quantity <= 5
  ) {
    return "low";
  }
  return null;
};

type EditorialCopy = { notes: string; pairing: string; serving: string };
function getEditorialForCategory(cat: string): EditorialCopy | null {
  if (!cat) return null;
  const c = cat.toLowerCase();
  if (c.includes("whisky") || c.includes("whiskey") || c.includes("bourbon") || c.includes("scotch"))
    return {
      notes: "Oak, honey, and a whisper of vanilla over a warm, peppery finish.",
      pairing: "Smoked meats, aged cheddar, dark chocolate.",
      serving: "Neat or over a single large ice sphere.",
    };
  if (c.includes("rum"))
    return {
      notes: "Burnt caramel, ripe banana, and tropical spice.",
      pairing: "Citrus desserts, grilled pineapple, short ribs.",
      serving: "Over ice with a twist of orange.",
    };
  if (c.includes("vodka"))
    return {
      notes: "Crisp, clean grain with a subtle mineral backbone.",
      pairing: "Caviar, oysters, smoked fish.",
      serving: "Ice-cold from the freezer, neat.",
    };
  if (c.includes("gin"))
    return {
      notes: "Juniper-forward with citrus peel and bright botanicals.",
      pairing: "Smoked salmon, cucumber, fresh herbs.",
      serving: "Indian tonic, pink grapefruit, rosemary.",
    };
  if (c.includes("tequila") || c.includes("mezcal"))
    return {
      notes: "Roasted agave, cracked pepper, and lime zest.",
      pairing: "Grilled fish, ceviche, chilli chocolate.",
      serving: "Neat after dinner, or in a precise margarita.",
    };
  if (c.includes("cognac") || c.includes("brandy"))
    return {
      notes: "Dried fruit, honeyed walnut, and warm baking spice.",
      pairing: "Dark chocolate, aged cheese, poached pear.",
      serving: "Warmed in a tulip glass, after dinner.",
    };
  if (c.includes("champagne") || c.includes("sparkling"))
    return {
      notes: "Brioche, orchard fruit, and a crisp mineral finish.",
      pairing: "Oysters, caviar, anything celebratory.",
      serving: "Chilled to 8\u201310\u00b0C, in a flute or tulip.",
    };
  if (c.includes("red") && c.includes("wine"))
    return {
      notes: "Dark berries, supple tannin, and a long oak finish.",
      pairing: "Beef, lamb, aged hard cheeses.",
      serving: "Decant 30 minutes. Serve at 16\u201318\u00b0C.",
    };
  if (c.includes("white") && c.includes("wine"))
    return {
      notes: "Citrus, stone fruit, and a saline, mineral lift.",
      pairing: "Seafood, poultry, soft cheeses.",
      serving: "Chilled to 10\u201312\u00b0C.",
    };
  if (c.includes("wine"))
    return {
      notes: "Layered fruit with a clean, balanced finish.",
      pairing: "Charcuterie, roasted vegetables, artisanal cheese.",
      serving: "Serve at 14\u201316\u00b0C.",
    };
  if (c.includes("beer") || c.includes("lager") || c.includes("ale"))
    return {
      notes: "Fresh malt, gentle hops, and a clean bitter finish.",
      pairing: "Burgers, wings, sharp cheese.",
      serving: "Frosted glass, 4\u20136\u00b0C.",
    };
  if (c.includes("liqueur") || c.includes("amaretto") || c.includes("kahlua"))
    return {
      notes: "Layered sweetness, herbs, and a lingering finish.",
      pairing: "Espresso, tiramisu, vanilla ice cream.",
      serving: "Over ice, in cocktails, or drizzled over dessert.",
    };
  return null;
}

export default function ProductDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { productId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, gradients, shadows, isDark } = useTheme();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const {
    subscribed: notifySubscribed,
    subscribe: subscribeNotify,
    unsubscribe: unsubscribeNotify,
  } = useBackInStock(product?.id);
  const { addItem } = useCart();

  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      const data = await productsApi.getProductById(productId);
      setProduct(data);
    } catch (error) {
      console.error("Error loading product:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handleAddToCart = () => {
    if (!product) return;

    setAddingToCart(true);

    addItem(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        category: product.category,
        bottle_size: product.bottle_size,
      },
      quantity,
    );

    setTimeout(() => {
      setAddingToCart(false);
      Alert.alert(
        "Added to Cart",
        `${quantity} x ${product.name} added to your cart`,
        [
          { text: "Continue Shopping", style: "cancel" },
          {
            text: "Go to Checkout",
            onPress: () => navigation.navigate("MainTabs", { screen: "Cart" }),
          },
        ],
      );
    }, 400);
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Icon key={i} name="star" size={18} color={colors.gold.primary} />,
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Icon
            key={i}
            name="star-half"
            size={18}
            color={colors.gold.primary}
          />,
        );
      } else {
        stars.push(
          <Icon
            key={i}
            name="star-outline"
            size={18}
            color={colors.gold.border}
          />,
        );
      }
    }
    return stars;
  };

  // Loading State
  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background.primary },
        ]}
      >
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={[styles.loadingText, { color: colors.gold.muted }]}>
          Loading product...
        </Text>
      </View>
    );
  }

  // Not Found State
  if (!product) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background.primary },
        ]}
      >
        <Icon name="alert-circle-outline" size={64} color={colors.gold.muted} />
        <Text style={[styles.notFoundTitle, { color: colors.text.primary }]}>
          Product Not Found
        </Text>
        <Text style={[styles.notFoundText, { color: colors.gold.muted }]}>
          This product may no longer be available.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.goBackButton, { borderColor: colors.gold.border }]}
        >
          <Text style={[styles.goBackText, { color: colors.gold.primary }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background.primary }]}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero Image */}
        <View
          style={[
            styles.imageContainer,
            { backgroundColor: colors.background.secondary },
          ]}
        >
          <Image
            source={{ uri: product.image_url }}
            style={styles.productImage}
            resizeMode="cover"
          />
          {/* Gradient overlay fading to background at bottom */}
          <LinearGradient
            colors={[
              "transparent",
              "rgba(0,0,0,0.1)",
              colors.background.primary,
            ]}
            locations={[0.35, 0.65, 1]}
            style={styles.imageOverlay}
          />

          {/* Back Button - Floating circle with blur */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { top: insets.top + spacing.sm }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BlurView
              intensity={60}
              tint={isDark ? "dark" : "light"}
              style={[
                styles.backButtonBlur,
                { borderColor: colors.gold.border },
              ]}
            >
              <Icon name="arrow-back" size={22} color={colors.text.primary} />
            </BlurView>
          </TouchableOpacity>

          {/* Premium Badge */}
          {product.is_featured && (
            <View style={[styles.premiumBadgeContainer, { top: insets.top + spacing.sm }]}>
              <LinearGradient
                colors={[...gradients.goldShimmer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.premiumBadge}
              >
                <Icon name="diamond" size={12} color={colors.text.inverse} />
                <Text
                  style={[
                    styles.premiumBadgeText,
                    { color: colors.text.inverse },
                  ]}
                >
                  Premium
                </Text>
              </LinearGradient>
            </View>
          )}

          {/* AR Preview — iOS Quick Look (USDZ) / Android Scene Viewer (GLB) */}
          {(() => {
            const usdz = (product as any).ar_model_url_ios as string | undefined;
            const glb = (product as any).ar_model_url_android as string | undefined;
            const arUrl =
              Platform.OS === "ios"
                ? usdz
                : Platform.OS === "android" && glb
                ? `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(
                    glb,
                  )}&mode=ar_preferred#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;end;`
                : undefined;
            if (!arUrl) return null;
            return (
              <TouchableOpacity
                onPress={() => Linking.openURL(arUrl).catch(() => {})}
                activeOpacity={0.85}
                style={styles.arButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <BlurView
                  intensity={60}
                  tint={isDark ? "dark" : "light"}
                  style={[
                    styles.arButtonBlur,
                    { borderColor: colors.gold.border },
                  ]}
                >
                  <Icon name="cube-outline" size={16} color={colors.gold.primary} />
                  <Text style={[styles.arButtonText, { color: colors.gold.primary }]}>
                    View in AR
                  </Text>
                </BlurView>
              </TouchableOpacity>
            );
          })()}

          {/* Scarcity Badge */}
          {(() => {
            const scarcity = resolveScarcity(product);
            if (!scarcity) return null;
            const Meta = SCARCITY_META[scarcity];
            const stackedTop =
              insets.top + spacing.sm + (product.is_featured ? 38 : 0);
            const solid = scarcity === "low";
            return (
              <View
                style={[
                  styles.scarcityBadgeContainer,
                  { top: stackedTop },
                ]}
              >
                <View
                  style={[
                    styles.scarcityBadge,
                    {
                      backgroundColor: solid
                        ? colors.gold.primary
                        : colors.background.primary + "E6",
                      borderColor: colors.gold.primary,
                    },
                  ]}
                >
                  <Icon
                    name={Meta.icon as any}
                    size={12}
                    color={solid ? colors.text.inverse : colors.gold.primary}
                  />
                  <Text
                    style={[
                      styles.scarcityBadgeText,
                      {
                        color: solid
                          ? colors.text.inverse
                          : colors.gold.primary,
                      },
                    ]}
                  >
                    {Meta.label}
                  </Text>
                </View>
              </View>
            );
          })()}
        </View>

        {/* Product Info Card - Overlapping image with elevated feel */}
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.background.primary },
            shadows.card,
          ]}
        >
          {/* Category gold pill badge */}
          <View
            style={[
              styles.categoryBadge,
              {
                backgroundColor: colors.gold.faint,
                borderColor: colors.gold.border,
              },
            ]}
          >
            <Text
              style={[styles.categoryText, { color: colors.gold.primary }]}
            >
              {product.category}
            </Text>
          </View>

          {/* Product Name - 26px bold */}
          <BrandMark size="xs" />
          <Text style={[styles.productName, { color: colors.text.primary }]}>
            {product.name}
          </Text>

          {/* Rating Section - Star display with gold filled stars */}
          {product.rating ? (
            <View style={styles.ratingSection}>
              <View style={styles.starsRow}>{renderStars(product.rating)}</View>
              <Text
                style={[styles.ratingScore, { color: colors.gold.primary }]}
              >
                {product.rating.toFixed(1)}
              </Text>
              <Text style={[styles.reviewCount, { color: colors.text.dim }]}>
                ({product.review_count || 0} reviews)
              </Text>
            </View>
          ) : null}

          {/* Price - 28px fontWeight 800 gold */}
          <Text style={[styles.price, { color: colors.gold.primary }]}>
            R{product.price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </Text>

          {/* Description Card */}
          {product.description ? (
            <View
              style={[
                styles.descriptionCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                },
              ]}
            >
              <Text
                style={[styles.sectionTitle, { color: colors.text.primary }]}
              >
                About this product
              </Text>
              <Text
                style={[styles.description, { color: colors.text.muted }]}
              >
                {product.description}
              </Text>
            </View>
          ) : null}

          {/* Details Grid */}
          {(product.bottle_size || product.alcohol_pct || product.country) && (
            <View
              style={[
                styles.detailsCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                },
              ]}
            >
              {product.bottle_size ? (
                <View style={styles.detailItem}>
                  <View
                    style={[
                      styles.detailIconWrap,
                      { backgroundColor: colors.gold.faint },
                    ]}
                  >
                    <Icon
                      name="flask-outline"
                      size={22}
                      color={colors.gold.primary}
                    />
                  </View>
                  <Text
                    style={[styles.detailLabel, { color: colors.text.dim }]}
                  >
                    Size
                  </Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: colors.text.primary },
                    ]}
                  >
                    {product.bottle_size}
                  </Text>
                </View>
              ) : null}

              {product.country ? (
                <View style={styles.detailItem}>
                  <View
                    style={[
                      styles.detailIconWrap,
                      { backgroundColor: colors.gold.faint },
                    ]}
                  >
                    <Icon
                      name="location-outline"
                      size={22}
                      color={colors.gold.primary}
                    />
                  </View>
                  <Text
                    style={[styles.detailLabel, { color: colors.text.dim }]}
                  >
                    Origin
                  </Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: colors.text.primary },
                    ]}
                  >
                    {product.country}
                  </Text>
                </View>
              ) : null}

              {product.alcohol_pct ? (
                <View style={styles.detailItem}>
                  <View
                    style={[
                      styles.detailIconWrap,
                      { backgroundColor: colors.gold.faint },
                    ]}
                  >
                    <Icon
                      name="water-outline"
                      size={22}
                      color={colors.gold.primary}
                    />
                  </View>
                  <Text
                    style={[styles.detailLabel, { color: colors.text.dim }]}
                  >
                    ABV
                  </Text>
                  <Text
                    style={[
                      styles.detailValue,
                      { color: colors.text.primary },
                    ]}
                  >
                    {product.alcohol_pct}%
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ── Editorial: Tasting Notes & Pairing ─────────── */}
          {(() => {
            const cat = (product.category || "").toLowerCase();
            const ed = getEditorialForCategory(cat);
            if (!ed) return null;
            return (
              <View
                style={[
                  styles.descriptionCard,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                    marginTop: 12,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <Icon name="wine-outline" size={16} color={colors.gold.primary} />
                  <Text
                    style={[styles.sectionTitle, { color: colors.text.primary, marginBottom: 0 }]}
                  >
                    The Tasting
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        color: colors.text.dim,
                        marginBottom: 4,
                      }}
                    >
                      Notes
                    </Text>
                    <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text.primary, fontStyle: "italic" }}>
                      {ed.notes}
                    </Text>
                  </View>
                  <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.gold.border }} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        color: colors.text.dim,
                        marginBottom: 4,
                      }}
                    >
                      Pair With
                    </Text>
                    <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text.primary, fontStyle: "italic" }}>
                      {ed.pairing}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: colors.gold.border,
                    marginBottom: 10,
                  }}
                />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    color: colors.text.dim,
                    marginBottom: 4,
                  }}
                >
                  Serving
                </Text>
                <Text style={{ fontSize: 13, lineHeight: 20, color: colors.text.primary }}>
                  {ed.serving}
                </Text>
              </View>
            );
          })()}

          {/* Stock Status */}
          <View style={styles.stockRow}>
            <Icon
              name={product.in_stock ? "checkmark-circle" : "close-circle"}
              size={20}
              color={
                product.in_stock ? colors.status.success : colors.status.error
              }
            />
            <Text
              style={[
                styles.stockText,
                { color: colors.status.success },
                !product.in_stock && { color: colors.status.error },
              ]}
            >
              {product.in_stock ? "In Stock" : "Out of Stock"}
            </Text>
          </View>

          {/* Spacer for bottom bar */}
          <View style={{ height: 140 }} />
        </View>
      </ScrollView>

      {/* Out-of-stock bottom bar — Notify Me */}
      {!product.in_stock && (
        <View style={styles.bottomBar}>
          <LinearGradient
            colors={[
              "rgba(5,4,3,0)",
              "rgba(5,4,3,0.95)",
              colors.background.primary,
            ]}
            style={styles.bottomBarGradient}
          >
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={async () => {
                  if (notifySubscribed) {
                    await unsubscribeNotify();
                    Alert.alert("Notification cancelled");
                  } else {
                    await subscribeNotify();
                    Alert.alert(
                      "You're on the list",
                      "We'll send a push the moment this returns.",
                    );
                  }
                }}
                style={{
                  height: 56,
                  borderRadius: 28,
                  overflow: "hidden",
                }}
              >
                <LinearGradient
                  colors={
                    notifySubscribed
                      ? [colors.background.card, colors.background.card]
                      : [...gradients.gold]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    borderWidth: notifySubscribed ? 1 : 0,
                    borderColor: colors.border,
                  }}
                >
                  <Icon
                    name={notifySubscribed ? "notifications-off" : "notifications"}
                    size={20}
                    color={
                      notifySubscribed
                        ? colors.text.primary
                        : colors.text.inverse
                    }
                  />
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "800",
                      color: notifySubscribed
                        ? colors.text.primary
                        : colors.text.inverse,
                    }}
                  >
                    {notifySubscribed
                      ? "You'll be notified — tap to cancel"
                      : "Notify Me When Available"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Bottom Bar */}
      {product.in_stock && (
        <View style={styles.bottomBar}>
          <LinearGradient
            colors={[
              "rgba(5,4,3,0)",
              "rgba(5,4,3,0.95)",
              colors.background.primary,
            ]}
            style={styles.bottomBarGradient}
          >
            {/* Premium summary row — Total + hairline */}
            <View style={styles.summaryRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.text.dim },
                  ]}
                >
                  {quantity > 1 ? `${quantity} bottles · Total` : "Your Total"}
                </Text>
                <Text
                  style={[styles.summaryPrice, { color: colors.gold.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  R
                  {(product.price * quantity).toLocaleString("en-ZA", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
              <View
                style={[
                  styles.summaryHairline,
                  { backgroundColor: colors.gold.border },
                ]}
              />
            </View>

            <View style={styles.bottomBarContent}>
              {/* Quantity Stepper — refined pill, 52pt height */}
              <View
                style={[
                  styles.quantityContainer,
                  {
                    backgroundColor: colors.background.card,
                    borderColor: colors.gold.border,
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => setQuantity(Math.max(1, quantity - 1))}
                  style={styles.quantityButton}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Icon
                    name="remove"
                    size={18}
                    color={
                      quantity <= 1 ? colors.text.dim : colors.gold.primary
                    }
                  />
                </TouchableOpacity>
                <Text
                  style={[styles.quantityText, { color: colors.text.primary }]}
                >
                  {quantity}
                </Text>
                <TouchableOpacity
                  onPress={() => setQuantity(quantity + 1)}
                  style={styles.quantityButton}
                  activeOpacity={0.6}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Icon name="add" size={18} color={colors.gold.primary} />
                </TouchableOpacity>
              </View>

              {/* Add to Cart — single clean line, price lives in summary row above */}
              <Animated.View
                style={[
                  styles.addToCartWrapper,
                  shadows.gold,
                  { transform: [{ scale: scaleAnim }] },
                  addingToCart && { opacity: 0.75 },
                ]}
              >
                <TouchableOpacity
                  onPress={handleAddToCart}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={addingToCart}
                  activeOpacity={1}
                  style={styles.addToCartTouchable}
                >
                  <LinearGradient
                    colors={[...gradients.gold]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.addToCartGradient}
                  >
                    <Icon
                      name={addingToCart ? "checkmark" : "bag-handle-outline"}
                      size={20}
                      color={colors.text.inverse}
                    />
                    <Text
                      style={[
                        styles.addToCartText,
                        { color: colors.text.inverse },
                      ]}
                      numberOfLines={1}
                    >
                      {addingToCart ? "Added" : "Add to Cart"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.bodySmall,
    marginTop: spacing.md,
  },
  notFoundTitle: {
    ...typography.h3,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  notFoundText: {
    ...typography.bodySmall,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  goBackButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: borderRadius.full,
  },
  goBackText: {
    ...typography.body,
    fontWeight: "600",
  },

  // Hero Image
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: IMAGE_HEIGHT * 0.6,
  },

  // Back Button - Floating circle with blur
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : spacing.md,
    left: spacing.md,
    zIndex: 10,
  },
  backButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  // Premium Badge
  premiumBadgeContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // Scarcity Badge
  scarcityBadgeContainer: {
    position: "absolute",
    right: spacing.md,
    zIndex: 10,
  },
  scarcityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  scarcityBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // AR Preview Button
  arButton: {
    position: "absolute",
    bottom: CARD_OVERLAP + spacing.md,
    left: spacing.md,
    zIndex: 10,
    borderRadius: borderRadius.full,
    overflow: "hidden",
  },
  arButtonBlur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  arButtonText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Product Info Card - Overlapping image
  infoCard: {
    marginTop: -CARD_OVERLAP,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + spacing.sm,
    minHeight: 400,
  },

  // Category gold pill badge
  categoryBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: spacing.md,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Product Name - 26px bold
  productName: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
    lineHeight: 32,
  },

  // Rating Section
  ratingSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: 8,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingScore: {
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 4,
  },
  reviewCount: {
    ...typography.bodySmall,
  },

  // Price - 28px fontWeight 800 gold
  price: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: spacing.lg,
    letterSpacing: -0.5,
  },

  // Description Card
  descriptionCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    lineHeight: 26,
    letterSpacing: 0.1,
  },

  // Details Grid
  detailsCard: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  detailItem: {
    alignItems: "center",
    flex: 1,
  },
  detailIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  detailLabel: {
    ...typography.caption,
    marginBottom: 2,
  },
  detailValue: {
    ...typography.body,
    fontWeight: "600",
  },

  // Stock
  stockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.md,
  },
  stockText: {
    ...typography.body,
    fontWeight: "600",
  },

  // Bottom Bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomBarGradient: {
    paddingTop: spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 34 : spacing.md,
    paddingHorizontal: spacing.lg,
  },
  bottomBarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  // Summary row — "YOUR TOTAL" caps label + bold gold price
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  summaryPrice: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  summaryHairline: {
    width: 40,
    height: StyleSheet.hairlineWidth,
  },

  // Quantity Stepper — compact pill, 52pt height, subtle gold hairline
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: borderRadius.full,
    height: 52,
    paddingHorizontal: 4,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    fontSize: 16,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
    letterSpacing: 0.3,
  },

  // Add to Cart — single clean line, price lives in summary row
  addToCartWrapper: {
    flex: 1,
    height: 52,
    borderRadius: borderRadius.full,
    overflow: "hidden",
  },
  addToCartTouchable: {
    flex: 1,
  },
  addToCartGradient: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: borderRadius.full,
    paddingHorizontal: 20,
    gap: 10,
  },
  addToCartText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});
