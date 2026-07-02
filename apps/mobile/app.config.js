const path = require("path");

// Env sourcing for EXPO_PUBLIC_* vars:
//   - Local dev: loaded from the monorepo root .env.local below. Expo's built-in
//     env loader only looks in the project directory (apps/mobile/), not the
//     monorepo root, so we load it explicitly here.
//   - EAS cloud builds (preview/production): sourced from EAS-hosted environment
//     variables (`eas env:list <profile>`), since .env.local is gitignored and is
//     not uploaded to the build. These point at the self-hosted Supabase backend.
try {
  require("dotenv").config({
    path: path.resolve(__dirname, "../../.env.local"),
    override: false, // don't clobber vars already set in the shell
  });
} catch {
  // dotenv may not be available in all environments; fall through gracefully
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: "Constellation",
    slug: "constellation",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "constellation",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#030712",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.harebrainedapps.constellation",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#030712",
      },
      package: "com.harebrainedapps.constellation",
    },
    plugins: ["expo-router", "expo-secure-store"],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: "b1a84f90-27c7-4e76-aa25-0e674b09300e",
      },
    },
  },
};
