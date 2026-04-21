import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, borderRadius, spacing, shadows } from "../../theme";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  borderColor?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  borderColor = colors.gold.border,
}) => {
  return (
    <View style={[styles.card, shadows.card, { borderColor }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.gold.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
});

export default GlassCard;
