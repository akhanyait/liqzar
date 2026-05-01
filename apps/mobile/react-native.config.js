module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ["./assets/fonts"],
  dependencies: {
    // Override the `expo` package's Android autolinking config. Without this,
    // RN autolinking falls back to deriving the import path from build.gradle's
    // namespace (`expo.core`) which is WRONG — the actual class lives at
    // `expo.modules.ExpoModulesPackage`. Setting `null` for `android` would
    // disable autolinking entirely, but that breaks the runtime registration
    // of all Expo modules. So we override packageImportPath explicitly.
    expo: {
      platforms: {
        android: {
          packageImportPath: "import expo.modules.ExpoModulesPackage;",
          packageInstance: "new ExpoModulesPackage()",
        },
      },
    },
  },
};
