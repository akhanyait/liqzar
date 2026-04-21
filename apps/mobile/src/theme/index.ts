import { Platform, TextStyle } from "react-native";

export type ThemeMode = "dark" | "light";

export interface ThemeColors {
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    card: string;
    elevated: string;
  };
  gold: {
    primary: string;
    light: string;
    muted: string;
    dark: string;
    faint: string;
    border: string;
    glow: string;
  };
  header: {
    bg: string;
    fg: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    dim: string;
    inverse: string;
  };
  status: {
    success: string;
    error: string;
    warning: string;
    info: string;
  };
  border: string;
  overlay: string;
  transparent: string;
  white: string;
  black: string;
}

export interface ThemeGradients {
  gold: readonly [string, string, string];
  goldShimmer: readonly [string, string, string];
  background: readonly [string, string, string];
  backgroundReverse: readonly [string, string, string];
  card: readonly [string, string];
  header: readonly [string, string];
  darkOverlay: readonly [string, string];
}

export interface ThemeShadows {
  gold: object;
  goldSubtle: object;
  dark: object;
  card: object;
}

// ─── Dark Mode (Premium) ─────────────────────────────────
export const darkColors: ThemeColors = {
  background: {
    primary: "#050403",
    secondary: "#0d0b08",
    tertiary: "#1a1510",
    card: "#1c1810",
    elevated: "#231e14",
  },
  gold: {
    primary: "#D4AF37",
    light: "#F5E6A3",
    muted: "#9A8860",
    dark: "#8B7A3E",
    faint: "rgba(212,175,55,0.08)",
    border: "rgba(212,175,55,0.15)",
    glow: "rgba(212,175,55,0.25)",
  },
  header: {
    bg: "#1e2028",
    fg: "#F5F0E8",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#F5E6A3",
    muted: "#9A8860",
    dim: "#6B5F44",
    inverse: "#050403",
  },
  status: {
    success: "#10B981",
    error: "#EF4444",
    warning: "#F59E0B",
    info: "#3B82F6",
  },
  border: "rgba(212,175,55,0.15)",
  overlay: "rgba(5,4,3,0.7)",
  transparent: "transparent",
  white: "#FFFFFF",
  black: "#000000",
};

export const darkGradients: ThemeGradients = {
  gold: ["#D4AF37", "#B8962E", "#D4AF37"] as const,
  goldShimmer: ["#D4AF37", "#F5E6A3", "#D4AF37"] as const,
  background: ["#1a1510", "#0d0b08", "#050403"] as const,
  backgroundReverse: ["#050403", "#0d0b08", "#1a1510"] as const,
  card: ["#1c1810", "#0f0d09"] as const,
  header: ["#1e2028", "#161820"] as const,
  darkOverlay: ["rgba(5,4,3,0)", "rgba(5,4,3,0.9)"] as const,
};

export const darkShadows: ThemeShadows = {
  gold: {
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  goldSubtle: {
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  dark: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
};

// ─── Light Mode (Elegant) ────────────────────────────────
export const lightColors: ThemeColors = {
  background: {
    primary: "#FAFAF8",
    secondary: "#F5F3EF",
    tertiary: "#EDEAE4",
    card: "#FFFFFF",
    elevated: "#FFFFFF",
  },
  gold: {
    primary: "#B8962E",
    light: "#D4AF37",
    muted: "#8B7A3E",
    dark: "#6B5F32",
    faint: "rgba(184,150,46,0.06)",
    border: "rgba(184,150,46,0.18)",
    glow: "rgba(184,150,46,0.15)",
  },
  header: {
    bg: "#FFFFFF",
    fg: "#1a1510",
  },
  text: {
    primary: "#1a1510",
    secondary: "#8B7A3E",
    muted: "#8B7A3E",
    dim: "#B5A88A",
    inverse: "#FFFFFF",
  },
  status: {
    success: "#059669",
    error: "#DC2626",
    warning: "#D97706",
    info: "#2563EB",
  },
  border: "rgba(26,21,16,0.1)",
  overlay: "rgba(26,21,16,0.4)",
  transparent: "transparent",
  white: "#FFFFFF",
  black: "#000000",
};

export const lightGradients: ThemeGradients = {
  gold: ["#D4AF37", "#B8962E", "#D4AF37"] as const,
  goldShimmer: ["#D4AF37", "#F5E6A3", "#D4AF37"] as const,
  background: ["#F5F3EF", "#FAFAF8", "#FFFFFF"] as const,
  backgroundReverse: ["#FFFFFF", "#FAFAF8", "#F5F3EF"] as const,
  card: ["#FFFFFF", "#F9F8F5"] as const,
  header: ["#FFFFFF", "#FAFAF8"] as const,
  darkOverlay: ["rgba(255,255,255,0)", "rgba(255,255,255,0.95)"] as const,
};

export const lightShadows: ThemeShadows = {
  gold: {
    shadowColor: "#B8962E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  goldSubtle: {
    shadowColor: "#B8962E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dark: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
};

// ─── Theme Getters ────────────────────────────────────────
export function getColors(mode: ThemeMode): ThemeColors {
  return mode === "dark" ? darkColors : lightColors;
}

export function getGradients(mode: ThemeMode): ThemeGradients {
  return mode === "dark" ? darkGradients : lightGradients;
}

export function getShadows(mode: ThemeMode): ThemeShadows {
  return mode === "dark" ? darkShadows : lightShadows;
}

// ─── Default exports (dark, for backward compat) ─────────
export const colors = darkColors;
export const gradients = darkGradients;
export const shadows = darkShadows;

// ─── Shared (mode-independent) ────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const fonts = {
  regular: Platform.select({ ios: "System", android: "Roboto" }) as string,
  medium: Platform.select({ ios: "System", android: "Roboto" }) as string,
  semiBold: Platform.select({ ios: "System", android: "Roboto" }) as string,
  bold: Platform.select({ ios: "System", android: "Roboto" }) as string,
};

export const typography: Record<string, TextStyle> = {
  h1: { fontSize: 32, fontWeight: "700", letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: "700", letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: "600" },
  h4: { fontSize: 18, fontWeight: "600" },
  body: { fontSize: 16, fontWeight: "400" },
  bodySmall: { fontSize: 14, fontWeight: "400" },
  caption: { fontSize: 12, fontWeight: "400" },
  label: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  button: { fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
};

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

// ─── Extended Tokens (v3.1 UI Modernization) ─────────────
export const iconSize = {
  sm: 18,
  md: 24,
  lg: 32,
};

export const opacity = {
  disabled: 0.5,
  muted: 0.6,
  subtle: 0.08,
  light: 0.15,
  medium: 0.25,
};

export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
};

export const touchTarget = {
  minHeight: 44,
  minWidth: 44,
};
