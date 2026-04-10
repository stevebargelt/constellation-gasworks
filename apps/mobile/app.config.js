const path = require("path");

// Load .env.local from the monorepo root so EXPO_PUBLIC_* vars are available
// when this config is evaluated. Expo's built-in env loader only looks in the
// project directory (apps/mobile/), not the monorepo root.
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
      bundleIdentifier: "com.constellation.app",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#030712",
      },
      package: "com.constellation.app",
    },
    plugins: ["expo-router", "expo-secure-store"],
    experiments: {
      typedRoutes: true,
    },
  },
};
