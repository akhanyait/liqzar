import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Linking,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, typography, spacing, shadows } from "../theme";

interface AgeGateProps {
  onVerified: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AgeGate({ onVerified }: AgeGateProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const glowPulse = useRef(new Animated.Value(0.07)).current;

  useEffect(() => {
    // Entry: fade + scale combined
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1.0,
        duration: 900,
        useNativeDriver: true,
      }),
    ]).start();

    // Inner glow circle pulsing loop
    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.12,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.07,
          duration: 2400,
          useNativeDriver: true,
        }),
      ]),
    );
    glowAnim.start();

    return () => { glowAnim.stop(); };
  }, [fadeAnim, scaleAnim, glowPulse]);

  const handleVerify = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onVerified();
    });
  };

  const handleExit = () => {
    Linking.openURL("https://www.google.com");
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1a1510", "#0d0b08", "#050403"]}
        style={styles.gradient}
      >
        {/* Multiple gold ambient glow circles */}
        <View style={styles.glowWrapper}>
          <View style={styles.glowCircleOuter} />
          <View style={styles.glowCircleMiddle} />
          <Animated.View
            style={[styles.glowCircleInner, { opacity: glowPulse }]}
          />
        </View>

        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Logo with gold ring */}
          <View style={styles.logoContainer}>
            <View style={styles.logoRing}>
              <Image
                source={require("../../assets/liqzar-logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Brand name */}
          <Text style={styles.brandName}>LIQZAR</Text>

          {/* Tagline */}
          <Text style={styles.tagline}>— RESERVE THE FINEST.</Text>

          {/* Divider with question */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerSegment}>
              <View style={styles.dividerDot} />
              <View style={styles.dividerLine} />
            </View>
            <Text style={styles.dividerText}>ARE YOU 18 OR OLDER?</Text>
            <View style={styles.dividerSegment}>
              <View style={styles.dividerLine} />
              <View style={styles.dividerDot} />
            </View>
          </View>

          <Text style={styles.disclaimer}>
            You must be of legal drinking age to enter
          </Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.yesButton, styles.yesButtonShadow]}
              onPress={handleVerify}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[...gradients.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.yesGradient}
              >
                <Text style={styles.yesButtonText}>Yes, I'm 18+</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.noButton}
              onPress={handleExit}
              activeOpacity={0.8}
            >
              <Text style={styles.noButtonText}>No, I'm under 18</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.legalText}>
            Not for sale to persons under the age of 18
          </Text>
          <Text style={styles.footerText}>Drink Responsibly</Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  glowWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  glowCircleOuter: {
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_WIDTH * 1.2,
    borderRadius: SCREEN_WIDTH * 0.6,
    backgroundColor: colors.gold.primary,
    opacity: 0.03,
    position: "absolute",
    top: "10%",
  },
  glowCircleMiddle: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: SCREEN_WIDTH * 0.45,
    backgroundColor: colors.gold.primary,
    opacity: 0.05,
    position: "absolute",
    top: "15%",
  },
  glowCircleInner: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    borderRadius: SCREEN_WIDTH * 0.3,
    backgroundColor: colors.gold.primary,
    opacity: 0.07,
    position: "absolute",
    top: "22%",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    maxWidth: 400,
    width: "100%",
  },

  /* Logo */
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logoRing: {
    borderWidth: 2,
    borderColor: "rgba(212,175,55,0.30)",
    borderRadius: 9999,
    padding: 10,
  },
  logoImage: {
    width: 140,
    height: 140,
  },

  /* Brand */
  brandName: {
    fontSize: 42,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: 6,
    marginBottom: spacing.xs,
    textShadowColor: "rgba(212,175,55,0.25)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: 12,
    color: colors.gold.muted,
    letterSpacing: 3,
    fontWeight: "500",
    marginBottom: spacing.xxl,
  },

  /* Divider */
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: spacing.md,
  },
  dividerSegment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  dividerLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: "rgba(212,175,55,0.25)",
  },
  dividerDot: {
    width: 5,
    height: 5,
    borderRadius: 1,
    backgroundColor: colors.gold.primary,
    opacity: 0.4,
    transform: [{ rotate: "45deg" }],
  },
  dividerText: {
    ...typography.label,
    color: colors.gold.primary,
    marginHorizontal: spacing.md,
    fontSize: 13,
  },
  disclaimer: {
    ...typography.bodySmall,
    color: colors.text.dim,
    textAlign: "center",
    marginBottom: spacing.xl,
  },

  /* Buttons */
  buttonsContainer: {
    width: "100%",
    gap: spacing.md,
  },
  yesButton: {
    width: "100%",
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
  },
  yesButtonShadow: {
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  yesGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 30,
  },
  yesButtonText: {
    ...typography.button,
    color: colors.text.primary,
  },
  noButton: {
    width: "100%",
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.40)",
    backgroundColor: colors.transparent,
    justifyContent: "center",
    alignItems: "center",
  },
  noButtonText: {
    ...typography.button,
    color: colors.gold.primary,
  },

  /* Footer */
  legalText: {
    ...typography.caption,
    color: "rgba(107,95,68,0.6)",
    marginTop: spacing.xxl,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  footerText: {
    ...typography.caption,
    color: colors.text.dim,
    marginTop: spacing.sm,
    textAlign: "center",
    letterSpacing: 1,
  },
});
