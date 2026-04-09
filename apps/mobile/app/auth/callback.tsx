import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@constellation/api";

/**
 * Deep-link callback handler for Google OAuth on mobile.
 *
 * Expo Router matches `constellation://auth/callback?code=...` to this screen.
 * When using expo-web-browser's openAuthSessionAsync, the browser handles the
 * redirect before this screen is reached — the code exchange happens in
 * useGoogleAuth. This screen is a fallback for cases where the system browser
 * (not in-app) handles the redirect.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    if (!code) {
      router.replace("/");
      return;
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          console.error("Auth callback error:", error.message);
        }
        router.replace("/");
      });
  }, [code, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366f1" />
      <Text style={styles.text}>Signing in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#030712",
  },
  text: {
    color: "#9ca3af",
    fontSize: 16,
  },
});
