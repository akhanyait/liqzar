/**
 * EmptyState — Shared empty state component with icon, title, subtitle, and optional CTA.
 * Replaces 10+ inline empty state implementations across screens.
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

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = "albums-outline",
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconRingOuter, { borderColor: colors.gold.faint }]}>
        <View
          style={[styles.iconRingInner, { backgroundColor: colors.gold.faint }]}
        >
          <Ionicons name={icon} size={40} color={colors.gold.muted} />
        </View>
      </View>

      <Text
        style={[typography.h4, styles.title, { color: colors.text.primary }]}
      >
        {title}
      </Text>

      {subtitle ? (
        <Text
          style={[
            typography.bodySmall,
            styles.subtitle,
            { color: colors.text.muted },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          style={[
            styles.actionButton,
            { backgroundColor: colors.gold.primary },
          ]}
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
        >
          <Text style={[typography.button, { color: colors.text.inverse }]}>
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
  subtitle: {
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  actionButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
  },
});

export default EmptyState;
