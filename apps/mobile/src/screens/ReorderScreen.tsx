import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "../components/Icon";
import BrandMark from "../components/BrandMark";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { useCart } from "../contexts/CartContext";
import { supabase } from "../lib/supabase";
import { borderRadius } from "../theme";

// ─── Types ───────────────────────────────────────────────

interface OrderItem {
  product_id: string;
  quantity: number;
  products?: {
    name: string;
    price: number;
    image_url: string;
    stock_quantity: number;
    category: string;
  };
}

interface PastOrder {
  id: string;
  created_at: string;
  total_amount: number;
  order_items: OrderItem[];
}

interface FrequentItem {
  product_id: string;
  name: string;
  price: number;
  image_url: string;
  category: string;
  count: number;
}

// ─── Component ───────────────────────────────────────────────

export default function ReorderScreen() {
  const { colors, isDark, gradients } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { addItem } = useCart();

  const [loading, setLoading] = useState(true);
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([]);
  const [frequentItems, setFrequentItems] = useState<FrequentItem[]>([]);

  const cardBg = colors.background.card;
  const screenBg = colors.background.primary;
  const cardBorder = colors.gold.border;
  const gold = colors.gold.primary;

  useEffect(() => {
    fetchPastOrders();
  }, []);

  const fetchPastOrders = async () => {
    setLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*, products(name, price, image_url, stock_quantity, category))')
        .eq('user_id', userId)
        .in('status', ['completed', 'delivered'])
        .order('created_at', { ascending: false })
        .limit(10);
      setPastOrders(data || []);

      // Calculate frequent items
      if (data) {
        const itemCounts: Record<string, FrequentItem> = {};
        data.forEach((order: any) => {
          order.order_items?.forEach((item: any) => {
            const key = item.product_id;
            if (!itemCounts[key]) {
              itemCounts[key] = {
                product_id: key,
                name: item.products?.name || 'Unknown',
                price: item.products?.price || 0,
                image_url: item.products?.image_url || '',
                category: item.products?.category || '',
                count: 0,
              };
            }
            itemCounts[key].count += item.quantity;
          });
        });
        const sorted = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 6);
        setFrequentItems(sorted);
      }
    } catch (error) {
      console.error('Error fetching past orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = (order: PastOrder) => {
    order.order_items?.forEach((item: OrderItem) => {
      addItem({
        id: item.product_id,
        name: item.products?.name || 'Unknown',
        price: item.products?.price || 0,
        image_url: item.products?.image_url || '',
        category: item.products?.category || '',
      }, item.quantity);
    });
    navigation.navigate('Cart');
  };

  const handleAddFrequentItem = (item: FrequentItem) => {
    addItem({
      id: item.product_id,
      name: item.name,
      price: item.price,
      image_url: item.image_url,
      category: item.category,
    });
    Alert.alert('Added', `${item.name} added to cart`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const truncateItems = (items: OrderItem[]) => {
    const first3 = items
      .slice(0, 3)
      .map((it) => {
        const name = it.products?.name || 'Unknown';
        return name.length > 22 ? name.slice(0, 22) + "..." : name;
      });
    return first3.join(", ");
  };

  // ─── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[st.root, { backgroundColor: screenBg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={gold} />
        <Text style={{ color: colors.text.muted, marginTop: 12 }}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={[st.root, { backgroundColor: screenBg }]}>
      {/* Header */}
      <LinearGradient
        colors={[...gradients.header]}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
          paddingHorizontal: 16,
        }}
      >
        <View style={st.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={st.backBtn}
          >
            <Icon
              name="arrow-back"
              size={22}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <BrandMark size="xs" />
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Quick Reorder
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      >
        {/* ── Recent Orders ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Recent Orders
          </Text>

          {pastOrders.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Icon name="receipt-outline" size={48} color={colors.gold.muted} />
              <Text style={{ fontSize: 14, color: colors.text.muted, marginTop: 12 }}>No past orders yet</Text>
              <Text style={{ fontSize: 12, color: colors.text.dim, marginTop: 4 }}>Your completed orders will appear here</Text>
            </View>
          ) : (
            pastOrders.map((order) => (
              <View
                key={order.id}
                style={[
                  st.card,
                  { backgroundColor: cardBg, borderColor: cardBorder },
                ]}
              >
                <View style={st.orderTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.orderDate, { color: gold }]}>
                      <Icon name="calendar-outline" size={13} color={gold} />{" "}
                      {formatDate(order.created_at)}
                    </Text>
                    <Text
                      style={[
                        st.orderItemCount,
                        { color: colors.text.muted },
                      ]}
                    >
                      {order.order_items?.length || 0} items
                    </Text>
                  </View>
                  <Text
                    style={[st.orderTotal, { color: colors.text.primary }]}
                  >
                    R{(order.total_amount || 0).toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </Text>
                </View>

                {/* Thumbnails row */}
                <View style={st.thumbRow}>
                  {(order.order_items || []).slice(0, 3).map((item, idx) => (
                    <View
                      key={idx}
                      style={[
                        st.thumbBox,
                        {
                          backgroundColor: colors.gold.faint,
                        },
                      ]}
                    >
                      {item.products?.image_url ? (
                        <Image
                          source={{ uri: item.products.image_url }}
                          style={{ width: 28, height: 28, borderRadius: 6 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Icon name="wine-outline" size={18} color={gold} />
                      )}
                    </View>
                  ))}
                  {(order.order_items?.length || 0) > 3 && (
                    <View
                      style={[
                        st.thumbBox,
                        {
                          backgroundColor: colors.gold.faint,
                        },
                      ]}
                    >
                      <Text
                        style={{ fontSize: 11, fontWeight: "700", color: gold }}
                      >
                        +{(order.order_items?.length || 0) - 3}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={[st.itemNames, { color: colors.text.muted }]}
                  numberOfLines={1}
                >
                  {truncateItems(order.order_items || [])}
                </Text>

                <TouchableOpacity
                  onPress={() => handleReorder(order)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[colors.gold.primary, colors.gold.dark]}
                    style={st.reorderBtn}
                  >
                    <Icon name="refresh-outline" size={16} color="#000" />
                    <Text style={st.reorderBtnText}>Reorder</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* ── Frequently Ordered ── */}
        {frequentItems.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
              Frequently Ordered
            </Text>

            {frequentItems.map((item) => (
              <View
                key={item.product_id}
                style={[
                  st.card,
                  { backgroundColor: cardBg, borderColor: cardBorder },
                ]}
              >
                <View style={st.freqRow}>
                  {/* Image */}
                  <View
                    style={[
                      st.freqImage,
                      {
                        backgroundColor: colors.gold.faint,
                      },
                    ]}
                  >
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={{ width: 40, height: 40, borderRadius: 8 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <Icon name="wine-outline" size={24} color={gold} />
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[st.freqName, { color: colors.text.primary }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={[st.freqPrice, { color: gold }]}>
                      R{item.price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.text.dim }}>
                      Ordered {item.count}x
                    </Text>
                  </View>

                  {/* Add to cart button */}
                  <TouchableOpacity
                    onPress={() => handleAddFrequentItem(item)}
                    style={[
                      st.addBtn,
                      {
                        backgroundColor: colors.gold.faint,
                      },
                    ]}
                  >
                    <Icon name="add" size={20} color={gold} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1 },
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
  headerTitle: { fontSize: 20, fontWeight: "800" },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 14 },

  // Card base
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },

  // Recent orders
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  orderDate: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  orderItemCount: { fontSize: 12 },
  orderTotal: { fontSize: 18, fontWeight: "800" },

  thumbRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  thumbBox: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },

  itemNames: { fontSize: 12, marginBottom: 12 },

  reorderBtn: {
    height: 40,
    borderRadius: borderRadius.xl,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  reorderBtnText: { fontSize: 14, fontWeight: "800", color: "#000" },

  // Frequent items
  freqRow: { flexDirection: "row", alignItems: "center" },
  freqImage: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  freqName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  freqPrice: { fontSize: 15, fontWeight: "800" },

  // Add button
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});
