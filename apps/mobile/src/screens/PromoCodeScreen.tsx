import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../components/Icon";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, borderRadius } from "../theme";
import { supabase } from "../lib/supabase";

interface PromoCode {
  id: string;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  is_active: boolean;
  expires_at: string | null;
  min_order_amount?: number;
}

export default function PromoCodeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark, shadows } = useTheme();

  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [savedAmount, setSavedAmount] = useState("");
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetchPromos();
  }, []);

  const fetchPromos = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
      setPromos(data || []);
    } catch (error) {
      console.error('Error fetching promos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDiscountLabel = (promo: PromoCode): string => {
    if (promo.discount_type === 'percentage') {
      return `${promo.discount_value}% OFF`;
    } else if (promo.discount_type === 'free_delivery') {
      return 'FREE DELIVERY';
    }
    return `R${promo.discount_value} OFF`;
  };

  const getExpiryLabel = (promo: PromoCode): string => {
    if (!promo.expires_at) return 'No expiry';
    const date = new Date(promo.expires_at);
    return `Expires ${date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const handleApplyCode = async (code: string) => {
    setApplying(true);
    try {
      const promo = promos.find(
        (p) => p.code === code.toUpperCase().trim(),
      );

      if (!promo) {
        // Also check Supabase in case it's a valid code not in the list
        const { data } = await supabase
          .from('promo_codes')
          .select('*')
          .eq('code', code.toUpperCase().trim())
          .eq('is_active', true)
          .single();

        if (data) {
          setAppliedCode(data.code);
          setSavedAmount(getDiscountLabel(data));
          Alert.alert("Promo Applied", `${data.code} has been applied!`);
        } else {
          Alert.alert("Invalid Code", "This promo code is not valid or has expired.");
        }
      } else {
        setAppliedCode(promo.code);
        setSavedAmount(getDiscountLabel(promo));
        Alert.alert("Promo Applied", `${promo.code} has been applied!`);
      }
    } catch (error) {
      Alert.alert("Invalid Code", "This promo code is not valid or has expired.");
    } finally {
      setApplying(false);
    }
  };

  const handleApplyInput = () => {
    if (!codeInput.trim()) {
      Alert.alert("Enter Code", "Please enter a promo code.");
      return;
    }
    handleApplyCode(codeInput);
  };

  const handleRemoveCode = () => {
    setAppliedCode(null);
    setSavedAmount("");
    setCodeInput("");
  };

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
          <Text style={[st.headerTitle, { color: colors.text.primary }]}>
            Promo Codes
          </Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Enter Code Section */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Enter Code
          </Text>
          <View
            style={[
              st.enterCard,
              {
                backgroundColor: colors.background.card,
                borderColor: colors.gold.border,
              },
            ]}
          >
            <TextInput
              style={[
                st.codeInput,
                {
                  color: colors.text.primary,
                  borderColor: colors.gold.border,
                  backgroundColor: colors.background.tertiary,
                },
              ]}
              placeholder="ENTER PROMO CODE"
              placeholderTextColor={colors.text.dim}
              value={codeInput}
              onChangeText={(t) => setCodeInput(t.toUpperCase())}
              autoCapitalize="characters"
            />
            <TouchableOpacity onPress={handleApplyInput} activeOpacity={0.8} disabled={applying}>
              <LinearGradient
                colors={[colors.gold.primary, colors.gold.dark]}
                style={st.applyBtn}
              >
                {applying ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={st.applyBtnText}>Apply</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Applied Code Banner */}
        {appliedCode && (
          <View style={{ paddingHorizontal: spacing.md, marginTop: 16 }}>
            <View style={st.appliedBanner}>
              <Icon name="checkmark-circle" size={20} color={colors.white} />
              <Text style={st.appliedText}>
                {appliedCode} applied — {savedAmount}!
              </Text>
              <TouchableOpacity onPress={handleRemoveCode} activeOpacity={0.7}>
                <Text style={st.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Available Promos */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
          <Text style={[st.sectionTitle, { color: colors.text.primary }]}>
            Available Promos
          </Text>
          {loading ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="large" color={colors.gold.primary} />
              <Text style={{ fontSize: 12, color: colors.text.muted, marginTop: 8 }}>Loading promos...</Text>
            </View>
          ) : promos.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Icon name="pricetag-outline" size={48} color={colors.gold.faint} />
              <Text style={{ fontSize: 14, color: colors.text.muted, marginTop: 12 }}>No promos available right now</Text>
              <Text style={{ fontSize: 12, color: colors.text.dim, marginTop: 4 }}>Check back later for new offers!</Text>
            </View>
          ) : (
            promos.map((promo) => {
              const isApplied = appliedCode === promo.code;
              return (
                <View
                  key={promo.id}
                  style={[
                    st.promoCard,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.gold.border,
                    },
                  ]}
                >
                  <View style={st.promoTopRow}>
                    <View
                      style={[st.discountBadge, { backgroundColor: colors.gold.primary + "18" }]}
                    >
                      <Text style={st.discountText}>{getDiscountLabel(promo)}</Text>
                    </View>
                    {isApplied && (
                      <View style={st.appliedPill}>
                        <Icon name="checkmark" size={12} color={colors.white} />
                        <Text style={st.appliedPillText}>Applied</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[st.promoCode, { color: colors.text.primary }]}>
                    {promo.code}
                  </Text>
                  <Text style={[st.promoDesc, { color: colors.text.muted }]}>
                    {promo.description}
                  </Text>
                  <View style={st.promoBottomRow}>
                    <Text style={{ fontSize: 11, color: colors.text.dim }}>
                      {getExpiryLabel(promo)}
                    </Text>
                    {!isApplied ? (
                      <TouchableOpacity
                        onPress={() => handleApplyCode(promo.code)}
                        activeOpacity={0.75}
                      >
                        <LinearGradient
                          colors={[colors.gold.primary, colors.gold.dark]}
                          style={st.promoApplyBtn}
                        >
                          <Text style={st.promoApplyText}>Apply</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={handleRemoveCode}
                        activeOpacity={0.75}
                        style={[
                          st.promoRemoveBtn,
                          { borderColor: colors.status.error },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: colors.status.error,
                          }}
                        >
                          Remove
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  headerTitle: { fontSize: 20, fontWeight: "800" },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  enterCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 3,
    textAlign: "center",
  },
  applyBtn: {
    height: 48,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  applyBtnText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "800",
  },
  appliedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  appliedText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  removeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
    textDecorationLine: "underline",
  },
  promoCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 16,
    marginBottom: 10,
  },
  promoTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  discountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  discountText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#D4AF37",
  },
  appliedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  appliedPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
  promoCode: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  promoDesc: {
    fontSize: 13,
    marginBottom: 12,
  },
  promoBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  promoApplyBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: borderRadius.lg,
  },
  promoApplyText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#000",
  },
  promoRemoveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
});
