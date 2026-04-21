import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, typography, spacing } from "../../theme";

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
  subtitle?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  onSeeAll,
  subtitle,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && (
          <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}>
            <Text style={styles.seeAll}>See All &gt;</Text>
          </TouchableOpacity>
        )}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  seeAll: {
    ...typography.bodySmall,
    color: colors.gold.primary,
    fontWeight: "600",
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.gold.muted,
    marginTop: spacing.xs,
  },
});

export default SectionHeader;
