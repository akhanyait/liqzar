import React, { useEffect, useRef, useState } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  Animated,
  Easing,
  LayoutChangeEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, typography, shadows } from "../../theme";

type ButtonVariant = "primary" | "secondary" | "outline";

interface GoldGradientButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: ButtonVariant;
}

export const GoldGradientButton: React.FC<GoldGradientButtonProps> = ({
  title,
  onPress,
  loading = false,
  disabled = false,
  style,
  variant = "primary",
}) => {
  const isDisabled = disabled || loading;
  const shimmer = useRef(new Animated.Value(0)).current;
  const [btnWidth, setBtnWidth] = useState(0);

  useEffect(() => {
    if (variant !== "primary" || isDisabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2600),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer, variant, isDisabled]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== btnWidth) setBtnWidth(w);
  };

  if (variant === "primary") {
    const translateX = shimmer.interpolate({
      inputRange: [0, 1],
      outputRange: [-btnWidth * 0.6, btnWidth * 1.1],
    });
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        onLayout={handleLayout}
        style={[
          styles.wrapper,
          shadows.gold,
          isDisabled && styles.disabledWrapper,
          style,
        ]}
      >
        <LinearGradient
          colors={[...gradients.gold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {btnWidth > 0 && !isDisabled && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shimmerTrack,
                {
                  width: btnWidth * 0.45,
                  transform: [{ translateX }, { skewX: "-18deg" }],
                },
              ]}
            >
              <LinearGradient
                colors={[
                  "rgba(255,255,255,0)",
                  "rgba(255,240,200,0.55)",
                  "rgba(255,255,255,0)",
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}
          {loading ? (
            <ActivityIndicator color={colors.text.inverse} size="small" />
          ) : (
            <Text
              style={[styles.primaryText, isDisabled && styles.disabledText]}
            >
              {title}
            </Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === "secondary") {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[
          styles.wrapper,
          styles.secondaryButton,
          isDisabled && styles.disabledWrapper,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.gold.primary} size="small" />
        ) : (
          <Text
            style={[styles.secondaryText, isDisabled && styles.disabledText]}
          >
            {title}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  // outline
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.wrapper,
        styles.outlineButton,
        isDisabled && styles.disabledWrapper,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.gold.primary} size="small" />
      ) : (
        <Text style={[styles.outlineText, isDisabled && styles.disabledText]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  gradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 28,
    overflow: "hidden",
  },
  shimmerTrack: {
    position: "absolute",
    top: -20,
    bottom: -20,
    left: 0,
  },
  primaryText: {
    ...typography.button,
    color: colors.text.inverse,
  },
  secondaryButton: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.gold.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryText: {
    ...typography.button,
    color: colors.gold.primary,
  },
  outlineButton: {
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.gold.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  outlineText: {
    ...typography.button,
    color: colors.gold.primary,
  },
  disabledWrapper: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },
});

export default GoldGradientButton;
