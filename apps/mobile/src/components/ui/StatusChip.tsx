/**
 * StatusChip — Themed status pill with icon and label.
 * Uses shared statusConfig for consistent colors across all screens.
 */
import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, borderRadius, typography, opacity } from "../../theme";
import { getStatusConfig } from "../../theme/statusConfig";

interface StatusChipProps {
  status: string;
  size?: "sm" | "md";
  style?: ViewStyle;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  size = "sm",
  style,
}) => {
  const { colors } = useTheme();
  const config = getStatusConfig(status, colors);

  const isMd = size === "md";

  return (
    <View
      style={[
        styles.chip,
        isMd && styles.chipMd,
        { backgroundColor: config.color + (isMd ? "1A" : "15") },
        style,
      ]}
      accessibilityLabel={`Status: ${config.label}`}
      accessibilityRole="text"
    >
      <Ionicons
        name={config.icon as any}
        size={isMd ? 16 : 12}
        color={config.color}
      />
      <Text
        style={[
          isMd ? typography.bodySmall : typography.caption,
          { color: config.color, fontWeight: "600" },
        ]}
        numberOfLines={1}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: "flex-start",
  },
  chipMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
});

export default StatusChip;
