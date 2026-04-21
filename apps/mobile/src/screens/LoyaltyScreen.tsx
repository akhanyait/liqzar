import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, borderRadius, typography, opacity, animation } from "../theme";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";

// ─── Types ───────────────────────────────────────────────

interface LoyaltyTransaction {
  id: string;
  description: string;
  points: number;
  type: "earned" | "redeemed";
  created_at: string;
}

const EARN_METHODS = [
  {
    id: "e1",
    icon: "cart-outline" as any,
    title: "R1 = 1 Point",
    subtitle: "Earn on every purchase",
  },
  {
    id: "e2",
    icon: "star-outline" as any,
    title: "Review = 50 Points",
    subtitle: "Rate products you've tried",
  },
  {
    id: "e3",
    icon: "people-outline" as any,
    title: "Refer = 500 Points",
    subtitle: "Invite friends to LIQZAR",
  },
];

const TIER_THRESHOLDS: Record<string, { next: string; threshold: number }> = {
  bronze: { next: "Silver", threshold: 1000 },
  silver: { next: "Gold", threshold: 2500 },
  gold: { next: "Platinum", threshold: 5000 },
  platinum: { next: "Diamond", threshold: 10000 },
  diamond: { next: "Diamond", threshold: 10000 },
};

// ─── Component ───────────────────────────────────────────────

export default function LoyaltyScreen() {
  const { colors, isDark, gradients } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [tier, setTier] = useState("bronze");
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);

  const cardBg = colors.background.tertiary;
  const screenBg = colors.background.secondary;
  const cardBorder = colors.gold.border;
  const gold = colors.gold.primary;
  const textPrimary = colors.text.primary;
  const textMuted = colors.text.muted;

  useEffect(() => {
    fetchLoyaltyData();
  }, []);

  const fetchLoyaltyData = async () => {
    setLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      // Get or create loyalty account
      let { data: account } = await supabase
        .from('loyalty_accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!account) {
        const { data: newAccount } = await supabase
          .from('loyalty_accounts')
          .insert({ user_id: userId, points_balance: 0, tier: 'bronze', lifetime_points: 0 })
          .select()
          .single();
        account = newAccount;
      }

      setPointsBalance(account?.points_balance || 0);
      setTier(account?.tier || 'bronze');
      setLifetimePoints(account?.lifetime_points || 0);

      // Get transaction history
      const { data: txData } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      setTransactions(txData || []);
    } catch (error) {
      console.error('Error fetching loyalty:', error);
    } finally {
      setLoading(false);
    }
  };

  const tierInfo = TIER_THRESHOLDS[tier] || TIER_THRESHOLDS.bronze;
  const progressPercent = Math.min((lifetimePoints / tierInfo.threshold) * 100, 100);
  const pointsValue = Math.floor(pointsBalance / 10);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ─── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[st.root, { backgroundColor: screenBg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={gold} />
        <Text style={{ color: textMuted, marginTop: 12 }}>Loading rewards...</Text>
      </View>
    );
  }

  return (
    <View style={[st.root, { backgroundColor: screenBg }]}>
      {/* Header */}
      <LinearGradient
        colors={[...gradients.card] as [string, string]}
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.md,
          paddingHorizontal: spacing.md,
        }}
      >
        <View style={st.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={st.backBtn}
          >
            <Icon name="arrow-back" size={22} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: textPrimary }]}>
            LIQZAR Rewards
          </Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      >
        {/* ── Points Balance Card ── */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: 20 }}>
          <LinearGradient
            colors={[...gradients.gold] as [string, string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.pointsCard}
          >
            <View style={st.pointsIconRow}>
              <View style={st.pointsIconBg}>
                <Icon name="diamond" size={28} color={gold} />
              </View>
            </View>
            <Text style={st.pointsLabel}>Your Points Balance</Text>
            <Text style={st.pointsValue}>
              {pointsBalance.toLocaleString()} Points
            </Text>
            <Text style={st.pointsEquiv}>= R{pointsValue} value</Text>
          </LinearGradient>
        </View>

        {/* ── Tier Badge & Progress ── */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <View
            style={[
              st.card,
              { backgroundColor: cardBg, borderColor: cardBorder },
            ]}
          >
            <View style={st.tierRow}>
              <View style={st.tierBadge}>
                <Icon name="shield-checkmark" size={20} color={gold} />
                <Text style={[st.tierText, { color: gold }]}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)} Member
                </Text>
              </View>
              <Text style={{ ...typography.caption, color: textMuted }}>
                Next: {tierInfo.next} at{" "}
                {tierInfo.threshold.toLocaleString()} pts
              </Text>
            </View>

            {/* Progress bar */}
            <View style={st.progressContainer}>
              <View
                style={[
                  st.progressTrack,
                  {
                    backgroundColor: colors.gold.faint,
                  },
                ]}
              >
                <LinearGradient
                  colors={[colors.gold.primary, colors.gold.dark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    st.progressFill,
                    { width: `${progressPercent}%` as any },
                  ]}
                />
              </View>
              <View style={st.progressLabels}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: gold }}>
                  {lifetimePoints.toLocaleString()}
                </Text>
                <Text style={{ fontSize: 11, color: textMuted }}>
                  {tierInfo.threshold.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── How to Earn ── */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: 20 }}>
          <Text style={[st.sectionTitle, { color: textPrimary }]}>
            How to Earn
          </Text>
          <View style={st.earnRow}>
            {EARN_METHODS.map((method) => (
              <View
                key={method.id}
                style={[
                  st.earnCard,
                  { backgroundColor: cardBg, borderColor: cardBorder },
                ]}
              >
                <View
                  style={[
                    st.earnIconBg,
                    {
                      backgroundColor: colors.gold.faint,
                    },
                  ]}
                >
                  <Icon name={method.icon} size={22} color={gold} />
                </View>
                <Text
                  style={[st.earnTitle, { color: textPrimary }]}
                  numberOfLines={1}
                >
                  {method.title}
                </Text>
                <Text
                  style={[st.earnSub, { color: textMuted }]}
                  numberOfLines={2}
                >
                  {method.subtitle}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Transaction History ── */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: 20 }}>
          <Text style={[st.sectionTitle, { color: textPrimary }]}>
            Transaction History
          </Text>
          {transactions.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <Icon name="receipt-outline" size={40} color={colors.gold.glow} />
              <Text style={{ fontSize: 13, color: textMuted, marginTop: spacing.sm }}>No transactions yet</Text>
              <Text style={{ ...typography.caption, color: textMuted, marginTop: spacing.xs }}>Start earning points with your next order!</Text>
            </View>
          ) : (
            transactions.map((tx) => (
              <View
                key={tx.id}
                style={[
                  st.txRow,
                  {
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    st.txIcon,
                    {
                      backgroundColor:
                        tx.type === "earned"
                          ? "rgba(16,185,129,0.12)"
                          : "rgba(239,68,68,0.12)",
                    },
                  ]}
                >
                  <Icon
                    name={
                      tx.type === "earned"
                        ? "arrow-down-outline"
                        : "arrow-up-outline"
                    }
                    size={16}
                    color={tx.type === "earned" ? colors.status.success : colors.status.error}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[st.txDesc, { color: textPrimary }]}>
                    {tx.description}
                  </Text>
                  <Text style={{ fontSize: 11, color: textMuted }}>
                    {formatDate(tx.created_at)}
                  </Text>
                </View>
                <Text
                  style={[
                    st.txPoints,
                    {
                      color: tx.type === "earned" ? colors.status.success : colors.status.error,
                    },
                  ]}
                >
                  {tx.type === "earned" ? "+" : ""}
                  {tx.points}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ── Refer a Friend Banner ── */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('Referral')}>
            <LinearGradient
              colors={[...gradients.card] as [string, string]}
              style={[st.referBanner, { borderColor: gold }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={st.referContent}>
                <View
                  style={[
                    st.referIconBg,
                    { backgroundColor: colors.gold.glow },
                  ]}
                >
                  <Icon name="people" size={26} color={gold} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[st.referTitle, { color: textPrimary }]}>
                    Refer a Friend
                  </Text>
                  <Text style={{ fontSize: 13, color: textMuted }}>
                    Give R50, Get R50 for each referral
                  </Text>
                </View>
                <Icon name="chevron-forward" size={20} color={gold} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
    borderRadius: borderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { ...typography.h3, fontWeight: "800" },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 14 },

  // Card base
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },

  // Points balance card
  pointsCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: "center",
  },
  pointsIconRow: { marginBottom: 12 },
  pointsIconBg: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.xl,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  pointsLabel: { fontSize: 13, fontWeight: "600", color: "#000", opacity: 0.7 },
  pointsValue: {
    ...typography.h1,
    fontWeight: "900",
    color: "#000",
    marginTop: spacing.xs,
  },
  pointsEquiv: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
    opacity: 0.6,
    marginTop: spacing.xs,
  },

  // Tier
  tierRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  tierBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  tierText: { ...typography.button, fontWeight: "800" },

  // Progress bar
  progressContainer: { marginTop: spacing.xs },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: 10,
    borderRadius: 5,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },

  // Earn
  earnRow: { flexDirection: "row", gap: 10 },
  earnCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
  earnIconBg: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  earnTitle: {
    ...typography.caption,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 2,
  },
  earnSub: { fontSize: 10, textAlign: "center" },

  // Transactions
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  txIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  txDesc: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
  txPoints: { fontSize: 15, fontWeight: "800" },

  // Refer banner
  referBanner: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  referContent: { flexDirection: "row", alignItems: "center" },
  referIconBg: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  referTitle: { ...typography.button, fontWeight: "800", marginBottom: 2 },
});
