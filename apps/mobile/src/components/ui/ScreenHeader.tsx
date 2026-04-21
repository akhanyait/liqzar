/**
 * ScreenHeader — Safe-area-aware header with back button, title, and optional right actions.
 * Replaces the 30+ inline header implementations across screens.
 */
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, typography, hitSlop, touchTarget } from "../../theme";

export interface HeaderAction {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: number;
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightActions?: HeaderAction[];
  style?: ViewStyle;
  transparent?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  showBack = true,
  rightActions = [],
  style,
  transparent = false,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors, gradients } = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const content = (
    <View
      style={[styles.container, { paddingTop: insets.top + spacing.sm }, style]}
    >
      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backButton, { backgroundColor: colors.gold.faint }]}
            hitSlop={hitSlop}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={colors.gold.primary}
            />
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        <View style={styles.titleContainer}>
          <Text
            style={[typography.h3, { color: colors.text.primary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                typography.caption,
                { color: colors.text.muted, marginTop: 2 },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionsContainer}>
          {rightActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              onPress={action.onPress}
              style={[
                styles.actionButton,
                { backgroundColor: colors.gold.faint },
              ]}
              hitSlop={hitSlop}
              accessibilityLabel={action.accessibilityLabel}
              accessibilityRole="button"
            >
              <Ionicons
                name={action.icon}
                size={20}
                color={colors.gold.primary}
              />
              {action.badge !== undefined && action.badge > 0 ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: colors.status.error },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {action.badge > 99 ? "99+" : action.badge}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  if (transparent) {
    return content;
  }

  return (
    <LinearGradient colors={[...gradients.header]} style={styles.gradient}>
      {content}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(212,175,55,0.1)",
  },
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: touchTarget.minHeight,
  },
  backButton: {
    width: touchTarget.minWidth,
    height: touchTarget.minHeight,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  backPlaceholder: {
    width: touchTarget.minWidth,
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionButton: {
    width: touchTarget.minWidth,
    height: touchTarget.minHeight,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});

export default ScreenHeader;
