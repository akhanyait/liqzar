import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { spacing, borderRadius, typography } from "../theme";
import { Icon } from "../components/Icon";
import BrandMark from "../components/BrandMark";
import { useCart } from "../contexts/CartContext";
import { useTheme } from "../contexts/ThemeContext";

const DELIVERY_FEE = 9.99;
const FREE_DELIVERY_THRESHOLD = 150;
const VAT_RATE = 0.15;

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { items, removeItem, updateQuantity, clearCart, total } = useCart();
  const { colors, gradients, shadows, isDark } = useTheme();

  const subtotal = total;
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const vatAmount = (subtotal + deliveryFee) * VAT_RATE;
  const grandTotal = subtotal + deliveryFee + vatAmount;

  const totalItemCount = items.reduce(
    (sum: number, item: any) => sum + item.quantity,
    0
  );

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert("Empty Cart", "Please add items to your cart first.");
      return;
    }
    navigation.navigate("Checkout");
  };

  const handleClearCart = () => {
    Alert.alert("Clear Cart", "Are you sure you want to remove all items?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear All", style: "destructive", onPress: clearCart },
    ]);
  };

  const handleRemoveItem = (id: string, name: string) => {
    Alert.alert("Remove Item", `Remove ${name} from your cart?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeItem(id) },
    ]);
  };

  // ── Empty Cart State ──────────────────────────────────────
  if (items.length === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          { backgroundColor: colors.background.primary },
        ]}
      >
        {/* Large gold-outlined cart icon */}
        <View
          style={[
            styles.emptyIconOuter,
            {
              borderColor: colors.gold.primary,
              backgroundColor: colors.gold.faint,
            },
          ]}
        >
          <View
            style={[
              styles.emptyIconInner,
              { backgroundColor: colors.gold.faint },
            ]}
          >
            <Icon name="cart-outline" size={56} color={colors.gold.primary} />
          </View>
        </View>

        <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
          Your Cart is Empty
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.gold.muted }]}>
          Discover our premium collection and add your favourites.
        </Text>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate("MainTabs", { screen: "Catalog" })
          }
          activeOpacity={0.8}
          style={[styles.startShoppingWrapper, shadows.gold]}
        >
          <LinearGradient
            colors={[...gradients.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startShoppingGradient}
          >
            <Icon name="bag-outline" size={20} color={colors.text.inverse} />
            <Text
              style={[styles.startShoppingText, { color: colors.text.inverse }]}
            >
              Start Shopping
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Cart Item Renderer ────────────────────────────────────
  const renderCartItem = ({ item }: any) => (
    <View
      style={[
        styles.cartItem,
        shadows.card,
        {
          backgroundColor: colors.background.card,
          borderColor: colors.gold.border,
        },
      ]}
    >
      {/* Product image in padded container */}
      <View
        style={[
          styles.imageContainer,
          { backgroundColor: colors.background.tertiary },
        ]}
      >
        <Image
          source={{ uri: item.image_url }}
          style={styles.itemImage}
          resizeMode="cover"
        />
      </View>

      {/* Details */}
      <View style={styles.itemDetails}>
        <Text
          style={[styles.itemName, { color: colors.text.primary }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <Text style={[styles.itemCategory, { color: colors.text.dim }]}>
          {item.category}
        </Text>
        <Text style={[styles.itemPrice, { color: colors.gold.primary }]}>
          R {item.price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </Text>
      </View>

      {/* Actions column */}
      <View style={styles.itemActions}>
        {/* Quantity Controls */}
        <View style={styles.qtyRow}>
          <TouchableOpacity
            onPress={() => updateQuantity(item.id, item.quantity - 1)}
            style={[
              styles.qtyButton,
              shadows.goldSubtle,
              {
                backgroundColor: colors.background.elevated,
                borderColor: colors.gold.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Icon name="remove" size={14} color={colors.gold.primary} />
          </TouchableOpacity>

          <Text style={[styles.qtyText, { color: colors.text.primary }]}>
            {item.quantity}
          </Text>

          <TouchableOpacity
            onPress={() => updateQuantity(item.id, item.quantity + 1)}
            style={[
              styles.qtyButton,
              shadows.goldSubtle,
              {
                backgroundColor: colors.background.elevated,
                borderColor: colors.gold.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Icon name="add" size={14} color={colors.gold.primary} />
          </TouchableOpacity>
        </View>

        {/* Line Total */}
        <Text style={[styles.lineTotal, { color: colors.gold.muted }]}>
          R {(item.price * item.quantity).toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </Text>

        {/* Remove - subtle trash icon */}
        <TouchableOpacity
          onPress={() => handleRemoveItem(item.id, item.name)}
          style={[
            styles.removeButton,
            { backgroundColor: "rgba(239,68,68,0.08)" },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <Icon name="trash-outline" size={16} color={colors.status.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Main Cart View ────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Header with gradient background */}
      <LinearGradient
        colors={[...gradients.header]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <BrandMark size="xs" />
            <View style={styles.headerTitleRow}>
              <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
                Your Cart
              </Text>
              {/* Item count badge */}
              <View
                style={[
                  styles.itemCountBadge,
                  { backgroundColor: colors.gold.primary },
                ]}
              >
                <Text style={[styles.itemCountText, { color: colors.text.inverse }]}>
                  {totalItemCount}
                </Text>
              </View>
            </View>
            <Text style={[styles.headerCount, { color: colors.gold.muted }]}>
              {items.length} {items.length === 1 ? "item" : "items"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleClearCart}
            style={[
              styles.clearButton,
              { backgroundColor: "rgba(239,68,68,0.1)" },
            ]}
            activeOpacity={0.7}
          >
            <Icon name="trash-outline" size={16} color={colors.status.error} />
            <Text style={[styles.clearText, { color: colors.status.error }]}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subtle gold bottom border */}
        <View
          style={[
            styles.headerBottomBorder,
            { backgroundColor: colors.gold.border },
          ]}
        />
      </LinearGradient>

      {/* Cart Items List */}
      <FlatList
        data={items}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Order Summary */}
      <View
        style={[
          styles.summaryContainer,
          { backgroundColor: colors.background.secondary },
        ]}
      >
        {/* Summary card with gold gradient top border */}
        <View
          style={[
            styles.summaryCard,
            shadows.card,
            {
              backgroundColor: colors.background.card,
            },
          ]}
        >
          {/* Gold gradient top border */}
          <LinearGradient
            colors={[...gradients.goldShimmer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.summaryGoldBorder}
          />

          <View style={styles.summaryInner}>
            {/* Subtotal */}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.gold.muted }]}>
                Subtotal
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                R {subtotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            </View>

            {/* VAT */}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.gold.muted }]}>
                VAT (15%)
              </Text>
              <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
                R {vatAmount.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            </View>

            {/* Delivery */}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.gold.muted }]}>
                Delivery
              </Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: colors.text.primary },
                  deliveryFee === 0 && { color: colors.status.success },
                ]}
              >
                {deliveryFee === 0 ? "FREE" : `R ${deliveryFee.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
              </Text>
            </View>

            {/* Free delivery hint */}
            {subtotal < FREE_DELIVERY_THRESHOLD && (
              <View
                style={[
                  styles.freeDeliveryHint,
                  { backgroundColor: colors.gold.faint },
                ]}
              >
                <Icon
                  name="information-circle-outline"
                  size={16}
                  color={colors.gold.muted}
                />
                <Text
                  style={[styles.freeDeliveryText, { color: colors.gold.muted }]}
                >
                  Add R {(FREE_DELIVERY_THRESHOLD - subtotal).toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})} more for
                  free delivery
                </Text>
              </View>
            )}

            {/* Divider between subtotal section and total */}
            <View
              style={[
                styles.summaryDivider,
                { backgroundColor: colors.gold.border },
              ]}
            />

            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.text.primary }]}>
                Total
              </Text>
              <Text style={[styles.totalValue, { color: colors.gold.primary }]}>
                R {grandTotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            </View>
          </View>
        </View>

        {/* Checkout Button - full width gold gradient with total on right */}
        <TouchableOpacity
          onPress={handleCheckout}
          activeOpacity={0.8}
          style={[styles.checkoutWrapper, shadows.gold]}
        >
          <LinearGradient
            colors={[...gradients.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkoutGradient}
          >
            <View style={styles.checkoutLeft}>
              <Icon name="bag-check-outline" size={22} color={colors.text.inverse} />
              <Text style={[styles.checkoutText, { color: colors.text.inverse }]}>
                Checkout
              </Text>
            </View>
            <View style={styles.checkoutRight}>
              <View
                style={[
                  styles.checkoutPriceDivider,
                  { backgroundColor: "rgba(255,255,255,0.25)" },
                ]}
              />
              <Text
                style={[styles.checkoutPrice, { color: colors.text.inverse }]}
              >
                R {grandTotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Header ────────────────────────────────────────────
  headerGradient: {
    paddingTop: spacing.md,
    paddingBottom: 0,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
  },
  itemCountBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  itemCountText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  headerCount: {
    ...typography.caption,
    marginTop: 2,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 4,
    borderRadius: borderRadius.sm,
  },
  clearText: {
    ...typography.bodySmall,
    fontWeight: "600",
  },
  headerBottomBorder: {
    height: 1,
    width: "100%",
  },

  // ── List ──────────────────────────────────────────────
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },

  // ── Cart Item ─────────────────────────────────────────
  cartItem: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  imageContainer: {
    width: 84,
    height: 84,
    borderRadius: borderRadius.md,
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  itemImage: {
    width: "100%",
    height: "100%",
    borderRadius: borderRadius.sm,
  },
  itemDetails: {
    flex: 1,
    marginLeft: spacing.sm + 4,
    justifyContent: "center",
  },
  itemName: {
    ...typography.bodySmall,
    fontWeight: "600",
    marginBottom: 3,
  },
  itemCategory: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  itemPrice: {
    ...typography.body,
    fontWeight: "700",
  },

  // ── Item Actions ──────────────────────────────────────
  itemActions: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingLeft: spacing.xs,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    ...typography.bodySmall,
    fontWeight: "700",
    minWidth: 20,
    textAlign: "center",
  },
  lineTotal: {
    ...typography.caption,
    fontWeight: "600",
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Empty State ───────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyIconOuter: {
    width: 140,
    height: 140,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg + spacing.sm,
  },
  emptyIconInner: {
    width: 110,
    height: 110,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: "center",
    marginBottom: spacing.xl + spacing.sm,
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  startShoppingWrapper: {
    height: 58,
    borderRadius: borderRadius.full,
    overflow: "hidden",
    width: "100%",
    maxWidth: 280,
  },
  startShoppingGradient: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    gap: 10,
  },
  startShoppingText: {
    ...typography.button,
  },

  // ── Summary ───────────────────────────────────────────
  summaryContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === "ios" ? 34 : spacing.md,
  },
  summaryCard: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  summaryGoldBorder: {
    height: 3,
    width: "100%",
  },
  summaryInner: {
    padding: spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm + 2,
  },
  summaryLabel: {
    ...typography.body,
  },
  summaryValue: {
    ...typography.body,
    fontWeight: "600",
  },
  freeDeliveryHint: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    gap: 6,
  },
  freeDeliveryText: {
    ...typography.caption,
    flex: 1,
  },
  summaryDivider: {
    height: 1,
    marginVertical: spacing.sm + 2,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    ...typography.h3,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  // ── Checkout Button ───────────────────────────────────
  checkoutWrapper: {
    height: 58,
    borderRadius: borderRadius.full,
    overflow: "hidden",
  },
  checkoutGradient: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
  },
  checkoutLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkoutText: {
    ...typography.button,
  },
  checkoutRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkoutPriceDivider: {
    width: 1,
    height: 24,
  },
  checkoutPrice: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
