/**
 * Responsive layout utilities for cross-platform adaptation.
 * Provides hooks for breakpoint detection, adaptive column counts,
 * and max-width constraints on tablets/large screens.
 */
import { useWindowDimensions } from "react-native";

export type Breakpoint = "compact" | "medium" | "expanded";

const BREAKPOINTS = {
  medium: 600,
  expanded: 900,
} as const;

/**
 * Returns the current responsive breakpoint based on window width.
 * - compact: phones (<600px)
 * - medium: large phones landscape, small tablets (600-900px)
 * - expanded: tablets, desktop (>900px)
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= BREAKPOINTS.expanded) return "expanded";
  if (width >= BREAKPOINTS.medium) return "medium";
  return "compact";
}

/**
 * Returns a value based on the current breakpoint.
 * Unspecified breakpoints fall back to the next smaller one.
 *
 * @example
 * const columns = useResponsiveValue({ compact: 2, medium: 3, expanded: 4 });
 */
export function useResponsiveValue<T>(values: {
  compact: T;
  medium?: T;
  expanded?: T;
}): T {
  const breakpoint = useBreakpoint();
  if (breakpoint === "expanded") {
    return values.expanded ?? values.medium ?? values.compact;
  }
  if (breakpoint === "medium") {
    return values.medium ?? values.compact;
  }
  return values.compact;
}

/**
 * Returns the number of grid columns for the current breakpoint.
 *
 * @example
 * const numColumns = useColumns(2, 3, 4); // 2 on phone, 3 on medium, 4 on expanded
 */
export function useColumns(
  compact: number,
  medium?: number,
  expanded?: number,
): number {
  return useResponsiveValue({
    compact,
    medium: medium ?? compact,
    expanded: expanded ?? medium ?? compact,
  });
}

/**
 * Returns a maxWidth and centering style for constraining layouts on wide screens.
 * On phones (compact), returns undefined so the layout fills the width.
 *
 * @example
 * const containerStyle = useMaxWidth(600);
 * <View style={[styles.container, containerStyle]}>
 */
export function useMaxWidth(
  maxWidth: number = 600,
): { maxWidth: number; alignSelf: "center"; width: "100%" } | undefined {
  const { width } = useWindowDimensions();
  if (width > maxWidth) {
    return { maxWidth, alignSelf: "center", width: "100%" };
  }
  return undefined;
}
