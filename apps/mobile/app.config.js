export default {
  expo: {
    name: "LIQZAR",
    slug: "liqzar",
    owner: "akhanya-it",
    version: "1.0.1",
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
      // Android-specific package name (different from iOS bundleId because
      // com.liqzar.delivery was already claimed on a different Google Play
      // developer account; iOS keeps com.liqzar.delivery on Apple).
      package: "co.za.liqzar.delivery",
      // Firebase config file — required for FCM push notification token
      // registration on Android. Generated in Firebase Console for the
      // 'liqzar' project (package name co.za.liqzar.delivery).
      // Excluded from git via .gitignore; provisioned via EAS build env.
      googleServicesFile: "./google-services.json",
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
      // expo-build-properties: per-platform native build flags. We pin
      // iOS `deploymentTarget` to 15.1 (matches Expo SDK 53 baseline) so
      // pods don't drag stale `IPHONEOS_DEPLOYMENT_TARGET = 9.0 / 11.0`
      // values into Xcode 26 builds — those values were below Xcode 26's
      // supported range (12.0+) and broke local `xcodebuild`. EAS Cloud
      // builds use Xcode 15.x and are unaffected.
      [
        "expo-build-properties",
        {
          ios: {
            // expo-build-properties 56.x rejects values below 16.4 with
            // "needs to be at least version 16.4" — the plugin's hard floor
            // for SDK 53. 15.1 was the earlier RN baseline.
            deploymentTarget: "16.4",
            // newArchEnabled: false skips the Fabric/TurboModules pipeline,
            // which on Apple Silicon avoids the libfmt compile path that
            // breaks under Xcode 26. EAS can flip this true once the
            // upstream RN fix lands.
            newArchEnabled: false,
          },
          android: {
            // Match the SDK 53 default. Keeps the Android build aligned
            // with what EAS expects.
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            minSdkVersion: 24,
            // newArchEnabled: false avoids the prefab/NDK compile that
            // hung gradle indefinitely on Apple Silicon — react-native-
            // reanimated's prefab task deadlocks when two Kotlin compile
            // daemons (1.9 + 2.0) end up running concurrently. Disabling
            // the new architecture skips that path entirely.
            newArchEnabled: false,
            // Bump gradle's heap so kotlinc + JIT don't OOM under
            // concurrent prebuild + r8 + lint.
            extraMavenRepos: [],
          },
        },
      ],
      [
        "expo-font",
        {
          fonts: [
            "./assets/fonts/Ionicons.ttf",
          ],
        },
      ],
      [
        "@rnmapbox/maps",
        {
          // Secret token (sk.*) used during BUILD only to download the Mapbox
          // native SDK from their private registry. Must have downloads:read
          // scope. Stored in EAS env as MAPBOX_DOWNLOAD_TOKEN.
          RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN,
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
      // Public Mapbox access token (pk.*) used at runtime to render maps and
      // call the Directions API. Set in EAS env as MAPBOX_ACCESS_TOKEN.
      mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN,
      // E.164 without the "+". Override via LIQZAR_CONCIERGE_WHATSAPP.
      conciergeWhatsApp:
        process.env.LIQZAR_CONCIERGE_WHATSAPP || "27810001234",
      eas: {
        projectId: "b7cc5924-558a-4153-a11a-3624fd5c4b36",
      },
    },
  },
};
