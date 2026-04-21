import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ThemeMode,
  ThemeColors,
  ThemeGradients,
  ThemeShadows,
  getColors,
  getGradients,
  getShadows,
} from "../theme";

interface ThemeContextType {
  mode: ThemeMode;
  colors: ThemeColors;
  gradients: ThemeGradients;
  shadows: ThemeShadows;
  isDark: boolean;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = "liqzar-theme-mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") {
        setModeState(saved);
      }
      setLoaded(true);
    });
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_KEY, newMode);
  };

  const toggleTheme = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  const value: ThemeContextType = {
    mode,
    colors: getColors(mode),
    gradients: getGradients(mode),
    shadows: getShadows(mode),
    isDark: mode === "dark",
    toggleTheme,
    setMode,
  };

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
