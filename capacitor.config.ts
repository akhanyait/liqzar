import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.liqzar.app",
  appName: "LIQZAR",
  webDir: "dist",
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#FAFAF9",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1F2328",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
  ios: {
    backgroundColor: "#FAFAF9",
    contentInset: "automatic",
    scrollEnabled: true,
    allowsLinkPreview: false,
    webContentsDebuggingEnabled: true,
  },
  server: {
    iosScheme: "capacitor",
    allowNavigation: [
      "api.mapbox.com",
      "*.mapbox.com",
      "*.tiles.mapbox.com",
      "events.mapbox.com",
    ],
  },
};

export default config;
