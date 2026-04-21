import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Icon } from "../components/Icon";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, borderRadius, typography } from "../theme";
import { haptics } from "../utils/haptics";

// Human-concierge handoff → WhatsApp Business bridge. Phone comes from
// app.config.extra.conciergeWhatsApp (E.164, no "+"). Override via
// LIQZAR_CONCIERGE_WHATSAPP env var at build time.
const CONCIERGE_PHONE: string =
  (Constants.expoConfig?.extra?.conciergeWhatsApp as string | undefined) ??
  "27810001234";

const QUICK_PROMPTS = [
  { key: "pair", icon: "restaurant-outline", label: "Pairing suggestion", body: "I'd like a pairing suggestion for tonight's meal." },
  { key: "gift", icon: "gift-outline", label: "Gift help", body: "I'm choosing a gift and would appreciate guidance on the right bottle." },
  { key: "collection", icon: "diamond-outline", label: "Cellar reserve", body: "I'd like to know what rare / allocated releases are available." },
  { key: "event", icon: "people-outline", label: "Event or tasting", body: "I'm hosting and need help planning bottles for my event." },
];

export default function SommelierChatScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, gradients, isDark } = useTheme();
  const [request, setRequest] = useState("");
  const [budgetHint, setBudgetHint] = useState<string | null>(null);

  const composeMessage = () => {
    const parts = [
      "Hi LIQZAR Concierge — I'd appreciate some guidance.",
    ];
    if (request.trim()) parts.push(`Request: ${request.trim()}`);
    if (budgetHint) parts.push(`Budget: ${budgetHint}`);
    return parts.join("\n\n");
  };

  const openWhatsApp = async (preset?: string) => {
    haptics.medium();
    const body = preset ?? composeMessage();
    const encoded = encodeURIComponent(body);
    const url = `whatsapp://send?phone=${CONCIERGE_PHONE}&text=${encoded}`;
    const fallback = `https://wa.me/${CONCIERGE_PHONE}?text=${encoded}`;

    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return;
      }
      const canWeb = await Linking.canOpenURL(fallback);
      if (canWeb) {
        await Linking.openURL(fallback);
        return;
      }
      throw new Error("no-wa");
    } catch {
      Alert.alert(
        "WhatsApp unavailable",
        "We couldn't open WhatsApp. Would you like to call the concierge directly?",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Call",
            onPress: () => Linking.openURL(`tel:+${CONCIERGE_PHONE}`),
          },
        ],
      );
    }
  };

  const callConcierge = () => {
    haptics.medium();
    Linking.openURL(`tel:+${CONCIERGE_PHONE}`).catch(() => {
      Alert.alert("Call failed", "Please try again or message on WhatsApp.");
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#1c1810", "#050403"] : ["#fff", "#faf7ed"]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerEyebrow, { color: colors.gold.primary }]}>
          LIQZAR CONCIERGE
        </Text>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
          Speak with our cellar
        </Text>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero framing */}
        <View
          style={[
            styles.hero,
            {
              borderColor: colors.gold.primary,
              backgroundColor: isDark ? "rgba(212,175,55,0.04)" : "rgba(212,175,55,0.06)",
            },
          ]}
        >
          <View style={[styles.heroRule, { backgroundColor: colors.gold.primary }]} />
          <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
            A human on the other end.
          </Text>
          <Text style={[styles.heroBody, { color: colors.text.muted }]}>
            Our curators will help you choose the right bottle, plan a pairing,
            or source an allocated release. Typically replies within 10 minutes,
            09:00–21:00 SAST.
          </Text>
          <View style={[styles.heroRuleBottom, { backgroundColor: colors.gold.primary }]} />
        </View>

        {/* Quick prompts */}
        <Text style={[styles.sectionEyebrow, { color: colors.gold.primary }]}>
          START A CONVERSATION
        </Text>
        <View style={{ gap: 10, marginBottom: spacing.lg }}>
          {QUICK_PROMPTS.map((p) => (
            <TouchableOpacity
              key={p.key}
              activeOpacity={0.85}
              onPress={() => openWhatsApp(p.body)}
              style={[
                styles.promptRow,
                { borderColor: colors.gold.border, backgroundColor: colors.background.card },
              ]}
              accessibilityRole="button"
              accessibilityLabel={p.label}
            >
              <View
                style={[
                  styles.promptIconWrap,
                  { backgroundColor: colors.gold.faint, borderColor: colors.gold.border },
                ]}
              >
                <Icon name={p.icon as any} size={18} color={colors.gold.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.promptLabel, { color: colors.text.primary }]}>
                  {p.label}
                </Text>
                <Text style={[styles.promptSub, { color: colors.text.muted }]}>
                  {p.body}
                </Text>
              </View>
              <Icon name="logo-whatsapp" size={20} color="#25D366" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom request */}
        <Text style={[styles.sectionEyebrow, { color: colors.gold.primary }]}>
          OR DESCRIBE WHAT YOU'RE LOOKING FOR
        </Text>
        <TextInput
          value={request}
          onChangeText={(t) => setRequest(t.slice(0, 400))}
          placeholder="e.g. A gift for my father's 60th — he enjoys peated whisky."
          placeholderTextColor={colors.text.muted}
          multiline
          style={[
            styles.request,
            {
              borderColor: colors.gold.border,
              color: colors.text.primary,
              backgroundColor: colors.background.card,
            },
          ]}
        />

        {/* Budget chips */}
        <Text
          style={[
            styles.sectionEyebrow,
            { color: colors.gold.primary, marginTop: spacing.md },
          ]}
        >
          BUDGET (OPTIONAL)
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: spacing.lg }}
        >
          {["Under R500", "R500–R1,500", "R1,500–R5,000", "R5,000+", "Open to suggestions"].map(
            (b) => {
              const selected = budgetHint === b;
              return (
                <TouchableOpacity
                  key={b}
                  onPress={() => {
                    haptics.selection();
                    setBudgetHint(selected ? null : b);
                  }}
                  activeOpacity={0.85}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.gold.primary : colors.gold.border,
                    backgroundColor: selected ? colors.gold.faint : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: selected ? colors.gold.primary : colors.text.primary,
                      letterSpacing: 0.3,
                    }}
                  >
                    {b}
                  </Text>
                </TouchableOpacity>
              );
            },
          )}
        </ScrollView>

        {/* Primary CTA — WhatsApp */}
        <TouchableOpacity
          onPress={() => openWhatsApp()}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Message the concierge on WhatsApp"
        >
          <LinearGradient
            colors={[...gradients.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryCta}
          >
            <Icon name="logo-whatsapp" size={20} color="#050403" />
            <Text style={styles.primaryCtaText}>Message the Concierge</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Secondary — call */}
        <TouchableOpacity
          onPress={callConcierge}
          activeOpacity={0.85}
          style={[styles.secondaryCta, { borderColor: colors.gold.border }]}
          accessibilityRole="button"
          accessibilityLabel="Call the concierge"
        >
          <Icon name="call-outline" size={18} color={colors.gold.primary} />
          <Text style={[styles.secondaryCtaText, { color: colors.text.primary }]}>
            Call the cellar instead
          </Text>
        </TouchableOpacity>

        {/* Reassurance */}
        <Text style={[styles.reassure, { color: colors.text.muted }]}>
          Private conversation. No chatbots, no scripts. Our curators have 10+ years in fine spirits.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  hero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  heroRule: {
    height: 1,
    width: 40,
    marginBottom: 12,
  },
  heroRuleBottom: {
    height: 1,
    width: 40,
    marginTop: 12,
    alignSelf: "flex-end",
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 14,
  },
  promptIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  promptLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  promptSub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  request: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 14,
    minHeight: 100,
    fontSize: 14,
    textAlignVertical: "top",
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  primaryCtaText: {
    color: "#050403",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  secondaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    marginTop: 10,
    borderWidth: 1,
  },
  secondaryCtaText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  reassure: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    fontStyle: "italic",
  },
});
