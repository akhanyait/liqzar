import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "../../components/Icon";
import BrandMark from "../../components/BrandMark";
import { useTheme } from "../../contexts/ThemeContext";
import { useOrders } from "../../contexts/OrderContext";
import { spacing, borderRadius } from "../../theme";

export default function CustomerDeliveryPin() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const { getDeliveryPin } = useOrders();

  const orderId = route.params?.orderId;
  const orderNumber = route.params?.orderNumber;
  const driverName = route.params?.driverName;

  const [pin, setPin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadPin();
  }, [orderId]);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const loadPin = async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    const deliveryPin = await getDeliveryPin(orderId);
    setPin(deliveryPin);
    setLoading(false);
  };

  const pinDigits = pin ? pin.split("") : ["·", "·", "·", "·"];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
          paddingHorizontal: spacing.md,
        }}
      >
        <View style={st.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={st.backBtn}
          >
            <Icon name="arrow-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <BrandMark size="xs" />
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Delivery PIN
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <View style={st.content}>
        {/* Shield Icon */}
        <View
          style={[
            st.shieldCircle,
            {
              backgroundColor: colors.gold.faint,
            },
          ]}
        >
          <Icon name="shield-checkmark" size={44} color={colors.gold.primary} />
        </View>

        {/* Instruction */}
        <Text style={[st.title, { color: colors.text.primary }]}>
          Your Delivery PIN
        </Text>
        <Text style={[st.subtitle, { color: colors.text.muted }]}>
          Show this PIN to your driver when they arrive.{"\n"}
          Do not share it with anyone else.
        </Text>

        {/* PIN Display */}
        <Animated.View
          style={[st.pinContainer, { transform: [{ scale: pulseAnim }] }]}
        >
          <LinearGradient
            colors={
              isDark
                ? ["rgba(212,175,55,0.12)", "rgba(212,175,55,0.04)"]
                : ["rgba(212,175,55,0.08)", "rgba(212,175,55,0.02)"]
            }
            style={[st.pinCard, { borderColor: "rgba(212,175,55,0.25)" }]}
          >
            <View style={st.pinRow}>
              {pinDigits.map((digit, i) => (
                <View
                  key={i}
                  style={[st.pinBox, { borderColor: "rgba(212,175,55,0.3)" }]}
                >
                  <Text style={st.pinDigit}>{loading ? "·" : digit}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Order Info */}
        <View
          style={[
            st.infoCard,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
          ]}
        >
          {orderNumber && (
            <View style={st.infoRow}>
              <Icon
                name="receipt-outline"
                size={18}
                color={colors.text.muted}
              />
              <Text style={{ color: colors.text.muted, fontSize: 14 }}>
                Order
              </Text>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: 14,
                  fontWeight: "600",
                  marginLeft: "auto",
                }}
              >
                #{orderNumber}
              </Text>
            </View>
          )}
          {driverName && (
            <View style={st.infoRow}>
              <Icon name="person-outline" size={18} color={colors.text.muted} />
              <Text style={{ color: colors.text.muted, fontSize: 14 }}>
                Driver
              </Text>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: 14,
                  fontWeight: "600",
                  marginLeft: "auto",
                }}
              >
                {driverName}
              </Text>
            </View>
          )}
        </View>

        {/* Security Note */}
        <View style={st.securityNote}>
          <Icon name="lock-closed" size={16} color={colors.gold.primary} />
          <Text style={{ color: colors.text.dim, fontSize: 12, flex: 1 }}>
            This PIN ensures your order is delivered to the right person. Only
            share it face-to-face with your driver.
          </Text>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
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
  headerTitle: { fontSize: 18, fontWeight: "800" },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 32,
  },
  shieldCircle: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  pinContainer: { marginBottom: 32 },
  pinCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: 24,
  },
  pinRow: { flexDirection: "row", gap: 16 },
  pinBox: {
    width: 64,
    height: 76,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    backgroundColor: "rgba(212,175,55,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  pinDigit: {
    fontSize: 36,
    fontWeight: "800",
    color: "#D4AF37",
    letterSpacing: 2,
  },
  infoCard: {
    width: "100%",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginBottom: 24,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 8,
  },
});
