import "react-native-url-polyfill/auto";
import "react-native-gesture-handler";
import React, { useState, useEffect, useCallback } from "react";
import { StatusBar, LogBox } from "react-native";

// Suppress the Expo Go Ionicons namespace warning — the font is pre-bundled
// inside Expo Go and renders correctly; the warning is a false positive caused
// by processFontFamily receiving an unscoped family name before the Expo Go
// session fully registers its scoped alias.
LogBox.ignoreLogs([
  "[Reanimated] Unknown version of Reanimated Babel plugin",
  'fontFamily "ionicons" is not a system font',
  "[NotificationBootstrap]",
  "Non-serializable values were found in the navigation state",
  "VirtualizedLists should never be nested",
]);
// In production the RN dev LogBox is disabled automatically; this is only a
// belt-and-suspenders guard for Expo Go / dev clients so consumer users on
// shared dev builds never see developer plumbing.

import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";
import { Ionicons } from "@expo/vector-icons";
import { AuthProvider } from "./src/contexts/AuthContext";
import { CartProvider } from "./src/contexts/CartContext";
import { OrderProvider } from "./src/contexts/OrderContext";
import { ThemeProvider } from "./src/contexts/ThemeContext";
import AppNavigator from "./src/navigation/AppNavigator";
import AgeGate from "./src/components/AgeGate";
import ThemedStatusBar from "./src/components/ThemedStatusBar";
import ErrorBoundary from "./src/components/ErrorBoundary";
import NotificationBootstrap from "./src/components/NotificationBootstrap";

// Prevent splash screen from hiding until fonts are loaded
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [ageVerified, setAgeVerified] = useState<boolean | null>(null);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Use Ionicons.loadFont() — the canonical API that loads the exact
        // same asset reference the component uses, guaranteeing the font
        // family 'ionicons' is registered before any icon renders.
        await Ionicons.loadFont();
      } catch (e) {
        console.warn("Font loading error:", e);
      }
      // Always set appReady regardless of font outcome so the app never
      // stays on a black/blank screen due to a font loading failure.
      setAppReady(true);
    }
    prepare();
    checkAgeVerification();
  }, []);

  const checkAgeVerification = async () => {
    try {
      const verified = await AsyncStorage.getItem("liqzar-age-verified");
      setAgeVerified(verified === "true");
    } catch {
      setAgeVerified(false);
    }
  };

  const handleAgeVerified = async () => {
    await AsyncStorage.setItem("liqzar-age-verified", "true");
    setAgeVerified(true);
  };

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady || ageVerified === null) {
    return null;
  }

  if (!ageVerified) {
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <ThemeProvider>
            <StatusBar barStyle="light-content" backgroundColor="#050403" />
            <AgeGate onVerified={handleAgeVerified} />
          </ThemeProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <CartProvider>
                <OrderProvider>
                  <ThemedStatusBar />
                  <NotificationBootstrap />
                  <AppNavigator />
                </OrderProvider>
              </CartProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
