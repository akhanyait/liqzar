import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "../components/Icon";
import BrandMark from "../components/BrandMark";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, borderRadius, typography, opacity } from "../theme";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";

// ─── Types ───────────────────────────────────────────────

interface Referral {
  id: string;
  referred_id: string;
  status: "pending" | "signed_up" | "first_order" | "reward_issued";
  reward_amount: number;
  created_at: string;
  referred_name?: string;
}

interface ReferralStats {
  totalReferred: number;
  completed: number;
  pending: number;
  totalEarned: number;
}

const STEPS = [
  {
    id: "step1",
    number: "1",
    title: "Share your code",
    description: "Send your unique code to friends via WhatsApp, SMS, or email",
  },
  {
    id: "step2",
    number: "2",
    title: "Friend orders",
    description:
      "Your friend signs up and places their first order using your code",
  },
  {
    id: "step3",
    number: "3",
    title: "You both get R50",
    description: "You each receive R50 credit -- it's a win-win!",
  },
];

const SHARE_OPTIONS = [
  { id: "s1", label: "WhatsApp", icon: "logo-whatsapp" as any, color: "#25D366" },
  { id: "s2", label: "SMS", icon: "chatbubble-outline" as any, color: "#3B82F6" },
  { id: "s3", label: "Email", icon: "mail-outline" as any, color: "#F59E0B" },
  { id: "s4", label: "More", icon: "share-outline" as any, color: "#8B5CF6" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#3B82F6" },
  signed_up: { label: "Signed up", color: "#3B82F6" },
  first_order: { label: "First order", color: "#F59E0B" },
  reward_issued: { label: "Reward earned", color: "#10B981" },
};

// ─── Component ───────────────────────────────────────────────

export default function ReferralScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState("");
  const [stats, setStats] = useState<ReferralStats>({
    totalReferred: 0,
    completed: 0,
    pending: 0,
    totalEarned: 0,
  });
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);

  const cardBg = colors.background.secondary;
  const screenBg = colors.background.primary;
  const cardBorder = colors.gold.border;
  const gold = colors.gold.primary;
  const textPrimary = colors.text.primary;
  const textMuted = colors.text.muted;

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    setLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      // Get or create referral code
      let { data: codeData } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!codeData) {
        const code = `LIQZAR${userId?.substring(0, 6).toUpperCase()}`;
        const { data: newCode } = await supabase
          .from('referral_codes')
          .insert({ user_id: userId, code, reward_amount: 50 })
          .select()
          .single();
        codeData = newCode;
      }

      setReferralCode(codeData?.code || '');

      // Get referral stats
      const { data: referralData } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', userId);

      const refs = referralData || [];
      setStats({
        totalReferred: refs.length,
        completed: refs.filter((r: any) => r.status === 'reward_issued').length,
        pending: refs.filter((r: any) => r.status === 'pending').length,
        totalEarned: refs.filter((r: any) => r.status === 'reward_issued').reduce((s: number, r: any) => s + (r.reward_amount || 0), 0),
      });
      setReferrals(refs);
    } catch (error) {
      console.error('Error fetching referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    try {
      Alert.alert("Copied!", "Referral code copied to clipboard");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying:', error);
    }
  };

  const shareCode = async () => {
    try {
      await Share.share({
        message: `Get R50 off your first LIQZAR order! Use my referral code: ${referralCode}. Download now!`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleShare = (option: typeof SHARE_OPTIONS[0]) => {
    shareCode();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // ─── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[st.root, { backgroundColor: screenBg, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={gold} />
        <Text style={{ color: textMuted, marginTop: 12 }}>Loading referrals...</Text>
      </View>
    );
  }

  return (
    <View style={[st.root, { backgroundColor: screenBg }]}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? [colors.background.tertiary, colors.background.secondary] : [colors.background.primary, "#F9F8F5"]}
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
          <View style={{ alignItems: "center" }}>
            <BrandMark size="xs" />
            <Text style={[st.headerTitle, { color: textPrimary }]}>
              Refer & Earn
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      >
        {/* ── Hero Section ── */}
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: 20,
            alignItems: "center",
          }}
        >
          <View
            style={[
              st.heroIcon,
              {
                backgroundColor: colors.gold.faint,
              },
            ]}
          >
            <Icon name="gift" size={48} color={gold} />
          </View>
          <Text style={[st.heroTitle, { color: textPrimary }]}>
            Give R50, Get R50
          </Text>
          <Text style={[st.heroSub, { color: textMuted }]}>
            Invite friends to LIQZAR and you both earn R50 credit on their first
            order.
          </Text>
        </View>

        {/* ── Referral Code Card ── */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
          <View
            style={[
              st.card,
              { backgroundColor: cardBg, borderColor: cardBorder },
            ]}
          >
            <Text style={[st.codeLabel, { color: textMuted }]}>
              Your Referral Code
            </Text>
            <View style={st.codeRow}>
              <Text style={[st.codeValue, { color: gold }]}>
                {referralCode}
              </Text>
              <TouchableOpacity
                onPress={copyCode}
                style={[
                  st.copyBtn,
                  {
                    backgroundColor: copied
                      ? colors.status.success
                      : colors.gold.faint,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Icon
                  name={copied ? "checkmark" : "copy-outline"}
                  size={16}
                  color={copied ? colors.white : gold}
                />
                <Text
                  style={{
                    ...typography.caption,
                    fontWeight: "700",
                    color: copied ? colors.white : gold,
                    marginLeft: spacing.xs,
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Share Buttons ── */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <View style={st.shareRow}>
            {SHARE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                onPress={() => handleShare(opt)}
                style={st.shareBtn}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    st.shareIconBg,
                    { backgroundColor: opt.color + "18" },
                  ]}
                >
                  <Icon name={opt.icon} size={22} color={opt.color} />
                </View>
                <Text style={[st.shareLabel, { color: textMuted }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── How it Works ── */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.lg }}>
          <Text style={[st.sectionTitle, { color: textPrimary }]}>
            How it Works
          </Text>
          {STEPS.map((step, idx) => (
            <View key={step.id} style={st.stepRow}>
              <View style={st.stepLeft}>
                <View style={[st.stepCircle, { backgroundColor: gold }]}>
                  <Text style={st.stepNumber}>{step.number}</Text>
                </View>
                {idx < STEPS.length - 1 && (
                  <View
                    style={[
                      st.stepLine,
                      {
                        backgroundColor: colors.gold.glow,
                      },
                    ]}
                  />
                )}
              </View>
              <View style={st.stepContent}>
                <Text style={[st.stepTitle, { color: textPrimary }]}>
                  {step.title}
                </Text>
                <Text style={[st.stepDesc, { color: textMuted }]}>
                  {step.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Stats Card ── */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: 20 }}>
          <Text style={[st.sectionTitle, { color: textPrimary }]}>
            Your Stats
          </Text>
          <View
            style={[
              st.card,
              { backgroundColor: cardBg, borderColor: cardBorder },
            ]}
          >
            <View style={st.statsRow}>
              <View style={st.statItem}>
                <Text style={[st.statValue, { color: textPrimary }]}>
                  {stats.totalReferred}
                </Text>
                <Text style={[st.statLabel, { color: textMuted }]}>
                  Total Referrals
                </Text>
              </View>
              <View
                style={[
                  st.statDivider,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.08)",
                  },
                ]}
              />
              <View style={st.statItem}>
                <Text style={[st.statValue, { color: colors.status.success }]}>
                  R{stats.totalEarned}
                </Text>
                <Text style={[st.statLabel, { color: textMuted }]}>
                  Earnings
                </Text>
              </View>
              <View
                style={[
                  st.statDivider,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.08)",
                  },
                ]}
              />
              <View style={st.statItem}>
                <Text style={[st.statValue, { color: colors.status.warning }]}>
                  {stats.pending}
                </Text>
                <Text style={[st.statLabel, { color: textMuted }]}>
                  Pending
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Your Referrals ── */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: 20 }}>
          <Text style={[st.sectionTitle, { color: textPrimary }]}>
            Your Referrals
          </Text>
          {referrals.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <Icon name="people-outline" size={40} color={colors.gold.glow} />
              <Text style={{ fontSize: 13, color: textMuted, marginTop: spacing.sm }}>No referrals yet</Text>
              <Text style={{ ...typography.caption, color: textMuted, marginTop: spacing.xs }}>Share your code to start earning!</Text>
            </View>
          ) : (
            referrals.map((ref) => {
              const status = STATUS_MAP[ref.status] || STATUS_MAP.pending;
              return (
                <View
                  key={ref.id}
                  style={[
                    st.refRow,
                    {
                    borderBottomColor: isDark
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.06)",
                    },
                  ]}
                >
                  <View
                    style={[
                      st.refAvatar,
                      {
                        backgroundColor: colors.gold.faint,
                      },
                    ]}
                  >
                    <Text
                      style={{ fontSize: 13, fontWeight: "800", color: gold }}
                    >
                      {getInitials(ref.referred_name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[st.refName, { color: textPrimary }]}>
                      {ref.referred_name || 'Referred User'}
                    </Text>
                    <Text style={{ fontSize: 11, color: textMuted }}>
                      {formatDate(ref.created_at)}
                    </Text>
                  </View>
                  <View
                    style={[
                      st.refStatusBadge,
                      { backgroundColor: status.color + "18" },
                    ]}
                  >
                    <Text style={[st.refStatusText, { color: status.color }]}>
                      {status.label}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── Terms Link ── */}
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.lg,
            alignItems: "center",
          }}
        >
          <TouchableOpacity activeOpacity={0.7}>
            <Text
              style={{
                fontSize: 13,
                color: textMuted,
                textDecorationLine: "underline",
              }}
            >
              Terms & Conditions apply
            </Text>
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
    padding: spacing.md,
    marginBottom: 12,
  },

  // Hero
  heroIcon: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h2,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  heroSub: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },

  // Referral code
  codeLabel: { ...typography.caption, fontWeight: "600", marginBottom: 10 },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeValue: { fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },

  // Share
  shareRow: { flexDirection: "row", justifyContent: "space-around" },
  shareBtn: { alignItems: "center", gap: 6 },
  shareIconBg: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  shareLabel: { fontSize: 11, fontWeight: "600" },

  // Steps
  stepRow: { flexDirection: "row", marginBottom: spacing.xs },
  stepLeft: { alignItems: "center", width: 36 },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumber: { fontSize: 13, fontWeight: "900", color: "#000" },
  stepLine: { width: 2, flex: 1, marginVertical: spacing.xs },
  stepContent: { flex: 1, marginLeft: 12, paddingBottom: 20 },
  stepTitle: { fontSize: 15, fontWeight: "800", marginBottom: spacing.xs },
  stepDesc: { fontSize: 13, lineHeight: 18 },

  // Stats
  statsRow: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { ...typography.h2, fontWeight: "900", marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: "600" },
  statDivider: { width: 1, height: 36 },

  // Referrals list
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  refAvatar: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  refName: { ...typography.label, fontWeight: "700", marginBottom: 2 },
  refStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  refStatusText: { fontSize: 11, fontWeight: "700" },
});
