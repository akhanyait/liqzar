/**
 * Badge — Small count or dot badge for notification counts, cart items, etc.
 */
import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface BadgeProps {
  count?: number;
  dot?: boolean;
  color?: string;
  style?: ViewStyle;
  maxCount?: number;
}

export const Badge: React.FC<BadgeProps> = ({
  count,
  dot = false,
  color,
  style,
  maxCount = 99,
}) => {
  const { colors } = useTheme();
  const bgColor = color || colors.status.error;

  if (dot) {
    return (
      <View
        style={[styles.dot, { backgroundColor: bgColor }, style]}
        accessibilityLabel="New"
        accessibilityRole="text"
      />
    );
  }

  if (count === undefined || count <= 0) return null;

  const displayText = count > maxCount ? `${maxCount}+` : `${count}`;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bgColor },
        count > 9 && styles.badgeWide,
        style,
      ]}
      accessibilityLabel={`${count} items`}
      accessibilityRole="text"
    >
      <Text style={styles.text}>{displayText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeWide: {
    paddingHorizontal: 6,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
});

export default Badge;
