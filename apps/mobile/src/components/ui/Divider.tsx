/**
 * Divider — Themed horizontal or vertical separator.
 */
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing } from "../../theme";

interface DividerProps {
  direction?: "horizontal" | "vertical";
  spacing?: number;
  style?: ViewStyle;
}

export const Divider: React.FC<DividerProps> = ({
  direction = "horizontal",
  spacing: dividerSpacing = spacing.md,
  style,
}) => {
  const { colors } = useTheme();

  if (direction === "vertical") {
    return (
      <View
        style={[
          styles.vertical,
          {
            backgroundColor: colors.border,
            marginHorizontal: dividerSpacing,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.horizontal,
        {
          backgroundColor: colors.border,
          marginVertical: dividerSpacing,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  horizontal: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  vertical: {
    width: StyleSheet.hairlineWidth,
    height: "100%",
  },
});

export default Divider;
