/**
 * ErrorState — Shared error state with icon, title, message, and retry CTA.
 * Mirrors the web `ErrorState` component API for cross-platform consistency.
 */
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, typography, borderRadius } from "../../theme";

interface ErrorStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  message?: string;
  actionLabel?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  icon = "alert-circle-outline",
  title = "Something went wrong",
  message = "We couldn't load this just now. Please try again in a moment.",
  actionLabel = "Try again",
  onRetry,
  style,
}) => {
  const { colors } = useTheme();
  const errorTint = colors.status.error;

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.iconRingOuter,
          { borderColor: `${errorTint}40` },
        ]}
      >
        <View
          style={[
            styles.iconRingInner,
            { backgroundColor: `${errorTint}22` },
          ]}
        >
          <Ionicons name={icon} size={40} color={errorTint} />
        </View>
      </View>

      <Text
        style={[typography.h4, styles.title, { color: colors.text.primary }]}
      >
        {title}
      </Text>

      {message ? (
        <Text
          style={[
            typography.bodySmall,
            styles.message,
            { color: colors.text.muted },
          ]}
        >
          {message}
        </Text>
      ) : null}

      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.85}
          style={[
            styles.retryButton,
            {
              backgroundColor: colors.background.secondary,
              borderColor: colors.gold.primary,
            },
          ]}
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
        >
          <Ionicons
            name="refresh"
            size={16}
            color={colors.gold.primary}
            style={styles.retryIcon}
          />
          <Text style={[typography.button, { color: colors.gold.primary }]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconRingOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  iconRingInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  message: {
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: spacing.lg,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  retryIcon: {
    marginRight: spacing.xs,
  },
});

export default ErrorState;
