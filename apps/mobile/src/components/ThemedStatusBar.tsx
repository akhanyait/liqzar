import React from "react";
import { StatusBar } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export default function ThemedStatusBar() {
  const { isDark, colors } = useTheme();
  return (
    <StatusBar
      barStyle={isDark ? "light-content" : "dark-content"}
      backgroundColor={colors.header.bg}
    />
  );
}
