import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from "react-native";
import { colors, typography, spacing, borderRadius } from "../../theme";

interface PremiumInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const PremiumInput: React.FC<PremiumInputProps> = ({
  label,
  error,
  containerStyle,
  style,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.status.error
    : focused
      ? colors.gold.primary
      : colors.gold.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TextInput
        style={[styles.input, { borderColor }, style]}
        placeholderTextColor={colors.text.dim}
        selectionColor={colors.gold.primary}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        {...rest}
      />

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.gold.muted,
    marginBottom: spacing.xs,
    fontWeight: "600",
  },
  input: {
    height: 52,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.gold.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text.primary,
  },
  error: {
    ...typography.caption,
    color: colors.status.error,
    marginTop: spacing.xs,
  },
});

export default PremiumInput;
