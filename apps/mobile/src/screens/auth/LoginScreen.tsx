import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Image,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { spacing, borderRadius, typography } from "../../theme";
import { Icon } from "../../components/Icon";
import { useAuth, TEST_USERS } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";

const { width, height } = Dimensions.get("window");

const ROLE_ICONS: Record<string, string> = {
  customer: "person-outline",
  driver: "car-outline",
  admin: "shield-checkmark-outline",
};

const ROLE_COLORS: Record<string, string> = {
  customer: "#D4AF37",
  driver: "#3B82F6",
  admin: "#10B981",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  customer: "Browse & Order",
  driver: "Deliver Orders",
  admin: "Manage Operations",
};

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { signInWithPhone } = useAuth();
  const { colors, gradients, shadows, isDark, toggleTheme } = useTheme();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  const logoGlow = useRef(new Animated.Value(0.3)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 800,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.spring(slideUp, {
        toValue: 0,
        tension: 40,
        friction: 8,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing gold glow behind the logo
    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, {
          toValue: 0.8,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(logoGlow, {
          toValue: 0.3,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    glowAnim.start();

    return () => { glowAnim.stop(); };
  }, []);

  const handlePressIn = useCallback(() => {
    Animated.spring(btnScale, {
      toValue: 0.96,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(btnScale, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, []);

  const formatPhoneDisplay = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, "");
    if (digits.length <= 10) {
      setPhone(digits);
      setError("");
    }
  };

  const handleSendOtp = async () => {
    if (phone.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // In DEV mode with a known test number, skip the real SMS
      if (__DEV__ && TEST_USERS.some((u) => u.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""))) {
        setOtpSent(true);
        return;
      }
      // Real Supabase OTP — normalize to E.164 international format
      const normalized = phone.replace(/\D/g, "");
      const e164 = normalized.startsWith("27") ? `+${normalized}` : `+27${normalized.replace(/^0/, "")}`;
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone: e164 });
      if (otpError) throw otpError;
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length < 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signInWithPhone(phone, otp);
    } catch (err: any) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (testPhone: string, role: string) => {
    const digits = testPhone.replace(/\D/g, "");
    setSelectedRole(role);
    setPhone(digits);
    setError("");
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      setOtpSent(true);
      setOtp("123456");
      await new Promise((r) => setTimeout(r, 400));
      await signInWithPhone(digits, "123456");
    } catch (err: any) {
      setError(err.message || "Quick login failed.");
      setOtpSent(false);
      setOtp("");
    } finally {
      setLoading(false);
      setSelectedRole(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Hero Banner with People */}
          <View style={st.heroBanner}>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80",
              }}
              style={st.heroImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={
                isDark
                  ? [
                      "transparent",
                      "rgba(5,4,3,0.35)",
                      "rgba(5,4,3,0.75)",
                      "rgba(5,4,3,0.98)",
                    ]
                  : [
                      "transparent",
                      "rgba(250,250,248,0.3)",
                      "rgba(250,250,248,0.7)",
                      "rgba(250,250,248,0.99)",
                    ]
              }
              locations={[0, 0.35, 0.65, 1]}
              style={st.heroOverlay}
            >
              {/* Theme toggle */}
              <TouchableOpacity
                style={[
                  st.themeToggle,
                  {
                    backgroundColor: "rgba(0,0,0,0.35)",
                  },
                ]}
                onPress={toggleTheme}
                activeOpacity={0.7}
              >
                <Icon
                  name={isDark ? "sunny-outline" : "moon-outline"}
                  size={18}
                  color="#FFF"
                />
              </TouchableOpacity>

              {/* Logo overlay at bottom of banner */}
              <Animated.View style={[st.logoArea, { opacity: fadeIn }]}>
                {/* Pulsing gold glow behind logo */}
                <Animated.View
                  style={[
                    st.logoGlow,
                    {
                      opacity: logoGlow,
                      backgroundColor: colors.gold.glow,
                    },
                  ]}
                />
                <Image
                  source={require("../../../assets/liqzar-logo.png")}
                  style={st.logo}
                  resizeMode="contain"
                />
                <Text style={[st.brand, { color: colors.text.primary }]}>
                  LIQZAR
                </Text>
                {/* Gold line separator */}
                <View
                  style={[
                    st.goldSeparator,
                    { backgroundColor: colors.gold.primary },
                  ]}
                />
                <Text style={[st.tagline, { color: colors.gold.primary }]}>
                  — RESERVE THE FINEST.
                </Text>
              </Animated.View>
            </LinearGradient>
          </View>

          {/* Form section */}
          <Animated.View
            style={[
              st.formSection,
              {
                backgroundColor: colors.background.secondary,
                opacity: fadeIn,
                transform: [{ translateY: slideUp }],
              },
            ]}
          >
            {/* Subtle inner shadow at top */}
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(0,0,0,0.25)", "rgba(0,0,0,0)"]
                  : ["rgba(0,0,0,0.04)", "rgba(0,0,0,0)"]
              }
              style={st.formInnerShadow}
            />

            <Text style={[st.heading, { color: colors.text.primary }]}>
              {otpSent ? "Verify your code" : "Welcome back"}
            </Text>

            {/* Error */}
            {error ? (
              <View
                style={[
                  st.errorBox,
                  {
                    backgroundColor: "rgba(239,68,68,0.08)",
                    borderColor: "rgba(239,68,68,0.2)",
                  },
                ]}
              >
                <Icon name="alert-circle" size={16} color="#EF4444" />
                <Text style={{ color: "#EF4444", fontSize: 13, flex: 1 }}>
                  {error}
                </Text>
              </View>
            ) : null}

            {/* Phone input */}
            {!otpSent && (
              <View style={st.inputWrap}>
                <Text style={[st.label, { color: colors.gold.muted }]}>
                  PHONE NUMBER
                </Text>
                <View
                  style={[
                    st.phoneRow,
                    {
                      backgroundColor: colors.background.secondary,
                      borderColor: phoneFocused
                        ? colors.gold.primary
                        : colors.gold.border,
                    },
                    phoneFocused && {
                      shadowColor: colors.gold.primary,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    },
                  ]}
                >
                  <View style={st.cc}>
                    <Text style={st.flag}>🇿🇦</Text>
                    <Text style={[st.ccText, { color: colors.text.primary }]}>
                      +27
                    </Text>
                  </View>
                  <View
                    style={[st.sep, { backgroundColor: colors.gold.border }]}
                  />
                  <TextInput
                    style={[st.phoneIn, { color: colors.text.primary }]}
                    placeholder="079 077 1591"
                    placeholderTextColor={colors.text.dim}
                    keyboardType="phone-pad"
                    value={formatPhoneDisplay(phone)}
                    onChangeText={handlePhoneChange}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                    maxLength={12}
                    selectionColor={colors.gold.primary}
                  />
                </View>
              </View>
            )}

            {/* OTP input */}
            {otpSent && (
              <View style={st.inputWrap}>
                <Text style={[st.label, { color: colors.gold.muted }]}>
                  ENTER 6-DIGIT CODE
                </Text>
                <TextInput
                  style={[
                    st.otpIn,
                    {
                      backgroundColor: colors.background.secondary,
                      color: colors.text.primary,
                      borderColor: otpFocused
                        ? colors.gold.primary
                        : colors.gold.border,
                    },
                    otpFocused && {
                      shadowColor: colors.gold.primary,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4,
                    },
                  ]}
                  placeholder="• • • • • •"
                  placeholderTextColor={colors.text.dim}
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={(t) => {
                    if (t.length <= 6) {
                      setOtp(t.replace(/\D/g, ""));
                      setError("");
                    }
                  }}
                  onFocus={() => setOtpFocused(true)}
                  onBlur={() => setOtpFocused(false)}
                  maxLength={6}
                  autoFocus
                />
              </View>
            )}

            {/* Primary button with scale animation */}
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                onPress={otpSent ? handleVerify : handleSendOtp}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[...gradients.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    st.primaryBtn,
                    shadows.goldSubtle as any,
                    loading && { opacity: 0.5 },
                  ]}
                >
                  <Text style={st.primaryBtnText}>
                    {loading
                      ? "Please wait..."
                      : otpSent
                        ? "Verify & Sign In"
                        : "Send OTP"}
                  </Text>
                  {!loading && (
                    <Icon name="arrow-forward" size={18} color="#050403" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Back to phone */}
            {otpSent && (
              <TouchableOpacity
                onPress={() => {
                  setOtpSent(false);
                  setOtp("");
                  setError("");
                }}
                style={st.backBtn}
                activeOpacity={0.7}
              >
                <Icon name="arrow-back" size={16} color={colors.gold.muted} />
                <Text style={{ color: colors.gold.muted, fontSize: 14 }}>
                  Change number
                </Text>
              </TouchableOpacity>
            )}

            {/* OR + email */}
            {!otpSent && (
              <>
                <View style={st.orRow}>
                  <View
                    style={[st.orLine, { backgroundColor: colors.gold.border }]}
                  />
                  <Text style={[st.orText, { color: colors.text.dim }]}>
                    OR
                  </Text>
                  <View
                    style={[st.orLine, { backgroundColor: colors.gold.border }]}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => navigation.navigate("SignUp")}
                  activeOpacity={0.8}
                  style={[st.emailBtn, { borderColor: colors.gold.border }]}
                >
                  <Icon name="mail-outline" size={18} color={colors.gold.primary} />
                  <Text style={{ color: colors.gold.primary, fontWeight: "600", fontSize: 15 }}>
                    Sign in with email
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Quick Login - Test Roles */}
            {!otpSent && __DEV__ && (
              <View style={st.quickSection}>
                <View style={st.quickHeader}>
                  <View
                    style={[
                      st.quickBadge,
                      {
                        backgroundColor: colors.gold.faint,
                      },
                    ]}
                  >
                    <Icon name="flash-outline" size={14} color={colors.gold.primary} />
                    <Text style={[st.quickBadgeText, { color: colors.gold.primary }]}>
                      QUICK LOGIN
                    </Text>
                  </View>
                  <Text style={[st.quickHint, { color: colors.text.dim }]}>
                    Test OTP: 123456
                  </Text>
                </View>

                <View style={st.roleGrid}>
                  {TEST_USERS.map((user) => {
                    const isLoading = selectedRole === user.role;
                    const roleColor = ROLE_COLORS[user.role] || colors.gold.primary;
                    const roleDesc = ROLE_DESCRIPTIONS[user.role] || "";
                    return (
                      <TouchableOpacity
                        key={user.role}
                        style={[
                          st.roleCard,
                          {
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.border,
                          },
                          isLoading && {
                            borderColor: roleColor,
                            borderWidth: 1.5,
                          },
                        ]}
                        onPress={() => handleQuickLogin(user.phone, user.role)}
                        disabled={loading}
                        activeOpacity={0.75}
                      >
                        {/* Subtle gradient background matching role color */}
                        <LinearGradient
                          colors={[roleColor + "0D", "transparent"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <View
                          style={[
                            st.roleIconCircle,
                            {
                              backgroundColor: roleColor + "18",
                            },
                          ]}
                        >
                          <Icon
                            name={ROLE_ICONS[user.role] || "person-outline"}
                            size={22}
                            color={roleColor}
                          />
                        </View>
                        <Text
                          style={[st.roleLabel, { color: colors.text.primary }]}
                          numberOfLines={1}
                        >
                          {user.label}
                        </Text>
                        <Text
                          style={[st.roleDesc, { color: roleColor }]}
                          numberOfLines={1}
                        >
                          {roleDesc}
                        </Text>
                        <Text
                          style={[st.rolePhone, { color: colors.text.dim }]}
                          numberOfLines={1}
                        >
                          {user.phone}
                        </Text>
                        {isLoading && (
                          <View style={[st.roleLoading, { backgroundColor: roleColor }]}>
                            <Text style={st.roleLoadingText}>Signing in...</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </Animated.View>

          {/* Footer */}
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.xl,
              backgroundColor: colors.background.secondary,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.text.dim, textAlign: "center" }}>
              By signing in you agree to our{" "}
              <Text style={{ color: colors.gold.muted }}>Terms of Service</Text>
            </Text>
            <View style={st.footerBrand}>
              <Text style={[st.footerPowered, { color: colors.gold.border }]}>
                Powered by LIQZAR
              </Text>
              <Text style={[st.footerVersion, { color: colors.gold.border }]}>
                v2.0
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  heroBanner: {
    width: width,
    height: height * 0.45,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 30,
  },
  themeToggle: {
    position: "absolute",
    top: 54,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 16,
  },
  logoGlow: {
    position: "absolute",
    top: -10,
    width: 120,
    height: 120,
    borderRadius: borderRadius.full,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 8,
  },
  brand: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 8,
  },
  goldSeparator: {
    width: 40,
    height: 1.5,
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 1,
  },
  tagline: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    marginTop: 2,
  },
  formSection: {
    marginTop: -16,
    borderTopLeftRadius: borderRadius.full,
    borderTopRightRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    position: "relative",
    overflow: "hidden",
  },
  formInnerShadow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 12,
    borderTopLeftRadius: borderRadius.full,
    borderTopRightRadius: borderRadius.full,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    gap: 8,
  },
  inputWrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 58,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  cc: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 6,
  },
  flag: { fontSize: 24 },
  ccText: { fontSize: 17, fontWeight: "600" },
  sep: { width: 1, height: 28 },
  phoneIn: {
    flex: 1,
    height: 58,
    paddingHorizontal: 14,
    fontSize: 17,
    letterSpacing: 1,
  },
  otpIn: {
    height: 58,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    height: 58,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#050403",
  },
  backBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
    paddingVertical: 6,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
  },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 12, fontWeight: "600", marginHorizontal: 14 },
  emailBtn: {
    flexDirection: "row",
    height: 58,
    borderWidth: 1.5,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  // Quick login section
  quickSection: {
    marginTop: 20,
  },
  quickHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  quickBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.xl,
    gap: 5,
  },
  quickBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  quickHint: {
    fontSize: 11,
    fontStyle: "italic",
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roleCard: {
    width: (width - spacing.lg * 2 - 10) / 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 18,
    position: "relative",
    overflow: "hidden",
  },
  roleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  roleDesc: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  rolePhone: {
    fontSize: 12,
  },
  roleLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: borderRadius.md,
    opacity: 0.92,
  },
  roleLoadingText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // Footer
  footerBrand: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    gap: 8,
  },
  footerPowered: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1,
  },
  footerVersion: {
    fontSize: 10,
    fontWeight: "600",
  },
});
