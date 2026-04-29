export default {
  expo: {
    name: "LIQZAR",
    slug: "liqzar",
    owner: "akhanya-it",
    version: "1.0.0",
    scheme: "liqzar",
    orientation: "portrait",
    userInterfaceStyle: "dark",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#050403",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.liqzar.delivery",
      // iOS uses Apple Maps via react-native-maps (no API key required).
      // Android still uses Google Maps below.
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription:
          "LIQZAR uses the camera to scan product barcodes for quick lookup.",
        NSLocationWhenInUseUsageDescription:
          "LIQZAR needs your location to auto-fill your delivery address and estimate delivery times.",
        NSLocationAlwaysUsageDescription:
          "LIQZAR uses your location to provide accurate delivery estimates.",
        NSFaceIDUsageDescription:
          "Use Face ID for quick, secure sign-in to LIQZAR.",
        NSMicrophoneUsageDescription:
          "LIQZAR uses the microphone for voice search.",
      },
    },
    android: {
      package: "com.liqzar.delivery",
      config: {
        googleMaps: {
          // Secret — set GOOGLE_MAPS_API_KEY in .env / EAS build secrets.
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#050403",
      },
      permissions: [
        "CAMERA",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "VIBRATE",
        "USE_BIOMETRIC",
        "USE_FINGERPRINT",
      ],
    },
    web: {
      bundler: "metro",
    },
    plugins: [
      [
        "expo-font",
        {
          fonts: [
            "./assets/fonts/Ionicons.ttf",
          ],
        },
      ],
      "expo-secure-store",
      [
        "expo-camera",
        {
          cameraPermission:
            "LIQZAR needs camera access to scan product barcodes.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "LIQZAR uses your location for delivery estimates.",
        },
      ],
      "expo-local-authentication",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#D4AF37",
        },
      ],
    ],
    extra: {
      // Supabase credentials — prefer .env / CI env vars.
      // The anon key is a public client key (safe to ship); the secret key must
      // NEVER be placed here. Override via SUPABASE_URL / SUPABASE_ANON_KEY env vars.
      supabaseUrl:
        process.env.SUPABASE_URL || "https://deiewcktyzzeviszukqj.supabase.co",
      supabaseAnonKey:
        process.env.SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlaWV3Y2t0eXp6ZXZpc3p1a3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTc1OTQsImV4cCI6MjA5MTI5MzU5NH0.n5CmlkLXrF-qAtIPNLVurhjf9vWFawFt8T7NEb--qHs",
      apiBaseUrl: process.env.API_BASE_URL || "https://api.liqzar.co.za",
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      // E.164 without the "+". Override via LIQZAR_CONCIERGE_WHATSAPP.
      conciergeWhatsApp:
        process.env.LIQZAR_CONCIERGE_WHATSAPP || "27810001234",
      eas: {
        projectId: "b7cc5924-558a-4153-a11a-3624fd5c4b36",
      },
    },
  },
};
