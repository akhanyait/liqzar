import React from "react";
import { Text, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

/**
 * Tiny gold letter-spaced LIQZAR wordmark — drop above any screen title to
 * give every page a quiet brand anchor without competing with the screen's
 * own heading. Wordmark over logo because logos shrink poorly to micro
 * sizes while letter-spaced caps stay crisp + on-brand.
 *
 * Three sizes:
 *   - "xs" (default): paired with H1 screen titles. Sits as a 10pt tag.
 *   - "sm": paired with section/card titles inside scrollviews.
 *   - "md": for empty/loading states where the brand should breathe more.
 *
 * Wrap optional accent prop for non-gold (e.g. a warning screen could use
 * status.warning) — defaults to gold.primary.
 */
export type BrandMarkSize = "xs" | "sm" | "md";

interface Props {
  size?: BrandMarkSize;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZES: Record<BrandMarkSize, { fontSize: number; letterSpacing: number; marginBottom: number }> = {
  xs: { fontSize: 9, letterSpacing: 2.4, marginBottom: 4 },
  sm: { fontSize: 10, letterSpacing: 2.6, marginBottom: 6 },
  md: { fontSize: 12, letterSpacing: 3.0, marginBottom: 8 },
};

export default function BrandMark({ size = "xs", accentColor, style }: Props) {
  const { colors } = useTheme();
  const cfg = SIZES[size];
  const color = accentColor ?? colors.gold.primary;
  return (
    <View style={[s.wrap, { marginBottom: cfg.marginBottom }, style]}>
      <Text
        style={[
          s.text,
          { color, fontSize: cfg.fontSize, letterSpacing: cfg.letterSpacing },
        ]}
        accessibilityRole="header"
        accessibilityLabel="LIQZAR"
      >
        LIQZAR
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "900",
    // Slight uppercase emphasis via the actual text — TextTransform also
    // works but explicit caps is more reliable across font fallbacks.
    textTransform: "uppercase",
  },
});
