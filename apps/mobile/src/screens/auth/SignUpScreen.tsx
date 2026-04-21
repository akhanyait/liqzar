import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { spacing, borderRadius, typography } from "../../theme";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function SignUpScreen() {
  const navigation = useNavigation<any>();
  const { signUp } = useAuth();
  const { colors, gradients, shadows, isDark } = useTheme();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const isValidEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleSignUp = async () => {
    setError("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim() || !isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      await signUp(email.trim().toLowerCase(), password, fullName.trim());
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[...gradients.background]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backButton, { backgroundColor: colors.background.elevated, borderColor: colors.gold.border }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={[...gradients.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.logoGradient, shadows.goldSubtle]}
            >
              <Text style={[styles.logoLetter, { color: colors.text.inverse }]}>L</Text>
            </LinearGradient>
          </View>

          <Text style={[styles.title, { color: colors.text.primary }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.gold.muted }]}>
            Join LIQZAR for premium spirits delivery
          </Text>

          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={18} color={colors.status.error} />
              <Text style={[styles.errorText, { color: colors.status.error }]}>{error}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.formContainer}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>Full Name</Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.background.tertiary },
                  {
                    borderColor: nameFocused
                      ? colors.gold.primary
                      : colors.gold.border,
                  },
                ]}
              >
                <Icon
                  name="person-outline"
                  size={20}
                  color={nameFocused ? colors.gold.primary : colors.text.dim}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.textInput, { color: colors.text.primary }]}
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.text.dim}
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    setError("");
                  }}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  autoCapitalize="words"
                  selectionColor={colors.gold.primary}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>Email Address</Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.background.tertiary },
                  {
                    borderColor: emailFocused
                      ? colors.gold.primary
                      : colors.gold.border,
                  },
                ]}
              >
                <Icon
                  name="mail-outline"
                  size={20}
                  color={emailFocused ? colors.gold.primary : colors.text.dim}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.textInput, { color: colors.text.primary }]}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.text.dim}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError("");
                  }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  selectionColor={colors.gold.primary}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>Password</Text>
              <View
                style={[
                  styles.inputRow,
                  { backgroundColor: colors.background.tertiary },
                  {
                    borderColor: passwordFocused
                      ? colors.gold.primary
                      : colors.gold.border,
                  },
                ]}
              >
                <Icon
                  name="lock-closed-outline"
                  size={20}
                  color={
                    passwordFocused ? colors.gold.primary : colors.text.dim
                  }
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.textInput, { color: colors.text.primary, flex: 1 }]}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={colors.text.dim}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError("");
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  selectionColor={colors.gold.primary}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon
                    name={showPassword ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={colors.text.dim}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Create Account Button */}
            <TouchableOpacity
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.8}
              style={[
                styles.buttonWrapper,
                shadows.gold,
                loading && { opacity: 0.6 },
              ]}
            >
              <LinearGradient
                colors={[...gradients.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Text style={[styles.buttonText, { color: colors.text.inverse }]}>
                  {loading ? "Creating Account..." : "Create Account"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Sign In Link */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.signInLink}
              disabled={loading}
            >
              <Text style={[styles.signInText, { color: colors.text.dim }]}>
                Already have an account?{" "}
                <Text style={[styles.signInHighlight, { color: colors.gold.primary }]}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Disclaimer */}
          <Text style={[styles.disclaimer, { color: colors.text.dim }]}>
            By creating an account, you agree to our Terms of Service and
            Privacy Policy. You must be 18+ to purchase alcohol.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Header
  header: {
    paddingTop: Platform.OS === "ios" ? 56 : spacing.lg,
    marginBottom: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Logo
  logoContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  logoGradient: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  logoLetter: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
  },

  // Title
  title: {
    ...typography.h1,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    textAlign: "center",
    marginBottom: spacing.xl,
  },

  // Error
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: 8,
  },
  errorText: {
    ...typography.bodySmall,
    flex: 1,
  },

  // Form
  formContainer: {
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.caption,
    fontWeight: "600",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    height: 56,
    ...typography.body,
  },

  // Button
  buttonWrapper: {
    height: 56,
    borderRadius: borderRadius.full,
    overflow: "hidden",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: borderRadius.full,
  },
  buttonText: {
    ...typography.button,
  },

  // Sign In Link
  signInLink: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  signInText: {
    ...typography.bodySmall,
  },
  signInHighlight: {
    fontWeight: "600",
  },

  // Disclaimer
  disclaimer: {
    ...typography.caption,
    textAlign: "center",
    lineHeight: 18,
    marginTop: spacing.md,
  },
});
