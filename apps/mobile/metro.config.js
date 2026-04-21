// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Get the workspace root (two levels up from apps/mobile)
const workspaceRoot = path.resolve(__dirname, "../..");
const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Prevent duplicate React / RN / Expo module resolution.
// When the same package exists in BOTH mobile and root node_modules,
// Metro can load both copies, causing "Invalid hook call" (two Reacts)
// or "Tried to register two views" (two expo-blur copies).
// Force these critical packages to always resolve from mobile's node_modules.
const mobileModules = path.resolve(projectRoot, "node_modules");
const criticalPackages = [
  "react",
  "react-native",
  "react-refresh",
  "expo",
  "expo-modules-core",
  "expo-blur",
  "expo-font",
  "expo-constants",
  "expo-asset",
  "expo-file-system",
  "expo-keep-awake",
  "@expo/vector-icons",
];
config.resolver.extraNodeModules = criticalPackages.reduce((acc, pkg) => {
  acc[pkg] = path.resolve(mobileModules, pkg);
  return acc;
}, {});

// extraNodeModules covers direct project imports but NOT transitive imports
// inside node_modules/ (e.g. @react-navigation importing react). The root has
// react@18.3.1, mobile has react@18.2.0 — two instances cause the Hermes
// "Cannot read property 'useContext' of null" crash.
// Intercept ONLY the react entry points (not react-native, which has no root
// duplicate and benefits from Expo's own platform resolution).
const reactEntries = new Set([
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
]);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (reactEntries.has(moduleName)) {
    try {
      return {
        filePath: require.resolve(moduleName, { paths: [projectRoot] }),
        type: "sourceFile",
      };
    } catch {
      // mobile doesn't have this entry; fall through to default resolution
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
