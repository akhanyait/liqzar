/**
 * SkeletonLoader — Shimmer placeholder for loading states.
 * Supports rectangle, circle, and line shapes.
 * Uses native-driver animation for performance.
 */
import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { borderRadius, spacing, animation } from "../../theme";

type SkeletonShape = "rectangle" | "circle" | "line";

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  shape?: SkeletonShape;
  borderRadiusOverride?: number;
  style?: ViewStyle;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = "100%",
  height = 20,
  shape = "rectangle",
  borderRadiusOverride,
  style,
}) => {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: animation.slow * 2,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: animation.slow * 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const resolvedBorderRadius =
    borderRadiusOverride ??
    (shape === "circle"
      ? typeof height === "number"
        ? height / 2
        : borderRadius.full
      : shape === "line"
        ? borderRadius.sm
        : borderRadius.md);

  const resolvedWidth =
    shape === "circle" ? height : shape === "line" ? width : width;

  return (
    <Animated.View
      style={[
        {
          width: resolvedWidth as any,
          height,
          borderRadius: resolvedBorderRadius,
          backgroundColor: colors.gold.faint,
          opacity,
        },
        style,
      ]}
    />
  );
};

/** Pre-built skeleton layouts for common patterns */

export const SkeletonCard: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[skeletonStyles.card, style]}>
    <SkeletonLoader height={140} shape="rectangle" />
    <View style={skeletonStyles.cardBody}>
      <SkeletonLoader height={14} width="60%" shape="line" />
      <SkeletonLoader height={12} width="40%" shape="line" />
      <SkeletonLoader height={16} width="30%" shape="line" />
    </View>
  </View>
);

export const SkeletonListItem: React.FC<{ style?: ViewStyle }> = ({
  style,
}) => (
  <View style={[skeletonStyles.listItem, style]}>
    <SkeletonLoader height={48} width={48} shape="circle" />
    <View style={skeletonStyles.listItemBody}>
      <SkeletonLoader height={14} width="70%" shape="line" />
      <SkeletonLoader height={12} width="50%" shape="line" />
    </View>
  </View>
);

const skeletonStyles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  cardBody: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  listItemBody: {
    flex: 1,
    gap: spacing.sm,
  },
});

export default SkeletonLoader;
