import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../../theme";

interface LoadingSpinnerProps {
  size?: "small" | "large";
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "large",
  message,
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={colors.gold.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.primary,
  },
  message: {
    ...typography.bodySmall,
    color: colors.gold.muted,
    marginTop: spacing.md,
    textAlign: "center",
  },
});

export default LoadingSpinner;
